const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne, transaction } = require('../config/database');
const {
  signatureScoreForCount,
  MAX_CONFIRMATEURS_PAR_SIGNATURE,
  redistributeSignatureScoresForFicheEvent,
} = require('../utils/signatureScores');

function getFirstOfMonthLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function getLastDayOfMonthLocal() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function isAdminSession(fonction) {
  return [1, 11].includes(Number(fonction));
}

async function ensureSignaturesRejeteesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS signatures_rejetees (
      id INT NOT NULL AUTO_INCREMENT,
      signature_id INT NOT NULL,
      id_fiche INT NULL,
      confirmateur INT NULL,
      ajoute DECIMAL(10,2) NULL,
      date_heure DATETIME NULL,
      tel VARCHAR(255) NULL,
      motif TEXT NOT NULL,
      id_rejete_par INT NOT NULL,
      date_rejet TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_signature_id (signature_id),
      KEY idx_id_fiche (id_fiche),
      KEY idx_confirmateur (confirmateur),
      KEY idx_date_rejet (date_rejet)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

// =====================================================
// ROUTE: GET /api/signature
// Récupérer la liste des signatures avec filtres (par date de planning = date_rdv_time de la fiche)
// =====================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      id_confirmateur, 
      id_commercial,
      id_fiche,
      id_etat_final,
      sort_by = 'date_planning',
      sort_order = 'desc',
      page = 1,
      limit = 50
    } = req.query;
    console.log('[signature][list] query params:', {
      date_debut,
      date_fin,
      id_confirmateur,
      id_commercial,
      id_fiche,
      id_etat_final,
      sort_by,
      sort_order,
      page,
      limit,
      user_id: req.user?.id || null,
      user_fonction: req.user?.fonction || null
    });

    // Limiter aux fiches actuellement signées (même critère que "recherche tout signé par date de planning")
    const etatsSignes = [13, 16, 38, 44, 45]; // SIGNER, SIGNER RETRACTER, SIGNER RETRACTER 2 FOIS, SIGNER PM, SIGNER COMPLET
    let whereConditions = ['f.id IS NOT NULL', `f.id_etat_final IN (${etatsSignes.join(', ')})`];
    let params = [];

    // Filtrer par état final (ex. uniquement Signer / Signer complet = 13 ou 45)
    if (id_etat_final !== undefined && id_etat_final !== '' && id_etat_final !== null) {
      whereConditions.push('f.id_etat_final = ?');
      params.push(id_etat_final);
    }

    // Filtrer par date de planning (date RDV de la fiche)
    if (date_debut) {
      whereConditions.push('f.date_rdv_time >= ?');
      params.push(`${date_debut} 00:00:00`);
    }
    if (date_fin) {
      whereConditions.push('f.date_rdv_time <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    // Filtrer par confirmateur (au moins une signature de la fiche avec ce confirmateur)
    if (id_confirmateur) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM signature sx
        WHERE sx.id_fiche = f.id AND sx.confirmateur = ?
      )`);
      params.push(id_confirmateur);
    }
    if (id_commercial) {
      whereConditions.push('f.id_commercial = ?');
      params.push(id_commercial);
    }

    // Filtrer par fiche
    if (id_fiche) {
      whereConditions.push('f.id = ?');
      params.push(id_fiche);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    console.log('[signature][list] filters built:', {
      whereClause,
      params
    });

    // Compter le total des fiches filtrées
    const countResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM fiches f
       ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;
    console.log('[signature][list] count result:', {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    // Calculer la pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = parseInt(limit);
    const normalizedOrder = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortMap = {
      date_planning: 'f.date_rdv_time',
      date_heure: 's.date_heure',
      confirmateur: 'u.pseudo',
      score: 's.ajoute',
      telephone: 'COALESCE(s.tel, f.tel)'
    };
    const sortColumn = sortMap[sort_by] || 'f.date_rdv_time';

    // Récupérer les fiches + dernière signature associée (si existante)
    const signatures = await query(
      `SELECT 
        s.id,
        f.id as id_fiche,
        s.confirmateur,
        s.ajoute,
        s.date_heure,
        COALESCE(s.tel, f.tel) as tel,
        f.hash as fiche_hash,
        f.nom,
        f.prenom,
        f.cp,
        f.date_insert_time,
        f.date_rdv_time as date_planning,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        f.id_etat_final as fiche_id_etat_final,
        f.id_sous_etat as fiche_id_sous_etat,
        f.id_commercial,
        f.id_commercial_2,
        f.produit,
        f.valider,
        f.cq_etat as fiche_cq_etat_id,
        f.cq_dossier as fiche_cq_dossier_id,
        f.observations_cq,
        f.ph3_installateur as fiche_installateur_id,
        c.titre as centre_titre,
        e.titre as etat_titre,
        se.titre as sous_etat_titre,
        uc.pseudo as commercial_pseudo,
        uc2.pseudo as commercial_2_pseudo,
        cqe.titre as cq_etat_titre,
        cqd.titre as cq_dossier_titre,
        i.nom as installateur_nom,
        u.pseudo as confirmateur_pseudo,
        u.nom as confirmateur_nom,
        u.prenom as confirmateur_prenom
      FROM fiches f
      LEFT JOIN signature s ON s.id = (
        SELECT s2.id
        FROM signature s2
        WHERE s2.id_fiche = f.id
        ORDER BY s2.id DESC
        LIMIT 1
      )
      LEFT JOIN centres c ON f.id_centre = c.id
      LEFT JOIN etats e ON f.id_etat_final = e.id
      LEFT JOIN sous_etat se ON f.id_sous_etat = se.id
      LEFT JOIN utilisateurs uc ON f.id_commercial = uc.id
      LEFT JOIN utilisateurs uc2 ON f.id_commercial_2 = uc2.id
      LEFT JOIN cq_etat cqe ON f.cq_etat = cqe.id
      LEFT JOIN cq_dossier cqd ON f.cq_dossier = cqd.id
      LEFT JOIN installateurs i ON f.ph3_installateur = i.id
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      ORDER BY ${sortColumn} ${normalizedOrder}, s.date_heure DESC, s.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limitValue, offset]
    );
    console.log('[signature][list] rows fetched:', {
      fetched: signatures?.length || 0,
      offset,
      limitValue,
      first_row_id: signatures?.[0]?.id || null,
      first_row_fiche_id: signatures?.[0]?.id_fiche || null,
      first_row_date_planning: signatures?.[0]?.date_planning || null,
      first_row_date_signature: signatures?.[0]?.date_heure || null
    });

    res.json({
      success: true,
      data: signatures,
      pagination: {
        page: parseInt(page),
        limit: limitValue,
        total,
        totalPages: Math.ceil(total / limitValue)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des signatures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des signatures',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: GET /api/signature/rejetees
// Liste des signatures rejetées (admin)
// =====================================================
router.get('/rejetees', authenticate, async (req, res) => {
  try {
    if (!isAdminSession(req.user?.fonction)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await ensureSignaturesRejeteesTable();
    const { date_debut, date_fin, id_confirmateur, id_commercial, page = 1, limit = 50 } = req.query;
    const whereConditions = ['1=1'];
    const params = [];

    if (date_debut) {
      whereConditions.push('sr.date_rejet >= ?');
      params.push(`${date_debut} 00:00:00`);
    }
    if (date_fin) {
      whereConditions.push('sr.date_rejet <= ?');
      params.push(`${date_fin} 23:59:59`);
    }
    if (id_confirmateur) {
      whereConditions.push('sr.confirmateur = ?');
      params.push(id_confirmateur);
    }
    if (id_commercial) {
      whereConditions.push('f.id_commercial = ?');
      params.push(id_commercial);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitValue = parseInt(limit, 10);

    const totalRow = await queryOne(
      `SELECT COUNT(*) as total FROM signatures_rejetees sr ${whereClause}`,
      params
    );

    const rows = await query(
      `SELECT
        sr.id,
        sr.signature_id,
        sr.id_fiche,
        sr.confirmateur,
        sr.ajoute,
        sr.date_heure,
        sr.tel,
        sr.motif,
        sr.id_rejete_par,
        sr.date_rejet,
        u_conf.pseudo as confirmateur_pseudo,
        u_rej.pseudo as rejete_par_pseudo,
        f.hash as fiche_hash,
        f.date_rdv_time as date_planning,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        c.titre as centre_titre
      FROM signatures_rejetees sr
      LEFT JOIN utilisateurs u_conf ON sr.confirmateur = u_conf.id
      LEFT JOIN utilisateurs u_rej ON sr.id_rejete_par = u_rej.id
      LEFT JOIN fiches f ON sr.id_fiche = f.id
      LEFT JOIN centres c ON f.id_centre = c.id
      ${whereClause}
      ORDER BY sr.date_rejet DESC, sr.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limitValue, offset]
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: limitValue,
        total: totalRow?.total || 0,
        totalPages: Math.ceil((totalRow?.total || 0) / limitValue)
      }
    });
  } catch (error) {
    console.error('Erreur récupération signatures rejetées:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des signatures rejetées',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: GET /api/signature/stats
// Récupérer les statistiques des signatures (par date de planning = date_rdv_time de la fiche)
// =====================================================
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    // Limiter aux fiches actuellement signées (aligné sur "recherche tout signé par date de planning")
    const etatsSignes = [13, 16, 38, 44, 45]; // SIGNER, SIGNER RETRACTER, SIGNER RETRACTER 2 FOIS, SIGNER PM, SIGNER COMPLET
    let whereConditions = ['f.id IS NOT NULL', `f.id_etat_final IN (${etatsSignes.join(', ')})`];
    let params = [];

    // Filtrer par date de planning
    if (date_debut) {
      whereConditions.push('f.date_rdv_time >= ?');
      params.push(`${date_debut} 00:00:00`);
    }
    if (date_fin) {
      whereConditions.push('f.date_rdv_time <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    const joinFiches = 'INNER JOIN fiches f ON s.id_fiche = f.id';

    // Timestamps et dates pour la période (fiches confirmées = état 7)
    const startDateStr = date_debut ? `${date_debut} 00:00:00` : null;
    const endDateStr = date_fin ? `${date_fin} 23:59:59` : null;
    const startTs = startDateStr ? Math.floor(new Date(startDateStr).getTime() / 1000) : 0;
    const endTs = endDateStr ? Math.floor(new Date(endDateStr).getTime() / 1000) : 0;

    // Total signatures (somme des scores) - par date de planning
    const totalResult = await queryOne(
      `SELECT SUM(s.ajoute) as total FROM signature s ${joinFiches} ${whereClause}`,
      params
    );
    const totalSignatures = parseFloat(totalResult?.total || 0);

    // Nombre de fiches signées uniques
    const fichesUniquesResult = await queryOne(
      `SELECT COUNT(DISTINCT s.id_fiche) as total 
       FROM signature s ${joinFiches} ${whereClause} 
       AND s.id_fiche IS NOT NULL`,
      params
    );
    const fichesUniques = fichesUniquesResult?.total || 0;

    // Top 10 confirmateurs par score - par date de planning
    const topConfirmateurs = await query(
      `SELECT 
        s.confirmateur,
        u.pseudo as confirmateur_pseudo,
        u.nom as confirmateur_nom,
        u.prenom as confirmateur_prenom,
        SUM(s.ajoute) as total_score,
        COUNT(DISTINCT s.id_fiche) as nb_fiches,
        COUNT(*) as nb_signatures
      FROM signature s
      ${joinFiches}
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      AND s.confirmateur IS NOT NULL
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom
      ORDER BY total_score DESC
      LIMIT 10`,
      params
    );

    // Nombre de fiches confirmées par confirmateur : depuis la table confirmations, filtré par date RDV (pas date confirmation)
    let fichesConfirmeesByConfirmateur = {};
    if (date_debut && date_fin) {
      const confParams = [startDateStr, endDateStr];
      const colRows = await query(
        `SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'confirmations'
           AND COLUMN_NAME IN ('date_rdv_time', 'date_planning')`
      ).catch(() => []);

      const availableCols = new Set((colRows || []).map(r => r.COLUMN_NAME));
      let dateCol = null;
      if (availableCols.has('date_rdv_time')) dateCol = 'date_rdv_time';
      else if (availableCols.has('date_planning')) dateCol = 'date_planning';

      if (dateCol) {
        const fcRows = await query(
          `SELECT id_confirmateur as confirmateur_id, COUNT(*) as nb_fiches_confirmees
           FROM confirmations
           WHERE id_confirmateur IS NOT NULL AND id_confirmateur > 0
             AND ${dateCol} >= ? AND ${dateCol} <= ?
           GROUP BY id_confirmateur`,
          confParams
        ).catch(() => []);
        (fcRows || []).forEach(row => {
          fichesConfirmeesByConfirmateur[row.confirmateur_id] = parseInt(row.nb_fiches_confirmees || 0);
        });
      }
    }

    // Statistiques par jour (par date de planning, derniers 30 jours)
    const statsParJour = await query(
      `SELECT 
        DATE(f.date_rdv_time) as date,
        SUM(s.ajoute) as total_score,
        COUNT(DISTINCT s.id_fiche) as nb_fiches,
        COUNT(*) as nb_signatures
      FROM signature s
      ${joinFiches}
      ${whereClause}
      AND f.date_rdv_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(f.date_rdv_time)
      ORDER BY date DESC`,
      params
    );

    // Statistiques par confirmateur (tous) - par date de planning
    const statsConfirmateurs = await query(
      `SELECT 
        s.confirmateur,
        u.pseudo as confirmateur_pseudo,
        u.nom as confirmateur_nom,
        u.prenom as confirmateur_prenom,
        SUM(s.ajoute) as total_score,
        COUNT(DISTINCT s.id_fiche) as nb_fiches,
        COUNT(*) as nb_signatures
      FROM signature s
      ${joinFiches}
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      AND s.confirmateur IS NOT NULL
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom
      ORDER BY total_score DESC`,
      params
    );

    const enrichConfirmateur = (c) => {
      const nb_fiches_confirmees = fichesConfirmeesByConfirmateur[c.confirmateur] ?? 0;
      const total_score = parseFloat(c.total_score || 0);
      const taux_signature = nb_fiches_confirmees > 0
        ? (total_score / nb_fiches_confirmees) * 100
        : null;
      return {
        ...c,
        total_score,
        nb_fiches: nb_fiches_confirmees,
        nb_fiches_confirmees,
        nb_signatures: parseInt(c.nb_signatures || 0),
        taux_signature: taux_signature !== null ? parseFloat(taux_signature.toFixed(1)) : null
      };
    };

    res.json({
      success: true,
      data: {
        totalSignatures,
        fichesUniques,
        topConfirmateurs: topConfirmateurs.map(enrichConfirmateur),
        allConfirmateurs: statsConfirmateurs.map(enrichConfirmateur),
        statsParJour: statsParJour.map(s => ({
          date: s.date,
          total_score: parseFloat(s.total_score || 0),
          nb_fiches: parseInt(s.nb_fiches || 0),
          nb_signatures: parseInt(s.nb_signatures || 0)
        })),
        statsConfirmateurs: statsConfirmateurs.map(c => ({
          ...c,
          total_score: parseFloat(c.total_score || 0),
          nb_fiches: parseInt(c.nb_fiches || 0),
          nb_signatures: parseInt(c.nb_signatures || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: GET /api/signature/kpi
// Récupérer les KPI des signatures (par date de planning = date_rdv_time de la fiche)
// =====================================================
router.get('/kpi', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    // Dates par défaut : 1er du mois -> dernier jour du mois (heure locale)
    const dateDebut = date_debut || getFirstOfMonthLocal();
    const dateFin = date_fin || getLastDayOfMonthLocal();

    // Période actuelle
    const currentStart = `${dateDebut} 00:00:00`;
    const currentEnd = `${dateFin} 23:59:59`;

    // Période précédente (même période du mois précédent)
    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculer la même période du mois précédent
    const previousStart = new Date(startDate);
    previousStart.setMonth(previousStart.getMonth() - 1);
    
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + daysDiff - 1);

    const previousStartStr = previousStart.toISOString().split('T')[0] + ' 00:00:00';
    const previousEndStr = previousEnd.toISOString().split('T')[0] + ' 23:59:59';

    const joinFichesKpi = 'INNER JOIN fiches f ON s.id_fiche = f.id';
    // Limiter aux fiches actuellement signées (aligné sur "recherche tout signé par date de planning")
    const whereEtatSigneKpi = 'AND f.id_etat_final IN (13, 16, 38, 44, 45)';

    // KPI 1: Total signatures (score - SUM ajoute) - période actuelle - par date de planning
    const currentTotalResult = await queryOne(
      `SELECT SUM(s.ajoute) as total FROM signature s ${joinFichesKpi} WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? ${whereEtatSigneKpi}`,
      [currentStart, currentEnd]
    );
    const currentTotal = parseFloat(currentTotalResult?.total || 0);

    // KPI 2: Total signatures - période précédente
    const previousTotalResult = await queryOne(
      `SELECT SUM(s.ajoute) as total FROM signature s ${joinFichesKpi} WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? ${whereEtatSigneKpi}`,
      [previousStartStr, previousEndStr]
    );
    const previousTotal = parseFloat(previousTotalResult?.total || 0);

    // KPI 3: Évolution du score
    const evolution = previousTotal > 0 
      ? ((currentTotal - previousTotal) / previousTotal) * 100 
      : (currentTotal > 0 ? 100 : 0);

    // KPI 4: Nombre de signatures (COUNT) - période actuelle
    const currentNombreResult = await queryOne(
      `SELECT COUNT(*) as total FROM signature s ${joinFichesKpi} WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? ${whereEtatSigneKpi}`,
      [currentStart, currentEnd]
    );
    const currentNombre = parseInt(currentNombreResult?.total || 0);

    // KPI 5: Nombre de signatures (COUNT) - période précédente
    const previousNombreResult = await queryOne(
      `SELECT COUNT(*) as total FROM signature s ${joinFichesKpi} WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? ${whereEtatSigneKpi}`,
      [previousStartStr, previousEndStr]
    );
    const previousNombre = parseInt(previousNombreResult?.total || 0);

    // KPI 6: Évolution du nombre
    const evolutionNombre = previousNombre > 0 
      ? ((currentNombre - previousNombre) / previousNombre) * 100 
      : (currentNombre > 0 ? 100 : 0);

    // KPI 7: Nombre de fiches signées uniques (période actuelle)
    const currentFichesResult = await queryOne(
      `SELECT COUNT(DISTINCT s.id_fiche) as total 
       FROM signature s ${joinFichesKpi} 
       WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? AND s.id_fiche IS NOT NULL ${whereEtatSigneKpi}`,
      [currentStart, currentEnd]
    );
    const currentFiches = parseInt(currentFichesResult?.total || 0);

    // KPI 8: Nombre de fiches signées uniques (période précédente)
    const previousFichesResult = await queryOne(
      `SELECT COUNT(DISTINCT s.id_fiche) as total 
       FROM signature s ${joinFichesKpi} 
       WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ? AND s.id_fiche IS NOT NULL ${whereEtatSigneKpi}`,
      [previousStartStr, previousEndStr]
    );
    const previousFiches = parseInt(previousFichesResult?.total || 0);

    // KPI 9: Évolution fiches
    const evolutionFiches = previousFiches > 0 
      ? ((currentFiches - previousFiches) / previousFiches) * 100 
      : (currentFiches > 0 ? 100 : 0);

    // Top 3 confirmateurs (période actuelle) - par date de planning
    const top3Result = await query(
      `SELECT 
        s.confirmateur,
        u.pseudo as confirmateur_pseudo,
        SUM(s.ajoute) as total_score
      FROM signature s
      ${joinFichesKpi}
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      WHERE f.date_rdv_time >= ? AND f.date_rdv_time <= ?
      AND s.confirmateur IS NOT NULL ${whereEtatSigneKpi}
      GROUP BY s.confirmateur, u.pseudo
      ORDER BY total_score DESC
      LIMIT 3`,
      [currentStart, currentEnd]
    );

    const top3 = top3Result.map(c => ({
      id: c.confirmateur,
      pseudo: c.confirmateur_pseudo || 'Inconnu',
      score: parseFloat(c.total_score || 0)
    }));

    // KPI 8: Moyenne par jour
    const avgPerDay = daysDiff > 0 ? (currentTotal / daysDiff) : 0;

    res.json({
      success: true,
      data: {
        totalSignatures: {
          current: parseFloat(currentTotal.toFixed(2)),
          previous: parseFloat(previousTotal.toFixed(2)),
          evolution: parseFloat(evolution.toFixed(2)),
          trend: evolution > 0 ? 'up' : (evolution < 0 ? 'down' : 'stable')
        },
        nombreSignatures: {
          current: currentNombre,
          previous: previousNombre,
          evolution: parseFloat(evolutionNombre.toFixed(2)),
          trend: evolutionNombre > 0 ? 'up' : (evolutionNombre < 0 ? 'down' : 'stable')
        },
        fichesSignees: {
          current: currentFiches,
          previous: previousFiches,
          evolution: parseFloat(evolutionFiches.toFixed(2)),
          trend: evolutionFiches > 0 ? 'up' : (evolutionFiches < 0 ? 'down' : 'stable')
        },
        top3Confirmateurs: top3,
        moyenneParJour: parseFloat(avgPerDay.toFixed(2)),
        periode: {
          debut: dateDebut,
          fin: dateFin,
          jours: daysDiff,
          previous_debut: previousStart.toISOString().split('T')[0],
          previous_fin: previousEnd.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des KPI:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des KPI',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: POST /api/signature/:id/rejeter
// Déplace une signature dans signatures_rejetees avec motif
// =====================================================
router.post('/:id/rejeter', authenticate, async (req, res) => {
  try {
    if (!isAdminSession(req.user?.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const signatureId = Number(req.params.id);
    const motif = (req.body?.motif || '').toString().trim();

    if (!signatureId || Number.isNaN(signatureId)) {
      return res.status(400).json({
        success: false,
        message: 'ID signature invalide'
      });
    }
    if (!motif) {
      return res.status(400).json({
        success: false,
        message: 'Le motif est obligatoire'
      });
    }

    const sig = await queryOne('SELECT * FROM signature WHERE id = ?', [signatureId]);
    if (!sig) {
      return res.status(404).json({
        success: false,
        message: 'Signature introuvable'
      });
    }

    await ensureSignaturesRejeteesTable();
    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO signatures_rejetees
          (signature_id, id_fiche, confirmateur, ajoute, date_heure, tel, motif, id_rejete_par, date_rejet)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [sig.id, sig.id_fiche || null, sig.confirmateur || null, sig.ajoute || null, sig.date_heure || null, sig.tel || null, motif, req.user.id]
      );

      await connection.execute('DELETE FROM signature WHERE id = ?', [signatureId]);
    });

    if (sig.id_fiche) {
      await redistributeSignatureScoresForFicheEvent(sig.id_fiche, sig.date_heure || null);
    }

    return res.json({
      success: true,
      message: 'Signature rejetée et déplacée avec succès'
    });
  } catch (error) {
    console.error('Erreur rejet signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet de la signature',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: PATCH /api/signature/:id/confirmateur
// Modifie le propriétaire d'une signature
// =====================================================
router.patch('/:id/confirmateur', authenticate, async (req, res) => {
  try {
    if (!isAdminSession(req.user?.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const signatureId = Number(req.params.id);
    const confirmateurId = Number(req.body?.id_confirmateur);
    if (!signatureId || Number.isNaN(signatureId)) {
      return res.status(400).json({ success: false, message: 'ID signature invalide' });
    }
    if (!confirmateurId || Number.isNaN(confirmateurId)) {
      return res.status(400).json({ success: false, message: 'ID confirmateur invalide' });
    }

    const sig = await queryOne('SELECT id, id_fiche FROM signature WHERE id = ?', [signatureId]);
    if (!sig) {
      return res.status(404).json({ success: false, message: 'Signature introuvable' });
    }

    const conf = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND fonction = 6', [confirmateurId]);
    if (!conf) {
      return res.status(400).json({ success: false, message: 'Confirmateur invalide' });
    }

    await query('UPDATE signature SET confirmateur = ? WHERE id = ?', [confirmateurId, signatureId]);
    return res.json({ success: true, message: 'Confirmateur modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification confirmateur signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du confirmateur',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: POST /api/signature/:id/confirmateurs
// Ajoute un 2e/3e confirmateur en insérant une ligne signature
// =====================================================
router.post('/:id/confirmateurs', authenticate, async (req, res) => {
  try {
    if (!isAdminSession(req.user?.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    const signatureId = Number(req.params.id);
    const confirmateurId = Number(req.body?.id_confirmateur);
    if (!signatureId || Number.isNaN(signatureId)) {
      return res.status(400).json({ success: false, message: 'ID signature invalide' });
    }
    if (!confirmateurId || Number.isNaN(confirmateurId)) {
      return res.status(400).json({ success: false, message: 'ID confirmateur invalide' });
    }

    const baseSig = await queryOne('SELECT * FROM signature WHERE id = ?', [signatureId]);
    if (!baseSig) {
      return res.status(404).json({ success: false, message: 'Signature de base introuvable' });
    }
    if (!baseSig.id_fiche) {
      return res.status(400).json({ success: false, message: 'Impossible d’ajouter un confirmateur : id_fiche absent' });
    }

    const conf = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND fonction = 6', [confirmateurId]);
    if (!conf) {
      return res.status(400).json({ success: false, message: 'Confirmateur invalide' });
    }

    const duplicate = await queryOne(
      `SELECT id FROM signature
       WHERE id_fiche = ? AND confirmateur = ?
       ORDER BY id DESC LIMIT 1`,
      [baseSig.id_fiche, confirmateurId]
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Ce confirmateur existe déjà pour cette fiche'
      });
    }

    const eventDateHeure = baseSig.date_heure || null;
    let countRow;
    if (eventDateHeure) {
      countRow = await queryOne(
        `SELECT COUNT(*) AS c FROM signature WHERE id_fiche = ? AND date_heure = ?`,
        [baseSig.id_fiche, eventDateHeure]
      );
    } else {
      countRow = await queryOne(
        `SELECT COUNT(*) AS c FROM signature WHERE id_fiche = ? AND (date_heure IS NULL OR date_heure = "")`,
        [baseSig.id_fiche]
      );
    }
    const currentCount = Number(countRow?.c) || 0;
    if (currentCount >= MAX_CONFIRMATEURS_PAR_SIGNATURE) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CONFIRMATEURS_PAR_SIGNATURE} confirmateurs par signature`,
      });
    }

    const insertDateHeure = eventDateHeure || new Date();
    await query(
      `INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
       VALUES (?, ?, ?, ?, ?)`,
      [baseSig.id_fiche, confirmateurId, signatureScoreForCount(currentCount + 1), insertDateHeure, baseSig.tel || null]
    );

    const { count, score } = await redistributeSignatureScoresForFicheEvent(
      baseSig.id_fiche,
      eventDateHeure
    );

    return res.json({
      success: true,
      message: 'Confirmateur ajouté avec succès',
      data: {
        confirmateurs: count,
        score_par_confirmateur: score,
      },
    });
  } catch (error) {
    console.error('Erreur ajout confirmateur signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’ajout du confirmateur',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: POST /api/signature/rejetees/:id/restaurer
// Restaure une signature rejetée vers la table signature
// =====================================================
router.post('/rejetees/:id/restaurer', authenticate, async (req, res) => {
  try {
    if (!isAdminSession(req.user?.fonction)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await ensureSignaturesRejeteesTable();
    const rejectedId = Number(req.params.id);
    if (!rejectedId || Number.isNaN(rejectedId)) {
      return res.status(400).json({ success: false, message: 'ID rejet invalide' });
    }

    const row = await queryOne('SELECT * FROM signatures_rejetees WHERE id = ?', [rejectedId]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Signature rejetée introuvable' });
    }

    if (row.id_fiche && row.confirmateur) {
      const dup = await queryOne(
        'SELECT id FROM signature WHERE id_fiche = ? AND confirmateur = ? LIMIT 1',
        [row.id_fiche, row.confirmateur]
      );
      if (dup) {
        return res.status(409).json({
          success: false,
          message: 'Ce confirmateur existe déjà sur cette fiche',
        });
      }
    }

    if (row.id_fiche) {
      const eventDateHeure = row.date_heure || null;
      let countRow;
      if (eventDateHeure) {
        countRow = await queryOne(
          `SELECT COUNT(*) AS c FROM signature WHERE id_fiche = ? AND date_heure = ?`,
          [row.id_fiche, eventDateHeure]
        );
      } else {
        countRow = await queryOne(
          `SELECT COUNT(*) AS c FROM signature WHERE id_fiche = ? AND (date_heure IS NULL OR date_heure = "")`,
          [row.id_fiche]
        );
      }
      if (Number(countRow?.c) >= MAX_CONFIRMATEURS_PAR_SIGNATURE) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_CONFIRMATEURS_PAR_SIGNATURE} confirmateurs par signature`,
        });
      }
    }

    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
         VALUES (?, ?, ?, ?, ?)`,
        [
          row.id_fiche || null,
          row.confirmateur || null,
          row.ajoute ?? 0,
          row.date_heure || new Date(),
          row.tel || null
        ]
      );

      await connection.execute('DELETE FROM signatures_rejetees WHERE id = ?', [rejectedId]);
    });

    if (row.id_fiche) {
      await redistributeSignatureScoresForFicheEvent(row.id_fiche, row.date_heure || null);
    }

    return res.json({
      success: true,
      message: 'Signature restaurée avec succès'
    });
  } catch (error) {
    console.error('Erreur restauration signature rejetée:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la restauration de la signature',
      error: error.message
    });
  }
});

module.exports = router;

