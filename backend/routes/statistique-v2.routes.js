const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// STATISTIQUES V2 - Routes avancées avec nouvelles métriques
// =====================================================

// GET /api/statistiques-v2/qualification-advanced
// Métriques avancées pour l'onglet Qualification
router.get('/qualification-advanced', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  try {
    const { date_debut, date_fin, id_agent, id_equipe, id_centre, id_departement } = req.query;
    
    // Dates par défaut : ce mois
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];
    const startDate = `${dateDebut} 00:00:00`;
    const endDate = `${dateFin} 23:59:59`;

    // Construire les conditions de filtre
    const conditions = [];
    const params = [startDate, endDate];
    
    if (id_agent) {
      conditions.push('f.id_agent = ?');
      params.push(parseInt(id_agent));
    }
    if (id_centre) {
      conditions.push('f.id_centre = ?');
      params.push(parseInt(id_centre));
    }
    if (id_departement) {
      conditions.push('f.departement = ?');
      params.push(id_departement);
    }
    
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // 1. Temps moyen de traitement (création → validation)
    const avgProcessingTimeParams = [...params];
    const avgProcessingTime = await queryOne(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, f.date_insert_time, 
        COALESCE(
          (SELECT MIN(fh.date_creation) FROM fiches_histo fh 
           WHERE fh.id_fiche = f.id 
           AND fh.id_etat IN (SELECT id FROM etats WHERE groupe IN ('1', '2', '3'))
           LIMIT 1),
          f.date_modif_time
        )
      )) as avg_hours
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
    `, avgProcessingTimeParams);

    // 2. Top 10 Agents (au lieu de Top 3)
    const top10Agents = await query(`
      SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        COUNT(DISTINCT f.id) as count_validated,
        AVG(TIMESTAMPDIFF(HOUR, f.date_insert_time, f.date_modif_time)) as avg_processing_hours
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_agent = u.id
      INNER JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
      ${whereClause}
      AND f.id_agent IS NOT NULL
      GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
      ORDER BY count_validated DESC
      LIMIT 10
    `, params);

    // 3. Taux de rejet/abandon par agent
    const rejectionRates = await query(`
      SELECT 
        u.id,
        u.pseudo,
        COUNT(DISTINCT CASE WHEN e.groupe = '0' OR e.groupe = 0 THEN f.id END) as rejected_count,
        COUNT(DISTINCT f.id) as total_count,
        CASE 
          WHEN COUNT(DISTINCT f.id) > 0 
          THEN (COUNT(DISTINCT CASE WHEN e.groupe = '0' OR e.groupe = 0 THEN f.id END) / COUNT(DISTINCT f.id)) * 100
          ELSE 0
        END as rejection_rate
      FROM fiches f
      INNER JOIN utilisateurs u ON f.id_agent = u.id
      INNER JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
      AND f.id_agent IS NOT NULL
      GROUP BY u.id, u.pseudo
      HAVING total_count > 0
      ORDER BY rejection_rate DESC
    `, params);

    // 4. Nombre moyen de fiches par agent/jour
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1;
    const avgFichesPerAgentParams = [...params];
    const totalFichesResult = await queryOne(`
      SELECT COUNT(DISTINCT f.id) as total, COUNT(DISTINCT f.id_agent) as agents
      FROM fiches f
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.id_agent IS NOT NULL
      ${whereClause}
    `, avgFichesPerAgentParams);
    
    const avgFichesPerAgent = {
      avg_per_agent_per_day: totalFichesResult?.agents > 0 && daysDiff > 0
        ? (totalFichesResult.total / totalFichesResult.agents / daysDiff)
        : 0
    };

    // 5. Évolution temporelle (par jour)
    const dailyEvolution = await query(`
      SELECT 
        DATE(f.date_insert_time) as date,
        COUNT(DISTINCT f.id) as total_fiches,
        COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated_fiches
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      ${whereClause}
      GROUP BY DATE(f.date_insert_time)
      ORDER BY date ASC
    `, params);

    res.json({
      success: true,
      data: {
        avg_processing_time_hours: parseFloat(avgProcessingTime?.avg_hours || 0),
        top10_agents: top10Agents || [],
        rejection_rates: rejectionRates || [],
        avg_fiches_per_agent_per_day: parseFloat(avgFichesPerAgent?.avg_per_agent_per_day || 0),
        daily_evolution: dailyEvolution || []
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des métriques qualification avancées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/confirmation-advanced
// Métriques avancées pour l'onglet Confirmation
router.get('/confirmation-advanced', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
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

    // 2. Taux de rétractation (état 38)
    const retractionRate = await queryOne(`
      SELECT 
        COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) as retracted_count,
        COUNT(DISTINCT f.id) as total_count,
        CASE 
          WHEN COUNT(DISTINCT f.id) > 0 
          THEN (COUNT(DISTINCT CASE WHEN f.id_etat_final = 38 THEN f.id END) / COUNT(DISTINCT f.id)) * 100
          ELSE 0
        END as retraction_rate
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
        top10_confirmateurs: top10Confirmateurs || [],
        daily_evolution: dailyConfirmationEvolution || []
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des métriques confirmation avancées:', error);
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

    // Récupérer tous les centres
    const centres = await query(`
      SELECT id, titre FROM centres WHERE etat > 0 ORDER BY titre ASC
    `);

    const centresData = [];

    for (const centre of centres) {
      const centreParams = [...params, centre.id];

      // Métriques de base
      const totalCount = await queryOne(`
        SELECT COUNT(*) as count
        FROM fiches f
        WHERE f.id_centre = ? AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [centre.id, startDate, endDate]);

      const signedCount = await queryOne(`
        SELECT COUNT(DISTINCT f.id) as count
        FROM fiches f
        WHERE f.id_centre = ? AND f.date_insert_time >= ? AND f.date_insert_time <= ?
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
        WHERE f.id_centre = ? AND f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND f.id_etat_final IN (13, 16, 44, 45)
        AND f.id_etat_final != 38
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [centre.id, prevStartStr, prevEndStr]);

      const growthRate = prevSignedCount?.count > 0
        ? ((signedCount?.count - prevSignedCount.count) / prevSignedCount.count) * 100
        : (signedCount?.count > 0 ? 100 : 0);

      // Productivité (fiches/jour)
      const productivity = daysDiff > 0 ? (totalCount?.count || 0) / daysDiff : 0;

      centresData.push({
        centre_id: centre.id,
        centre_titre: centre.titre,
        total_count: parseInt(totalCount?.count || 0),
        signed_count: parseInt(signedCount?.count || 0),
        growth_rate: parseFloat(growthRate.toFixed(2)),
        productivity_per_day: parseFloat(productivity.toFixed(2))
      });
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
    console.error('Erreur lors de la récupération de la performance temporelle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// GET /api/statistiques-v2/comparison
// Comparaison multi-périodes
router.get('/comparison', authenticate, checkPermissionCode('statistiques_v2_view'), async (req, res) => {
  try {
    const { 
      period1_start, period1_end, 
      period2_start, period2_end,
      metric_type = 'all'
    } = req.query;

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

    const comparison = {
      period1: { start: period1_start, end: period1_end },
      period2: { start: period2_start, end: period2_end }
    };

    if (metric_type === 'all' || metric_type === 'qualification') {
      const period1Data = await queryOne(`
        SELECT 
          COUNT(DISTINCT f.id) as total,
          COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated
        FROM fiches f
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [period1Start, period1End]);

      const period2Data = await queryOne(`
        SELECT 
          COUNT(DISTINCT f.id) as total,
          COUNT(DISTINCT CASE WHEN e.groupe IN ('1', '2', '3') THEN f.id END) as validated
        FROM fiches f
        LEFT JOIN etats e ON f.id_etat_final = e.id
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [period2Start, period2End]);

      comparison.qualification = {
        period1: {
          total: parseInt(period1Data?.total || 0),
          validated: parseInt(period1Data?.validated || 0),
          rate: period1Data?.total > 0 ? ((period1Data.validated / period1Data.total) * 100).toFixed(2) : 0
        },
        period2: {
          total: parseInt(period2Data?.total || 0),
          validated: parseInt(period2Data?.validated || 0),
          rate: period2Data?.total > 0 ? ((period2Data.validated / period2Data.total) * 100).toFixed(2) : 0
        },
        evolution: period1Data?.total > 0 
          ? (((period2Data?.validated || 0) - (period1Data?.validated || 0)) / period1Data.total * 100).toFixed(2)
          : 0
      };
    }

    if (metric_type === 'all' || metric_type === 'confirmation') {
      const period1Data = await queryOne(`
        SELECT 
          COUNT(DISTINCT f.id) as total,
          COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed
        FROM fiches f
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [period1Start, period1End]);

      const period2Data = await queryOne(`
        SELECT 
          COUNT(DISTINCT f.id) as total,
          COUNT(DISTINCT CASE WHEN f.id_etat_final = 7 THEN f.id END) as confirmed
        FROM fiches f
        WHERE f.date_insert_time >= ? AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
      `, [period2Start, period2End]);

      comparison.confirmation = {
        period1: {
          total: parseInt(period1Data?.total || 0),
          confirmed: parseInt(period1Data?.confirmed || 0),
          rate: period1Data?.total > 0 ? ((period1Data.confirmed / period1Data.total) * 100).toFixed(2) : 0
        },
        period2: {
          total: parseInt(period2Data?.total || 0),
          confirmed: parseInt(period2Data?.confirmed || 0),
          rate: period2Data?.total > 0 ? ((period2Data.confirmed / period2Data.total) * 100).toFixed(2) : 0
        },
        evolution: period1Data?.total > 0 
          ? (((period2Data?.confirmed || 0) - (period1Data?.confirmed || 0)) / period1Data.total * 100).toFixed(2)
          : 0
      };
    }

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Erreur lors de la comparaison:', error);
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

    res.json({
      success: true,
      data: {
        heatmap: formattedData,
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
    console.error('Erreur lors de la préparation de l\'export:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

