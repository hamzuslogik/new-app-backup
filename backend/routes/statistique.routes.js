const express = require('express');
const router = express.Router();
const { authenticate, checkPermission, isAdminOrBackofficeOrRPConfirmation } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// Dates en heure locale : 1er du mois / aujourd'hui (évite UTC qui peut donner le 31 du mois précédent)
function getFirstOfMonthLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
function getTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
/** Mois précédent pour comparaison : du 1er jusqu'au même jour que la fin de période (aujourd'hui si mois en cours). */
function getPreviousMonthComparisonRange(periodStartStr, periodEndStr) {
  const todayStr = getTodayLocal();
  const isCurrentMonth = periodStartStr.slice(0, 7) === todayStr.slice(0, 7);
  const endRef = new Date(`${(isCurrentMonth ? todayStr : periodEndStr)}T12:00:00`);
  const start = new Date(`${periodStartStr}T12:00:00`);
  const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const lastDayPrev = new Date(endRef.getFullYear(), endRef.getMonth(), 0).getDate();
  const previousEnd = new Date(
    endRef.getFullYear(),
    endRef.getMonth() - 1,
    Math.min(endRef.getDate(), lastDayPrev)
  );
  return {
    previousStart: formatDateLocal(previousStart),
    previousEnd: formatDateLocal(previousEnd),
  };
}
/** Fin de période « mois » : aujourd'hui si le mois sélectionné est le mois en cours. */
function capMonthEndToToday(monthParam, monthEnd) {
  const todayStr = getTodayLocal();
  if (monthParam && monthParam === todayStr.slice(0, 7)) {
    return todayStr;
  }
  if (!monthParam) {
    return todayStr;
  }
  return monthEnd;
}

function resolveKpiDateChamp(queryDateChamp) {
  return queryDateChamp === 'date_rdv_time' ? 'f.date_rdv_time' : 'f.date_insert_time';
}

function resolveKpiDateRangeFromQuery(req) {
  const { date_debut, date_fin, time_debut, time_fin } = req.query || {};
  const todayStr = getTodayLocal();
  let start =
    typeof date_debut === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date_debut)
      ? date_debut
      : getFirstOfMonthLocal();
  let end =
    typeof date_fin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date_fin) ? date_fin : todayStr;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const timeDebut =
    time_debut && /^\d{2}:\d{2}/.test(String(time_debut)) ? String(time_debut).slice(0, 8) : '00:00:00';
  const timeFin =
    time_fin && /^\d{2}:\d{2}/.test(String(time_fin)) ? String(time_fin).slice(0, 8) : '23:59:59';
  return {
    start,
    end,
    timeDebut,
    timeFin,
    startDateTime: `${start} ${timeDebut}`,
    endDateTime: `${end} ${timeFin}`,
    dateChamp: resolveKpiDateChamp(req.query?.date_champ),
    dateChampKey: req.query?.date_champ === 'date_rdv_time' ? 'date_rdv_time' : 'date_insert_time',
  };
}

/** Période précédente de même durée (fin = veille du début actuel). */
function getPreviousPeriodComparisonRange(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T12:00:00`);
  const end = new Date(`${endDateStr}T12:00:00`);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const dayCount = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (dayCount - 1));
  return {
    previousStart: formatDateLocal(previousStart),
    previousEnd: formatDateLocal(previousEnd),
  };
}

/** Filtre date fiches confirmées (état 7) selon champ KPI. */
function buildKpiConfirmationEtat7DateClause(dateChampKey) {
  if (dateChampKey === 'date_rdv_time') {
    return {
      sql: 'AND f.date_rdv_time >= ? AND f.date_rdv_time <= ?',
      params: (startDateTime, endDateTime) => [startDateTime, endDateTime],
    };
  }
  return {
    sql: `AND (
      (f.date_confirmation IS NOT NULL AND f.date_confirmation >= ? AND f.date_confirmation <= ?)
      OR (f.date_confirmation IS NULL AND f.date_modif_time >= ? AND f.date_modif_time <= ?)
    )`,
    params: (startDateTime, endDateTime, startTs, endTs) => [
      startTs,
      endTs,
      startDateTime,
      endDateTime,
    ],
  };
}

/** Filtre date comptes rendus approuvés (RDV visités) selon champ KPI. */
function buildKpiCompteRenduDateClause(dateChampKey) {
  if (dateChampKey === 'date_rdv_time') {
    return {
      sql: 'AND f.date_rdv_time >= ? AND f.date_rdv_time <= ?',
      params: (startDateTime, endDateTime) => [startDateTime, endDateTime],
    };
  }
  return {
    sql: `AND COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) >= ?
      AND COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) <= ?`,
    params: (startDateTime, endDateTime) => [startDateTime, endDateTime],
  };
}

const KPI_CONFIRMATION_SIGNED_ETATS = [13, 16, 38, 44, 45];

/** Fiche appelée et qualifiée : présence d'une ligne fiches_histo avec état groupe 0. */
const KPI_FICHES_QUALIFIEES_HISTO_SQL = `
  AND EXISTS (
    SELECT 1 FROM fiches_histo fh
    INNER JOIN etats e ON e.id = fh.id_etat
    WHERE fh.id_fiche = f.id
    AND (e.groupe = '0' OR e.groupe = 0)
  )
