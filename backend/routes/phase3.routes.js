const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTES POUR PHASE 3
// =====================================================

// GET /api/phase3/rdv-affilie
// Récupère les RDV affiliés (fiches confirmées avec commercial assigné, date_rdv = aujourd'hui)
router.get('/rdv-affilie', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    let whereConditions = [
      'fiche.archive = 0',
      'fiche.ko = 0',
      'fiche.active = 1',
      'fiche.id_etat_final = 7', // CONFIRMER
      'fiche.date_rdv_time IS NOT NULL',
      'fiche.date_rdv_time != ""',
      'fiche.date_rdv_time >= ?',
      'fiche.date_rdv_time <= ?',
      '(fiche.id_commercial IS NOT NULL AND fiche.id_commercial > 0)' // Affecté à un commercial
    ];
    let params = [`${today} 00:00:00`, `${today} 23:59:59`];

    // Pour les confirmateurs, filtrer par leurs fiches
    if (req.user.fonction === 6) {
      whereConditions.push('(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)');
      params.push(req.user.id, req.user.id, req.user.id);
    }

    const whereClause = whereConditions.join(' AND ');

    const fiches = await query(
      `SELECT fiche.*
      FROM fiches fiche
      WHERE ${whereClause}
      ORDER BY fiche.date_rdv_time ASC`,
      params
    );

    res.json({ data: fiches });
  } catch (error) {
    console.error('Erreur lors de la récupération des RDV affiliés:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/phase3/rdv-non-affilie
// Récupère les RDV non affiliés (fiches confirmées sans commercial, date_rdv = aujourd'hui)
router.get('/rdv-non-affilie', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    let whereConditions = [
      'fiche.archive = 0',
      'fiche.ko = 0',
      'fiche.active = 1',
      'fiche.id_etat_final = 7', // CONFIRMER
      'fiche.date_rdv_time IS NOT NULL',
      'fiche.date_rdv_time != ""',
      'fiche.date_rdv_time >= ?',
      'fiche.date_rdv_time <= ?',
      '(fiche.id_commercial IS NULL OR fiche.id_commercial = 0)' // Non affecté à un commercial
    ];
    let params = [`${today} 00:00:00`, `${today} 23:59:59`];

    // Pour les confirmateurs, filtrer par leurs fiches
    if (req.user.fonction === 6) {
      whereConditions.push('(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)');
      params.push(req.user.id, req.user.id, req.user.id);
    }

    const whereClause = whereConditions.join(' AND ');

    const fiches = await query(
      `SELECT fiche.*
      FROM fiches fiche
      WHERE ${whereClause}
      ORDER BY fiche.date_rdv_time ASC`,
      params
    );

    res.json({ data: fiches });
  } catch (error) {
    console.error('Erreur lors de la récupération des RDV non affiliés:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/phase3/signes-semaine
// Récupère les fiches signées de la semaine en cours
router.get('/signes-semaine', authenticate, async (req, res) => {
  try {
    // Calculer le début et la fin de la semaine ISO (lundi à dimanche)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Ajuster pour que lundi = 0
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().slice(0, 19).replace('T', ' ');
    const weekEndStr = weekEnd.toISOString().slice(0, 19).replace('T', ' ');

    const fiches = await query(
      `SELECT fiche.*
      FROM fiches fiche
      WHERE (fiche.id_etat_final = 13 
             OR fiche.id_etat_final = 44 
             OR fiche.id_etat_final = 45)
        AND fiche.date_rdv_time >= ?
        AND fiche.date_rdv_time <= ?
      ORDER BY fiche.date_rdv_time ASC`,
      [weekStartStr, weekEndStr]
    );

    res.json({ 
      data: fiches,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des signés de la semaine:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/phase3/signes-mois
// Récupère les fiches signées du mois en cours
router.get('/signes-mois', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    
    // Premier jour du mois
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
    
    // Dernier jour du mois
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;

    const fiches = await query(
      `SELECT fiche.*
      FROM fiches fiche
      WHERE (fiche.id_etat_final = 13 
             OR fiche.id_etat_final = 44 
             OR fiche.id_etat_final = 45)
        AND fiche.date_rdv_time >= ?
        AND fiche.date_rdv_time <= ?
      ORDER BY fiche.date_rdv_time ASC`,
      [monthStart, monthEnd]
    );

    res.json({ 
      data: fiches,
      month_start: `${year}-${String(month).padStart(2, '0')}-01`,
      month_end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des signés du mois:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;

