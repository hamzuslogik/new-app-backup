const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// STATISTIQUES V2 - Routes avancées avec nouvelles métriques
// =====================================================

/** Filtres communs onglet Qualification : fiches insérées par agents qualification (F3). */
function buildQualifAdvancedFilters(queryParams) {
  const { id_agent, id_equipe, id_centre, id_departement, id_rp } = queryParams;
  const conditions = [
    'f.date_insert_time >= ?',
    'f.date_insert_time <= ?',
    'f.id_agent IS NOT NULL',
    'f.id_agent > 0',
    '(f.archive = 0 OR f.archive IS NULL)',
    '(f.id_etat_final != 61 OR f.id_etat_final IS NULL)',
    'agent.fonction = 3',
  ];
  const params = [];

  if (id_agent) {
    conditions.push('f.id_agent = ?');
    params.push(parseInt(id_agent, 10));
  }
  if (id_equipe) {
    conditions.push('agent.chef_equipe = ?');
    params.push(parseInt(id_equipe, 10));
  }
  if (id_rp) {
    conditions.push('re.id_rp_qualif = ?');
    params.push(parseInt(id_rp, 10));
  }
  if (id_centre) {
    conditions.push('f.id_centre = ?');
    params.push(parseInt(id_centre, 10));
  }
  if (id_departement) {
    conditions.push('f.departement = ?');
    params.push(id_departement);
  }

  const whereSql = conditions.join(' AND ');
  const fromSql = `
    FROM fiches f
    INNER JOIN utilisateurs agent ON f.id_agent = agent.id
    LEFT JOIN utilisateurs re ON agent.chef_equipe = re.id
    LEFT JOIN etats e ON f.id_etat_final = e.id
  `;

  return { whereSql, fromSql, filterParams: params };
}

const SQL_FICHE_VALIDEE = `
  (f.ko = 0 OR f.ko IS NULL)
  AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
`;

const SQL_FICHE_REJET = `
  (f.ko = 1 OR e.groupe = '0' OR e.groupe = 0)
`;

