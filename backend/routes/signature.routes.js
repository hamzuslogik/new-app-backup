const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTE: GET /api/signature
// Récupérer la liste des signatures avec filtres
// =====================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      id_confirmateur, 
      id_fiche,
      page = 1,
      limit = 50
    } = req.query;

    let whereConditions = [];
    let params = [];

    // Filtrer par date
    if (date_debut) {
      whereConditions.push('s.date_heure >= ?');
      params.push(`${date_debut} 00:00:00`);
    }
    if (date_fin) {
      whereConditions.push('s.date_heure <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    // Filtrer par confirmateur
    if (id_confirmateur) {
      whereConditions.push('s.confirmateur = ?');
      params.push(id_confirmateur);
    }

    // Filtrer par fiche
    if (id_fiche) {
      whereConditions.push('s.id_fiche = ?');
      params.push(id_fiche);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Compter le total
    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM signature s ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Calculer la pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = parseInt(limit);

    // Récupérer les signatures
    const signatures = await query(
      `SELECT 
        s.id,
        s.id_fiche,
        s.confirmateur,
        s.ajoute,
        s.date_heure,
        s.tel,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        u.pseudo as confirmateur_pseudo,
        u.nom as confirmateur_nom,
        u.prenom as confirmateur_prenom
      FROM signature s
      LEFT JOIN fiches f ON s.id_fiche = f.id
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      ORDER BY s.date_heure DESC
      LIMIT ? OFFSET ?`,
      [...params, limitValue, offset]
    );

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
// ROUTE: GET /api/signature/stats
// Récupérer les statistiques des signatures
// =====================================================
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    let whereConditions = [];
    let params = [];

    // Filtrer par date
    if (date_debut) {
      whereConditions.push('s.date_heure >= ?');
      params.push(`${date_debut} 00:00:00`);
    }
    if (date_fin) {
      whereConditions.push('s.date_heure <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Timestamps et dates pour la période (fiches confirmées = état 7)
    const startDateStr = date_debut ? `${date_debut} 00:00:00` : null;
    const endDateStr = date_fin ? `${date_fin} 23:59:59` : null;
    const startTs = startDateStr ? Math.floor(new Date(startDateStr).getTime() / 1000) : 0;
    const endTs = endDateStr ? Math.floor(new Date(endDateStr).getTime() / 1000) : 0;

    // Total signatures (somme des scores)
    const totalResult = await queryOne(
      `SELECT SUM(s.ajoute) as total FROM signature s ${whereClause}`,
      params
    );
    const totalSignatures = parseFloat(totalResult?.total || 0);

    // Nombre de fiches signées uniques
    const fichesUniquesResult = await queryOne(
      `SELECT COUNT(DISTINCT s.id_fiche) as total 
       FROM signature s 
       ${whereClause} 
       AND s.id_fiche IS NOT NULL`,
      params
    );
    const fichesUniques = fichesUniquesResult?.total || 0;

    // Top 10 confirmateurs par score (nb_signatures = nombre de lignes signature)
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
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      AND s.confirmateur IS NOT NULL
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom
      ORDER BY total_score DESC
      LIMIT 10`,
      params
    );

    // Nombre de fiches confirmées (RDV, état 7) par confirmateur sur la période
    let fichesConfirmeesByConfirmateur = {};
    if (date_debut && date_fin) {
      const dateCond = `((f.date_confirmation IS NOT NULL AND f.date_confirmation >= ? AND f.date_confirmation <= ?) OR (f.date_confirmation IS NULL AND f.date_modif_time >= ? AND f.date_modif_time <= ?))`;
      const fcParams = [startTs, endTs, startDateStr, endDateStr, startTs, endTs, startDateStr, endDateStr, startTs, endTs, startDateStr, endDateStr];
      const fcRows = await query(
        `SELECT confirmateur_id, COUNT(DISTINCT id_fiche) as nb_fiches_confirmees
         FROM (
           SELECT f.id_confirmateur as confirmateur_id, f.id as id_fiche FROM fiches f WHERE f.id_etat_final = 7 AND f.id_confirmateur IS NOT NULL AND (f.archive = 0 OR f.archive IS NULL) AND (f.ko = 0 OR f.ko IS NULL) AND ${dateCond}
           UNION ALL
           SELECT f.id_confirmateur_2, f.id FROM fiches f WHERE f.id_etat_final = 7 AND f.id_confirmateur_2 IS NOT NULL AND (f.archive = 0 OR f.archive IS NULL) AND (f.ko = 0 OR f.ko IS NULL) AND ${dateCond}
           UNION ALL
           SELECT f.id_confirmateur_3, f.id FROM fiches f WHERE f.id_etat_final = 7 AND f.id_confirmateur_3 IS NOT NULL AND (f.archive = 0 OR f.archive IS NULL) AND (f.ko = 0 OR f.ko IS NULL) AND ${dateCond}
         ) t
         GROUP BY confirmateur_id`,
        fcParams
      );
      (fcRows || []).forEach(row => {
        fichesConfirmeesByConfirmateur[row.confirmateur_id] = parseInt(row.nb_fiches_confirmees || 0);
      });
    }

    // Statistiques par jour (derniers 30 jours)
    const statsParJour = await query(
      `SELECT 
        DATE(s.date_heure) as date,
        SUM(s.ajoute) as total_score,
        COUNT(DISTINCT s.id_fiche) as nb_fiches,
        COUNT(*) as nb_signatures
      FROM signature s
      ${whereClause}
      AND s.date_heure >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(s.date_heure)
      ORDER BY date DESC`,
      params
    );

    // Statistiques par confirmateur (tous)
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
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      AND s.confirmateur IS NOT NULL
      GROUP BY s.confirmateur, u.pseudo, u.nom, u.prenom
      ORDER BY total_score DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        totalSignatures,
        fichesUniques,
        topConfirmateurs: topConfirmateurs.map(c => {
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
        }),
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
// Récupérer les KPI des signatures
// =====================================================
router.get('/kpi', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    // Dates par défaut : ce mois
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateDebut = date_debut || startOfMonth.toISOString().split('T')[0];
    const dateFin = date_fin || endOfMonth.toISOString().split('T')[0];

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

    // KPI 1: Total signatures (score - SUM ajoute) - période actuelle
    const currentTotalResult = await queryOne(
      `SELECT SUM(ajoute) as total FROM signature WHERE date_heure >= ? AND date_heure <= ?`,
      [currentStart, currentEnd]
    );
    const currentTotal = parseFloat(currentTotalResult?.total || 0);

    // KPI 2: Total signatures (score - SUM ajoute) - période précédente
    const previousTotalResult = await queryOne(
      `SELECT SUM(ajoute) as total FROM signature WHERE date_heure >= ? AND date_heure <= ?`,
      [previousStartStr, previousEndStr]
    );
    const previousTotal = parseFloat(previousTotalResult?.total || 0);

    // KPI 3: Évolution du score
    const evolution = previousTotal > 0 
      ? ((currentTotal - previousTotal) / previousTotal) * 100 
      : (currentTotal > 0 ? 100 : 0);

    // KPI 4: Nombre de signatures (COUNT) - période actuelle
    const currentNombreResult = await queryOne(
      `SELECT COUNT(*) as total FROM signature WHERE date_heure >= ? AND date_heure <= ?`,
      [currentStart, currentEnd]
    );
    const currentNombre = parseInt(currentNombreResult?.total || 0);

    // KPI 5: Nombre de signatures (COUNT) - période précédente
    const previousNombreResult = await queryOne(
      `SELECT COUNT(*) as total FROM signature WHERE date_heure >= ? AND date_heure <= ?`,
      [previousStartStr, previousEndStr]
    );
    const previousNombre = parseInt(previousNombreResult?.total || 0);

    // KPI 6: Évolution du nombre
    const evolutionNombre = previousNombre > 0 
      ? ((currentNombre - previousNombre) / previousNombre) * 100 
      : (currentNombre > 0 ? 100 : 0);

    // KPI 7: Nombre de fiches signées uniques (période actuelle)
    const currentFichesResult = await queryOne(
      `SELECT COUNT(DISTINCT id_fiche) as total 
       FROM signature 
       WHERE date_heure >= ? AND date_heure <= ? AND id_fiche IS NOT NULL`,
      [currentStart, currentEnd]
    );
    const currentFiches = parseInt(currentFichesResult?.total || 0);

    // KPI 8: Nombre de fiches signées uniques (période précédente)
    const previousFichesResult = await queryOne(
      `SELECT COUNT(DISTINCT id_fiche) as total 
       FROM signature 
       WHERE date_heure >= ? AND date_heure <= ? AND id_fiche IS NOT NULL`,
      [previousStartStr, previousEndStr]
    );
    const previousFiches = parseInt(previousFichesResult?.total || 0);

    // KPI 9: Évolution fiches
    const evolutionFiches = previousFiches > 0 
      ? ((currentFiches - previousFiches) / previousFiches) * 100 
      : (currentFiches > 0 ? 100 : 0);

    // KPI 7: Top 3 confirmateurs (période actuelle)
    const top3Result = await query(
      `SELECT 
        s.confirmateur,
        u.pseudo as confirmateur_pseudo,
        SUM(s.ajoute) as total_score
      FROM signature s
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      WHERE s.date_heure >= ? AND s.date_heure <= ?
      AND s.confirmateur IS NOT NULL
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

module.exports = router;