`;

const KPI_FICHE_INSERT_DATE_SQL = 'AND f.date_insert_time >= ? AND f.date_insert_time <= ?';
const KPI_FICHE_RDV_DATE_SQL =
  'AND f.date_rdv_time IS NOT NULL AND f.date_rdv_time != \'\' AND f.date_rdv_time >= ? AND f.date_rdv_time <= ?';
const KPI_CONFIRMATIONS_PERIOD_SQL = 'AND c.date_creation >= ? AND c.date_creation <= ?';
const KPI_FICHES_HISTO_PERIOD_SQL = 'AND fh.date_creation >= ? AND fh.date_creation <= ?';

/** Filtre date_visite sur compte_rendu_pending (repli date_rdv_time fiche si colonne absente). */
async function getKpiCompteRenduDateVisiteFilter() {
  const colRows = await query(`
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'compte_rendu_pending'
      AND COLUMN_NAME = 'date_visite'
  `).catch(() => []);
  if ((colRows || []).length > 0) {
    return {
      sql: `AND cr.date_visite IS NOT NULL
        AND cr.date_visite != ''
        AND cr.date_visite >= ?
        AND cr.date_visite <= ?`,
    };
  }
  return { sql: KPI_FICHE_RDV_DATE_SQL };
}

function getLastDayOfMonthLocal() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const day = String(last.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Préfixe f. pour filtres appliqués via JOIN fiches (stats commercial). */
function prefixFicheSqlConditions(additionalConditions) {
  if (!additionalConditions) return '';
  return additionalConditions
    .replace(/\bid_centre\b/g, 'f.id_centre')
    .replace(/\bid_confirmateur\b/g, 'f.id_confirmateur')
    .replace(/\bid_commercial\b/g, 'f.id_commercial')
    .replace(/\bid_agent\b/g, 'f.id_agent')
    .replace(/\bproduit\b/g, 'f.produit')
    .replace(/\bko = 1\b/g, 'f.ko = 1');
}

function isEtatGroupe0(etat) {
  const g = etat?.groupe;
  return g === '0' || g === 0;
}

/** Stats commercial : compte_rendu_pending uniquement, filtre date = date modification CR. */
function buildCommercialCrSourceSql(ficheExtraConditions, excludeEtatIds = []) {
  const dateCr = 'COALESCE(cr.date_modif, cr.date_creation, cr.date_approbation)';
  const etatCr = 'CAST(cr.id_etat_final AS CHAR)';
  const baseFiche = '(f.archive = 0 OR f.archive IS NULL) AND f.active = 1 AND (f.ko = 0 OR f.ko IS NULL)';
  const excludeEtatsSql = excludeEtatIds.length
    ? ` AND cr.id_etat_final NOT IN (${excludeEtatIds.map(() => '?').join(',')})`
    : '';

  return `
    SELECT ${etatCr} AS etat_key, cr.id_commercial AS entity_id
    FROM compte_rendu_pending cr
    INNER JOIN fiches f ON f.id = cr.id_fiche
    WHERE ${baseFiche}
      AND cr.id_commercial IS NOT NULL AND cr.id_commercial > 0
      AND cr.id_etat_final IS NOT NULL
      AND ${dateCr} IS NOT NULL
      AND ${dateCr} >= ? AND ${dateCr} <= ?${excludeEtatsSql}${ficheExtraConditions}
  `;
}

function buildCommercialCrParams(dateStart, dateEnd, extraParams) {
  return [dateStart, dateEnd, ...extraParams];
}

// Récupérer les statistiques par type (centre, confirmateur, commercial, agent)
router.get('/all-stat', authenticate, async (req, res) => {
  try {
    const { 
      name_stat,      // CENTRE, CONFIRMATEUR, COMMERCIAL, AGENT, STAT_KO
      type_id,        // id_centre, id_confirmateur, id_commercial, id_agent
      func_id,        // ID de la fonction pour filtrer les utilisateurs
      stat,           // 'net' ou 'taux'
      date_debut, 
      date_fin, 
      date,           // date_appel_time, date_insert_time, date_modif_time
      produit,        // 1 (PAC), 2 (PV), ou vide (les deux)
      ko,             // 1 = fiches KO uniquement (onglet Stat KO)
      id_centre,
      id_confirmateur,
      id_commercial,
      id_agent
    } = req.query;

    // Valeurs par défaut (AGENT = date de saisie / insertion)
    const champ_date = name_stat === 'AGENT'
      ? (date || 'date_insert_time')
      : name_stat === 'COMMERCIAL'
        ? 'date_modif_time'
        : (date || 'date_modif_time');
    const startDate = date_debut || getTodayLocal();
    const endDate = date_fin || getTodayLocal();
    const statType = stat || 'net';

    // Construire les conditions avec paramètres préparés
    const conditions = [];
    const queryParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
    
    if (produit && (produit === '1' || produit === '2')) {
      conditions.push('produit = ?');
      queryParams.push(parseInt(produit));
    }

    if (id_centre) {
      conditions.push('id_centre = ?');
      queryParams.push(parseInt(id_centre));
    }
    if (id_confirmateur) {
      conditions.push('id_confirmateur = ?');
      queryParams.push(parseInt(id_confirmateur));
    }
    if (id_commercial) {
      conditions.push('id_commercial = ?');
      queryParams.push(parseInt(id_commercial));
    }
    if (id_agent) {
      conditions.push('id_agent = ?');
      queryParams.push(parseInt(id_agent));
    }

    // Onglet Stat KO : uniquement les fiches avec ko = 1
    if (ko === '1' || ko === 1) {
      conditions.push('ko = 1');
    }

    const excludeKoFromStats = ['CENTRE', 'CONFIRMATEUR', 'COMMERCIAL'].includes(name_stat);
    const isStatKo = name_stat === 'STAT_KO';
    const hideGroupe0Etats = ['CENTRE', 'CONFIRMATEUR', 'COMMERCIAL', 'STAT_KO'].includes(name_stat);
    const useEtatFinalKey = excludeKoFromStats || isStatKo;
    if (excludeKoFromStats && name_stat !== 'COMMERCIAL') {
      conditions.push('(ko = 0 OR ko IS NULL)');
    }

    const additionalConditions = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    // Récupérer les états avec leurs taux et couleurs
    const etats = await query(
      `SELECT id, titre, abbreviation, color, taux, groupe, ordre
       FROM etats
       ORDER BY ordre ASC`
    );

    // Organiser les états par ID pour faciliter l'accès
    const etatsMap = {};
    const etatsTaux = {};
    const etatsColor = {};
    const KO_STAT_COLUMN_ID = 'ko';
    const KO_STAT_COLOR = '#dc3545';

    etats.forEach(etat => {
      etatsMap[etat.id] = etat.abbreviation || etat.titre;
      etatsColor[etat.id] = etat.color || '#cccccc';
      
      // Mapper les taux : POSITIVE = 1, NEGATIVE = -1, NEUTRE = 0
      switch(etat.taux) {
        case 'POSITIVE':
          etatsTaux[etat.id] = 1;
          break;
        case 'NEGATIVE':
          etatsTaux[etat.id] = -1;
          break;
        case 'NEUTRE':
        default:
          etatsTaux[etat.id] = 0;
          break;
      }
    });

    // Colonne KO : fiches avec ko=1 (pas dans la colonne de leur id_etat_final)
    const koEtatInDb = etats.find(
      (e) => String(e.abbreviation || '').trim().toUpperCase() === 'KO'
    );
    const koColumnKey = koEtatInDb ? koEtatInDb.id : KO_STAT_COLUMN_ID;
    if (!koEtatInDb) {
      etatsTaux[KO_STAT_COLUMN_ID] = -1;
    }
    const etatsWithKo = koEtatInDb
      ? [...etats]
      : [
          ...etats,
          {
            id: KO_STAT_COLUMN_ID,
            titre: 'KO',
            abbreviation: 'KO',
            color: KO_STAT_COLOR,
            taux: 'NEGATIVE',
            ordre: 99999
          }
        ];
    const etatGroupe0Ids = hideGroupe0Etats
      ? etats.filter(isEtatGroupe0).map((e) => e.id)
      : [];
    const etatGroupe0IdSet = new Set(etatGroupe0Ids.map(String));
    const groupe0SqlExtra = etatGroupe0Ids.length
      ? ` AND id_etat_final NOT IN (${etatGroupe0Ids.map(() => '?').join(',')})`
      : '';
    const fichesConditions = additionalConditions + groupe0SqlExtra;
    const fichesQueryParams = groupe0SqlExtra
      ? [...queryParams, ...etatGroupe0Ids]
      : queryParams;

    let baseEtatsForDisplay = excludeKoFromStats
      ? etats.filter((e) => String(e.abbreviation || '').trim().toUpperCase() !== 'KO')
      : isStatKo
        ? etats
        : etatsWithKo;
    const etatsForDisplay = hideGroupe0Etats
      ? baseEtatsForDisplay.filter((e) => !isEtatGroupe0(e))
      : baseEtatsForDisplay;

    // Valider le champ de date pour éviter les injections SQL
    // Note: date_appel_time n'existe pas dans le schéma, on utilise date_appel (bigint) si nécessaire
    const allowedDateFields = ['date_insert_time', 'date_modif_time', 'date_rdv_time'];
    const defaultDateField = name_stat === 'AGENT' ? 'date_insert_time' : 'date_modif_time';
    const safeDateField = allowedDateFields.includes(champ_date) ? champ_date : defaultDateField;
    // Onglet AGENT : toujours filtrer sur la date d'insertion (saisie)
    const dateFieldForQuery = name_stat === 'AGENT'
      ? 'date_insert_time'
      : name_stat === 'COMMERCIAL'
        ? 'date_modif_time'
        : safeDateField;

    // Valider le champ de groupement
    const allowedGroupFields = ['id_centre', 'id_confirmateur', 'id_commercial', 'id_agent'];
    let groupByField = type_id || 'id_centre';
    if (name_stat === 'CENTRE') {
      groupByField = 'id_centre';
    } else if (name_stat === 'STAT_KO') {
      groupByField = 'id_agent';
    } else if (name_stat === 'CONFIRMATEUR') {
      groupByField = 'id_confirmateur';
    } else if (name_stat === 'COMMERCIAL') {
      groupByField = 'id_commercial';
    } else if (name_stat === 'AGENT') {
      groupByField = 'id_agent';
    }
    
    if (!allowedGroupFields.includes(groupByField)) {
      groupByField = 'id_centre';
    }

  const isCommercialStat = name_stat === 'COMMERCIAL';
  const commercialFicheExtra = isCommercialStat
    ? prefixFicheSqlConditions(
        id_commercial
          ? additionalConditions.replace(/\s*AND\s*id_commercial\s*=\s*\?/i, '')
          : additionalConditions
      )
    : additionalConditions;

    // Récupérer le total de fiches pour la période
    let total;
    let stats;

    if (isCommercialStat) {
      const crSql = buildCommercialCrSourceSql(commercialFicheExtra, etatGroupe0Ids);
      const extrasForUnion = [];
      if (produit && (produit === '1' || produit === '2')) extrasForUnion.push(parseInt(produit, 10));
      if (id_centre) extrasForUnion.push(parseInt(id_centre, 10));
      if (id_confirmateur) extrasForUnion.push(parseInt(id_confirmateur, 10));
      if (id_agent) extrasForUnion.push(parseInt(id_agent, 10));

      const crParams = buildCommercialCrParams(
        queryParams[0],
        queryParams[1],
        [...etatGroupe0Ids, ...extrasForUnion]
      );
      const entityFilterSql = id_commercial ? ' AND entity_id = ?' : '';
      const entityFilterParams = id_commercial ? [parseInt(id_commercial, 10)] : [];

      const totalResult = await queryOne(
        `SELECT COUNT(*) AS total
         FROM (${crSql}) commercial_src
         WHERE entity_id IS NOT NULL AND entity_id > 0${entityFilterSql}`,
        [...crParams, ...entityFilterParams]
      );
      total = totalResult?.total || 0;

      stats = await query(
        `SELECT
           etat_key,
           entity_id AS \`${groupByField}\`,
           COUNT(*) AS stats
         FROM (${crSql}) commercial_src
         WHERE entity_id IS NOT NULL AND entity_id > 0${entityFilterSql}
         GROUP BY etat_key, entity_id
         ORDER BY etat_key ASC`,
        [...crParams, ...entityFilterParams]
      );
    } else {
      const totalResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM fiches
       WHERE (archive = 0 OR archive IS NULL) 
       AND active = 1 
       AND \`${dateFieldForQuery}\` >= ? 
       AND \`${dateFieldForQuery}\` <= ?${fichesConditions}`,
      fichesQueryParams
    );
    total = totalResult?.total || 0;

    stats = await query(
      `SELECT
         ${useEtatFinalKey
           ? 'CAST(id_etat_final AS CHAR) AS etat_key'
           : 'CASE WHEN (ko = 1) THEN ? ELSE CAST(id_etat_final AS CHAR) END AS etat_key'},
         \`${groupByField}\`,
         COUNT(*) AS stats
       FROM fiches
       WHERE (archive = 0 OR archive IS NULL)
       AND active = 1
       AND \`${dateFieldForQuery}\` >= ?
       AND \`${dateFieldForQuery}\` <= ?${fichesConditions}
       GROUP BY etat_key, \`${groupByField}\`
       ORDER BY etat_key ASC`,
      useEtatFinalKey ? fichesQueryParams : [String(koColumnKey), ...fichesQueryParams]
    );
    }

    // Organiser les données par utilisateur/centre
    const dataByEntity = {};
    const tauxByEntity = {};

    stats.forEach(stat => {
      const entityId = stat[groupByField];
      if (!entityId) return;

      if (!dataByEntity[entityId]) {
        dataByEntity[entityId] = {};
        tauxByEntity[entityId] = {
          neutre: 0,
          positive: 0,
          negative: 0
        };
      }

      const etatId = stat.etat_key;
      const count = stat.stats;
      if (hideGroupe0Etats && etatGroupe0IdSet.has(String(etatId))) return;

      const taux = etatsTaux[etatId] ?? (String(etatId) === String(koColumnKey) ? -1 : 0);

      // Stocker le nombre par état
      dataByEntity[entityId][etatId] = count;

      // Calculer les totaux par type de taux
      if (taux === 0) {
        tauxByEntity[entityId].neutre += count;
      } else if (taux === 1) {
        tauxByEntity[entityId].positive += count;
      } else if (taux === -1) {
        tauxByEntity[entityId].negative += count;
      }
    });

    // Récupérer les noms des entités (centres, utilisateurs)
    let entitiesMap = {};
    if (name_stat === 'CENTRE') {
      const centres = await query('SELECT id, titre FROM centres');
      centres.forEach(centre => {
        entitiesMap[centre.id] = centre.titre;
      });
    } else if (name_stat === 'STAT_KO') {
      // Stat KO : récupérer les noms des agents (id_agent) y compris inactifs
      const agentIds = Object.keys(dataByEntity).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (agentIds.length > 0) {
        const placeholders = agentIds.map(() => '?').join(',');
        const agents = await query(
          `SELECT id, pseudo FROM utilisateurs WHERE id IN (${placeholders})`,
          agentIds
        );
        agents.forEach(agent => {
          entitiesMap[agent.id] = agent.pseudo || `ID ${agent.id}`;
        });
      }
    } else {
      // Pour les utilisateurs (confirmateur, commercial, agent)
      let fonctionFilter = '';
      if (func_id) {
        fonctionFilter = ` AND fonction = ${parseInt(func_id)}`;
      }
      const users = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE etat > 0${fonctionFilter} ORDER BY pseudo ASC`
      );
      users.forEach(user => {
        entitiesMap[user.id] = user.pseudo;
      });
    }

    // Construire la réponse selon le type de statistique
    const result = {
      name_stat: (name_stat === 'STAT_KO') ? 'AGENT' : name_stat,
      stat_type: statType,
      total: total,
      etats: etatsForDisplay.map(e => ({
        id: e.id,
        abbreviation: e.abbreviation || e.titre,
        color: e.color || (String(e.id) === String(koColumnKey) ? KO_STAT_COLOR : '#cccccc'),
        taux: etatsTaux[e.id] ?? (String(e.id) === String(koColumnKey) ? -1 : 0)
      })),
      data: []
    };

    // Construire les données pour chaque entité
    Object.keys(dataByEntity).forEach(entityId => {
      const entityName = entitiesMap[entityId] || `ID ${entityId}`;
      const entityData = {
        id: entityId,
        name: entityName,
        stats: {},
        totals: {
          neutre: tauxByEntity[entityId].neutre,
          positive: tauxByEntity[entityId].positive,
          negative: tauxByEntity[entityId].negative
        }
      };

      // Ajouter les stats par état
      etatsForDisplay.forEach(etat => {
        entityData.stats[etat.id] = dataByEntity[entityId][etat.id] || 0;
      });

      // Calculer le total et le taux de réussite
      const totalEntity = Object.values(entityData.stats).reduce((sum, val) => sum + val, 0);
      const positive = entityData.totals.positive;
      const negative = entityData.totals.negative;
      const tauxReussite = (positive + negative) > 0 
        ? Math.round((positive * 10000) / (positive + negative)) / 100
        : 0;

      entityData.total = totalEntity;
      entityData.taux_reussite = tauxReussite;

      result.data.push(entityData);
    });

    // Trier par nom
    result.data.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[STAT] /all-stat - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// GET /api/statistiques/fiches-par-centre
// Récupérer les statistiques de fiches par centre et date
// - Administrateurs (fonction 1, 2, 7) : voient toutes les fiches
// - Utilisateurs fonction 9 : voient uniquement les fiches de leurs centres assignés
router.get('/fiches-par-centre', authenticate, checkPermissionCode('statistiques_fiches_view'), async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      date_champ = 'date_modif_time', // date_modif_time ou date_insert_time
      id_centre // Filtre optionnel par centre
    } = req.query;

    // Valeurs par défaut pour les dates (mois en cours : 1er du mois, pas 31 du mois précédent)
    const startDate = date_debut || getFirstOfMonthLocal();
    const endDate = date_fin || getLastDayOfMonthLocal();

    // Déterminer les centres accessibles selon le rôle
    let allowedCentres = null;
    
    if (isAdminOrBackofficeOrRPConfirmation(req.user.fonction)) {
      // Administrateurs, Backoffice et RP Confirmation : voient tous les centres
      allowedCentres = null;
    } else if (req.user.fonction === 9) {
      // Fonction 9 : récupérer les centres assignés depuis utilisateurs_centres
      const userCentres = await query(
        'SELECT id_centre FROM utilisateurs_centres WHERE id_utilisateur = ?',
        [req.user.id]
      );
      
      if (userCentres.length === 0) {
        // Aucun centre assigné, retourner vide
        return res.json({
          success: true,
          data: []
        });
      }
      
      allowedCentres = userCentres.map(uc => uc.id_centre);
    } else {
      // Autres utilisateurs : pas d'accès (déjà vérifié par checkPermissionCode, mais garder pour sécurité)
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs et les utilisateurs de fonction 9 peuvent accéder à cette page.'
      });
    }

    // Déterminer le champ de date à utiliser
    const dateField = date_champ === 'date_modif_time' ? 'f.date_modif_time' : 'f.date_insert_time';
    
    // Construire les conditions
    const conditions = [
      'f.archive = 0',
      `${dateField} >= ?`,
      `${dateField} <= ?`
    ];
    const params = [
      `${startDate} 00:00:00`,
      `${endDate} 23:59:59`
    ];

    // Filtrer par centres si nécessaire
    if (allowedCentres && allowedCentres.length > 0) {
      const placeholders = allowedCentres.map(() => '?').join(',');
      conditions.push(`f.id_centre IN (${placeholders})`);
      params.push(...allowedCentres);
    }

    // Filtre optionnel par centre spécifique
    if (id_centre) {
      const centreId = parseInt(id_centre);
      if (allowedCentres === null || allowedCentres.includes(centreId)) {
        conditions.push('f.id_centre = ?');
        params.push(centreId);
      } else {
        // L'utilisateur n'a pas accès à ce centre
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce centre'
        });
      }
    }

    // Requête pour obtenir les statistiques par centre
    // Utiliser CAST pour convertir datetime en date si DATE() n'est pas supporté
    const stats = await query(
      `SELECT 
        c.id as centre_id,
        c.titre as centre_titre,
        DATE(${dateField}) as date,
        COUNT(*) as nombre_fiches,
        COUNT(DISTINCT f.id_agent) as nombre_agents,
        COUNT(DISTINCT f.id_commercial) as nombre_commerciaux,
        COUNT(DISTINCT f.id_confirmateur) as nombre_confirmateurs,
        SUM(CASE WHEN f.id_etat_final = 7 THEN 1 ELSE 0 END) as fiches_confirmees,
        SUM(CASE WHEN f.id_etat_final IN (13, 16, 38, 44, 45) THEN 1 ELSE 0 END) as fiches_signees,
        SUM(CASE WHEN f.produit = 1 THEN 1 ELSE 0 END) as fiches_pac,
        SUM(CASE WHEN f.produit = 2 THEN 1 ELSE 0 END) as fiches_pv
       FROM fiches f
       LEFT JOIN centres c ON f.id_centre = c.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY c.id, c.titre, DATE(${dateField})
       ORDER BY c.titre ASC, DATE(${dateField}) DESC`,
      params
    );

    // Organiser les données par centre
    const statsByCentre = {};
    stats.forEach(stat => {
      const centreId = stat.centre_id;
      if (!statsByCentre[centreId]) {
        statsByCentre[centreId] = {
          centre_id: centreId,
          centre_titre: stat.centre_titre,
          dates: []
        };
      }
      statsByCentre[centreId].dates.push({
        date: stat.date,
        nombre_fiches: stat.nombre_fiches,
        nombre_agents: stat.nombre_agents,
        nombre_commerciaux: stat.nombre_commerciaux,
        nombre_confirmateurs: stat.nombre_confirmateurs,
        fiches_confirmees: stat.fiches_confirmees,
        fiches_signees: stat.fiches_signees,
        fiches_pac: stat.fiches_pac,
        fiches_pv: stat.fiches_pv
      });
    });

    // Calculer les totaux par centre
    const result = Object.values(statsByCentre).map(centre => {
      const totalFiches = centre.dates.reduce((sum, d) => sum + d.nombre_fiches, 0);
      const totalConfirmees = centre.dates.reduce((sum, d) => sum + d.fiches_confirmees, 0);
      const totalSignees = centre.dates.reduce((sum, d) => sum + d.fiches_signees, 0);
      
      return {
        ...centre,
        total_fiches: totalFiches,
        total_confirmees: totalConfirmees,
        total_signees: totalSignees,
        taux_confirmation: totalFiches > 0 ? ((totalConfirmees / totalFiches) * 100).toFixed(2) : 0,
        taux_signature: totalFiches > 0 ? ((totalSignees / totalFiches) * 100).toFixed(2) : 0
      };
    });

    res.json({
      success: true,
      data: result,
      filters: {
        date_debut: startDate,
        date_fin: endDate,
        date_champ: date_champ
      }
    });
  } catch (error) {
    console.error('[STAT] /fiches-par-centre - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// GET /api/statistiques/fiches-detaillees
// Récupérer les fiches détaillées par centre avec les mêmes filtres
router.get('/fiches-detaillees', authenticate, checkPermissionCode('statistiques_fiches_view'), async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      date_champ = 'date_modif_time',
      id_centre
    } = req.query;

    // Valeurs par défaut pour les dates (mois en cours : 1er du mois, pas 31 du mois précédent)
    const startDate = date_debut || getFirstOfMonthLocal();
    const endDate = date_fin || getLastDayOfMonthLocal();

    // Déterminer les centres accessibles selon le rôle
    let allowedCentres = null;
    
    if (isAdminOrBackofficeOrRPConfirmation(req.user.fonction)) {
      // Administrateurs, Backoffice et RP Confirmation : voient tous les centres
      allowedCentres = null;
    } else if (req.user.fonction === 9) {
      const userCentres = await query(
        'SELECT id_centre FROM utilisateurs_centres WHERE id_utilisateur = ?',
        [req.user.id]
      );
      
      if (userCentres.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      allowedCentres = userCentres.map(uc => uc.id_centre);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé.'
      });
    }

    // Déterminer le champ de date à utiliser
    const dateField = date_champ === 'date_modif_time' ? 'f.date_modif_time' : 'f.date_insert_time';
    
    // Construire les conditions
    const conditions = [
      'f.archive = 0',
      `${dateField} >= ?`,
      `${dateField} <= ?`
    ];
    const params = [
      `${startDate} 00:00:00`,
      `${endDate} 23:59:59`
    ];

    // Filtrer par centres si nécessaire
    if (allowedCentres && allowedCentres.length > 0) {
      const placeholders = allowedCentres.map(() => '?').join(',');
      conditions.push(`f.id_centre IN (${placeholders})`);
      params.push(...allowedCentres);
    }

    // Filtre optionnel par centre spécifique
    if (id_centre) {
      const centreId = parseInt(id_centre);
      if (allowedCentres === null || allowedCentres.includes(centreId)) {
        conditions.push('f.id_centre = ?');
        params.push(centreId);
      } else {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce centre'
        });
      }
    }

    // Récupérer les fiches détaillées
    const fiches = await query(
      `SELECT 
        f.id,
        f.hash,
        f.id_centre,
        f.nom,
        f.prenom,
        f.tel,
        f.gsm1,
        f.cp,
        f.date_insert_time,
        f.date_rdv_time,
        f.id_confirmateur,
        f.id_commercial,
        f.id_etat_final,
        conf.pseudo as confirmateur_nom,
        com.pseudo as commercial_nom,
        e.titre as etat_titre,
        e.color as etat_color
       FROM fiches f
       LEFT JOIN utilisateurs conf ON f.id_confirmateur = conf.id
       LEFT JOIN utilisateurs com ON f.id_commercial = com.id
       LEFT JOIN etats e ON f.id_etat_final = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.id_centre ASC, ${dateField} DESC
       LIMIT 10000`,
      params
    );

    res.json({
      success: true,
      data: fiches,
      filters: {
        date_debut: startDate,
        date_fin: endDate,
        date_champ: date_champ
      }
    });
  } catch (error) {
    console.error('[STAT] /fiches-detaillees - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches',
      error: error.message
    });
  }
});

// GET /api/statistiques/dashboard
// Récupérer les statistiques pour le Dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const todayStart = `${todayStr} 00:00:00`;
    const todayEnd = `${todayStr} 23:59:59`;

    // 1. Nombre de fiches confirmées créées dans la journée (depuis fiches + fiches_histo, pas confirmations)
    const rdvTodayConfirmed = await queryOne(`
      SELECT COUNT(DISTINCT f.id) as count
      FROM fiches f
      INNER JOIN fiches_histo h ON h.id_fiche = f.id AND h.id_etat = 7 AND h.date_creation >= ? AND h.date_creation <= ?
      WHERE f.id_etat_final = 7 AND (f.archive = 0 OR f.archive IS NULL)
    `, [todayStart, todayEnd]);

    // 2. Nombre de signatures enregistrées aujourd'hui (table signature)
    const signaturesToday = await queryOne(`
      SELECT COUNT(*) as count
      FROM signature
      WHERE date_heure >= ? AND date_heure <= ?
    `, [todayStart, todayEnd]);

    // 3. Nombre de RDV à venir (état CONFIRMER = 7) avec date_rdv_time >= aujourd'hui
    const rdvUpcoming = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches
      WHERE id_etat_final = 7
      AND date_rdv_time >= ?
      AND (archive = 0 OR archive IS NULL)
    `, [todayStart]);

    // 4. Liste des confirmateurs actifs avec RDV aujourd'hui (fiches_histo) et à venir (fiches)
    const confirmateursWithRdv = await query(`
      SELECT 
        u.id,
        u.pseudo,
        u.photo,
        u.genre,
        COALESCE((
          SELECT COUNT(DISTINCT h2.id_fiche)
          FROM fiches_histo h2
          INNER JOIN fiches f2 ON f2.id = h2.id_fiche AND (f2.archive = 0 OR f2.archive IS NULL)
          WHERE h2.id_etat = 7 AND h2.date_creation >= ? AND h2.date_creation <= ?
          AND h2.id_confirmateur = u.id
        ), 0) as rdv_today,
        COALESCE((
          SELECT COUNT(DISTINCT f.id)
          FROM fiches f
          WHERE (
            f.id_confirmateur = u.id 
            OR f.id_confirmateur_2 = u.id 
            OR f.id_confirmateur_3 = u.id
          )
          AND f.id_etat_final = 7
          AND f.date_rdv_time >= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        ), 0) as rdv_upcoming
      FROM utilisateurs u
      LEFT JOIN fonctions f ON u.fonction = f.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE u.fonction = 6
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
      ORDER BY rdv_today DESC, rdv_upcoming DESC, u.pseudo ASC
    `, [todayStart, todayEnd, todayStart]);

    res.json({
      success: true,
      data: {
        rdvTodayConfirmed: rdvTodayConfirmed?.count || 0,
        signaturesToday: signaturesToday?.count || 0,
        rdvUpcoming: rdvUpcoming?.count || 0,
        confirmateurs: confirmateursWithRdv.map(conf => ({
          id: conf.id,
          pseudo: conf.pseudo,
          photo: conf.photo,
          genre: conf.genre,
          rdv_today: conf.rdv_today || 0,
          rdv_upcoming: conf.rdv_upcoming || 0
        })) || []
      }
    });
  } catch (error) {
    console.error('[STAT] /dashboard - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// Suivi des agents qualification
router.get('/agents-qualif', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin,
      id_agent,
      id_centre,
      id_rp // Nouveau paramètre pour filtrer par RP (pour les administrateurs)
    } = req.query;

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Si l'utilisateur est un RE Qualification (a des agents sous sa responsabilité)
    // Filtrer uniquement ses agents
    let agentsQuery = `
      SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        u.centre,
        c.titre as centre_nom
      FROM utilisateurs u
      LEFT JOIN fonctions f ON u.fonction = f.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE u.fonction = 3
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
    `;

    const agentsParams = [];

    let agentIds = [];

    // Si un filtre RP est fourni (pour les administrateurs), filtrer par ce RP
    if (id_rp) {
      // Récupérer les superviseurs assignés au RP spécifié
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [parseInt(id_rp)]
      );

      if (superviseursAssignes && superviseursAssignes.length > 0) {
        const superviseurIds = superviseursAssignes.map(s => s.id);
        // Récupérer les agents de tous ces superviseurs
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseurIds
        );
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    }
    // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
    else if (req.user.fonction === 12) {
      // Récupérer les superviseurs assignés au RP connecté
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [req.user.id]
      );

      if (superviseursAssignes && superviseursAssignes.length > 0) {
        const superviseurIds = superviseursAssignes.map(s => s.id);
        // Récupérer les agents de tous ces superviseurs
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseurIds
        );
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    } else {
      // RE Qualification : récupérer les agents directement sous la responsabilité
      // Vérifier si l'utilisateur a des agents sous sa responsabilité
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs 
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    }

    if (agentIds.length > 0) {
      // Filtrer uniquement les agents sous responsabilité
      agentsQuery += ` AND u.id IN (${agentIds.map(() => '?').join(',')})`;
      agentsParams.push(...agentIds);
    }

    if (id_agent) {
      agentsQuery += ' AND u.id = ?';
      agentsParams.push(parseInt(id_agent));
    }

    if (id_centre) {
      agentsQuery += ' AND u.centre = ?';
      agentsParams.push(parseInt(id_centre));
    }

    agentsQuery += ' ORDER BY u.pseudo ASC';

    const agents = await query(agentsQuery, agentsParams);

    // Récupérer tous les états avec groupe 0 (états utilisés pour la qualité)
    const etatsGroupe0 = await query(`
      SELECT id, titre, color, abbreviation, ordre
      FROM etats
      WHERE groupe = '0' OR groupe = 0
      ORDER BY ordre ASC
    `);

    const koEtatGroupe0 = etatsGroupe0.find(
      (e) => String(e.abbreviation || '').trim().toUpperCase() === 'KO'
        || String(e.titre || '').trim().toUpperCase() === 'KO'
    ) || etatsGroupe0.find((e) => Number(e.id) === 54);
    const koEtatId = koEtatGroupe0?.id ?? null;

    // Récupérer les statistiques pour chaque agent
    const agentsStats = await Promise.all(
      agents.map(async (agent) => {
        const statsByEtat = {};

        // Initialiser les compteurs pour chaque état groupe 0
        etatsGroupe0.forEach(etat => {
          statsByEtat[etat.id] = {
            id: etat.id,
            titre: etat.titre,
            color: etat.color || '#cccccc',
            abbreviation: etat.abbreviation || etat.titre,
            count: 0
          };
        });

        // Compter les fiches créées par cet agent avec les états groupe 0
        const fichesConditions = [
          'f.id_agent = ?',
          'f.date_insert_time >= ?',
          'f.date_insert_time <= ?',
          '(f.archive = 0 OR f.archive IS NULL)'
        ];
        const fichesParams = [agent.id, startDate, endDate];

        // Répartition groupe 0 : fiches ko=1 → colonne état KO existante
        const fichesStatsParams = koEtatId != null
          ? [koEtatId, ...fichesParams]
          : fichesParams;
        const fichesStats = koEtatId != null
          ? await query(`
            SELECT
              CASE WHEN (f.ko = 1) THEN ? ELSE f.id_etat_final END AS etat_key,
              COUNT(*) AS count
            FROM fiches f
            LEFT JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesConditions.join(' AND ')}
            AND (
              f.ko = 1
              OR ((f.ko = 0 OR f.ko IS NULL) AND (e.groupe = '0' OR e.groupe = 0))
            )
            GROUP BY etat_key
          `, fichesStatsParams)
          : await query(`
            SELECT
              f.id_etat_final AS etat_key,
              COUNT(*) AS count
            FROM fiches f
            INNER JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesConditions.join(' AND ')}
            AND (f.ko = 0 OR f.ko IS NULL)
            AND (e.groupe = '0' OR e.groupe = 0)
            GROUP BY f.id_etat_final
          `, fichesParams);

        fichesStats.forEach((stat) => {
          const key = stat.etat_key;
          if (statsByEtat[key]) {
            statsByEtat[key].count = stat.count || 0;
          }
        });

        // Fiches validées : hors groupe 0, hors KO
        const idsGroupe0 = etatsGroupe0.map(e => e.id);
        let validatedCount = 0;
        if (idsGroupe0.length > 0) {
          const validatedResult = await queryOne(`
            SELECT COUNT(*) as count
            FROM fiches f
            INNER JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesConditions.join(' AND ')}
            AND (f.ko = 0 OR f.ko IS NULL)
            AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})
            AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
          `, [...fichesParams, ...idsGroupe0]);
          validatedCount = validatedResult?.count || 0;
        }

        // Calculer le total de fiches créées
        const totalFiches = await queryOne(`
          SELECT COUNT(*) as total
          FROM fiches f
          WHERE f.id_agent = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `, [agent.id, startDate, endDate]);

        return {
          agent: {
            id: agent.id,
            pseudo: agent.pseudo,
            nom: agent.nom,
            prenom: agent.prenom,
            photo: agent.photo,
            centre: agent.centre,
            centre_nom: agent.centre_nom
          },
          stats: Object.values(statsByEtat),
          validated: validatedCount,
          total: totalFiches?.total || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        agents: agentsStats,
        etats: etatsGroupe0,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du suivi des agents qualification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// =====================================================
// PRODUCTION QUALIF - RP Qualification
// =====================================================

// Récupérer la production par superviseur pour un RP Qualification
router.get('/production-qualif', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin,
      id_superviseur,
      id_etat_final
    } = req.query;

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    const fonction = Number(req.user?.fonction);
    const isBackofficeOrAdmin = fonction === 11 || fonction === 1;

    const superviseurExistsClause = `
      AND EXISTS (
        SELECT 1 FROM utilisateurs agents
        WHERE agents.chef_equipe = u.id
        AND agents.fonction = 3
        AND agents.etat > 0
      )
    `;

    let superviseursQuery;
    let superviseursParams = [];

    if (fonction === 12) {
      // RP Qualification : superviseurs assignés via id_rp_qualif
      superviseursQuery = `
        SELECT DISTINCT
          u.id,
          u.pseudo,
          u.nom,
          u.prenom
        FROM utilisateurs u
        LEFT JOIN fonctions f ON u.fonction = f.id
        WHERE u.id_rp_qualif = ?
        AND u.etat > 0
        AND (f.etat > 0 OR f.etat IS NULL)
        ${superviseurExistsClause}
      `;
      superviseursParams = [req.user.id];
    } else if (fonction === 2) {
      // RE Qualification : sa propre ligne de stats
      superviseursQuery = `
        SELECT DISTINCT
          u.id,
          u.pseudo,
          u.nom,
          u.prenom
        FROM utilisateurs u
        WHERE u.id = ?
        AND u.etat > 0
        ${superviseurExistsClause}
      `;
      superviseursParams = [req.user.id];
    } else if (isBackofficeOrAdmin) {
      // Backoffice / Admin : tous les superviseurs ayant des agents qualification
      superviseursQuery = `
        SELECT DISTINCT
          u.id,
          u.pseudo,
          u.nom,
          u.prenom
        FROM utilisateurs u
        LEFT JOIN fonctions f ON u.fonction = f.id
        WHERE u.etat > 0
        AND (f.etat > 0 OR f.etat IS NULL)
        ${superviseurExistsClause}
      `;
    } else {
      return res.json({
        success: true,
        data: {
          superviseurs: [],
          etats: [],
          period: {
            date_debut: startDateStr,
            date_fin: endDateStr
          }
        }
      });
    }

    if (id_superviseur) {
      superviseursQuery += ' AND u.id = ?';
      superviseursParams.push(parseInt(id_superviseur, 10));
    }

    superviseursQuery += ' ORDER BY u.pseudo ASC';

    const superviseurs = await query(superviseursQuery, superviseursParams);

    // Récupérer les états groupe 0
    const etatsGroupe0 = await query(`
      SELECT id, titre, color, abbreviation, ordre
      FROM etats
      WHERE (groupe = '0' OR groupe = 0)
      ORDER BY ordre ASC
    `);

    const idsGroupe0 = etatsGroupe0.map(e => e.id);
    const ID_ETAT_HC = 55;
    const koEtatGroupe0 = etatsGroupe0.find(
      (e) => String(e.abbreviation || '').trim().toUpperCase() === 'KO'
        || String(e.titre || '').trim().toUpperCase() === 'KO'
    ) || etatsGroupe0.find((e) => Number(e.id) === 54);
    const koEtatId = koEtatGroupe0?.id ?? null;

    let etatsListe = [...etatsGroupe0];
    if (!etatsListe.some((e) => Number(e.id) === ID_ETAT_HC)) {
      const hcEtatRow = await queryOne(
        'SELECT id, titre, color, abbreviation, ordre FROM etats WHERE id = ?',
        [ID_ETAT_HC]
      );
      if (hcEtatRow) etatsListe.push(hcEtatRow);
    }

    // Périmètre qualification: RP (12) et superviseur qualif (2) voient uniquement leurs agents.
    // Les autres profils gardent la vue globale.
    let scopedAgentIds = null; // null => global
    if (req.user?.fonction === 12) {
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [req.user.id]
      );
      const superviseurIds = (superviseursAssignes || []).map((s) => s.id);
      if (superviseurIds.length === 0) {
        scopedAgentIds = [];
      } else {
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')})
           AND fonction = 3
           AND etat > 0`,
          superviseurIds
        );
        scopedAgentIds = (agentsSousResponsabilite || []).map((a) => a.id);
      }
    } else if (req.user?.fonction === 2) {
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      scopedAgentIds = (agentsSousResponsabilite || []).map((a) => a.id);
    }

    // Pour chaque superviseur, calculer les stats
    const superviseursStats = await Promise.all(
      superviseurs.map(async (superviseur) => {
        // Récupérer les agents sous ce superviseur
        const agents = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
          [superviseur.id]
        );

        const agentIds = agents.map(a => a.id);

        if (agentIds.length === 0) {
          return {
            superviseur,
            stats: {},
            total: 0
          };
        }

        const stats = {};
        etatsListe.forEach((etat) => {
          stats[etat.id] = {
            id: etat.id,
            titre: etat.titre,
            abbreviation: etat.abbreviation || etat.titre,
            count: 0
          };
        });

        const fichesConditions = [
          `f.id_agent IN (${agentIds.map(() => '?').join(',')})`,
          'f.date_insert_time >= ?',
          'f.date_insert_time <= ?',
          '(f.archive = 0 OR f.archive IS NULL)',
          'f.date_insert_time IS NOT NULL'
        ];
        const fichesParams = [...agentIds, startDate, endDate];

        if (koEtatId != null) {
          const fichesStatsRows = await query(
            `SELECT
              CASE WHEN (f.ko = 1) THEN ? ELSE f.id_etat_final END AS etat_key,
              COUNT(*) AS count
            FROM fiches f
            LEFT JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesConditions.join(' AND ')}
            AND (
              f.ko = 1
              OR (
                (f.ko = 0 OR f.ko IS NULL)
                AND ((e.groupe = '0' OR e.groupe = 0) OR f.id_etat_final = ?)
              )
            )
            GROUP BY etat_key`,
            [koEtatId, ...fichesParams, ID_ETAT_HC]
          );
          (fichesStatsRows || []).forEach((row) => {
            const key = row.etat_key;
            if (stats[key]) {
              stats[key].count = Number(row.count) || 0;
            }
          });
        } else {
          const fichesStatsRows = await query(
            `SELECT f.id_etat_final AS etat_key, COUNT(*) AS count
             FROM fiches f
             INNER JOIN etats e ON f.id_etat_final = e.id
             WHERE ${fichesConditions.join(' AND ')}
             AND (f.ko = 0 OR f.ko IS NULL)
             AND ((e.groupe = '0' OR e.groupe = 0) OR f.id_etat_final = ?)
             GROUP BY f.id_etat_final`,
            [...fichesParams, ID_ETAT_HC]
          );
          (fichesStatsRows || []).forEach((row) => {
            const key = row.etat_key;
            if (stats[key]) {
              stats[key].count = Number(row.count) || 0;
            }
          });
        }

        if (!id_etat_final || id_etat_final === 'validated') {
          const validatedConditions = [...fichesConditions, '(f.ko = 0 OR f.ko IS NULL)'];
          const validatedParams = [...fichesParams];
          const idsEtatsQualif = etatsListe.map((e) => e.id);
          if (idsEtatsQualif.length > 0) {
            validatedConditions.push(
              `f.id_etat_final NOT IN (${idsEtatsQualif.map(() => '?').join(',')})`
            );
            validatedParams.push(...idsEtatsQualif);
          }

          const validatedCount = await queryOne(
            `SELECT COUNT(*) AS count
             FROM fiches f
             WHERE ${validatedConditions.join(' AND ')}`,
            validatedParams
          );

          stats.validated = {
            id: 'validated',
            titre: 'Validé',
            abbreviation: 'VALIDÉ',
            count: validatedCount?.count || 0
          };
        }

        // Calculer le total (BRUT) : toutes les fiches avec date de création dans la période, indépendamment de l'état actuel
        const totalResult = await queryOne(
          `SELECT COUNT(*) as total
           FROM fiches f
           WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
           AND f.date_insert_time >= ?
           AND f.date_insert_time <= ?
           AND (f.archive = 0 OR f.archive IS NULL)
           AND f.date_insert_time IS NOT NULL`,
          [...agentIds, startDate, endDate]
        );

        const total = totalResult?.total || 0;

        return {
          superviseur,
          stats,
          total
        };
      })
    );

    res.json({
      success: true,
      data: {
        superviseurs: superviseursStats,
        etats: etatsListe,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('[STAT] /production-qualif - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la production',
      error: error.message
    });
  }
});

// =====================================================
// KPI QUALIFICATION
// =====================================================

// =====================================================
// KPI Qualification — compteurs détail (produites, KO, HC, alertes, remarques)
// =====================================================

async function countKpiQualifDetails(agentIds, startDate, endDate) {
  const ID_ETAT_HC = 55;
  const empty = {
    fiches_produites: 0,
    nb_ko: 0,
    nb_hc: 0,
    nb_alertes_recues: 0,
    nb_remarques_recues: 0,
  };

  const hasAgentList = Array.isArray(agentIds);
  if (hasAgentList && agentIds.length === 0) return empty;

  const agentInClauseF = hasAgentList
    ? `AND f.id_agent IN (${agentIds.map(() => '?').join(',')})`
    : '';
  const agentInParams = hasAgentList ? agentIds : [];

  const fichesProduitesRow = await queryOne(
    `SELECT COUNT(DISTINCT f.id) AS count
     FROM fiches f
     INNER JOIN utilisateurs u ON f.id_agent = u.id
     WHERE u.fonction = 3
     ${agentInClauseF}
     AND f.id_agent IS NOT NULL AND f.id_agent > 0
     AND f.date_insert_time >= ? AND f.date_insert_time <= ?
     AND (f.archive = 0 OR f.archive IS NULL)
     AND (f.id_etat_final != 61 OR f.id_etat_final IS NULL)`,
    [...agentInParams, startDate, endDate]
  );

  const nbKoRow = await queryOne(
    `SELECT COUNT(DISTINCT f.id) AS count
     FROM fiches f
     INNER JOIN utilisateurs u ON f.id_agent = u.id
     WHERE u.fonction = 3
     ${agentInClauseF}
     AND f.id_agent IS NOT NULL AND f.id_agent > 0
     AND f.date_insert_time >= ? AND f.date_insert_time <= ?
     AND (f.archive = 0 OR f.archive IS NULL)
     AND (f.id_etat_final != 61 OR f.id_etat_final IS NULL)
     AND f.ko = 1`,
    [...agentInParams, startDate, endDate]
  );

  const nbHcRow = await queryOne(
    `SELECT COUNT(DISTINCT f.id) AS count
     FROM fiches f
     INNER JOIN utilisateurs u ON f.id_agent = u.id
     WHERE u.fonction = 3
     ${agentInClauseF}
     AND f.id_agent IS NOT NULL AND f.id_agent > 0
     AND f.date_insert_time >= ? AND f.date_insert_time <= ?
     AND (f.archive = 0 OR f.archive IS NULL)
     AND (f.id_etat_final != 61 OR f.id_etat_final IS NULL)
     AND f.id_etat_final = ?`,
    [...agentInParams, startDate, endDate, ID_ETAT_HC]
  );

  let nbAlertes = 0;
  let nbRemarques = 0;
  try {
    if (hasAgentList) {
      const ph = agentIds.map(() => '?').join(',');
      const alertesRow = await queryOne(
        `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent IN (${ph}) AND date_alerte >= ? AND date_alerte <= ?`,
        [...agentIds, startDate, endDate]
      );
      nbAlertes = alertesRow?.nb ?? 0;
      const remarquesRow = await queryOne(
        `SELECT COUNT(*) AS nb FROM remarques WHERE id_destinataire IN (${ph}) AND date_remarque >= ? AND date_remarque <= ?`,
        [...agentIds, startDate, endDate]
      );
      nbRemarques = remarquesRow?.nb ?? 0;
    } else {
      const alertesRow = await queryOne(
        `SELECT COUNT(*) AS nb
         FROM alert_ko ak
         INNER JOIN utilisateurs u ON ak.id_agent = u.id
         WHERE u.fonction = 3 AND ak.date_alerte >= ? AND ak.date_alerte <= ?`,
        [startDate, endDate]
      );
      nbAlertes = alertesRow?.nb ?? 0;
      const remarquesRow = await queryOne(
        `SELECT COUNT(*) AS nb
         FROM remarques r
         INNER JOIN utilisateurs u ON r.id_destinataire = u.id
         WHERE u.fonction = 3 AND r.date_remarque >= ? AND r.date_remarque <= ?`,
        [startDate, endDate]
      );
      nbRemarques = remarquesRow?.nb ?? 0;
    }
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }

  return {
    fiches_produites: Number(fichesProduitesRow?.count ?? 0),
    nb_ko: Number(nbKoRow?.count ?? 0),
    nb_hc: Number(nbHcRow?.count ?? 0),
    nb_alertes_recues: Number(nbAlertes),
    nb_remarques_recues: Number(nbRemarques),
  };
}

// Récupérer les KPI qualification (meilleurs agents et équipes)
router.get('/kpi-qualification', authenticate, async (req, res) => {
  try {
    const { month, id_rp, id_superviseur, id_agent } = req.query; // filtres optionnels (backoffice/admin)

    // Périmètre qualification:
    // - RP (12): ses équipes uniquement
    // - Superviseur qualif (2): ses agents uniquement
    // - Backoffice/Admin: global + filtres optionnels RP/RE/agent
    // - autres profils: global
    let scopedAgentIds = null; // null => global
    const asInt = (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const filterRpId = asInt(id_rp);
    const filterSuperviseurId = asInt(id_superviseur);
    const filterAgentId = asInt(id_agent);
    const isBackofficeOrAdmin = req.user?.fonction === 11 || req.user?.fonction === 1;

    if (req.user?.fonction === 12) {
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs
         WHERE id_rp_qualif = ? AND etat > 0`,
        [req.user.id]
      );
      const superviseurIds = (superviseursAssignes || []).map((s) => s.id);
      if (superviseurIds.length === 0) {
        scopedAgentIds = [];
      } else {
        const agents = await query(
          `SELECT id FROM utilisateurs
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')})
           AND fonction = 3 AND etat > 0`,
          superviseurIds
        );
        scopedAgentIds = (agents || []).map((a) => a.id);
      }
    } else if (req.user?.fonction === 2) {
      const agents = await query(
        `SELECT id FROM utilisateurs
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      scopedAgentIds = (agents || []).map((a) => a.id);
    } else if (isBackofficeOrAdmin) {
      // Backoffice/Admin : par défaut, "Tous les RP" => tous les agents qualification (fonction 3).
      // Puis les filtres RP/RE/agent viennent restreindre ce périmètre.
      const allQualifAgents = await query(
        `SELECT id FROM utilisateurs
         WHERE fonction = 3`
      );
      scopedAgentIds = (allQualifAgents || []).map((a) => a.id);

      if (filterAgentId) {
        scopedAgentIds = scopedAgentIds.includes(filterAgentId) ? [filterAgentId] : [];
      } else if (filterSuperviseurId) {
        const agents = await query(
          `SELECT id FROM utilisateurs
           WHERE chef_equipe = ? AND fonction = 3`,
          [filterSuperviseurId]
        );
        scopedAgentIds = (agents || []).map((a) => a.id);
      } else if (filterRpId) {
        const superviseursAssignes = await query(
          `SELECT id FROM utilisateurs
           WHERE id_rp_qualif = ?`,
          [filterRpId]
        );
        const superviseurIds = (superviseursAssignes || []).map((s) => s.id);
        if (superviseurIds.length === 0) {
          scopedAgentIds = [];
        } else {
          const agents = await query(
            `SELECT id FROM utilisateurs
             WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')})
             AND fonction = 3`,
            superviseurIds
          );
          scopedAgentIds = (agents || []).map((a) => a.id);
        }
      }
    }

    let allQualifAgentIds = null;
    if (isBackofficeOrAdmin) {
      const allQualifAgents = await query(`SELECT id FROM utilisateurs WHERE fonction = 3`);
      allQualifAgentIds = (allQualifAgents || []).map((a) => a.id);
    }
    const hasActiveUiFilter = isBackofficeOrAdmin && (filterRpId || filterSuperviseurId || filterAgentId);

    // Dates pour jour, semaine, mois
    const today = new Date();
    const todayStr = getTodayLocal();
    
    // Semaine (lundi à dimanche)
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour lundi
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = todayStr;
    
    // Mois - utiliser le mois sélectionné ou le mois en cours
    let monthStart, monthEnd;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      // Mois sélectionné
      const [year, monthNum] = month.split('-').map(Number);
      monthStart = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
      // Dernier jour du mois
      const lastDay = new Date(year, monthNum, 0).getDate();
      monthEnd = new Date(year, monthNum - 1, lastDay).toISOString().split('T')[0];
    } else {
      // Mois en cours par défaut
      monthStart = getFirstOfMonthLocal();
      monthEnd = todayStr;
    }

    const kpiData = {
      jour: {},
      semaine: {},
      mois: {}
    };

    // Pour chaque période (jour, semaine, mois)
    const periods = [
      { key: 'jour', start: todayStr, end: todayStr, label: 'Aujourd\'hui' },
      { key: 'semaine', start: weekStart, end: weekEnd, label: 'Cette semaine' },
      { key: 'mois', start: monthStart, end: monthEnd, label: 'Ce mois' }
    ];

    for (const period of periods) {
      const startDate = `${period.start} 00:00:00`;
      const endDate = `${period.end} 23:59:59`;
      const hasScopedAgents = Array.isArray(scopedAgentIds);
      const scopedAgentClauseF = hasScopedAgents
        ? (scopedAgentIds.length > 0 ? `AND f.id_agent IN (${scopedAgentIds.map(() => '?').join(',')})` : 'AND 1=0')
        : '';
      const scopedAgentClauseU = hasScopedAgents
        ? (scopedAgentIds.length > 0 ? `AND u.id IN (${scopedAgentIds.map(() => '?').join(',')})` : 'AND 1=0')
        : '';
      const scopedAgentClauseA = hasScopedAgents
        ? (scopedAgentIds.length > 0 ? `AND a.id IN (${scopedAgentIds.map(() => '?').join(',')})` : 'AND 1=0')
        : '';
      const scopedAgentParams = hasScopedAgents && scopedAgentIds.length > 0 ? scopedAgentIds : [];

      // Fiches validées (KPI) : hors poubelle, hors KO (ko=1), hors HC (état 55), hors états groupe 0
      const ID_ETAT_HC = 55;
      const fichesValideesWhere = `
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.ko = 0 OR f.ko IS NULL)
        AND (f.id_etat_final != ${ID_ETAT_HC} OR f.id_etat_final IS NULL)
        AND (e.groupe IS NULL OR (e.groupe != '0' AND e.groupe != 0))
      `;
      const fichesValideesParams = [startDate, endDate, ...scopedAgentParams];

      // Meilleur agent : même périmètre que les fiches validées
      const bestAgentQuery = `
        SELECT 
          u.id,
          u.pseudo,
          u.nom,
          u.prenom,
          u.photo,
          COUNT(DISTINCT f.id) as count_validated
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE u.fonction = 3
        AND u.etat > 0
        AND f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        ${scopedAgentClauseU}
        ${fichesValideesWhere}
        GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
        ORDER BY count_validated DESC
        LIMIT 1
      `;
      
      const bestAgent = await queryOne(bestAgentQuery, fichesValideesParams);

      // Meilleure équipe : même périmètre que les fiches validées
      const bestTeamQuery = `
        SELECT 
          s.id as superviseur_id,
          s.pseudo as superviseur_pseudo,
          s.nom as superviseur_nom,
          s.prenom as superviseur_prenom,
          COUNT(DISTINCT f.id) as count_validated,
          COUNT(DISTINCT a.id) as nb_agents
        FROM fiches f
        INNER JOIN utilisateurs a ON f.id_agent = a.id
        INNER JOIN utilisateurs s ON a.chef_equipe = s.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE a.fonction = 3
        AND a.etat > 0
        AND s.etat > 0
        AND f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        ${scopedAgentClauseA}
        ${fichesValideesWhere}
        GROUP BY s.id, s.pseudo, s.nom, s.prenom
        ORDER BY count_validated DESC
        LIMIT 1
      `;
      
      const bestTeam = await queryOne(bestTeamQuery, fichesValideesParams);

      // Total fiches validées (taux conversion / transformation)
      const fichesValideesQuery = `
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        ${scopedAgentClauseF}
        ${fichesValideesWhere}
      `;
      const fichesValidees = await queryOne(fichesValideesQuery, fichesValideesParams);

      // Fiches produites : saisies par un agent qualif. (F3) avec id_agent renseigné — exclut import en masse (id_agent NULL/0)
      const fichesProduiteQuery = `
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        WHERE u.fonction = 3
        ${scopedAgentClauseF}
        AND f.id_agent IS NOT NULL
        AND f.id_agent > 0
        AND f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.id_etat_final != 61 OR f.id_etat_final IS NULL)
      `;
      const fichesProduites = await queryOne(fichesProduiteQuery, [...scopedAgentParams, startDate, endDate]);

      const nbValidees = fichesValidees?.count || 0;
      const nbProduites = fichesProduites?.count || 0;
      const tauxConversion = nbProduites > 0 ? ((nbValidees / nbProduites) * 100).toFixed(1) : 0;

      // Fiches confirmées (table confirmations) - par date de confirmation, hors KO
      const fichesConfirmeesQuery = `
        SELECT COUNT(DISTINCT c.id_fiche) as count
        FROM confirmations c
        INNER JOIN fiches f ON c.id_fiche = f.id
        WHERE c.date_creation >= ?
        AND c.date_creation <= ?
        ${scopedAgentClauseF}
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.ko = 0 OR f.ko IS NULL)
      `;
      const fichesConfirmees = await queryOne(fichesConfirmeesQuery, [startDate, endDate, ...scopedAgentParams]);
      const nbConfirmees = fichesConfirmees?.count || 0;
      const tauxTransformation = nbValidees > 0 ? ((nbConfirmees / nbValidees) * 100).toFixed(1) : 0;

      const filteredAgentIds = hasScopedAgents ? scopedAgentIds : null;
      let detailsTotal;
      let detailsFiltered;
      if (hasActiveUiFilter) {
        [detailsTotal, detailsFiltered] = await Promise.all([
          countKpiQualifDetails(allQualifAgentIds, startDate, endDate),
          countKpiQualifDetails(filteredAgentIds, startDate, endDate),
        ]);
      } else {
        detailsFiltered = await countKpiQualifDetails(filteredAgentIds, startDate, endDate);
        detailsTotal = detailsFiltered;
      }

      kpiData[period.key] = {
        period: period.label,
        date_start: period.start,
        date_end: period.end,
        best_agent: bestAgent ? {
          id: bestAgent.id,
          pseudo: bestAgent.pseudo,
          nom: bestAgent.nom,
          prenom: bestAgent.prenom,
          photo: bestAgent.photo,
          count: bestAgent.count_validated || 0
        } : null,
        best_team: bestTeam ? {
          superviseur: {
            id: bestTeam.superviseur_id,
            pseudo: bestTeam.superviseur_pseudo,
            nom: bestTeam.superviseur_nom,
            prenom: bestTeam.superviseur_prenom
          },
          count: bestTeam.count_validated || 0,
          nb_agents: bestTeam.nb_agents || 0
        } : null,
        taux_conversion: {
          fiches_validees: nbValidees,
          fiches_produites: nbProduites,
          taux: parseFloat(tauxConversion)
        },
        taux_transformation: {
          fiches_confirmees: nbConfirmees,
          fiches_validees: nbValidees,
          taux: parseFloat(tauxTransformation)
        },
        details: {
          total: detailsTotal,
          filtered: detailsFiltered,
          has_filter: !!hasActiveUiFilter,
        }
      };
    }

    res.json({
      success: true,
      data: kpiData
    });
  } catch (error) {
    console.error('[STAT] /kpi-qualification - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPI',
      error: error.message
    });
  }
});

// =====================================================
// KPIs - Nouveaux KPI avec Top 3, Taux de conversion, Évolution
// =====================================================

// Récupérer les KPIs (Top 3 agents, Top 3 équipes, Taux de conversion, Évolution) - centre CALL_JWS uniquement
router.get('/kpis', authenticate, async (req, res) => {
  try {
    const dateRange = resolveKpiDateRangeFromQuery(req);
    const dateChamp = dateRange.dateChamp;

    // Centre CALL_JWS (optionnel - si pas trouvé, on prend tous les centres)
    const callJwsCentres = await query(`
      SELECT id FROM centres
      WHERE (titre = 'CALL_JWS' OR titre LIKE 'CALL_JWS%' OR titre LIKE 'Call_JWS%')
      AND etat > 0
    `);
    const callJwsCentreIds = (callJwsCentres || []).map(c => c.id);
    // Si pas de centre CALL_JWS, on ne filtre pas par centre (toutes les fiches)
    const centreCondition = callJwsCentreIds.length > 0 
      ? `AND f.id_centre IN (${callJwsCentreIds.map(() => '?').join(',')})` 
      : '';
    const useCentreFilter = callJwsCentreIds.length > 0;
    
    // Récupérer les IDs des états groupe 0 pour exclure
    const etatsGroupe0 = await query(`
      SELECT id FROM etats
      WHERE (groupe = '0' OR groupe = 0)
    `);
    const idsGroupe0 = etatsGroupe0.map(e => e.id);

    const periodStart = dateRange.start;
    const periodEnd = dateRange.end;
    const startDate = dateRange.startDateTime;
    const endDate = dateRange.endDateTime;
    const { previousStart, previousEnd } = getPreviousPeriodComparisonRange(periodStart, periodEnd);
    const previousStartDate = `${previousStart} ${dateRange.timeDebut}`;
    const previousEndDate = `${previousEnd} ${dateRange.timeFin}`;

    const centreParams = useCentreFilter ? callJwsCentreIds : [];

    const qualifAgentInsertWhere = `
        AND f.id_agent IS NOT NULL
        AND f.id_agent > 0
      `;
    const fichesValideesWhere = `
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.ko = 0 OR f.ko IS NULL)
        AND (e.groupe IS NULL OR (e.groupe != '0' AND e.groupe != 0))
      `;

    const top3AgentsQuery = `
        SELECT 
          u.id,
          u.pseudo,
          u.nom,
          u.prenom,
          u.photo,
          COUNT(DISTINCT f.id) as count_validated
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE u.fonction = 3
        AND u.etat > 0
        AND ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        ${qualifAgentInsertWhere}
        ${fichesValideesWhere}
        GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
        ORDER BY count_validated DESC
        LIMIT 3
      `;
    const top3Agents = await query(top3AgentsQuery, [startDate, endDate]);

    const top3TeamsQuery = `
        SELECT 
          s.id as superviseur_id,
          s.pseudo as superviseur_pseudo,
          s.nom as superviseur_nom,
          s.prenom as superviseur_prenom,
          COUNT(DISTINCT f.id) as count_validated,
          COUNT(DISTINCT a.id) as nb_agents
        FROM fiches f
        INNER JOIN utilisateurs a ON f.id_agent = a.id
        INNER JOIN utilisateurs s ON a.chef_equipe = s.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE a.fonction = 3
        AND a.etat > 0
        AND s.etat > 0
        AND ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        ${qualifAgentInsertWhere}
        ${fichesValideesWhere}
        GROUP BY s.id, s.pseudo, s.nom, s.prenom
        ORDER BY count_validated DESC
        LIMIT 3
      `;
    const top3Teams = await query(top3TeamsQuery, [startDate, endDate]);

    const validatedQuery = `
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE u.fonction = 3
        AND ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        ${qualifAgentInsertWhere}
        ${fichesValideesWhere}
      `;
    const validatedResult = await queryOne(validatedQuery, [startDate, endDate]);
    const validatedCount = validatedResult?.count || 0;

    const totalQuery = `
        SELECT COUNT(*) as count
        FROM fiches f
        WHERE ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        ${centreCondition}
      `;
    const totalResult = await queryOne(totalQuery, [startDate, endDate, ...centreParams]);
    const totalCount = totalResult?.count || 0;

    const totalQualifQuery = `
        SELECT COUNT(*) as count
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        WHERE u.fonction = 3
        AND f.id_agent IS NOT NULL
        AND f.id_agent > 0
        AND ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.id_etat_final != 61 OR f.id_etat_final IS NULL)
      `;
    const totalQualifResult = await queryOne(totalQualifQuery, [startDate, endDate]);
    const totalQualifCount = totalQualifResult?.count || 0;

    const confirmedQuery = `
        SELECT COUNT(DISTINCT c.id_fiche) as count
        FROM confirmations c
        INNER JOIN fiches f ON c.id_fiche = f.id
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        WHERE u.fonction = 3
        AND ${dateChamp} >= ?
        AND ${dateChamp} <= ?
        ${qualifAgentInsertWhere}
        AND (f.archive = 0 OR f.archive IS NULL)
      `;
    const confirmedResult = await queryOne(confirmedQuery, [startDate, endDate]);
    const confirmedCount = confirmedResult?.count || 0;

    const previousValidatedResult = await queryOne(validatedQuery, [previousStartDate, previousEndDate]);
    const previousValidatedCount = previousValidatedResult?.count || 0;

    const previousTotalResult = await queryOne(totalQuery, [previousStartDate, previousEndDate, ...centreParams]);
    const previousTotalCount = previousTotalResult?.count || 0;

    const previousTotalQualifResult = await queryOne(totalQualifQuery, [previousStartDate, previousEndDate]);
    const previousTotalQualifCount = previousTotalQualifResult?.count || 0;

    const previousConfirmedResult = await queryOne(confirmedQuery, [previousStartDate, previousEndDate]);
    const previousConfirmedCount = previousConfirmedResult?.count || 0;

    const conversionRate = totalQualifCount > 0 ? (validatedCount / totalQualifCount) * 100 : 0;
    const previousConversionRate = previousTotalQualifCount > 0 ? (previousValidatedCount / previousTotalQualifCount) * 100 : 0;
    const conversionRateChange = conversionRate - previousConversionRate;

    const transformationRate = validatedCount > 0 ? (confirmedCount / validatedCount) * 100 : 0;
    const previousTransformationRate = previousValidatedCount > 0 ? (previousConfirmedCount / previousValidatedCount) * 100 : 0;
    const transformationRateChange = transformationRate - previousTransformationRate;

    const evolutionChange = previousValidatedCount > 0
      ? ((validatedCount - previousValidatedCount) / previousValidatedCount) * 100
      : (validatedCount > 0 ? 100 : 0);

    const evolutionTrend = evolutionChange > 0 ? 'up' : (evolutionChange < 0 ? 'down' : 'stable');

    const kpiData = {
      range: {
        period: 'Période sélectionnée',
        date_start: periodStart,
        date_end: periodEnd,
        date_champ: dateRange.dateChampKey,
        conversion_rate: conversionRate,
        conversion_rate_change: conversionRateChange,
        conversion_validated: validatedCount,
        conversion_produced: totalQualifCount,
        transformation_rate: transformationRate,
        transformation_rate_change: transformationRateChange,
        transformation_count: confirmedCount,
        transformation_total: validatedCount,
        top3_agents: top3Agents.map((agent) => ({
          id: agent.id,
          pseudo: agent.pseudo,
          nom: agent.nom,
          prenom: agent.prenom,
          photo: agent.photo,
          count: agent.count_validated || 0,
        })),
        top3_teams: top3Teams.map((team) => ({
          superviseur: {
            id: team.superviseur_id,
            pseudo: team.superviseur_pseudo,
            nom: team.superviseur_nom,
            prenom: team.superviseur_prenom,
          },
          count: team.count_validated || 0,
          nb_agents: team.nb_agents || 0,
        })),
        evolution: {
          current: validatedCount,
          previous: previousValidatedCount,
          change: evolutionChange,
          trend: evolutionTrend,
        },
      },
    };

    res.json({
      success: true,
      data: kpiData,
    });
  } catch (error) {
    console.error('[STAT] /kpis - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPIs',
      error: error.message
    });
  }
});

// =====================================================
// KPIs CONFIRMATION - Top 3 confirmateurs, Taux de confirmation/signature, Évolution
// =====================================================

function buildEmptyKpisConfirmationRange(dateRange) {
  return {
    period: 'Période sélectionnée',
    date_start: dateRange.start,
    date_end: dateRange.end,
    top3_confirmations: [],
    top3_signatures: [],
    confirmation_rate: 0,
    confirmation_rate_change: 0,
    confirmations_count: 0,
    fiches_traitees_count: 0,
    signature_rate: 0,
    signature_rate_change: 0,
    signatures_count: 0,
    compte_rendu_visites_count: 0,
    fiches_signees_count: 0,
    rdvs_visites_count: 0,
  };
}

/** KPIs confirmation agrégés pour une liste de centres (ex. CALL_JWS). */
async function computeKpisConfirmationRange(centreIds, dateRange) {
  const periodStart = dateRange.start;
  const periodEnd = dateRange.end;
  const emptyRange = buildEmptyKpisConfirmationRange(dateRange);
  if (!centreIds?.length) {
    return emptyRange;
  }

  const centreCondition = `AND f.id_centre IN (${centreIds.map(() => '?').join(',')})`;
  const centreParams = centreIds;
  const centreInList = centreIds.map(() => '?').join(', ');

  const startDate = dateRange.startDateTime;
  const endDate = dateRange.endDateTime;
  const { previousStart, previousEnd } = getPreviousPeriodComparisonRange(periodStart, periodEnd);
  const previousStartDate = `${previousStart} ${dateRange.timeDebut}`;
  const previousEndDate = `${previousEnd} ${dateRange.timeFin}`;

  const crDateVisiteFilter = await getKpiCompteRenduDateVisiteFilter();

  const top3ConfirmationsQuery = `
      SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        COUNT(*) as count_confirmations
      FROM confirmations c
      INNER JOIN fiches f ON c.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
      INNER JOIN utilisateurs u ON c.id_confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      WHERE c.id_confirmateur IS NOT NULL
      AND c.id_confirmateur > 0
      ${KPI_CONFIRMATIONS_PERIOD_SQL}
      ${centreCondition}
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY count_confirmations DESC
      LIMIT 3
    `;
  const top3Confirmations = await query(top3ConfirmationsQuery, [startDate, endDate, ...centreParams]);

  const top3SignaturesQuery = `
      SELECT 
        s.confirmateur as id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        SUM(s.ajoute) as count_signatures
      FROM signature s
      INNER JOIN fiches f ON s.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
      INNER JOIN utilisateurs u ON s.confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      WHERE f.id_centre IN (${centreInList})
      ${KPI_FICHE_RDV_DATE_SQL}
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY count_signatures DESC
      LIMIT 3
    `;
  const top3SignaturesRows = await query(top3SignaturesQuery, [...centreParams, startDate, endDate]);

  const signaturesTotalResult = await queryOne(
    `SELECT COALESCE(SUM(s.ajoute), 0) as total
       FROM signature s
       INNER JOIN fiches f ON s.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
       WHERE f.id_centre IN (${centreInList})
       ${KPI_FICHE_RDV_DATE_SQL}`,
    [...centreParams, startDate, endDate]
  );
  const signaturesCount = parseFloat(signaturesTotalResult?.total || 0);

  const compteRenduVisitesQuery = `
      SELECT COUNT(*) as count
      FROM compte_rendu_pending cr
      INNER JOIN fiches f ON f.id = cr.id_fiche
      WHERE (f.archive = 0 OR f.archive IS NULL)
      ${crDateVisiteFilter.sql}
      ${centreCondition}
    `;

  const confirmationsQuery = `
      SELECT COUNT(*) as count
      FROM confirmations c
      INNER JOIN fiches f ON c.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
      WHERE 1=1
      ${KPI_CONFIRMATIONS_PERIOD_SQL}
      ${centreCondition}
    `;

  const fichesTraiteesQuery = `
      SELECT COUNT(*) as count
      FROM fiches_histo fh
      INNER JOIN fiches f ON fh.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
      INNER JOIN utilisateurs u ON fh.id_confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      WHERE fh.id_confirmateur IS NOT NULL
      AND fh.id_confirmateur > 0
      ${KPI_FICHES_HISTO_PERIOD_SQL}
      ${centreCondition}
    `;

  const [
    compteRenduVisitesResult,
    confirmationsResult,
    fichesTraiteesResult,
    previousConfirmationsResult,
    previousSignaturesTotalResult,
    previousCompteRenduVisitesResult,
    previousFichesTraiteesResult,
  ] = await Promise.all([
    queryOne(compteRenduVisitesQuery, [startDate, endDate, ...centreParams]),
    queryOne(confirmationsQuery, [startDate, endDate, ...centreParams]),
    queryOne(fichesTraiteesQuery, [startDate, endDate, ...centreParams]),
    queryOne(confirmationsQuery, [previousStartDate, previousEndDate, ...centreParams]),
    queryOne(
      `SELECT COALESCE(SUM(s.ajoute), 0) as total
         FROM signature s
         INNER JOIN fiches f ON s.id_fiche = f.id AND (f.archive = 0 OR f.archive IS NULL)
         WHERE f.id_centre IN (${centreInList})
         ${KPI_FICHE_RDV_DATE_SQL}`,
      [...centreParams, previousStartDate, previousEndDate]
    ),
    queryOne(compteRenduVisitesQuery, [previousStartDate, previousEndDate, ...centreParams]),
    queryOne(fichesTraiteesQuery, [previousStartDate, previousEndDate, ...centreParams]),
  ]);

  const compteRenduVisitesCount = compteRenduVisitesResult?.count || 0;
  const confirmationsCount = confirmationsResult?.count || 0;
  const fichesTraiteesCount = fichesTraiteesResult?.count || 0;
  const previousConfirmationsCount = previousConfirmationsResult?.count || 0;
  const previousSignaturesCount = parseFloat(previousSignaturesTotalResult?.total || 0);
  const previousCompteRenduVisitesCount = previousCompteRenduVisitesResult?.count || 0;
  const previousFichesTraiteesCount = previousFichesTraiteesResult?.count || 0;

  const confirmationRate = fichesTraiteesCount > 0 ? (confirmationsCount / fichesTraiteesCount) * 100 : 0;
  const signatureRate =
    compteRenduVisitesCount > 0 ? (signaturesCount / compteRenduVisitesCount) * 100 : 0;
  const previousConfirmationRate =
    previousFichesTraiteesCount > 0 ? (previousConfirmationsCount / previousFichesTraiteesCount) * 100 : 0;
  const previousSignatureRate =
    previousCompteRenduVisitesCount > 0
      ? (previousSignaturesCount / previousCompteRenduVisitesCount) * 100
      : 0;
  const confirmationRateChange = confirmationRate - previousConfirmationRate;
  const signatureRateChange = signatureRate - previousSignatureRate;

  const confirmationEvolutionChange =
    previousConfirmationsCount > 0
      ? ((confirmationsCount - previousConfirmationsCount) / previousConfirmationsCount) * 100
      : confirmationsCount > 0
        ? 100
        : 0;
  const signatureEvolutionChange =
    previousSignaturesCount > 0
      ? ((signaturesCount - previousSignaturesCount) / previousSignaturesCount) * 100
      : signaturesCount > 0
        ? 100
        : 0;
  const confirmationTrend =
    confirmationEvolutionChange > 0 ? 'up' : confirmationEvolutionChange < 0 ? 'down' : 'stable';
  const signatureTrend = signatureEvolutionChange > 0 ? 'up' : signatureEvolutionChange < 0 ? 'down' : 'stable';

  return {
    period: 'Période sélectionnée',
    date_start: periodStart,
    date_end: periodEnd,
    confirmation_rate: confirmationRate,
    confirmation_rate_change: confirmationRateChange,
    confirmations_count: confirmationsCount,
    fiches_traitees_count: fichesTraiteesCount,
    signature_rate: signatureRate,
    signature_rate_change: signatureRateChange,
    signatures_count: signaturesCount,
    compte_rendu_visites_count: compteRenduVisitesCount,
    fiches_signees_count: signaturesCount,
    rdvs_visites_count: compteRenduVisitesCount,
    top3_confirmations: (top3Confirmations || []).map((conf) => ({
      id: conf.id,
      pseudo: conf.pseudo,
      nom: conf.nom,
      prenom: conf.prenom,
      photo: conf.photo,
      count: Math.round(conf.count_confirmations || 0),
    })),
    top3_signatures: (top3SignaturesRows || []).map((conf) => ({
      id: conf.id,
      pseudo: conf.pseudo,
      nom: conf.nom,
      prenom: conf.prenom,
      photo: conf.photo,
      count: parseFloat((conf.count_signatures || 0).toFixed(2)),
    })),
    confirmation_evolution: {
      current: confirmationsCount,
      previous: previousConfirmationsCount,
      change: confirmationEvolutionChange,
      trend: confirmationTrend,
    },
    signature_evolution: {
      current: signaturesCount,
      previous: previousSignaturesCount,
      change: signatureEvolutionChange,
      trend: signatureTrend,
    },
  };
}

async function queryJwsCentreIds() {
  const rows = await query(`
    SELECT id FROM centres
    WHERE (titre = 'CALL_JWS' OR titre LIKE 'CALL_JWS%' OR titre LIKE 'Call_JWS%')
    AND etat > 0
  `);
  return (rows || []).map((c) => c.id);
}

// Récupérer les KPIs Confirmation (Top 3 confirmateurs confirmations/signatures, Taux, Évolution) - centre CALL_JWS uniquement
router.get('/kpis-confirmation', authenticate, async (req, res) => {
  try {
    const dateRange = resolveKpiDateRangeFromQuery(req);
    const centreIds = await queryJwsCentreIds();
    const range = await computeKpisConfirmationRange(centreIds, dateRange);
    res.json({ success: true, data: { range } });
  } catch (error) {
    console.error('[STAT] /kpis-confirmation - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPIs confirmation',
      error: error.message
    });
  }
});

// =====================================================
// KPIs PAR CENTRE - KPIs groupés par centre
// =====================================================

// Récupérer les KPIs par centre
router.get('/kpis-centres', authenticate, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM (ex: 2025-01)
    
    // Récupérer les IDs des états groupe 0 pour exclure
    const etatsGroupe0 = await query(`
      SELECT id FROM etats
      WHERE (groupe = '0' OR groupe = 0)
    `);
    const idsGroupe0 = etatsGroupe0.map(e => e.id);

    // Dates pour jour, semaine, mois
    const today = new Date();
    const todayStr = getTodayLocal();
    
    // Semaine (lundi à dimanche)
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = todayStr;
    
    // Mois - utiliser le mois sélectionné ou le mois en cours
    let monthStart, monthEnd;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNum] = month.split('-').map(Number);
      monthStart = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, monthNum, 0).getDate();
      monthEnd = new Date(year, monthNum - 1, lastDay).toISOString().split('T')[0];
    } else {
      monthStart = getFirstOfMonthLocal();
      monthEnd = todayStr;
    }

    const kpiData = {
      jour: {},
      semaine: {},
      mois: {}
    };

    // Pour chaque période (jour, semaine, mois)
    const periods = [
      { key: 'jour', start: todayStr, end: todayStr, label: 'Aujourd\'hui' },
      { key: 'semaine', start: weekStart, end: weekEnd, label: 'Cette semaine' },
      { key: 'mois', start: monthStart, end: monthEnd, label: 'Ce mois' }
    ];

    for (const period of periods) {
      const startDate = `${period.start} 00:00:00`;
      const endDate = `${period.end} 23:59:59`;

      const baseParams = idsGroupe0.length > 0 
        ? [startDate, endDate, ...idsGroupe0]
        : [startDate, endDate];

      // Récupérer tous les centres actifs
      const centres = await query(`
        SELECT id, titre
        FROM centres
        WHERE etat > 0
        ORDER BY titre ASC
      `);

      const centresKPIs = [];

      for (const centre of centres) {
        // Total fiches créées pour ce centre
        const totalQuery = `
          SELECT COUNT(*) as count
          FROM fiches f
          WHERE f.id_centre = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `;
        const totalResult = await queryOne(totalQuery, [centre.id, startDate, endDate]);
        const totalCount = totalResult?.count || 0;

        // Fiches validées pour ce centre
        const validatedParams = idsGroupe0.length > 0 
          ? [centre.id, startDate, endDate, ...idsGroupe0]
          : [centre.id, startDate, endDate];
        
        const validatedQuery = `
          SELECT COUNT(DISTINCT f.id) as count
          FROM fiches f
          INNER JOIN etats e ON f.id_etat_final = e.id
          WHERE f.id_centre = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${idsGroupe0.length > 0 ? `AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})` : ''}
          AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
        `;
        const validatedResult = await queryOne(validatedQuery, validatedParams);
        const validatedCount = validatedResult?.count || 0;

        // Taux de conversion
        const conversionRate = totalCount > 0 ? (validatedCount / totalCount) * 100 : 0;

        // Fiches signées (états 13, 16, 44, 45, mais PAS 38 = retracter 2 fois) par date d'insertion
        const signedQuery = `
          SELECT COUNT(DISTINCT f.id) as count
          FROM fiches f
          WHERE f.id_centre = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND f.id_etat_final IN (13, 16, 44, 45)
          AND f.id_etat_final != 38
          AND (f.archive = 0 OR f.archive IS NULL)
        `;
        const signedResult = await queryOne(signedQuery, [centre.id, startDate, endDate]);
        const signedCount = signedResult?.count || 0;

        // Taux de transformation = signatures / total fiches créées (par date d'insertion)
        const transformationRate = totalCount > 0 ? (signedCount / totalCount) * 100 : 0;

        // Pourcentage de chaque état durant la période (basé sur date_insert_time)
        const etatsQuery = `
          SELECT 
            e.id as etat_id,
            e.titre as etat_titre,
            e.color as etat_color,
            COUNT(DISTINCT f.id) as count,
            COUNT(DISTINCT f.id) * 100.0 / ? as percentage
          FROM fiches f
          INNER JOIN etats e ON f.id_etat_final = e.id
          WHERE f.id_centre = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          GROUP BY e.id, e.titre, e.color
          ORDER BY count DESC
        `;
        const etatsResult = await query(etatsQuery, [totalCount || 1, centre.id, startDate, endDate]);
        const etatsDistribution = etatsResult.map(etat => ({
          id: etat.etat_id,
          titre: etat.etat_titre,
          color: etat.etat_color,
          count: etat.count,
          percentage: parseFloat(etat.percentage.toFixed(2))
        }));

        // Meilleur agent pour ce centre
        const bestAgentQuery = `
          SELECT 
            u.id,
            u.pseudo,
            u.nom,
            u.prenom,
            u.photo,
            COUNT(DISTINCT f.id) as count_validated
          FROM fiches f
          INNER JOIN utilisateurs u ON f.id_agent = u.id
          INNER JOIN etats e ON f.id_etat_final = e.id
          WHERE f.id_centre = ?
          AND u.fonction = 3
          AND u.etat > 0
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${idsGroupe0.length > 0 ? `AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})` : ''}
          AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
          GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
          ORDER BY count_validated DESC
          LIMIT 1
        `;
        const bestAgent = await queryOne(bestAgentQuery, validatedParams);

        // Meilleure équipe pour ce centre
        const bestTeamQuery = `
          SELECT 
            s.id as superviseur_id,
            s.pseudo as superviseur_pseudo,
            s.nom as superviseur_nom,
            s.prenom as superviseur_prenom,
            COUNT(DISTINCT f.id) as count_validated
          FROM fiches f
          INNER JOIN utilisateurs a ON f.id_agent = a.id
          INNER JOIN utilisateurs s ON a.chef_equipe = s.id
          INNER JOIN etats e ON f.id_etat_final = e.id
          WHERE f.id_centre = ?
          AND a.fonction = 3
          AND a.etat > 0
          AND s.etat > 0
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${idsGroupe0.length > 0 ? `AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})` : ''}
          AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
          GROUP BY s.id, s.pseudo, s.nom, s.prenom
          ORDER BY count_validated DESC
          LIMIT 1
        `;
        const bestTeam = await queryOne(bestTeamQuery, validatedParams);

        centresKPIs.push({
          centre_id: centre.id,
          centre_titre: centre.titre,
          conversion_rate: conversionRate,
          validated_count: validatedCount,
          total_count: totalCount,
          transformation_rate: transformationRate,
          signed_count: signedCount,
          etats_distribution: etatsDistribution,
          top_agent: bestAgent ? {
            id: bestAgent.id,
            pseudo: bestAgent.pseudo,
            nom: bestAgent.nom,
            prenom: bestAgent.prenom,
            photo: bestAgent.photo,
            count: bestAgent.count_validated || 0
          } : null,
          top_team: bestTeam ? {
            superviseur: {
              id: bestTeam.superviseur_id,
              pseudo: bestTeam.superviseur_pseudo,
              nom: bestTeam.superviseur_nom,
              prenom: bestTeam.superviseur_prenom
            },
            count: bestTeam.count_validated || 0
          } : null
        });
      }

      kpiData[period.key] = {
        period: period.label,
        date_start: period.start,
        date_end: period.end,
        centres: centresKPIs
      };
    }

    res.json({
      success: true,
      data: kpiData
    });
  } catch (error) {
    console.error('[STAT] /kpis-centres - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPIs par centre',
      error: error.message
    });
  }
});

// =====================================================
// KPIs CONFIRMATION JWS - Statistiques pour le centre call_jws
// =====================================================

// KPIs Confirmation JWS — mêmes métriques que /kpis-confirmation, périmètre centres Call_JWS
router.get('/kpis-confirmation-jws', authenticate, async (req, res) => {
  try {
    const dateRange = resolveKpiDateRangeFromQuery(req);
    const centreIds = await queryJwsCentreIds();
    const range = await computeKpisConfirmationRange(centreIds, dateRange);
    res.json({ success: true, data: { range } });
  } catch (error) {
    console.error('[STAT] /kpis-confirmation-jws - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPIs Confirmation JWS',
      error: error.message
    });
  }
});

// =====================================================
// KPIs Porte ouverte — lignes table porte_ouverte (CR approuvés, états « qualification porte ouverte »)
// Même périmètre centre CALL_JWS que /kpis lorsque le centre existe.
// =====================================================
router.get('/kpis-porte-ouverte', authenticate, async (req, res) => {
  try {
    const { id_centre, centre_scope } = req.query;
    const dateRange = resolveKpiDateRangeFromQuery(req);
    const dateChamp = dateRange.dateChamp;

    const callJwsCentres = await query(`
      SELECT id FROM centres
      WHERE (titre = 'CALL_JWS' OR titre LIKE 'CALL_JWS%' OR titre LIKE 'Call_JWS%')
      AND etat > 0
    `);
    const callJwsCentreIds = (callJwsCentres || []).map((c) => Number(c.id)).filter(Boolean);
    const parsedCentreId = Number(id_centre);
    const hasSelectedCentre = Number.isFinite(parsedCentreId) && parsedCentreId > 0;
    const isAllJwsScope = String(centre_scope || '').toLowerCase() === 'all_jws';
    const selectedCentreIsJws = hasSelectedCentre && callJwsCentreIds.includes(parsedCentreId);
    const centreIdsToUse = hasSelectedCentre
      ? [parsedCentreId]
      : (isAllJwsScope ? callJwsCentreIds : []);
    const centreCondition =
      centreIdsToUse.length > 0
        ? `AND f.id_centre IN (${centreIdsToUse.map(() => '?').join(',')})`
        : '';
    const useCentreFilter = centreIdsToUse.length > 0;

    const kpiData = {};

    const effectivePeriods = [
      {
        key: 'range',
        start: dateRange.start,
        end: dateRange.end,
        label: 'Période sélectionnée',
      },
    ];

    const baseParams = (startDt, endDt) => {
      const p = [`${startDt} 00:00:00`, `${endDt} 23:59:59`];
      if (useCentreFilter) p.push(...centreIdsToUse);
      return p;
    };

    const runPorteOuverteForPeriod = async (startDateTime, endDateTime, previousStart, previousEnd) => {
      const startDatetime = startDateTime;
      const endDatetime = endDateTime;
      const prevStartDt = `${previousStart} ${dateRange.timeDebut}`;
      const prevEndDt = `${previousEnd} ${dateRange.timeFin}`;

      const totalSql = `
        SELECT
          COUNT(*) AS total_lignes,
          COUNT(DISTINCT po.id_fiche) AS total_fiches
        FROM porte_ouverte po
        INNER JOIN fiches f ON f.id = po.id_fiche
        WHERE ${dateChamp} >= ?
          AND ${dateChamp} <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${centreCondition}
      `;
      const totalRow = await queryOne(totalSql, [
        startDatetime,
        endDatetime,
        ...(useCentreFilter ? centreIdsToUse : []),
      ]);

      const byEtatSql = `
        SELECT
          po.id_etat_final AS id_etat,
          COALESCE(e.titre, CONCAT('État #', po.id_etat_final)) AS etat_titre,
          COUNT(*) AS count
        FROM porte_ouverte po
        INNER JOIN fiches f ON f.id = po.id_fiche
        LEFT JOIN etats e ON e.id = po.id_etat_final
        WHERE ${dateChamp} >= ?
          AND ${dateChamp} <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${centreCondition}
        GROUP BY po.id_etat_final, e.titre
        ORDER BY count DESC, etat_titre ASC
      `;
      const byEtatRows = await query(byEtatSql, [
        startDatetime,
        endDatetime,
        ...(useCentreFilter ? centreIdsToUse : []),
      ]);

      const detailsSql = `
        SELECT
          po.id,
          po.id_fiche,
          po.id_etat_final,
          COALESCE(e.titre, CONCAT('État #', po.id_etat_final)) AS etat_titre,
          f.nom,
          f.prenom,
          f.tel,
          f.cp,
          f.ville,
          f.date_rdv_time AS date_visite,
          c.titre AS centre_titre,
          uc.pseudo AS commercial_pseudo,
          ua.pseudo AS approbateur_pseudo,
          po.date_approbation,
          po.date_creation
        FROM porte_ouverte po
        INNER JOIN fiches f ON f.id = po.id_fiche
        LEFT JOIN centres c ON c.id = f.id_centre
        LEFT JOIN etats e ON e.id = po.id_etat_final
        LEFT JOIN utilisateurs uc ON uc.id = po.id_commercial
        LEFT JOIN utilisateurs ua ON ua.id = po.id_approbateur
        WHERE ${dateChamp} >= ?
          AND ${dateChamp} <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ${centreCondition}
        ORDER BY ${dateChamp} DESC, po.id DESC
        LIMIT 500
      `;
      const detailRows = await query(detailsSql, [
        startDatetime,
        endDatetime,
        ...(useCentreFilter ? centreIdsToUse : []),
      ]);

      const prevTotalRow = await queryOne(totalSql, [
        prevStartDt,
        prevEndDt,
        ...(useCentreFilter ? centreIdsToUse : []),
      ]);

      const totalLignes = Number(totalRow?.total_lignes) || 0;
      const prevLignes = Number(prevTotalRow?.total_lignes) || 0;
      const evolutionChange =
        prevLignes > 0 ? ((totalLignes - prevLignes) / prevLignes) * 100 : totalLignes > 0 ? 100 : 0;
      const evolutionTrend =
        evolutionChange > 0 ? 'up' : evolutionChange < 0 ? 'down' : 'stable';

      return {
        total_lignes: totalLignes,
        total_fiches_distinct: Number(totalRow?.total_fiches) || 0,
        previous_total_lignes: prevLignes,
        par_etat: (byEtatRows || []).map((r) => ({
          id_etat: r.id_etat,
          etat_titre: r.etat_titre,
          count: Number(r.count) || 0,
        })),
        details: (detailRows || []).map((r) => ({
          id: r.id,
          id_fiche: r.id_fiche,
          id_etat_final: r.id_etat_final,
          etat_titre: r.etat_titre,
          nom: r.nom,
          prenom: r.prenom,
          tel: r.tel,
          cp: r.cp,
          ville: r.ville,
          centre_titre: r.centre_titre,
          commercial_pseudo: r.commercial_pseudo,
          approbateur_pseudo: r.approbateur_pseudo,
          date_visite: r.date_visite,
          date_approbation: r.date_approbation,
          date_creation: r.date_creation,
        })),
        evolution: {
          current: totalLignes,
          previous: prevLignes,
          change: evolutionChange,
          trend: evolutionTrend,
        },
      };
    };

    for (const period of effectivePeriods) {
      const { previousStart, previousEnd } = getPreviousPeriodComparisonRange(period.start, period.end);

      const payload = await runPorteOuverteForPeriod(
        dateRange.startDateTime,
        dateRange.endDateTime,
        previousStart,
        previousEnd
      );
      kpiData[period.key] = {
        period: period.label,
        date_start: period.start,
        date_end: period.end,
        date_champ: dateRange.dateChampKey,
        id_centre: hasSelectedCentre ? parsedCentreId : null,
        centre_scope: hasSelectedCentre
          ? (selectedCentreIsJws ? 'selected_jws' : 'selected_non_jws')
          : (isAllJwsScope ? 'all_jws' : 'all_active'),
        ...payload,
      };
    }

    res.json({
      success: true,
      data: kpiData,
    });
  } catch (error) {
    const msg = error.message || '';
    const noTable =
      msg.includes('porte_ouverte') &&
      (msg.includes("doesn't exist") || msg.includes("n'existe pas") || error.code === 'ER_NO_SUCH_TABLE');
    if (noTable) {
      console.warn('[STAT] /kpis-porte-ouverte - Table porte_ouverte absente, réponse vide');
      const empty = {
        period: '',
        date_start: '',
        date_end: '',
        total_lignes: 0,
        total_fiches_distinct: 0,
        previous_total_lignes: 0,
        par_etat: [],
        details: [],
        evolution: { current: 0, previous: 0, change: 0, trend: 'stable' },
      };
      return res.json({
        success: true,
        data: { jour: { ...empty }, semaine: { ...empty }, mois: { ...empty }, custom: { ...empty } },
        warning: 'Table porte_ouverte non disponible (migration SQL non appliquée).',
      });
    }
    console.error('[STAT] /kpis-porte-ouverte - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPIs Porte ouverte',
      error: error.message,
    });
  }
});

// Statistiques des agents pour un superviseur
router.get('/superviseur/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      date_debut, 
      date_fin
    } = req.query;

    // Vérifier que l'utilisateur est bien un superviseur
    const superviseur = await queryOne(
      `SELECT id, pseudo, nom, prenom, photo, fonction, centre, id_rp_qualif
       FROM utilisateurs
       WHERE id = ? AND etat > 0`,
      [id]
    );

    if (!superviseur) {
      return res.status(404).json({
        success: false,
        message: 'Superviseur non trouvé'
      });
    }

    // Vérification de sécurité pour RP Qualification
    // Si l'utilisateur connecté est un RP Qualification (fonction 12),
    // il ne peut voir que les superviseurs qui lui sont assignés (id_rp_qualif = user.id)
    if (req.user.fonction === 12) {
      if (!superviseur.id_rp_qualif || superviseur.id_rp_qualif !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé : ce superviseur n\'est pas assigné à votre responsabilité'
        });
      }
    }

    // Vérification de sécurité pour RE Qualification
    // Si l'utilisateur connecté est un RE Qualification (a des agents sous sa responsabilité),
    // il ne peut voir que ses propres statistiques (id = user.id)
    if (req.user.fonction !== 12 && req.user.id !== parseInt(id)) {
      // Vérifier si l'utilisateur a des agents sous sa responsabilité (RE Qualification)
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      
      if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
        // C'est un RE Qualification, il ne peut voir que ses propres statistiques
        return res.status(403).json({
          success: false,
          message: 'Accès refusé : vous ne pouvez voir que vos propres statistiques'
        });
      }
    }

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Récupérer tous les agents sous la supervision de cet utilisateur avec leurs statistiques en une seule requête optimisée
    const agents = await query(
      `SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        u.centre,
        u.chef_equipe,
        c.titre as centre_nom
      FROM utilisateurs u
      LEFT JOIN centres c ON u.centre = c.id
      LEFT JOIN fonctions f ON u.fonction = f.id
      WHERE u.chef_equipe = ?
      AND u.fonction = 3
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
      ORDER BY u.pseudo ASC`,
      [id]
    );

    if (!agents || agents.length === 0) {
      return res.json({
        success: true,
        data: {
          superviseur: {
            id: superviseur.id,
            pseudo: superviseur.pseudo,
            nom: superviseur.nom,
            prenom: superviseur.prenom,
            photo: superviseur.photo
          },
          agents: [],
          period: {
            date_debut: startDateStr,
            date_fin: endDateStr
          }
        }
      });
    }

    const agentIds = agents.map(a => a.id);

    // Récupérer toutes les statistiques en une seule requête optimisée
    // 1. Statistiques par agent (total période, aujourd'hui, cette semaine, ce mois)
    const statsQuery = `
      SELECT 
        f.id_agent,
        COUNT(CASE WHEN f.date_insert_time >= ? AND f.date_insert_time <= ? THEN 1 END) as total_periode,
        COUNT(CASE WHEN DATE(f.date_insert_time) = CURDATE() THEN 1 END) as aujourdhui,
        COUNT(CASE WHEN YEARWEEK(f.date_insert_time, 1) = YEARWEEK(CURDATE(), 1) THEN 1 END) as cette_semaine,
        COUNT(CASE WHEN YEAR(f.date_insert_time) = YEAR(CURDATE()) AND MONTH(f.date_insert_time) = MONTH(CURDATE()) THEN 1 END) as ce_mois
      FROM fiches f
      WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
      AND (f.archive = 0 OR f.archive IS NULL)
      GROUP BY f.id_agent
    `;

    const statsParams = [startDate, endDate, ...agentIds];
    const statsResults = await query(statsQuery, statsParams);

    // 2. Fiches par état (groupe 0) pour tous les agents en une seule requête
    const etatsQuery = `
      SELECT 
        f.id_agent,
        f.id_etat_final,
        e.titre as etat_titre,
        e.color as etat_color,
        e.abbreviation as etat_abbreviation,
        COUNT(*) as count
      FROM fiches f
      INNER JOIN etats e ON f.id_etat_final = e.id
      WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
      AND f.date_insert_time >= ?
      AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      AND (e.groupe = '0' OR e.groupe = 0)
      GROUP BY f.id_agent, f.id_etat_final, e.titre, e.color, e.abbreviation
      ORDER BY f.id_agent, count DESC
    `;

    const etatsParams = [...agentIds, startDate, endDate];
    const etatsResults = await query(etatsQuery, etatsParams);

    // Organiser les résultats par agent
    const statsMap = {};
    statsResults.forEach(stat => {
      statsMap[stat.id_agent] = {
        total: parseInt(stat.total_periode) || 0,
        aujourdhui: parseInt(stat.aujourdhui) || 0,
        cette_semaine: parseInt(stat.cette_semaine) || 0,
        ce_mois: parseInt(stat.ce_mois) || 0
      };
    });

    const etatsMap = {};
    etatsResults.forEach(etat => {
      if (!etatsMap[etat.id_agent]) {
        etatsMap[etat.id_agent] = [];
      }
      etatsMap[etat.id_agent].push({
        id_etat_final: etat.id_etat_final,
        etat_titre: etat.etat_titre,
        etat_color: etat.etat_color,
        etat_abbreviation: etat.etat_abbreviation,
        count: parseInt(etat.count) || 0
      });
    });

    // Construire le résultat final
    const agentsStats = agents.map(agent => {
      const stats = statsMap[agent.id] || {
        total: 0,
        aujourdhui: 0,
        cette_semaine: 0,
        ce_mois: 0
      };
      const par_etat = etatsMap[agent.id] || [];

      return {
        agent: {
          id: agent.id,
          pseudo: agent.pseudo,
          nom: agent.nom,
          prenom: agent.prenom,
          photo: agent.photo,
          centre: agent.centre,
          centre_nom: agent.centre_nom
        },
        statistiques: {
          total: stats.total,
          aujourdhui: stats.aujourdhui,
          cette_semaine: stats.cette_semaine,
          ce_mois: stats.ce_mois,
          par_etat: par_etat
        }
      };
    });

    res.json({
      success: true,
      data: {
        superviseur: {
          id: superviseur.id,
          pseudo: superviseur.pseudo,
          nom: superviseur.nom,
          prenom: superviseur.prenom,
          photo: superviseur.photo
        },
        agents: agentsStats,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('[STAT] /superviseur/:id - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// =====================================================
// STATISTIQUES PAR AGENT QUALITÉ
// =====================================================

// Récupérer les statistiques par agent qualité (qui ont audité des fiches)
// Se base sur le champ id_qualite dans la table fiches et date_insert_time pour la date
router.get('/agents-qualite', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin,
      id_agent_qualite // Filtre optionnel par agent qualité
    } = req.query;

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Récupérer tous les agents qualité qui ont audité des fiches
    // Un agent qualité est identifié par le champ id_qualite dans la table fiches
    let agentsQualiteQuery = `
      SELECT DISTINCT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        u.fonction,
        fn.titre as fonction_titre,
        u.centre,
        c.titre as centre_titre
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_qualite = u.id
      LEFT JOIN fonctions fn ON u.fonction = fn.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE f.id_qualite IS NOT NULL
      AND f.date_insert_time >= ?
      AND f.date_insert_time <= ?
      AND u.etat > 0
    `;

    const agentsParams = [startDate, endDate];

    if (id_agent_qualite) {
      agentsQualiteQuery += ' AND u.id = ?';
      agentsParams.push(parseInt(id_agent_qualite));
    }

    agentsQualiteQuery += ' ORDER BY u.pseudo ASC';

    const agentsQualite = await query(agentsQualiteQuery, agentsParams);

    // Pour chaque agent qualité, calculer les statistiques
    // Récupérer tous les états pour les statistiques
    const tousEtats = await query(`
      SELECT id, titre, color, abbreviation, groupe
      FROM etats
      ORDER BY groupe ASC, ordre ASC
    `);

    const agentsStats = await Promise.all(
      agentsQualite.map(async (agent) => {
        // Nombre total de fiches auditées par cet agent qualité (basé sur id_qualite)
        const auditsQuery = `
          SELECT COUNT(*) as total_audits
          FROM fiches f
          WHERE f.id_qualite = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `;
        const auditsResult = await queryOne(auditsQuery, [agent.id, startDate, endDate]);
        const totalAudits = auditsResult?.total_audits || 0;

        // Nombre de fiches avec commentaire qualité (non vide)
        const commentQuery = `
          SELECT COUNT(*) as count
          FROM fiches f
          WHERE f.id_qualite = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND f.commentaire_qualite IS NOT NULL
          AND f.commentaire_qualite != ''
          AND (f.archive = 0 OR f.archive IS NULL)
        `;
        const commentResult = await queryOne(commentQuery, [agent.id, startDate, endDate]);
        const fichesAvecCommentaire = commentResult?.count || 0;

        // Nombre de fiches par état
        const statsParEtat = {};
        for (const etat of tousEtats) {
          const etatQuery = `
            SELECT COUNT(*) as count
            FROM fiches f
            WHERE f.id_qualite = ?
            AND f.date_insert_time >= ?
            AND f.date_insert_time <= ?
            AND f.id_etat_final = ?
            AND (f.archive = 0 OR f.archive IS NULL)
          `;
          const etatResult = await queryOne(etatQuery, [agent.id, startDate, endDate, etat.id]);
          const count = etatResult?.count || 0;
          if (count > 0) {
            statsParEtat[etat.id] = {
              id: etat.id,
              titre: etat.titre,
              color: etat.color || '#ccc',
              abbreviation: etat.abbreviation || etat.titre,
              groupe: etat.groupe,
              count: count
            };
          }
        }

        // Détails des fiches auditées (limité à 100 pour les performances)
        const fichesAuditeesQuery = `
          SELECT
            f.id,
            f.hash,
            f.nom,
            f.prenom,
            f.tel,
            f.cp,
            f.ville,
            f.date_insert_time,
            f.commentaire_qualite,
            f.id_etat_final,
            f.ko,
            f.hc,
            e.titre as etat_titre,
            e.color as etat_color,
            e.abbreviation as etat_abbreviation,
            agent_createur.pseudo as agent_pseudo,
            agent_createur.nom as agent_nom,
            agent_createur.prenom as agent_prenom,
            centre.titre as centre_titre,
            f.date_insert_time as date_audit
          FROM fiches f
          LEFT JOIN etats e ON f.id_etat_final = e.id
          LEFT JOIN utilisateurs agent_createur ON f.id_agent = agent_createur.id
          LEFT JOIN centres centre ON f.id_centre = centre.id
          WHERE f.id_qualite = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
          ORDER BY f.date_insert_time DESC
          LIMIT 100
        `;
        const fichesAuditees = await query(fichesAuditeesQuery, [agent.id, startDate, endDate]);

        return {
          agent: {
            id: agent.id,
            pseudo: agent.pseudo,
            nom: agent.nom,
            prenom: agent.prenom,
            photo: agent.photo,
            fonction: agent.fonction,
            fonction_titre: agent.fonction_titre,
            centre: agent.centre,
            centre_titre: agent.centre_titre
          },
          stats: {
            total_audits: totalAudits,
            fiches_avec_commentaire: fichesAvecCommentaire,
            par_etat: statsParEtat
          },
          fiches_auditees: fichesAuditees
        };
      })
    );

    res.json({
      success: true,
      data: {
        agents: agentsStats,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('[STAT] /agents-qualite - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// =====================================================
// KPIs Agent Qualification (taux HC, taux KO) – session agent qualification
// Fiches produites = fiches créées par l'agent, hors poubelle (archive) et doublon (état 61)
// Taux HC = nombre HC / fiches produites ; Taux KO = nombre KO / fiches produites
// =====================================================
router.get('/agent-qualification-kpis', authenticate, async (req, res) => {
  try {
    if (Number(req.user?.fonction) !== 3) {
      return res.status(403).json({
        success: false,
        message: 'Réservé aux agents qualification (fonction 3).'
      });
    }
    const agentId = req.user.id;
    const { date_debut, date_fin } = req.query;
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();
    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;


    const baseConditions = [
      'f.id_agent = ?',
      'f.date_insert_time >= ?',
      'f.date_insert_time <= ?',
      '(f.archive = 0 OR f.archive IS NULL)',
      '(f.id_etat_final != 61 OR f.id_etat_final IS NULL)'
    ];
    const baseParams = [agentId, startDate, endDate];

    const fichesProduitesQuery = `
      SELECT COUNT(DISTINCT f.id) AS count
      FROM fiches f
      WHERE ${baseConditions.join(' AND ')}
    `;
    const fichesProduitesRow = await queryOne(fichesProduitesQuery, baseParams);
    const fichesProduites = fichesProduitesRow?.count ?? 0;

    const ID_ETAT_HC = 55;
    const nbHcQuery = `
      SELECT COUNT(DISTINCT f.id) AS count
      FROM fiches f
      WHERE ${baseConditions.join(' AND ')} AND f.id_etat_final = ?
    `;
    const nbHcRow = await queryOne(nbHcQuery, [...baseParams, ID_ETAT_HC]);
    const nbHc = nbHcRow?.count ?? 0;

    const nbKoQuery = `
      SELECT COUNT(DISTINCT f.id) AS count
      FROM fiches f
      WHERE ${baseConditions.join(' AND ')} AND (f.ko = 1)
    `;
    const nbKoRow = await queryOne(nbKoQuery, baseParams);
    const nbKo = nbKoRow?.count ?? 0;

    const tauxHc = fichesProduites > 0 ? Math.round((nbHc / fichesProduites) * 1000) / 10 : 0;
    const tauxKo = fichesProduites > 0 ? Math.round((nbKo / fichesProduites) * 1000) / 10 : 0;

    const payload = {
      period: { date_debut: startDateStr, date_fin: endDateStr },
      fiches_produites: Number(fichesProduites),
      nb_hc: Number(nbHc),
      nb_ko: Number(nbKo),
      taux_hc: Number(tauxHc),
      taux_ko: Number(tauxKo)
    };

    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('[STAT] /agent-qualification-kpis - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// =====================================================
// KPIs Stats Agents Qualité (alertes KO, remarques)
// =====================================================
router.get('/agents-qualite-kpis', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;
    const today = new Date();
    const startDateStr = date_debut || getFirstOfMonthLocal();
    const endDateStr = date_fin || getTodayLocal();
    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    let qualiteTable = [];
    let reAlertesPie = [];
    let reRemarquesBar = [];
    let agentsQualifTable = [];

    try {
      // 1) Tableau qualité qualification : tous les agents fonction 8 (actifs)
      const qualiteUsers = await query(
        `SELECT id, pseudo, nom, prenom
         FROM utilisateurs
         WHERE fonction = 8 AND (etat > 0 OR etat IS NULL)
         ORDER BY pseudo ASC`
      ).catch(() => []);

      for (const u of qualiteUsers || []) {
        let alertesSentNb = 0;
        let remarquesSentNb = 0;
        try {
          const alertesSent = await queryOne(
            `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_qualite = ? AND date_alerte >= ? AND date_alerte <= ?`,
            [u.id, startDate, endDate]
          );
          alertesSentNb = alertesSent?.nb ?? 0;
        } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        try {
          const remarquesSent = await queryOne(
            `SELECT COUNT(*) AS nb FROM remarques WHERE id_expediteur = ? AND date_remarque >= ? AND date_remarque <= ?`,
            [u.id, startDate, endDate]
          );
          remarquesSentNb = remarquesSent?.nb ?? 0;
        } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        qualiteTable.push({
          id: u.id,
          pseudo: u.pseudo,
          nom: u.nom,
          prenom: u.prenom,
          nb_alertes_envoyees: alertesSentNb,
          nb_remarques_envoyees: remarquesSentNb
        });
      }
      qualiteTable.sort((a, b) => (b.nb_alertes_envoyees + b.nb_remarques_envoyees) - (a.nb_alertes_envoyees + a.nb_remarques_envoyees));

      // 2) RE qualification : alertes reçues par leurs agents (camembert : % et nombre)
      const reList = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE fonction = 2 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC`
      ).catch(() => []);
      let totalAlertes = 0;
      const reAlertesCounts = [];
      for (const re of reList || []) {
        const agents = await query(
          `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND (etat > 0 OR etat IS NULL)`,
          [re.id]
        ).catch(() => []);
        const agentIds = (agents || []).map((a) => a.id);
        let nb = 0;
        if (agentIds.length > 0) {
          try {
            const ph = agentIds.map(() => '?').join(',');
            const r = await queryOne(
              `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent IN (${ph}) AND date_alerte >= ? AND date_alerte <= ?`,
              [...agentIds, startDate, endDate]
            );
            nb = r?.nb ?? 0;
          } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        }
        totalAlertes += nb;
        reAlertesCounts.push({ re_id: re.id, re_pseudo: re.pseudo, nb });
      }
      const totalA = totalAlertes;
      reAlertesPie = reAlertesCounts.map(({ re_pseudo, nb }) => ({
        name: re_pseudo,
        value: nb,
        percent: totalA > 0 ? Math.round((nb / totalA) * 100) : 0
      })).filter((d) => d.value > 0);

      // 3) RE qualification : remarques reçues par leurs agents (graphique en barres)
      let totalRemarques = 0;
      const reRemarquesCounts = [];
      for (const re of reList || []) {
        const agents = await query(
          `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND (etat > 0 OR etat IS NULL)`,
          [re.id]
        ).catch(() => []);
        const agentIds = (agents || []).map((a) => a.id);
        let nb = 0;
        if (agentIds.length > 0) {
          try {
            const ph = agentIds.map(() => '?').join(',');
            const r = await queryOne(
              `SELECT COUNT(*) AS nb FROM remarques WHERE id_destinataire IN (${ph}) AND date_remarque >= ? AND date_remarque <= ?`,
              [...agentIds, startDate, endDate]
            );
            nb = r?.nb ?? 0;
          } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        }
        totalRemarques += nb;
        reRemarquesCounts.push({ re_pseudo: re.pseudo, nb });
      }
      const totalR = totalRemarques;
      reRemarquesBar = reRemarquesCounts.map(({ re_pseudo, nb }) => ({
        name: re_pseudo,
        value: nb,
        percent: totalR > 0 ? Math.round((nb / totalR) * 100) : 0
      }));

      // 4) Tableau agents qualification : nb remarques reçues, nb alertes KO reçues
      const agentsQualif = await query(
        `SELECT id, pseudo, nom, prenom, chef_equipe FROM utilisateurs WHERE fonction = 3 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC`
      ).catch(() => []);
      for (const ag of agentsQualif || []) {
        let alertesKoNb = 0;
        let remarquesNb = 0;
        try {
          const alertesKo = await queryOne(
            `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent = ? AND date_alerte >= ? AND date_alerte <= ?`,
            [ag.id, startDate, endDate]
          );
          alertesKoNb = alertesKo?.nb ?? 0;
        } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        try {
          const remarquesRecu = await queryOne(
            `SELECT COUNT(*) AS nb FROM remarques WHERE id_destinataire = ? AND date_remarque >= ? AND date_remarque <= ?`,
            [ag.id, startDate, endDate]
          );
          remarquesNb = remarquesRecu?.nb ?? 0;
        } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') throw e; }
        agentsQualifTable.push({
          id: ag.id,
          pseudo: ag.pseudo,
          nom: ag.nom,
          prenom: ag.prenom,
          nb_alertes_ko_recues: alertesKoNb,
          nb_remarques_recues: remarquesNb
        });
      }
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    res.json({
      success: true,
      data: {
        period: { date_debut: startDateStr, date_fin: endDateStr },
        qualite_qualification: qualiteTable,
        re_alertes_pie: reAlertesPie,
        re_remarques_bar: reRemarquesBar,
        agents_qualification: agentsQualifTable
      }
    });
  } catch (error) {
    console.error('[STAT] /agents-qualite-kpis - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;