// GET /api/statistiques-v2/qualification-advanced
// Métriques avancées pour l'onglet Qualification
router.get('/qualification-advanced', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /qualification-advanced - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { date_debut, date_fin } = req.query;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    const { whereSql, fromSql, filterParams } = buildQualifAdvancedFilters(req.query);
    const params = [startDate, endDate, ...filterParams];

    // Top 10 agents qualification (fiches validées, sans temps de traitement)
    const top10Agents = await query(`
      SELECT
        agent.id,
        agent.pseudo,
        agent.nom,
        agent.prenom,
        agent.photo,
        COUNT(DISTINCT CASE WHEN ${SQL_FICHE_VALIDEE} THEN f.id END) as count_validated,
        COUNT(DISTINCT CASE WHEN f.ko = 1 THEN f.id END) as count_ko
      ${fromSql}
      WHERE ${whereSql}
      GROUP BY agent.id, agent.pseudo, agent.nom, agent.prenom, agent.photo
      HAVING count_validated > 0 OR count_ko > 0
      ORDER BY count_validated DESC, count_ko DESC
      LIMIT 10
    `, params);

    // Taux de rejet par agent (groupe 0 + ko=1) + nombre de KO
    const rejectionRates = await query(`
      SELECT
        agent.id,
        agent.pseudo,
        COUNT(DISTINCT CASE WHEN ${SQL_FICHE_REJET} THEN f.id END) as rejected_count,
        COUNT(DISTINCT CASE WHEN f.ko = 1 THEN f.id END) as ko_count,
        COUNT(DISTINCT CASE WHEN (f.ko = 0 OR f.ko IS NULL) AND (e.groupe = '0' OR e.groupe = 0) THEN f.id END) as groupe0_count,
        COUNT(DISTINCT f.id) as total_count,
        CASE
          WHEN COUNT(DISTINCT f.id) > 0
          THEN ROUND((COUNT(DISTINCT CASE WHEN ${SQL_FICHE_REJET} THEN f.id END) / COUNT(DISTINCT f.id)) * 100, 1)
          ELSE 0
        END as rejection_rate
      ${fromSql}
      WHERE ${whereSql}
      GROUP BY agent.id, agent.pseudo
      HAVING total_count > 0
      ORDER BY ko_count DESC, rejection_rate DESC
    `, params);

    // Ratio production / effectif par équipe RE (fiches produites ÷ nb agents qualification actifs)
    const ratioByRe = await query(`
      SELECT
        re.id as re_id,
        re.pseudo as re_pseudo,
        re.nom as re_nom,
        re.prenom as re_prenom,
        COUNT(DISTINCT f.id) as fiches_produites,
        COUNT(DISTINCT CASE WHEN ${SQL_FICHE_VALIDEE} THEN f.id END) as fiches_validees,
        COUNT(DISTINCT CASE WHEN f.ko = 1 THEN f.id END) as fiches_ko,
        (
          SELECT COUNT(*)
          FROM utilisateurs ua
          WHERE ua.fonction = 3
            AND ua.chef_equipe = re.id
            AND (ua.etat > 0 OR ua.etat IS NULL)
        ) as effectif,
        CASE
          WHEN (
            SELECT COUNT(*)
            FROM utilisateurs ua
            WHERE ua.fonction = 3
              AND ua.chef_equipe = re.id
              AND (ua.etat > 0 OR ua.etat IS NULL)
          ) > 0
          THEN ROUND(
            COUNT(DISTINCT f.id) / (
              SELECT COUNT(*)
              FROM utilisateurs ua
              WHERE ua.fonction = 3
                AND ua.chef_equipe = re.id
                AND (ua.etat > 0 OR ua.etat IS NULL)
            ),
            2
          )
          ELSE 0
        END as ratio
      ${fromSql}
      WHERE ${whereSql}
        AND re.id IS NOT NULL
      GROUP BY re.id, re.pseudo, re.nom, re.prenom
      HAVING fiches_produites > 0
      ORDER BY ratio DESC, fiches_produites DESC
    `, params);

    // Ratio production / effectif par plateau RP qualification
    const ratioByRp = await query(`
      SELECT
        rp.id as rp_id,
        rp.pseudo as rp_pseudo,
        rp.nom as rp_nom,
        rp.prenom as rp_prenom,
        COUNT(DISTINCT f.id) as fiches_produites,
        COUNT(DISTINCT CASE WHEN ${SQL_FICHE_VALIDEE} THEN f.id END) as fiches_validees,
        COUNT(DISTINCT CASE WHEN f.ko = 1 THEN f.id END) as fiches_ko,
        (
          SELECT COUNT(*)
          FROM utilisateurs ua
          WHERE ua.fonction = 3
            AND (ua.etat > 0 OR ua.etat IS NULL)
            AND ua.chef_equipe IN (
              SELECT r2.id FROM utilisateurs r2 WHERE r2.id_rp_qualif = rp.id
            )
        ) as effectif,
        CASE
          WHEN (
            SELECT COUNT(*)
            FROM utilisateurs ua
            WHERE ua.fonction = 3
              AND (ua.etat > 0 OR ua.etat IS NULL)
              AND ua.chef_equipe IN (
                SELECT r2.id FROM utilisateurs r2 WHERE r2.id_rp_qualif = rp.id
              )
          ) > 0
          THEN ROUND(
            COUNT(DISTINCT f.id) / (
              SELECT COUNT(*)
              FROM utilisateurs ua
              WHERE ua.fonction = 3
                AND (ua.etat > 0 OR ua.etat IS NULL)
                AND ua.chef_equipe IN (
                  SELECT r2.id FROM utilisateurs r2 WHERE r2.id_rp_qualif = rp.id
                )
            ),
            2
          )
          ELSE 0
        END as ratio
      ${fromSql}
      INNER JOIN utilisateurs rp ON re.id_rp_qualif = rp.id AND rp.fonction = 12
      WHERE ${whereSql}
      GROUP BY rp.id, rp.pseudo, rp.nom, rp.prenom
      HAVING fiches_produites > 0
      ORDER BY ratio DESC, fiches_produites DESC
    `, params);

    // Évolution quotidienne (total, validées, KO)
    const dailyEvolution = await query(`
      SELECT
        DATE(f.date_insert_time) as date,
        COUNT(DISTINCT f.id) as total_fiches,
        COUNT(DISTINCT CASE WHEN ${SQL_FICHE_VALIDEE} THEN f.id END) as validated_fiches,
        COUNT(DISTINCT CASE WHEN f.ko = 1 THEN f.id END) as ko_fiches
      ${fromSql}
      WHERE ${whereSql}
      GROUP BY DATE(f.date_insert_time)
      ORDER BY date ASC
    `, params);

    res.json({
      success: true,
      data: {
        top10_agents: top10Agents || [],
        rejection_rates: (rejectionRates || []).map((row) => ({
          ...row,
          rejection_rate: parseFloat(row.rejection_rate || 0),
          ko_count: parseInt(row.ko_count || 0, 10),
          rejected_count: parseInt(row.rejected_count || 0, 10),
          groupe0_count: parseInt(row.groupe0_count || 0, 10),
          total_count: parseInt(row.total_count || 0, 10),
        })),
        ratio_by_re: (ratioByRe || []).map((row) => ({
          ...row,
          ratio: parseFloat(row.ratio || 0),
          effectif: parseInt(row.effectif || 0, 10),
          fiches_produites: parseInt(row.fiches_produites || 0, 10),
          fiches_validees: parseInt(row.fiches_validees || 0, 10),
          fiches_ko: parseInt(row.fiches_ko || 0, 10),
        })),
        ratio_by_rp: (ratioByRp || []).map((row) => ({
          ...row,
          ratio: parseFloat(row.ratio || 0),
          effectif: parseInt(row.effectif || 0, 10),
          fiches_produites: parseInt(row.fiches_produites || 0, 10),
          fiches_validees: parseInt(row.fiches_validees || 0, 10),
          fiches_ko: parseInt(row.fiches_ko || 0, 10),
        })),
        daily_evolution: dailyEvolution || [],
      },
    });
  } catch (error) {
    console.error('[STAT-V2] /qualification-advanced - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});

// GET /api/statistiques-v2/confirmation-advanced
// Métriques avancées pour l'onglet Confirmation
router.get('/confirmation-advanced', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /confirmation-advanced - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { date_debut, date_fin, id_confirmateur, id_centre } = req.query;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    const conditions = [];
    const params = [startDate, endDate];
    
    if (id_confirmateur) {
      conditions.push('f.id_confirmateur = ?');
      params.push(parseInt(id_confirmateur));
    }
    if (id_centre) {
      conditions.push('f.id_centre = ?');
      params.push(parseInt(id_centre));
    }
    
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // 1. Délai moyen entre confirmation et signature
    const avgConfirmationToSignature = await queryOne(`
      SELECT AVG(TIMESTAMPDIFF(DAY, 
        FROM_UNIXTIME(f.date_confirmation),
        COALESCE(
          (SELECT MIN(fh.date_creation) FROM fiches_histo fh 
           WHERE fh.id_fiche = f.id 
           AND fh.id_etat IN (13, 16, 44, 45)),
          f.date_modif_time
        )
      )) as avg_days
      FROM fiches f
      WHERE f.id_etat_final = 7
      AND f.date_confirmation IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM fiches_histo fh 
        WHERE fh.id_fiche = f.id 
        AND fh.id_etat IN (13, 16, 44, 45)
      )
      AND f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
    `, params);

    // 2. Taux de rétractation (état 38) + Taux de conversion + Nombre de signatures
    const retractionRate = await queryOne(`
      SELECT 
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) as retracted_count,
        COUNT(DISTINCT f.id) as total_count,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed_count,
        COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN f.id END) as signatures_count,
        CASE 
          WHEN COUNT(DISTINCT f.id) > 0 
          THEN (COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) / COUNT(DISTINCT f.id)) * 100
          ELSE 0
        END as retraction_rate,
        CASE 
          WHEN COUNT(DISTINCT f.id) > 0 
          THEN (COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) / COUNT(DISTINCT f.id)) * 100
          ELSE 0
        END as confirmation_rate
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
    `, params);

    // 3. Top 10 Confirmateurs avec détails
    const top10Confirmateurs = await query(`
      SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmations_count,
        COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN f.id END) as signatures_count,
        AVG(CASE 
          WHEN f.date_confirmation IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, FROM_UNIXTIME(f.date_confirmation), f.date_modif_time)
          ELSE NULL
        END) as avg_confirmation_time_hours
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_confirmateur = u.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
      AND f.id_confirmateur IS NOT NULL
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY confirmations_count DESC
      LIMIT 10
    `, params);

    // 4. Évolution quotidienne des confirmations et signatures
    const dailyConfirmationEvolution = await query(`
      SELECT 
        DATE(COALESCE(FROM_UNIXTIME(f.date_confirmation), f.date_modif_time)) as date,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmations,
        COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) AND f.id_etat_final != 38 THEN f.id END) as signatures
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
      GROUP BY DATE(COALESCE(FROM_UNIXTIME(f.date_confirmation), f.date_modif_time))
      ORDER BY date ASC
    `, params);

    res.json({
      success: true,
      data: {
        avg_confirmation_to_signature_days: parseFloat(avgConfirmationToSignature?.avg_days || 0),
        retraction_rate: parseFloat(retractionRate?.retraction_rate || 0),
        retracted_count: parseInt(retractionRate?.retracted_count || 0),
        total_count: parseInt(retractionRate?.total_count || 0),
        confirmed_count: parseInt(retractionRate?.confirmed_count || 0),
        signatures_count: parseInt(retractionRate?.signatures_count || 0),
        confirmation_rate: parseFloat(retractionRate?.confirmation_rate || 0),
        top10_confirmateurs: top10Confirmateurs || [],
        daily_evolution: dailyConfirmationEvolution || []
      }
    });
  } catch (error) {
    console.error('[STAT-V2] /confirmation-advanced - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/centres-advanced
// Métriques avancées pour l'onglet Centres
router.get('/centres-advanced', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /centres-advanced - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { date_debut, date_fin, id_centre } = req.query;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    const conditions = [];
    const params = [startDate, endDate];
    
    if (id_centre) {
      conditions.push('f.id_centre = ?');
      params.push(parseInt(id_centre));
    }
    
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Récupérer tous les centres actifs
    const centres = await query(`
      SELECT id, titre FROM centres WHERE etat = 1 ORDER BY titre ASC
    `);

    const centresData = [];

    for (const centre of centres) {
      // Métriques de base
      const totalCount = await queryOne(`
        SELECT COUNT(*) as count
        FROM fiches f
        WHERE f.id_centre = ?
        AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [centre.id, startDate, endDate]);

      const signedCount = await queryOne(`
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        WHERE f.id_centre = ?
        AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND f.id_etat_final IN (13, 16, 44, 45)
        AND f.id_etat_final != 38
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [centre.id, startDate, endDate]);

      // Taux de croissance vs période précédente
      const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - daysDiff - 1);
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStartStr = prevStart.toISOString().slice(0, 19).replace('T', ' ');
      const prevEndStr = prevEnd.toISOString().slice(0, 19).replace('T', ' ');

      const prevSignedCount = await queryOne(`
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        WHERE f.id_centre = ?
        AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND f.id_etat_final IN (13, 16, 44, 45)
        AND f.id_etat_final != 38
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [centre.id, prevStartStr, prevEndStr]);

      const growthRate = prevSignedCount?.count > 0
        ? ((signedCount?.count - prevSignedCount.count) / prevSignedCount.count) * 100
        : (signedCount?.count > 0 ? 100 : 0);

      // Productivité (fiches/jour)
      const productivity = daysDiff > 0 ? (totalCount?.count || 0) / daysDiff : 0;

      // N'inclure que les centres avec au moins une fiche sur la période
      const total = parseInt(totalCount?.count || 0);
      if (total > 0) {
        centresData.push({
          centre_id: centre.id,
          centre_titre: centre.titre,
          total_count: total,
          signed_count: parseInt(signedCount?.count || 0),
          growth_rate: parseFloat(growthRate.toFixed(2)),
          productivity_per_day: parseFloat(productivity.toFixed(2))
        });
      }
    }

    res.json({
      success: true,
      data: {
        centres: centresData,
        date_start: dateDebut,
        date_end: dateFin
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des métriques centres avancées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/temporal-performance
// Performance temporelle (évolution sur plusieurs mois)
router.get('/temporal-performance', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /temporal-performance - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { months = 6, metric_type = 'all' } = req.query; // metric_type: all, qualification, confirmation, signatures
    
    const now = new Date();
    const data = [];

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const startDate = `${monthStart} 00:00:00`;
      const endDate = `${monthEnd} 23:59:59`;

      const monthData = {
        period: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
        date_start: monthStart,
        date_end: monthEnd
      };

      if (metric_type === 'all' || metric_type === 'qualification') {
        const qualifData = await queryOne(`
          SELECT 
            COUNT(DISTINCT f.id) as total,
            COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated
          FROM fiches f
          LEFT JOIN etats e ON f.id_etat_final = e.id
          WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `, [startDate, endDate]);
        
        monthData.qualification = {
          total: parseInt(qualifData?.total || 0),
          validated: parseInt(qualifData?.validated || 0),
          rate: qualifData?.total > 0 ? ((qualifData.validated / qualifData.total) * 100).toFixed(2) : 0
        };
      }

      if (metric_type === 'all' || metric_type === 'confirmation') {
        const confData = await queryOne(`
          SELECT 
            COUNT(DISTINCT f.id) as total,
            COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed
          FROM fiches f
          WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `, [startDate, endDate]);
        
        monthData.confirmation = {
          total: parseInt(confData?.total || 0),
          confirmed: parseInt(confData?.confirmed || 0),
          rate: confData?.total > 0 ? ((confData.confirmed / confData.total) * 100).toFixed(2) : 0
        };
      }

      if (metric_type === 'all' || metric_type === 'signatures') {
        const sigData = await queryOne(`
          SELECT 
            COUNT(DISTINCT f.id) as total,
            COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) AND f.id_etat_final != 38 THEN f.id END) as signed
          FROM fiches f
          WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `, [startDate, endDate]);
        
        monthData.signatures = {
          total: parseInt(sigData?.total || 0),
          signed: parseInt(sigData?.signed || 0),
          rate: sigData?.total > 0 ? ((sigData.signed / sigData.total) * 100).toFixed(2) : 0
        };
      }

      data.push(monthData);
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('[STAT-V2] /temporal-performance - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/comparison
// Comparaison multi-périodes : toutes les métriques (fiches générées, qualifiées, confirmées, signatures, rétractées)
router.get('/comparison', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /comparison - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { period1_start, period1_end, period2_start, period2_end } = req.query;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        success: false,
        message: 'Les dates des deux périodes sont requises'
      });
    }

    const period1Start = `${period1_start} 00:00:00`;
    const period1End = `${period1_end} 23:59:59`;
    const period2Start = `${period2_start} 00:00:00`;
    const period2End = `${period2_end} 23:59:59`;

    // Période 1 : total, qualifiées (groupe 1,2,3), confirmées (état 7), signatures (13,16,44,45), rétractées (38)
    const p1 = await queryOne(`
      SELECT 
        COUNT(DISTINCT f.id) as total,
        COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed,
        COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN f.id END) as signatures_count,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) as retracted_count
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [period1Start, period1End]);

    const p2 = await queryOne(`
      SELECT 
        COUNT(DISTINCT f.id) as total,
        COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed,
        COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN f.id END) as signatures_count,
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) as retracted_count
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [period2Start, period2End]);

    const t1 = parseInt(p1?.total || 0);
    const t2 = parseInt(p2?.total || 0);
    const v1 = parseInt(p1?.validated || 0);
    const v2 = parseInt(p2?.validated || 0);
    const c1 = parseInt(p1?.confirmed || 0);
    const c2 = parseInt(p2?.confirmed || 0);
    const s1 = parseInt(p1?.signatures_count || 0);
    const s2 = parseInt(p2?.signatures_count || 0);
    const r1 = parseInt(p1?.retracted_count || 0);
    const r2 = parseInt(p2?.retracted_count || 0);

    const comparison = {
      period1: { start: period1_start, end: period1_end },
      period2: { start: period2_start, end: period2_end },
      fiches_generes: {
        period1: { count: t1 },
        period2: { count: t2 },
        evolution: t1 > 0 ? (((t2 - t1) / t1) * 100).toFixed(1) : (t2 > 0 ? '100' : '0')
      },
      fiches_qualifiees: {
        period1: { count: v1, rate: t1 > 0 ? ((v1 / t1) * 100).toFixed(1) : '0' },
        period2: { count: v2, rate: t2 > 0 ? ((v2 / t2) * 100).toFixed(1) : '0' },
        evolution: t1 > 0 ? (((v2 - v1) / t1) * 100).toFixed(1) : (v2 > 0 ? '100' : '0')
      },
      fiches_confirmees: {
        period1: { count: c1, rate: t1 > 0 ? ((c1 / t1) * 100).toFixed(1) : '0' },
        period2: { count: c2, rate: t2 > 0 ? ((c2 / t2) * 100).toFixed(1) : '0' },
        evolution: t1 > 0 ? (((c2 - c1) / t1) * 100).toFixed(1) : (c2 > 0 ? '100' : '0')
      },
      signatures: {
        period1: { count: s1, rate: t1 > 0 ? ((s1 / t1) * 100).toFixed(1) : '0' },
        period2: { count: s2, rate: t2 > 0 ? ((s2 / t2) * 100).toFixed(1) : '0' },
        evolution: t1 > 0 ? (((s2 - s1) / t1) * 100).toFixed(1) : (s2 > 0 ? '100' : '0')
      },
      retractees: {
        period1: { count: r1, rate: t1 > 0 ? ((r1 / t1) * 100).toFixed(1) : '0' },
        period2: { count: r2, rate: t2 > 0 ? ((r2 / t2) * 100).toFixed(1) : '0' },
        evolution: t1 > 0 ? (((r2 - r1) / t1) * 100).toFixed(1) : (r2 > 0 ? '100' : '0')
      }
    };

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('[STAT-V2] /comparison - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/heatmap
// Heatmap par jour de la semaine / heure
router.get('/heatmap', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /heatmap - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { date_debut, date_fin, metric_type = 'creation' } = req.query; // creation, confirmation, signature
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    let dateField = 'f.date_insert_time';
    if (metric_type === 'confirmation') {
      dateField = 'COALESCE(FROM_UNIXTIME(f.date_confirmation), f.date_modif_time)';
    } else if (metric_type === 'signature') {
      dateField = 'f.date_modif_time';
    }

    const heatmapData = await query(`
      SELECT 
        DAYOFWEEK(${dateField}) as day_of_week,
        HOUR(${dateField}) as hour,
        COUNT(DISTINCT f.id) as count
      FROM fiches f
      WHERE ${dateField} >= ? AND ${dateField} <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      GROUP BY DAYOFWEEK(${dateField}), HOUR(${dateField})
      ORDER BY day_of_week, hour
    `, [startDate, endDate]);

    // Formater les données pour la heatmap
    const formattedData = [];
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    for (let day = 1; day <= 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const item = heatmapData.find(d => d.day_of_week === day && d.hour === hour);
        formattedData.push({
          day: days[day - 1],
          dayOfWeek: day,
          hour: hour,
          count: parseInt(item?.count || 0)
        });
      }
    }

    // Calculer le maximum pour l'intensité
    const max_count = Math.max(...formattedData.map(d => d.count), 1);

    res.json({
      success: true,
      data: {
        heatmap: formattedData,
        max_count: max_count,
        date_start: dateDebut,
        date_end: dateFin,
        metric_type: metric_type
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la heatmap:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/export
// Export des données en CSV/Excel
router.get('/export', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /export - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { 
      type, date_debut, date_fin, 
      format = 'csv', // csv ou excel
      metric_type = 'all'
    } = req.query;

    // Cette route retourne les données formatées pour l'export
    // L'export réel sera fait côté frontend avec les bibliothèques appropriées
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    const exportData = {
      period: { start: dateDebut, end: dateFin },
      generated_at: new Date().toISOString(),
      data: {}
    };

    if (metric_type === 'all' || metric_type === 'qualification') {
      const qualifData = await query(`
        SELECT 
          u.pseudo as agent,
          COUNT(DISTINCT f.id) as total_fiches,
          COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as fiches_validees,
          AVG(TIMESTAMPDIFF(HOUR, f.date_insert_time, f.date_modif_time)) as temps_moyen_heures
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        AND f.id_agent IS NOT NULL
        GROUP BY u.id, u.pseudo
        ORDER BY total_fiches DESC
      `, [startDate, endDate]);

      exportData.data.qualification = qualifData || [];
    }

    if (metric_type === 'all' || metric_type === 'confirmation') {
      const confData = await query(`
        SELECT 
          u.pseudo as confirmateur,
          COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmations,
          COUNT(DISTINCT CASE WHEN f.id_etat_final IN (13, 16, 44, 45) AND f.id_etat_final != 38 THEN f.id END) as signatures
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_confirmateur = u.id
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        AND f.id_confirmateur IS NOT NULL
        GROUP BY u.id, u.pseudo
        ORDER BY confirmations DESC
      `, [startDate, endDate]);

      exportData.data.confirmation = confData || [];
    }

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('[STAT-V2] /export - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/drill-down
// Drill-down pour voir les détails d'un élément cliqué
router.get('/drill-down', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /drill-down - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { drill_type, id_agent, date, id_centre, date_debut, date_fin } = req.query;
    
    let result = {};

    if (drill_type === 'agent' && id_agent) {
      // Détails des fiches d'un agent
      const fiches = await query(`
        SELECT 
          f.id,
          f.nom,
          f.prenom,
          f.date_insert_time,
          e.titre as etat_titre,
          TIMESTAMPDIFF(HOUR, f.date_insert_time, f.date_modif_time) as processing_hours
        FROM fiches f
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE f.id_agent = ?
        AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        ORDER BY f.date_insert_time DESC
        LIMIT 100
      `, [parseInt(id_agent), `${date_debut} 00:00:00`, `${date_fin} 23:59:59`]);
      
      result.fiches = fiches || [];
    } else if (drill_type === 'date' && date) {
      // Résumé d'une date spécifique
      const summary = await queryOne(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) as validated,
          ROUND(COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) * 100.0 / COUNT(*), 2) as validation_rate
        FROM fiches f
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE DATE(f.date_insert_time) = ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [date]);
      
      result.summary = summary || {};
    } else if (drill_type === 'centre' && id_centre) {
      // Métriques d'un centre
      const metrics = await queryOne(`
        SELECT 
          COUNT(*) as total_fiches,
          COUNT(CASE WHEN f.id_etat_final = 7 THEN 1 END) as confirmations,
          COUNT(CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN 1 END) as signatures
        FROM fiches f
        WHERE f.id_centre = ?
        AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [parseInt(id_centre), `${date_debut} 00:00:00`, `${date_fin} 23:59:59`]);
      
      result.metrics = metrics || {};
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur lors du drill-down:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/comparison
// Comparaison entre deux périodes
router.get('/comparison', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /comparison (v2) - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { period1_start, period1_end, period2_start, period2_end } = req.query;
    
    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        success: false,
        message: 'Les dates des deux périodes sont requises'
      });
    }

    const start1 = `${period1_start} 00:00:00`;
    const end1 = `${period1_end} 23:59:59`;
    const start2 = `${period2_start} 00:00:00`;
    const end2 = `${period2_end} 23:59:59`;

    // Calculer les métriques pour la période 1
    const period1Data = await queryOne(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) as qualified,
        COUNT(CASE WHEN f.id_etat_final = 7 THEN 1 END) as confirmed,
        COUNT(CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN 1 END) as signed,
        ROUND(COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) * 100.0 / COUNT(*), 2) as qualification_rate,
        ROUND(COUNT(CASE WHEN f.id_etat_final = 7 THEN 1 END) * 100.0 / COUNT(*), 2) as confirmation_rate,
        ROUND(COUNT(CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN 1 END) * 100.0 / COUNT(*), 2) as signature_rate
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [start1, end1]);

    // Calculer les métriques pour la période 2
    const period2Data = await queryOne(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) as qualified,
        COUNT(CASE WHEN f.id_etat_final = 7 THEN 1 END) as confirmed,
        COUNT(CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN 1 END) as signed,
        ROUND(COUNT(CASE WHEN e.groupe IN ('1', '2', '3') THEN 1 END) * 100.0 / COUNT(*), 2) as qualification_rate,
        ROUND(COUNT(CASE WHEN f.id_etat_final = 7 THEN 1 END) * 100.0 / COUNT(*), 2) as confirmation_rate,
        ROUND(COUNT(CASE WHEN f.id_etat_final IN (13, 16, 44, 45) THEN 1 END) * 100.0 / COUNT(*), 2) as signature_rate
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [start2, end2]);

    // Calculer les différences
    const diff = {
      qualification: (period2Data?.qualification_rate || 0) - (period1Data?.qualification_rate || 0),
      confirmation: (period2Data?.confirmation_rate || 0) - (period1Data?.confirmation_rate || 0),
      signature: (period2Data?.signature_rate || 0) - (period1Data?.signature_rate || 0)
    };

    // Données pour le graphique
    const chart_data = [
      {
        metric: 'Qualification',
        period1: period1Data?.qualification_rate || 0,
        period2: period2Data?.qualification_rate || 0
      },
      {
        metric: 'Confirmation',
        period1: period1Data?.confirmation_rate || 0,
        period2: period2Data?.confirmation_rate || 0
      },
      {
        metric: 'Signature',
        period1: period1Data?.signature_rate || 0,
        period2: period2Data?.signature_rate || 0
      }
    ];

    res.json({
      success: true,
      data: {
        period1: period1Data || {},
        period2: period2Data || {},
        diff: diff,
        chart_data: chart_data
      }
    });
  } catch (error) {
    console.error('[STAT-V2] /comparison - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/alerts
// Alertes de performance
router.get('/alerts', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  console.log('[STAT-V2] /alerts - Requête reçue - user:', req.user?.id, 'params:', req.query);
  try {
    const { date_debut, date_fin } = req.query;
    
    const startDate = `${date_debut} 00:00:00`;
    const endDate = `${date_fin} 23:59:59`;

    const alerts = [];

    // Alerte: Taux de rejet élevé
    const rejectionRate = await queryOne(`
      SELECT 
        COUNT(CASE WHEN f.id_etat_final = 2 THEN 1 END) * 100.0 / COUNT(*) as rejection_rate
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [startDate, endDate]);

    const rejectionRateValue = parseFloat(rejectionRate?.rejection_rate) || 0;
    if (rejectionRateValue > 20) {
      alerts.push({
        severity: 'warning',
        title: 'Taux de rejet élevé',
        message: `Le taux de rejet est de ${rejectionRateValue.toFixed(1)}%, ce qui est supérieur au seuil recommandé de 20%.`,
        metric: {
          label: 'Taux de rejet',
          value: `${rejectionRateValue.toFixed(1)}%`
        }
      });
    }

    // Alerte: Temps de traitement moyen élevé
    const avgProcessingTime = await queryOne(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, f.date_insert_time, f.date_modif_time)) as avg_hours
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND f.date_modif_time IS NOT NULL
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [startDate, endDate]);

    const avgHoursValue = parseFloat(avgProcessingTime?.avg_hours) || 0;
    if (avgHoursValue > 48) {
      alerts.push({
        severity: 'warning',
        title: 'Temps de traitement élevé',
        message: `Le temps moyen de traitement est de ${avgHoursValue.toFixed(1)} heures, ce qui est supérieur à 48 heures.`,
        metric: {
          label: 'Temps moyen',
          value: `${avgHoursValue.toFixed(1)}h`
        }
      });
    }

    // Alerte: Baisse de productivité
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStart = lastWeek.toISOString().split('T')[0];
    const lastWeekEnd = today.toISOString().split('T')[0];

    const currentWeekCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [`${date_debut} 00:00:00`, `${date_fin} 23:59:59`]);

    const lastWeekCount = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
    `, [`${lastWeekStart} 00:00:00`, `${lastWeekEnd} 23:59:59`]);

    if (lastWeekCount?.count > 0) {
      const decline = ((currentWeekCount?.count || 0) - (lastWeekCount?.count || 0)) / lastWeekCount.count * 100;
      if (decline < -20) {
        alerts.push({
          severity: 'error',
          title: 'Baisse de productivité',
          message: `La productivité a baissé de ${Math.abs(decline).toFixed(1)}% par rapport à la semaine dernière.`,
          metric: {
            label: 'Baisse',
            value: `${Math.abs(decline).toFixed(1)}%`
          }
        });
      }
    }

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('[STAT-V2] /alerts - Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

