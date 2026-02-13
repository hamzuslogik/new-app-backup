const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

function getFirstOfMonthLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function getLastDayOfMonthLocal() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
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
      id_fiche,
      id_etat_final,
      page = 1,
      limit = 50
    } = req.query;

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

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // Compter le total (JOIN fiches pour filtrer par date_rdv_time)
    const countResult = await queryOne(
      `SELECT COUNT(*) as total 
       FROM signature s 
       INNER JOIN fiches f ON s.id_fiche = f.id 
       ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Calculer la pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = parseInt(limit);

    // Récupérer les signatures (date de planning = f.date_rdv_time)
    const signatures = await query(
      `SELECT 
        s.id,
        s.id_fiche,
        s.confirmateur,
        s.ajoute,
        s.date_heure,
        s.tel,
        f.hash as fiche_hash,
        f.date_rdv_time as date_planning,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        f.id_etat_final as fiche_id_etat_final,
        u.pseudo as confirmateur_pseudo,
        u.nom as confirmateur_nom,
        u.prenom as confirmateur_prenom
      FROM signature s
      INNER JOIN fiches f ON s.id_fiche = f.id
      LEFT JOIN utilisateurs u ON s.confirmateur = u.id
      ${whereClause}
      ORDER BY f.date_rdv_time DESC, s.date_heure DESC
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
      const fcRows = await query(
        `SELECT id_confirmateur as confirmateur_id, COUNT(*) as nb_fiches_confirmees
         FROM confirmations
         WHERE id_confirmateur IS NOT NULL AND id_confirmateur > 0
           AND (date_rdv_time >= ? AND date_rdv_time <= ?)
         GROUP BY id_confirmateur`,
        confParams
      ).catch(() => []); // si la table ou colonne n'existe pas, rester vide
      (fcRows || []).forEach(row => {
        fichesConfirmeesByConfirmateur[row.confirmateur_id] = parseInt(row.nb_fiches_confirmees || 0);
      });
      // Fallback: si date_rdv_time n'existe pas, essayer date_planning
      if (Object.keys(fichesConfirmeesByConfirmateur).length === 0) {
        const fcRowsPlan = await query(
          `SELECT id_confirmateur as confirmateur_id, COUNT(*) as nb_fiches_confirmees
           FROM confirmations
           WHERE id_confirmateur IS NOT NULL AND id_confirmateur > 0
             AND date_planning >= ? AND date_planning <= ?
           GROUP BY id_confirmateur`,
          confParams
        ).catch(() => []);
        (fcRowsPlan || []).forEach(row => {
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

module.exports = router;

