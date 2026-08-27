const express = require('express');
const router = express.Router();
const { authenticate, checkPermission, isAdminOrBackofficeOrRPConfirmation } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');
const { encodeFicheId } = require('./fiche.routes');
const {
  isAuditQualiteRdvTableAvailable,
  fetchAuditQualiteRdvStats,
} = require('../utils/auditQualiteRdv');

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

/** Parse date + heure pour Production Qualif (date_insert_time). */
function resolveProductionQualifDateRange(query) {
  const { date_debut, date_fin, time_debut, time_fin } = query || {};
  let start =
    typeof date_debut === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date_debut)
      ? date_debut.slice(0, 10)
      : getTodayLocal();
  let end =
    typeof date_fin === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date_fin)
      ? date_fin.slice(0, 10)
      : getTodayLocal();
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const timeDebut =
    time_debut && /^\d{2}:\d{2}/.test(String(time_debut))
      ? `${String(time_debut).slice(0, 5)}:00`
      : '00:00:00';
  const timeFin =
    time_fin && /^\d{2}:\d{2}/.test(String(time_fin))
      ? `${String(time_fin).slice(0, 5)}:00`
      : '23:59:59';
  return {
    start,
    end,
    timeDebut,
    timeFin,
    startDateTime: `${start} ${timeDebut}`,
    endDateTime: `${end} ${timeFin}`,
  };
}

/** Filtres communs production qualif (alignés onglet Statistiques / Fiches). */
const PRODUCTION_QUALIF_FICHE_FILTERS = [
  'f.active = 1',
  'f.archive = 0',
  'f.date_insert_time IS NOT NULL',
  "f.date_insert_time != ''",
];

function buildProductionQualifFicheConditions(agentIds, startDateTime, endDateTime, alias = 'f') {
  const f = alias;
  const filters = PRODUCTION_QUALIF_FICHE_FILTERS.map((c) => c.replace(/\bf\./g, `${f}.`));
  return {
    sql: [
      `${f}.id_agent IN (${agentIds.map(() => '?').join(',')})`,
      ...filters,
      `${f}.date_insert_time >= ?`,
      `${f}.date_insert_time <= ?`,
    ].join(' AND '),
    params: [...agentIds, startDateTime, endDateTime],
  };
}

/** Décale une datetime MySQL (YYYY-MM-DD HH:mm:ss) d'un nombre de jours. */
function shiftMysqlDateTimeByDays(dateTimeStr, days) {
  const normalized = String(dateTimeStr || '').trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return dateTimeStr;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

/** Veille : même créneau horaire (ex. 09:00–10:00 hier). */
function getPreviousDaySameTimeWindow(startDateTime, endDateTime) {
  return {
    mode: 'previous_day',
    startDateTime: shiftMysqlDateTimeByDays(startDateTime, -1),
    endDateTime: shiftMysqlDateTimeByDays(endDateTime, -1),
  };
}

/** Du 1er du mois à une date de fin (même mois) → mois précédent, même jour de fin. */
function isMonthToDatePeriod(startDateStr, endDateStr) {
  if (!/-01$/.test(String(startDateStr))) return false;
  return startDateStr.slice(0, 7) === endDateStr.slice(0, 7);
}

function getPreviousMonthSamePeriod(startDateStr, endDateStr, timeDebut, timeFin) {
  const startD = new Date(`${startDateStr}T12:00:00`);
  const endD = new Date(`${endDateStr}T12:00:00`);
  const prevStart = new Date(startD.getFullYear(), startD.getMonth() - 1, 1);
  const endDay = endD.getDate();
  const lastDayPrevMonth = new Date(endD.getFullYear(), endD.getMonth(), 0).getDate();
  const prevEnd = new Date(
    endD.getFullYear(),
    endD.getMonth() - 1,
    Math.min(endDay, lastDayPrevMonth)
  );
  return {
    mode: 'previous_month',
    startDateTime: `${formatDateLocal(prevStart)} ${timeDebut}`,
    endDateTime: `${formatDateLocal(prevEnd)} ${timeFin}`,
  };
}

function resolveProductionQualifComparisonWindow(startDateStr, endDateStr, startDateTime, endDateTime, timeDebut, timeFin) {
  if (isMonthToDatePeriod(startDateStr, endDateStr)) {
    return getPreviousMonthSamePeriod(startDateStr, endDateStr, timeDebut, timeFin);
  }
  return getPreviousDaySameTimeWindow(startDateTime, endDateTime);
}

async function computeProductionQualifPeriodTotals(agentIds, startDateTime, endDateTime) {
  const ID_ETAT_HC = 55;
  if (!agentIds || agentIds.length === 0) {
    return {
      total: 0,
      nb_ko: 0,
      nb_hc: 0,
      taux_ko: 0,
      taux_hc: 0,
      performance: 0,
    };
  }
  const placeholders = agentIds.map(() => '?').join(',');
  const { sql: baseWhere, params: baseParams } = buildProductionQualifFicheConditions(
    agentIds,
    startDateTime,
    endDateTime
  );

  const totalResult = await queryOne(
    `SELECT COUNT(*) AS total FROM fiches f WHERE ${baseWhere}`,
    baseParams
  );
  const total = Number(totalResult?.total) || 0;

  const koResult = await queryOne(
    `SELECT COUNT(*) AS count FROM fiches f WHERE ${baseWhere} AND f.ko = 1`,
    baseParams
  );
  const nb_ko = Number(koResult?.count) || 0;

  const hcResult = await queryOne(
    `SELECT COUNT(*) AS count FROM fiches f WHERE ${baseWhere} AND f.id_etat_final = ?`,
    [...baseParams, ID_ETAT_HC]
  );
  const nb_hc = Number(hcResult?.count) || 0;

  const taux_ko = total > 0 ? Math.round((nb_ko / total) * 1000) / 10 : 0;
  const taux_hc = total > 0 ? Math.round((nb_hc / total) * 1000) / 10 : 0;
  const nb_conformes = Math.max(0, total - nb_ko - nb_hc);
  const performance = total > 0 ? Math.round((nb_conformes / total) * 1000) / 10 : 0;

  return { total, nb_ko, nb_hc, taux_ko, taux_hc, performance };
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
/** Aligné page Signatures : fiches encore en état signé (pas seulement une ligne signature historique). */
const KPI_CONFIRMATION_SIGNED_ETATS_SQL = `AND f.id_etat_final IN (${KPI_CONFIRMATION_SIGNED_ETATS.join(', ')})`;

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
/** Période KPI confirmations : date_confirmation (repli date_creation si absent). */
const KPI_CONFIRMATION_DATE_SQL = `
  AND COALESCE(c.date_confirmation, c.date_creation) IS NOT NULL
  AND COALESCE(c.date_confirmation, c.date_creation) >= ?
  AND COALESCE(c.date_confirmation, c.date_creation) <= ?
`;
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

/** Filtres centre/produit/etc. pour stats confirmateur (auteur = fh.id_confirmateur). */
function prefixConfirmateurHistoSqlConditions(additionalConditions) {
  if (!additionalConditions) return '';
  return additionalConditions
    .replace(/\bid_centre\b/g, 'f.id_centre')
    .replace(/\bid_confirmateur\b/g, 'fh.id_confirmateur')
    .replace(/\bid_commercial\b/g, 'f.id_commercial')
    .replace(/\bid_agent\b/g, 'f.id_agent')
    .replace(/\bproduit\b/g, 'f.produit');
}

/**
 * Dernière ligne fiches_histo par fiche dans la plage (date_creation),
 * état et confirmateur issus de cette ligne (aligné Dashboard date_champ=fiches_histo).
 */
function buildConfirmateurHistoSourceSql(ficheExtraConditions, excludeEtatIds = []) {
  const excludeEtatsSql = excludeEtatIds.length
    ? ` AND fh.id_etat NOT IN (${excludeEtatIds.map(() => '?').join(',')})`
    : '';
  return `
    SELECT
      CAST(fh.id_etat AS CHAR) AS etat_key,
      fh.id_confirmateur AS entity_id,
      fh.id_fiche
    FROM fiches_histo fh
    INNER JOIN fiches f ON f.id = fh.id_fiche
    INNER JOIN (
      SELECT fh2.id_fiche, MAX(fh2.id) AS max_id
      FROM fiches_histo fh2
      WHERE fh2.date_creation >= ? AND fh2.date_creation <= ?
      GROUP BY fh2.id_fiche
    ) histo_last ON fh.id_fiche = histo_last.id_fiche AND fh.id = histo_last.max_id
    WHERE fh.date_creation >= ? AND fh.date_creation <= ?
      AND fh.id_confirmateur IS NOT NULL AND fh.id_confirmateur > 0
      AND fh.id_etat IS NOT NULL
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.active = 1
      AND (f.ko = 0 OR f.ko IS NULL)
      ${excludeEtatsSql}
      ${ficheExtraConditions}
  `;
}

function buildConfirmateurHistoParams(startDt, endDt, excludeEtatIds, filterParamsAfterDates = []) {
  return [startDt, endDt, startDt, endDt, ...excludeEtatIds, ...filterParamsAfterDates];
}

function isEtatGroupe0(etat) {
  const g = etat?.groupe;
  return g === '0' || g === 0;
}

/** États finaux possibles d'un compte rendu (Signer = id 13 uniquement, pas PM/COMPLET/RETRACTER). */
const ETATS_COMPTE_RENDU_STAT_IDS = new Set(
  [8, 9, 12, 13, 23, 34, 35].map(String)
);

const {
  commercialCrApprovedBaseSql,
  commercialCrDateFilterParts,
} = require('../utils/commercialCrSql');

/** Stats commercial : compte_rendu_pending approuvés, filtre date = modification CR ou date RDV fiche. */
function buildCommercialCrSourceSql(ficheExtraConditions, excludeEtatIds = [], dateField = 'date_modif_time') {
  const etatCr = 'CAST(cr.id_etat_final AS CHAR)';
  const base = commercialCrApprovedBaseSql([], 'f');
  const dateParts = commercialCrDateFilterParts(dateField);
  const excludeEtatsSql = excludeEtatIds.length
    ? ` AND cr.id_etat_final NOT IN (${excludeEtatIds.map(() => '?').join(',')})`
    : '';

  return `
    SELECT ${etatCr} AS etat_key, cr.id_commercial AS entity_id
    FROM compte_rendu_pending cr
    INNER JOIN fiches f ON f.id = cr.id_fiche
    INNER JOIN utilisateurs u_com ON u_com.id = cr.id_commercial AND u_com.fonction = 5 AND u_com.etat > 0
    WHERE ${base.sql}
      AND ${dateParts.sql}${excludeEtatsSql}${ficheExtraConditions}
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
    let etatsForDisplay = hideGroupe0Etats
      ? baseEtatsForDisplay.filter((e) => !isEtatGroupe0(e))
      : baseEtatsForDisplay;

    if (name_stat === 'COMMERCIAL') {
      etatsForDisplay = etatsForDisplay.filter((e) =>
        ETATS_COMPTE_RENDU_STAT_IDS.has(String(e.id))
      );
    }

    // Valider le champ de date pour éviter les injections SQL
    // Note: date_appel_time n'existe pas dans le schéma, on utilise date_appel (bigint) si nécessaire
    const allowedDateFields = ['date_insert_time', 'date_modif_time', 'date_rdv_time'];
    const defaultDateField = name_stat === 'AGENT' ? 'date_insert_time' : 'date_modif_time';
    const safeDateField = allowedDateFields.includes(champ_date) ? champ_date : defaultDateField;
    // Onglet AGENT : toujours filtrer sur la date d'insertion (saisie)
    const dateFieldForQuery = name_stat === 'AGENT'
      ? 'date_insert_time'
      : safeDateField;

    const commercialDateField =
      safeDateField === 'date_rdv_time' ? 'date_rdv_time' : 'date_modif_time';

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
  const isConfirmateurStat = name_stat === 'CONFIRMATEUR';
  const commercialFicheExtra = isCommercialStat
    ? prefixFicheSqlConditions(
        id_commercial
          ? additionalConditions.replace(/\s*AND\s*id_commercial\s*=\s*\?/i, '')
          : additionalConditions
      )
    : additionalConditions;
  const confirmateurHistoExtra = isConfirmateurStat
    ? prefixConfirmateurHistoSqlConditions(additionalConditions)
    : '';

    // Récupérer le total de fiches pour la période
    let total;
    let stats;

    if (isConfirmateurStat) {
      const histoParams = buildConfirmateurHistoParams(
        queryParams[0],
        queryParams[1],
        etatGroupe0Ids,
        queryParams.slice(2)
      );
      const histoSql = buildConfirmateurHistoSourceSql(
        confirmateurHistoExtra,
        etatGroupe0Ids
      );

      const totalResult = await queryOne(
        `SELECT COUNT(DISTINCT id_fiche) AS total
         FROM (${histoSql}) confirmateur_src
         WHERE entity_id IS NOT NULL AND entity_id > 0`,
        histoParams
      );
      total = totalResult?.total || 0;

      stats = await query(
        `SELECT
           etat_key,
           entity_id AS \`${groupByField}\`,
           COUNT(DISTINCT id_fiche) AS stats
         FROM (${histoSql}) confirmateur_src
         WHERE entity_id IS NOT NULL AND entity_id > 0
         GROUP BY etat_key, entity_id
         ORDER BY etat_key ASC`,
        histoParams
      );
    } else if (isCommercialStat) {
      const crSql = buildCommercialCrSourceSql(
        commercialFicheExtra,
        etatGroupe0Ids,
        commercialDateField
      );
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
      if (name_stat === 'COMMERCIAL' && !ETATS_COMPTE_RENDU_STAT_IDS.has(String(etatId))) return;

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
      if (name_stat === 'COMMERCIAL' && !entitiesMap[entityId]) return;
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

// GET /api/statistiques/kpi-commerciaux
// KPI commerciaux : honoré à suivre, refusés, signatures (comptes rendus approuvés, date RDV)
router.get('/kpi-commerciaux', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin, produit } = req.query;
    const startDate = date_debut || getFirstOfMonthLocal();
    const endDate = date_fin || getTodayLocal();
    const startDt = `${startDate} 00:00:00`;
    const endDt = `${endDate} 23:59:59`;

    const ID_HONORE = 9;
    const ID_REFUSER = 12;
    const SIGNER_IDS = [13, 16, 38, 44, 45];

    let produitSql = '';
    const queryParams = [ID_HONORE, ID_REFUSER, ...SIGNER_IDS, startDt, endDt];
    if (produit === '1' || produit === '2') {
      produitSql = ' AND f.produit = ?';
      queryParams.push(parseInt(produit, 10));
    }

    const statsRows = await query(
      `SELECT
        u.id AS id_commercial,
        u.pseudo AS commercial,
        u.color AS commercial_color,
        COUNT(*) AS total_rdv_honores,
        SUM(CASE WHEN cr.id_etat_final = ? THEN 1 ELSE 0 END) AS honore_a_suivre,
        SUM(CASE WHEN cr.id_etat_final = ? THEN 1 ELSE 0 END) AS rdv_refuse,
        SUM(CASE WHEN cr.id_etat_final IN (${SIGNER_IDS.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS signatures
      FROM compte_rendu_pending cr
      INNER JOIN fiches f ON f.id = cr.id_fiche
      INNER JOIN utilisateurs u ON u.id = cr.id_commercial AND u.fonction = 5 AND u.etat > 0
      WHERE cr.statut = 'approved'
        AND cr.id_commercial IS NOT NULL AND cr.id_commercial > 0
        AND cr.id_etat_final IS NOT NULL
        AND f.date_rdv_time IS NOT NULL AND f.date_rdv_time != ''
        AND f.date_rdv_time >= ? AND f.date_rdv_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        AND (f.ko = 0 OR f.ko IS NULL)
        ${produitSql}
      GROUP BY u.id, u.pseudo, u.color`,
      queryParams
    );

    const allCommerciaux = await query(
      `SELECT id, pseudo, color FROM utilisateurs WHERE fonction = 5 AND etat > 0 ORDER BY pseudo ASC`
    );

    const statsById = new Map((statsRows || []).map((r) => [Number(r.id_commercial), r]));
    const pct = (n, total) => (total > 0 ? Math.round((n / total) * 10000) / 100 : 0);

    const rows = (allCommerciaux || []).map((u) => {
      const r = statsById.get(Number(u.id));
      const total = Number(r?.total_rdv_honores) || 0;
      const honore = Number(r?.honore_a_suivre) || 0;
      const refuse = Number(r?.rdv_refuse) || 0;
      const signatures = Number(r?.signatures) || 0;
      return {
        id_commercial: u.id,
        commercial: u.pseudo || r?.commercial || `ID ${u.id}`,
        color: u.color || r?.commercial_color || null,
        total_rdv_honores: total,
        honore_a_suivre: honore,
        rdv_refuse: refuse,
        signatures,
        taux_r2: pct(honore, total),
        taux_refuses: pct(refuse, total),
        taux_signes: pct(signatures, total),
      };
    });

    res.json({
      success: true,
      data: {
        period: { date_debut: startDate, date_fin: endDate },
        rows,
      },
    });
  } catch (error) {
    console.error('[STAT] /kpi-commerciaux - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des KPI commerciaux',
      error: error.message,
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
    // RE Confirmation (14) : uniquement fiches dont un confirmateur de son équipe est en id_confirmateur (pas 2/3)
    const isREConfirmation = Number(req.user?.fonction) === 14;
    let rdvUpcoming;
    if (isREConfirmation) {
      rdvUpcoming = await queryOne(`
        SELECT COUNT(*) as count
        FROM fiches f
        INNER JOIN utilisateurs u ON u.id = f.id_confirmateur AND u.fonction = 6 AND u.etat > 0 AND u.chef_equipe = ?
        WHERE f.id_etat_final = 7
        AND f.date_rdv_time >= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [req.user.id, todayStart]);
    } else {
      rdvUpcoming = await queryOne(`
        SELECT COUNT(*) as count
        FROM fiches
        WHERE id_etat_final = 7
        AND date_rdv_time >= ?
        AND (archive = 0 OR archive IS NULL)
      `, [todayStart]);
    }

    // 4. Liste des confirmateurs actifs avec RDV aujourd'hui (fiches_histo) et à venir (fiches)
    // RDV à venir : uniquement le 1er confirmateur (id_confirmateur), pas les slots 2/3
    // RE Confirmation : tous les confirmateurs actifs (pas seulement son équipe)
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
          WHERE f.id_confirmateur = u.id
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
      id_superviseur,
      id_etat_final
    } = req.query;

    const {
      start: startDateStr,
      end: endDateStr,
      timeDebut,
      timeFin,
      startDateTime: startDate,
      endDateTime: endDate,
    } = resolveProductionQualifDateRange(req.query);

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
            date_fin: endDateStr,
            time_debut: timeDebut,
            time_fin: timeFin,
            start_datetime: startDate,
            end_datetime: endDate,
          },
          comparison: null,
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
    const allAgentIdsSet = new Set();
    const superviseursStats = await Promise.all(
      superviseurs.map(async (superviseur) => {
        // Récupérer les agents sous ce superviseur
        const agents = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
          [superviseur.id]
        );

        const agentIds = agents.map(a => a.id);
        agentIds.forEach((id) => allAgentIdsSet.add(id));

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

        const { sql: fichesWhere, params: fichesParams } = buildProductionQualifFicheConditions(
          agentIds,
          startDate,
          endDate
        );

        if (koEtatId != null) {
          const fichesStatsRows = await query(
            `SELECT
              CASE WHEN (f.ko = 1) THEN ? ELSE f.id_etat_final END AS etat_key,
              COUNT(*) AS count
            FROM fiches f
            LEFT JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesWhere}
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
             WHERE ${fichesWhere}
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
          const validatedConditions = [
            fichesWhere,
            '(f.ko = 0 OR f.ko IS NULL)',
          ];
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

        // Total (BRUT) : mêmes filtres que l'onglet Fiches
        const totalResult = await queryOne(
          `SELECT COUNT(*) as total FROM fiches f WHERE ${fichesWhere}`,
          fichesParams
        );

        const total = totalResult?.total || 0;

        return {
          superviseur,
          stats,
          total
        };
      })
    );

    const allAgentIds = [...allAgentIdsSet];
    const currentTotals = await computeProductionQualifPeriodTotals(
      allAgentIds,
      startDate,
      endDate
    );

    const previousWindow = resolveProductionQualifComparisonWindow(
      startDateStr,
      endDateStr,
      startDate,
      endDate,
      timeDebut,
      timeFin
    );
    const previousTotals = await computeProductionQualifPeriodTotals(
      allAgentIds,
      previousWindow.startDateTime,
      previousWindow.endDateTime
    );

    const deltaFiches = currentTotals.total - previousTotals.total;
    const deltaPerformance = Math.round((currentTotals.performance - previousTotals.performance) * 10) / 10;
    const deltaKo = currentTotals.nb_ko - previousTotals.nb_ko;
    const deltaHc = currentTotals.nb_hc - previousTotals.nb_hc;

    res.json({
      success: true,
      data: {
        superviseurs: superviseursStats,
        etats: etatsListe,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr,
          time_debut: timeDebut,
          time_fin: timeFin,
          start_datetime: startDate,
          end_datetime: endDate,
        },
        comparison: {
          mode: previousWindow.mode,
          current: currentTotals,
          previous: {
            ...previousTotals,
            period: {
              start_datetime: previousWindow.startDateTime,
              end_datetime: previousWindow.endDateTime,
            },
          },
          delta: {
            total: deltaFiches,
            nb_ko: deltaKo,
            nb_hc: deltaHc,
            performance: deltaPerformance,
          },
        },
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
    confirmateur_histo_modifications_count: 0,
    signature_rate: 0,
    signature_rate_change: 0,
    signatures_count: 0,
    compte_rendu_visites_count: 0,
    fiches_signees_count: 0,
    rdvs_visites_count: 0,
  };
}

/** Log SQL + paramètres pour debug KPIs confirmation. */
function logKpiConfirmationSql(scope, name, sql, params = []) {
  const normalized = String(sql || '').replace(/\s+/g, ' ').trim();
  console.log(`[STAT][KPI-CONFIRMATION][${scope}] --- ${name} ---`);
  console.log(`[STAT][KPI-CONFIRMATION][${scope}] SQL: ${normalized}`);
  console.log(`[STAT][KPI-CONFIRMATION][${scope}] Params:`, params);
}

/**
 * KPIs confirmation agrégés.
 * @param {number[]|null} centreIds - null = tous les centres actifs ; [] = aucun (vide) ; liste = filtre IN
 * @param {object} dateRange
 * @param {string} [logScope] - libellé pour les logs (ex. kpis-confirmation, kpis-confirmation-jws)
 */
async function computeKpisConfirmationRange(centreIds, dateRange, logScope = 'kpis-confirmation') {
  const periodStart = dateRange.start;
  const periodEnd = dateRange.end;
  const emptyRange = buildEmptyKpisConfirmationRange(dateRange);
  if (centreIds != null && centreIds.length === 0) {
    console.log(`[STAT][KPI-CONFIRMATION][${logScope}] Aucun centre JWS — résultats vides`);
    return emptyRange;
  }

  const filterByCentre = centreIds != null && centreIds.length > 0;
  const scopeLabel = filterByCentre
    ? `${logScope}|JWS|centres=${centreIds.join(',')}`
    : `${logScope}|TOUS_CENTRES`;
  console.log(`[STAT][KPI-CONFIRMATION][${scopeLabel}] Période: ${dateRange.startDateTime} → ${dateRange.endDateTime}`);
  console.log(
    `[STAT][KPI-CONFIRMATION][${scopeLabel}] Période précédente: ${dateRange.start} → comparaison via getPreviousPeriodComparisonRange`
  );
  const centreCondition = filterByCentre
    ? `AND f.id_centre IN (${centreIds.map(() => '?').join(',')})`
    : '';
  const centreParams = filterByCentre ? centreIds : [];
  const signatureCentreWhere = filterByCentre
    ? `WHERE f.id_centre IN (${centreIds.map(() => '?').join(', ')})`
    : 'WHERE 1=1';

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
      INNER JOIN fiches f ON c.id_fiche = f.id
      INNER JOIN utilisateurs u ON c.id_confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      WHERE c.id_confirmateur IS NOT NULL
      AND c.id_confirmateur > 0
      ${KPI_CONFIRMATION_DATE_SQL}
      ${centreCondition}
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY count_confirmations DESC
      LIMIT 3
    `;

  const top3SignaturesQuery = `
      SELECT 
        s.confirmateur as id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        COUNT(DISTINCT s.id_fiche) as count_fiches_signees
      FROM signature s
      INNER JOIN fiches f ON s.id_fiche = f.id
      INNER JOIN utilisateurs u ON s.confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      ${signatureCentreWhere}
      ${KPI_FICHE_RDV_DATE_SQL}
      ${KPI_CONFIRMATION_SIGNED_ETATS_SQL}
      AND s.id_fiche IS NOT NULL
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY count_fiches_signees DESC
      LIMIT 3
    `;

  const compteRenduVisitesQuery = `
      SELECT COUNT(*) as count
      FROM compte_rendu_pending cr
      INNER JOIN fiches f ON f.id = cr.id_fiche
      WHERE 1=1
      ${crDateVisiteFilter.sql}
      ${centreCondition}
    `;

  const confirmationsQuery = `
      SELECT COUNT(*) as count
      FROM confirmations c
      INNER JOIN fiches f ON c.id_fiche = f.id
      WHERE 1=1
      ${KPI_CONFIRMATION_DATE_SQL}
      ${centreCondition}
    `;

  /** Modifications d'état (fiches_histo) par agents confirmation (fonction 6), période = date_creation. */
  const fichesTraiteesQuery = `
      SELECT
        COUNT(DISTINCT fh.id_fiche) AS count_fiches,
        COUNT(*) AS count_modifications
      FROM fiches_histo fh
      INNER JOIN fiches f ON fh.id_fiche = f.id
      INNER JOIN utilisateurs u ON fh.id_confirmateur = u.id AND u.fonction = 6 AND u.etat > 0
      WHERE fh.id_confirmateur IS NOT NULL
      AND fh.id_confirmateur > 0
      AND fh.id_etat IS NOT NULL
      ${KPI_FICHES_HISTO_PERIOD_SQL}
      ${centreCondition}
    `;

  const signaturesFichesDistinctSql = `SELECT COUNT(DISTINCT s.id_fiche) as total
       FROM signature s
       INNER JOIN fiches f ON s.id_fiche = f.id
       ${signatureCentreWhere}
       ${KPI_FICHE_RDV_DATE_SQL}
       ${KPI_CONFIRMATION_SIGNED_ETATS_SQL}
       AND s.id_fiche IS NOT NULL`;

  const signaturesFichesDistinctParams = [...(filterByCentre ? centreParams : []), startDate, endDate];
  const signaturesFichesDistinctPreviousParams = [
    ...(filterByCentre ? centreParams : []),
    previousStartDate,
    previousEndDate,
  ];

  logKpiConfirmationSql(scopeLabel, 'top3_confirmations', top3ConfirmationsQuery, [
    startDate,
    endDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(scopeLabel, 'top3_signatures', top3SignaturesQuery, [
    ...(filterByCentre ? centreParams : []),
    startDate,
    endDate,
  ]);
  logKpiConfirmationSql(
    scopeLabel,
    'signatures_fiches_distinct (période actuelle)',
    signaturesFichesDistinctSql,
    signaturesFichesDistinctParams
  );
  logKpiConfirmationSql(scopeLabel, 'compte_rendu_visites (période actuelle)', compteRenduVisitesQuery, [
    startDate,
    endDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(scopeLabel, 'confirmations_count (période actuelle)', confirmationsQuery, [
    startDate,
    endDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(scopeLabel, 'fiches_traitees (période actuelle)', fichesTraiteesQuery, [
    startDate,
    endDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(scopeLabel, 'confirmations_count (période précédente)', confirmationsQuery, [
    previousStartDate,
    previousEndDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(
    scopeLabel,
    'signatures_fiches_distinct (période précédente)',
    signaturesFichesDistinctSql,
    signaturesFichesDistinctPreviousParams
  );
  logKpiConfirmationSql(scopeLabel, 'compte_rendu_visites (période précédente)', compteRenduVisitesQuery, [
    previousStartDate,
    previousEndDate,
    ...centreParams,
  ]);
  logKpiConfirmationSql(scopeLabel, 'fiches_traitees (période précédente)', fichesTraiteesQuery, [
    previousStartDate,
    previousEndDate,
    ...centreParams,
  ]);
  console.log(
    `[STAT][KPI-CONFIRMATION][${scopeLabel}] Filtre date_visite CR:`,
    crDateVisiteFilter.sql.replace(/\s+/g, ' ').trim()
  );

  const [
    top3Confirmations,
    top3SignaturesRows,
    signaturesFichesDistinctResult,
    compteRenduVisitesResult,
    confirmationsResult,
    fichesTraiteesResult,
    previousConfirmationsResult,
    previousSignaturesFichesDistinctResult,
    previousCompteRenduVisitesResult,
    previousFichesTraiteesResult,
  ] = await Promise.all([
    query(top3ConfirmationsQuery, [startDate, endDate, ...centreParams]),
    query(top3SignaturesQuery, [
      ...(filterByCentre ? centreParams : []),
      startDate,
      endDate,
    ]),
    queryOne(signaturesFichesDistinctSql, signaturesFichesDistinctParams),
    queryOne(compteRenduVisitesQuery, [startDate, endDate, ...centreParams]),
    queryOne(confirmationsQuery, [startDate, endDate, ...centreParams]),
    queryOne(fichesTraiteesQuery, [startDate, endDate, ...centreParams]),
    queryOne(confirmationsQuery, [previousStartDate, previousEndDate, ...centreParams]),
    queryOne(signaturesFichesDistinctSql, signaturesFichesDistinctPreviousParams),
    queryOne(compteRenduVisitesQuery, [previousStartDate, previousEndDate, ...centreParams]),
    queryOne(fichesTraiteesQuery, [previousStartDate, previousEndDate, ...centreParams]),
  ]);

  const signaturesFichesDistinctCount = parseInt(signaturesFichesDistinctResult?.total || 0, 10);

  const compteRenduVisitesCount = compteRenduVisitesResult?.count || 0;
  const confirmationsCount = confirmationsResult?.count || 0;
  const fichesTraiteesCount = parseInt(fichesTraiteesResult?.count_fiches || 0, 10);
  const confirmateurHistoModificationsCount = parseInt(
    fichesTraiteesResult?.count_modifications || 0,
    10
  );
  const previousConfirmationsCount = previousConfirmationsResult?.count || 0;
  const previousSignaturesFichesDistinctCount = parseInt(
    previousSignaturesFichesDistinctResult?.total || 0,
    10
  );
  const previousCompteRenduVisitesCount = previousCompteRenduVisitesResult?.count || 0;
  const previousFichesTraiteesCount = parseInt(previousFichesTraiteesResult?.count_fiches || 0, 10);
  const previousConfirmateurHistoModificationsCount = parseInt(
    previousFichesTraiteesResult?.count_modifications || 0,
    10
  );

  const confirmationRate = fichesTraiteesCount > 0 ? (confirmationsCount / fichesTraiteesCount) * 100 : 0;
  const signatureRate =
    compteRenduVisitesCount > 0 ? (signaturesFichesDistinctCount / compteRenduVisitesCount) * 100 : 0;
  const previousConfirmationRate =
    previousFichesTraiteesCount > 0 ? (previousConfirmationsCount / previousFichesTraiteesCount) * 100 : 0;
  const previousSignatureRate =
    previousCompteRenduVisitesCount > 0
      ? (previousSignaturesFichesDistinctCount / previousCompteRenduVisitesCount) * 100
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
    previousSignaturesFichesDistinctCount > 0
      ? ((signaturesFichesDistinctCount - previousSignaturesFichesDistinctCount) /
          previousSignaturesFichesDistinctCount) *
        100
      : signaturesFichesDistinctCount > 0
        ? 100
        : 0;
  const confirmationTrend =
    confirmationEvolutionChange > 0 ? 'up' : confirmationEvolutionChange < 0 ? 'down' : 'stable';
  const signatureTrend = signatureEvolutionChange > 0 ? 'up' : signatureEvolutionChange < 0 ? 'down' : 'stable';

  console.log(`[STAT][KPI-CONFIRMATION][${scopeLabel}] Résultats:`, {
    confirmations_count: confirmationsCount,
    fiches_traitees_count: fichesTraiteesCount,
    confirmateur_histo_modifications_count: confirmateurHistoModificationsCount,
    confirmation_rate: confirmationRate,
    signatures_fiches_distinct_count: signaturesFichesDistinctCount,
    compte_rendu_visites_count: compteRenduVisitesCount,
    signature_rate: signatureRate,
    previous_confirmations_count: previousConfirmationsCount,
    previous_fiches_traitees_count: previousFichesTraiteesCount,
    previous_confirmateur_histo_modifications_count: previousConfirmateurHistoModificationsCount,
    previous_signatures_fiches_distinct_count: previousSignaturesFichesDistinctCount,
    previous_compte_rendu_visites_count: previousCompteRenduVisitesCount,
  });

  return {
    period: 'Période sélectionnée',
    date_start: periodStart,
    date_end: periodEnd,
    confirmation_rate: confirmationRate,
    confirmation_rate_change: confirmationRateChange,
    confirmations_count: confirmationsCount,
    fiches_traitees_count: fichesTraiteesCount,
    confirmateur_histo_modifications_count: confirmateurHistoModificationsCount,
    signature_rate: signatureRate,
    signature_rate_change: signatureRateChange,
    signatures_count: signaturesFichesDistinctCount,
    signatures_fiches_distinct_count: signaturesFichesDistinctCount,
    compte_rendu_visites_count: compteRenduVisitesCount,
    fiches_signees_count: signaturesFichesDistinctCount,
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
      count: parseInt(conf.count_fiches_signees || 0, 10),
    })),
    confirmation_evolution: {
      current: confirmationsCount,
      previous: previousConfirmationsCount,
      change: confirmationEvolutionChange,
      trend: confirmationTrend,
    },
    signature_evolution: {
      current: signaturesFichesDistinctCount,
      previous: previousSignaturesFichesDistinctCount,
      change: signatureEvolutionChange,
      trend: signatureTrend,
    },
  };
}

async function queryJwsCentreIds(logScope = 'kpis-confirmation-jws') {
  const sql = `
    SELECT id, titre FROM centres
    WHERE (titre = 'CALL_JWS' OR titre LIKE 'CALL_JWS%' OR titre LIKE 'Call_JWS%')
    AND etat > 0
  `;
  logKpiConfirmationSql(logScope, 'centres_jws', sql, []);
  const rows = await query(sql);
  const ids = (rows || []).map((c) => c.id);
  console.log(
    `[STAT][KPI-CONFIRMATION][${logScope}] Centres JWS:`,
    (rows || []).map((c) => `${c.id}:${c.titre}`).join(' | ') || '(aucun)'
  );
  return ids;
}

// Récupérer les KPIs Confirmation (tous les centres)
router.get('/kpis-confirmation', authenticate, async (req, res) => {
  try {
    const dateRange = resolveKpiDateRangeFromQuery(req);
    console.log('[STAT] /kpis-confirmation - query:', req.query);
    const range = await computeKpisConfirmationRange(null, dateRange, 'kpis-confirmation');
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
    console.log('[STAT] /kpis-confirmation-jws - query:', req.query);
    const centreIds = await queryJwsCentreIds('kpis-confirmation-jws');
    const range = await computeKpisConfirmationRange(centreIds, dateRange, 'kpis-confirmation-jws');
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

/** Fiches insérées par un agent qualification (fonction 3). */
const STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN = `
  INNER JOIN utilisateurs agent_qualif ON f.id_agent = agent_qualif.id
    AND agent_qualif.fonction = 3
`;

async function fetchQualiteConfirmationCompletudeStats(startDate, endDate) {
  const empty = {
    agents: [],
    totaux: { total_completudes: 0, en_attente: 0, traitees: 0, non_traitees: 0 },
  };
  try {
    const rows = await query(
      `SELECT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        fn.titre AS fonction_titre,
        c.titre AS centre_titre,
        COUNT(*) AS total_completudes,
        SUM(CASE WHEN fc.statut = 'en_attente' THEN 1 ELSE 0 END) AS en_attente,
        SUM(CASE WHEN fc.statut = 'traitee' THEN 1 ELSE 0 END) AS traitees,
        SUM(CASE WHEN fc.statut = 'non_traitee' THEN 1 ELSE 0 END) AS non_traitees
      FROM fiche_completude fc
      INNER JOIN utilisateurs u ON fc.id_created_by = u.id AND u.fonction = 4 AND u.etat > 0
      LEFT JOIN fonctions fn ON u.fonction = fn.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE fc.date_creation >= ? AND fc.date_creation <= ?
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo, fn.titre, c.titre
      ORDER BY total_completudes DESC`,
      [startDate, endDate]
    );
    const agents = (rows || []).map((row) => ({
      agent: {
        id: row.id,
        pseudo: row.pseudo,
        nom: row.nom,
        prenom: row.prenom,
        photo: row.photo,
        fonction_titre: row.fonction_titre,
        centre_titre: row.centre_titre,
      },
      stats: {
        total_completudes: parseInt(row.total_completudes || 0, 10),
        en_attente: parseInt(row.en_attente || 0, 10),
        traitees: parseInt(row.traitees || 0, 10),
        non_traitees: parseInt(row.non_traitees || 0, 10),
      },
    }));
    const totaux = agents.reduce(
      (acc, a) => ({
        total_completudes: acc.total_completudes + a.stats.total_completudes,
        en_attente: acc.en_attente + a.stats.en_attente,
        traitees: acc.traitees + a.stats.traitees,
        non_traitees: acc.non_traitees + a.stats.non_traitees,
      }),
      { total_completudes: 0, en_attente: 0, traitees: 0, non_traitees: 0 }
    );
    return { agents, totaux };
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return empty;
    throw err;
  }
}

/** Fiches auditées qualif : id_qualite + fiches créées par agent qualification (fonction 3), période = date_insert_time. */
async function fetchFichesAuditeesQualifList(startDate, endDate, idAgentQualite = null) {
  const empty = { fiches: [], agents_options: [] };
  try {
    const agentsOptions = await query(
      `SELECT DISTINCT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_qualite = u.id AND u.etat > 0
      ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
      WHERE f.id_qualite IS NOT NULL
      AND f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ORDER BY u.pseudo ASC`,
      [startDate, endDate]
    );

    const ficheParams = [startDate, endDate];
    let agentFilterSql = '';
    if (idAgentQualite) {
      agentFilterSql = ' AND f.id_qualite = ?';
      ficheParams.push(idAgentQualite);
    }

    const fichesRows = await query(
      `SELECT
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
        e.titre AS etat_titre,
        e.color AS etat_color,
        e.abbreviation AS etat_abbreviation,
        e.groupe AS etat_groupe,
        e.taux AS etat_taux,
        u_qual.id AS qualite_id,
        u_qual.pseudo AS qualite_pseudo,
        u_qual.nom AS qualite_nom,
        u_qual.prenom AS qualite_prenom,
        agent_createur.pseudo AS agent_pseudo,
        agent_createur.nom AS agent_nom,
        agent_createur.prenom AS agent_prenom,
        centre.titre AS centre_titre,
        f.date_insert_time AS date_audit
      FROM fiches f
      ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
      INNER JOIN utilisateurs u_qual ON f.id_qualite = u_qual.id
      LEFT JOIN etats e ON f.id_etat_final = e.id
      LEFT JOIN utilisateurs agent_createur ON f.id_agent = agent_createur.id
      LEFT JOIN centres centre ON f.id_centre = centre.id
      WHERE f.id_qualite IS NOT NULL
      AND f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${agentFilterSql}
      ORDER BY f.date_insert_time DESC, f.id DESC`,
      ficheParams
    );

    const fiches = (fichesRows || []).map((f) => ({
      id: f.id,
      hash: f.hash || encodeFicheId(f.id),
      nom: f.nom,
      prenom: f.prenom,
      tel: f.tel,
      cp: f.cp,
      ville: f.ville,
      date_audit: f.date_audit,
      commentaire_qualite: f.commentaire_qualite,
      id_etat_final: f.id_etat_final,
      ko: f.ko,
      hc: f.hc,
      etat_titre: f.etat_titre,
      etat_color: f.etat_color,
      etat_abbreviation: f.etat_abbreviation,
      etat_groupe: f.etat_groupe,
      etat_taux: f.etat_taux,
      agent_pseudo: f.agent_pseudo,
      agent_nom: f.agent_nom,
      agent_prenom: f.agent_prenom,
      centre_titre: f.centre_titre,
      qualite: {
        id: f.qualite_id,
        pseudo: f.qualite_pseudo,
        nom: f.qualite_nom,
        prenom: f.qualite_prenom,
      },
    }));

    return {
      fiches,
      agents_options: (agentsOptions || []).map((u) => ({
        id: u.id,
        pseudo: u.pseudo,
        nom: u.nom,
        prenom: u.prenom,
      })),
    };
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') return empty;
    throw err;
  }
}

/** RDV audités : période = date_audit (table audit_qualite_rdv), repli fiches.date_modif_time si table absente. */
async function fetchQualiteConfirmationAuditStats(startDate, endDate, idAgentQualiteConfirmation = null) {
  const empty = {
    agents: [],
    agents_options: [],
    totaux: {
      total_rdvs_audites: 0,
      avec_observation: 0,
      signatures: 0,
      taux_signature: 0,
      porte_ouverte: 0,
      taux_porte_ouverte: 0,
    },
    rdvs_audites: [],
  };
  try {
    if (await isAuditQualiteRdvTableAvailable()) {
      return fetchAuditQualiteRdvStats(
        startDate,
        endDate,
        idAgentQualiteConfirmation,
        encodeFicheId
      );
    }

    const agentConfirmFilterSql = idAgentQualiteConfirmation
      ? ' AND f.id_qualite_confirmation = ?'
      : '';
    const agentConfirmParams = idAgentQualiteConfirmation ? [idAgentQualiteConfirmation] : [];
    const periodParams = [startDate, endDate, ...agentConfirmParams];

    const agentsOptions = await query(
      `SELECT DISTINCT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_qualite_confirmation = u.id AND u.fonction = 4 AND u.etat > 0
      WHERE f.id_qualite_confirmation IS NOT NULL
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.date_modif_time >= ? AND f.date_modif_time <= ?
      ORDER BY u.pseudo ASC`,
      periodParams
    );

    const rows = await query(
      `SELECT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        fn.titre AS fonction_titre,
        c.titre AS centre_titre,
        COUNT(DISTINCT f.id) AS total_rdvs_audites,
        COUNT(
          DISTINCT CASE
            WHEN f.observation_qualite IS NOT NULL AND TRIM(f.observation_qualite) != ''
            THEN f.id
            ELSE NULL
          END
        ) AS avec_observation
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_qualite_confirmation = u.id AND u.fonction = 4 AND u.etat > 0
      LEFT JOIN fonctions fn ON u.fonction = fn.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE f.id_qualite_confirmation IS NOT NULL
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.date_modif_time >= ? AND f.date_modif_time <= ?
      ${agentConfirmFilterSql}
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo, fn.titre, c.titre
      ORDER BY total_rdvs_audites DESC`,
      periodParams
    );
    const agents = (rows || []).map((row) => ({
      agent: {
        id: row.id,
        pseudo: row.pseudo,
        nom: row.nom,
        prenom: row.prenom,
        photo: row.photo,
        fonction_titre: row.fonction_titre,
        centre_titre: row.centre_titre,
      },
      stats: {
        total_rdvs_audites: parseInt(row.total_rdvs_audites || 0, 10),
        avec_observation: parseInt(row.avec_observation || 0, 10),
      },
    }));
    const totaux = agents.reduce(
      (acc, a) => ({
        total_rdvs_audites: acc.total_rdvs_audites + a.stats.total_rdvs_audites,
        avec_observation: acc.avec_observation + a.stats.avec_observation,
      }),
      { total_rdvs_audites: 0, avec_observation: 0 }
    );

    const rdvsRows = await query(
      `SELECT
        f.id,
        f.hash,
        f.nom,
        f.prenom,
        f.tel,
        f.cp,
        f.ville,
        f.date_rdv_time,
        f.date_modif_time AS date_audit,
        f.observation_qualite,
        f.id_etat_final,
        f.valider,
        u_aud.id AS auditeur_id,
        u_aud.pseudo AS auditeur_pseudo,
        u_aud.nom AS auditeur_nom,
        u_aud.prenom AS auditeur_prenom,
        u1.pseudo AS confirmateur_pseudo,
        p.nom AS produit_nom,
        po.id_fiche AS porte_ouverte_id_fiche
      FROM fiches f
      LEFT JOIN utilisateurs u_aud ON f.id_qualite_confirmation = u_aud.id
      LEFT JOIN utilisateurs u1 ON f.id_confirmateur = u1.id
      LEFT JOIN produits p ON f.produit = p.id
      LEFT JOIN (
        SELECT DISTINCT id_fiche
        FROM porte_ouverte
      ) po ON po.id_fiche = f.id
      WHERE f.id_qualite_confirmation IS NOT NULL
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.date_modif_time >= ? AND f.date_modif_time <= ?
      ${agentConfirmFilterSql}
      ORDER BY f.date_modif_time DESC, f.id DESC
      LIMIT 1000`,
      periodParams
    );
    const rdvs_audites = (rdvsRows || []).map((r) => ({
      id: r.id,
      hash: r.hash || encodeFicheId(r.id),
      nom: r.nom,
      prenom: r.prenom,
      tel: r.tel,
      cp: r.cp,
      ville: r.ville,
      date_rdv_time: r.date_rdv_time,
      date_audit: r.date_audit,
      date_modif_time: r.date_audit,
      observation_qualite: r.observation_qualite,
      id_etat_final: r.id_etat_final,
      valider: r.valider,
      has_porte_ouverte: !!r.porte_ouverte_id_fiche,
      auditeur: {
        id: r.auditeur_id,
        pseudo: r.auditeur_pseudo,
        nom: r.auditeur_nom,
        prenom: r.auditeur_prenom,
      },
      confirmateur_pseudo: r.confirmateur_pseudo,
      produit_nom: r.produit_nom,
    }));

    const signedEtats = new Set([13, 16, 38, 44, 45]);
    const signaturesCount = rdvs_audites.reduce(
      (acc, r) => acc + (signedEtats.has(Number(r.id_etat_final)) ? 1 : 0),
      0
    );
    const porteOuverteCount = rdvs_audites.reduce(
      (acc, r) => acc + (r.has_porte_ouverte ? 1 : 0),
      0
    );
    const totalRdvs = totaux.total_rdvs_audites;
    const tauxSignature = totalRdvs > 0 ? Number(((signaturesCount / totalRdvs) * 100).toFixed(1)) : 0;
    const tauxPorteOuverte = totalRdvs > 0 ? Number(((porteOuverteCount / totalRdvs) * 100).toFixed(1)) : 0;
    const enrichedTotaux = {
      ...totaux,
      signatures: signaturesCount,
      taux_signature: tauxSignature,
      porte_ouverte: porteOuverteCount,
      taux_porte_ouverte: tauxPorteOuverte,
    };

    return {
      agents,
      agents_options: (agentsOptions || []).map((u) => ({
        id: u.id,
        pseudo: u.pseudo,
        nom: u.nom,
        prenom: u.prenom,
      })),
      totaux: enrichedTotaux,
      rdvs_audites,
    };
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') return empty;
    throw err;
  }
}

// Récupérer les statistiques par agent qualité (qui ont audité des fiches)
// Se base sur le champ id_qualite dans la table fiches et date_insert_time pour la date
router.get('/agents-qualite', authenticate, async (req, res) => {
  try {
    const {
      date_debut,
      date_fin,
      id_agent_qualite, // rétrocompat : filtre agent qualité qualification (stats)
      id_agent_qualite_qualif,
      id_agent_qualite_confirmation,
    } = req.query;

    const idAgentQualifFilter = id_agent_qualite_qualif || id_agent_qualite;
    const idAgentQualifParsed = idAgentQualifFilter ? parseInt(idAgentQualifFilter, 10) : null;
    const idAgentConfirmationParsed = id_agent_qualite_confirmation
      ? parseInt(id_agent_qualite_confirmation, 10)
      : null;

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
      ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
      LEFT JOIN fonctions fn ON u.fonction = fn.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE f.id_qualite IS NOT NULL
      AND f.date_insert_time >= ?
      AND f.date_insert_time <= ?
      AND u.etat > 0
    `;

    const agentsParams = [startDate, endDate];

    if (idAgentQualifParsed) {
      agentsQualiteQuery += ' AND u.id = ?';
      agentsParams.push(idAgentQualifParsed);
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
          ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
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
          ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
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
            ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
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
          ${STATS_QUALITE_FICHE_AGENT_QUALIF_JOIN}
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

    const completudes = await fetchQualiteConfirmationCompletudeStats(startDate, endDate);
    const auditConfirmation = await fetchQualiteConfirmationAuditStats(
      startDate,
      endDate,
      idAgentConfirmationParsed
    );
    const fichesAuditeesQualif = await fetchFichesAuditeesQualifList(
      startDate,
      endDate,
      idAgentQualifParsed
    );

    res.json({
      success: true,
      data: {
        agents: agentsStats,
        fiches_auditees_qualif: fichesAuditeesQualif.fiches,
        agents_qualite_qualif_options: fichesAuditeesQualif.agents_options,
        qualite_confirmation: {
          completudes,
          audit_confirmation: {
            agents: auditConfirmation.agents,
            totaux: auditConfirmation.totaux,
            agents_options: auditConfirmation.agents_options,
          },
          rdvs_audites: auditConfirmation.rdvs_audites,
        },
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
