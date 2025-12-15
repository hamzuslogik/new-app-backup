const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTES POUR LE SUIVI TÉLÉPRO
// =====================================================

// GET /api/suivi/commissions
// Récupère les commissions par confirmateur
router.get('/commissions', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin, id_confirmateur } = req.query;

    // Par défaut : mois en cours
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const dateDebut = date_debut || firstDay.toISOString().split('T')[0];
    const dateFin = date_fin || lastDay.toISOString().split('T')[0];

    let whereClause = `fiche.id_etat_final = 7 
      AND fiche.date_modif_time >= ? 
      AND fiche.date_modif_time <= ?`;
    let params = [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`];

    if (id_confirmateur) {
      whereClause += ' AND fiche.id_confirmateur = ?';
      params.push(id_confirmateur);
    }

    // Fiches confirmées actives
    const commissionsActives = await query(
      `SELECT 
        fiche.id_confirmateur,
        SUM(COALESCE(fiche.ph3_prix, 0)) as ch_aff,
        COUNT(fiche.id) as nb_vente
      FROM fiches fiche
      WHERE ${whereClause}
      GROUP BY fiche.id_confirmateur
      ORDER BY ch_aff DESC`,
      params
    );

    // Fiches confirmées passées en historique (état 49)
    const commissionsHisto = await query(
      `SELECT 
        fiche.id_confirmateur,
        SUM(COALESCE(fiche.ph3_prix, 0)) as ch_aff,
        COUNT(histo.id) as nb_vente
      FROM fiches_histo histo
      LEFT JOIN fiches fiche ON histo.id_fiche = fiche.id
      WHERE histo.id_etat = 7 
        AND fiche.id_etat_final = 49
        AND histo.date_creation >= ?
        AND histo.date_creation <= ?
        ${id_confirmateur ? 'AND fiche.id_confirmateur = ?' : ''}
      GROUP BY fiche.id_confirmateur
      ORDER BY ch_aff DESC`,
      id_confirmateur 
        ? [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`, id_confirmateur]
        : [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`]
    );

    // Fusionner les résultats
    const commissionsMap = {};
    
    commissionsActives.forEach(item => {
      if (item.id_confirmateur) {
        commissionsMap[item.id_confirmateur] = {
          id_confirmateur: item.id_confirmateur,
          ch: parseFloat(item.ch_aff) || 0,
          ch_net: 0,
          nb_vente: parseInt(item.nb_vente) || 0
        };
      }
    });

    commissionsHisto.forEach(item => {
      if (item.id_confirmateur) {
        if (commissionsMap[item.id_confirmateur]) {
          commissionsMap[item.id_confirmateur].ch += parseFloat(item.ch_aff) || 0;
          commissionsMap[item.id_confirmateur].ch_net = parseFloat(item.ch_aff) || 0;
          commissionsMap[item.id_confirmateur].nb_vente += parseInt(item.nb_vente) || 0;
        } else {
          commissionsMap[item.id_confirmateur] = {
            id_confirmateur: item.id_confirmateur,
            ch: parseFloat(item.ch_aff) || 0,
            ch_net: parseFloat(item.ch_aff) || 0,
            nb_vente: parseInt(item.nb_vente) || 0
          };
        }
      }
    });

    // Récupérer les noms des confirmateurs
    const confirmateursIds = Object.keys(commissionsMap).map(id => parseInt(id));
    let confirmateurs = {};
    if (confirmateursIds.length > 0) {
      const users = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE id IN (${confirmateursIds.map(() => '?').join(',')})`,
        confirmateursIds
      );
      users.forEach(user => {
        confirmateurs[user.id] = user.pseudo;
      });
    }

    // Ajouter les noms et calculer les totaux
    const commissions = Object.values(commissionsMap).map(comm => ({
      ...comm,
      name: confirmateurs[comm.id_confirmateur] || 'Inconnu'
    }));

    // Calculer les totaux
    const totals = {
      ch_total: commissions.reduce((sum, c) => sum + c.ch, 0),
      ch_total_net: commissions.reduce((sum, c) => sum + c.ch_net, 0),
      nb_vente_total: commissions.reduce((sum, c) => sum + c.nb_vente, 0)
    };

    res.json({
      commissions: commissions.sort((a, b) => b.ch - a.ch),
      totals
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des commissions:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/suivi/signatures
// Récupère les statistiques de signature
// Calcul du score: 1 si un seul confirmateur, 0.5 chacun si deux confirmateurs
router.get('/signatures', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin, id_confirmateur } = req.query;

    // Par défaut : aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const dateDebut = date_debut || today;
    const dateFin = date_fin || today;

    // Construire les conditions WHERE
    let whereConditions = [
      'fiche.id_etat_final = 13', // État SIGNE
      'fiche.archive = 0',
      'fiche.ko = 0',
      'fiche.active = 1',
      'fiche.date_sign_time IS NOT NULL', // Uniquement les fiches avec date_sign_time
      'fiche.date_sign_time != ""',
      'fiche.date_sign_time >= ?', // Filtrer uniquement par date_sign_time
      'fiche.date_sign_time <= ?'
    ];
    let params = [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`];

    // Filtrer par confirmateur si spécifié
    if (id_confirmateur) {
      whereConditions.push(`(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)`);
      params.push(id_confirmateur, id_confirmateur, id_confirmateur);
    }

    const whereClause = whereConditions.join(' AND ');

    // Récupérer les fiches signées avec leurs confirmateurs
    const fiches = await query(
      `SELECT 
        fiche.id,
        fiche.nom,
        fiche.prenom,
        fiche.tel,
        fiche.id_confirmateur,
        fiche.id_confirmateur_2,
        fiche.id_confirmateur_3,
        fiche.date_sign_time,
        fiche.date_modif_time
      FROM fiches fiche
      WHERE ${whereClause}`,
      params
    );

    // Calculer les scores selon les nouvelles règles
    // 1 confirmateur = score 1, 2 confirmateurs = 0.5 chacun
    const scoresMap = {};
    const detailsMap = {};

    fiches.forEach(fiche => {
      const confirmateurs = [];
      if (fiche.id_confirmateur && fiche.id_confirmateur > 0) {
        confirmateurs.push(fiche.id_confirmateur);
      }
      if (fiche.id_confirmateur_2 && fiche.id_confirmateur_2 > 0) {
        confirmateurs.push(fiche.id_confirmateur_2);
      }
      if (fiche.id_confirmateur_3 && fiche.id_confirmateur_3 > 0) {
        confirmateurs.push(fiche.id_confirmateur_3);
      }

      // Calculer le score par confirmateur selon le nombre de confirmateurs
      const scorePerConfirmateur = confirmateurs.length === 1 ? 1.0 : 
                                    confirmateurs.length === 2 ? 0.5 : 
                                    confirmateurs.length === 3 ? (1.0 / 3.0) : 0;

      // Distribuer les scores
      confirmateurs.forEach(confirmId => {
        if (!scoresMap[confirmId]) {
          scoresMap[confirmId] = 0;
          detailsMap[confirmId] = [];
        }
        scoresMap[confirmId] += scorePerConfirmateur;
        
        // Pour les détails
        if (id_confirmateur && confirmId == id_confirmateur) {
          detailsMap[confirmId].push({
            ajoute: scorePerConfirmateur,
            tel: fiche.tel,
            nom: fiche.nom,
            prenom: fiche.prenom,
            id: fiche.id
          });
        }
      });
    });

    // Convertir en array et trier par score décroissant
    const scores = Object.keys(scoresMap).map(confirmateurId => ({
      confirmateur: parseInt(confirmateurId),
      score: scoresMap[confirmateurId]
    })).sort((a, b) => b.score - a.score);

    // Total général
    const total = Object.values(scoresMap).reduce((sum, score) => sum + score, 0);

    // Récupérer les noms des confirmateurs
    const confirmateursIds = scores.map(s => s.confirmateur).filter(id => id);
    let confirmateurs = {};
    if (confirmateursIds.length > 0) {
      const users = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE id IN (${confirmateursIds.map(() => '?').join(',')})`,
        confirmateursIds
      );
      users.forEach(user => {
        confirmateurs[user.id] = user.pseudo;
      });
    }

    // Ajouter les noms
    const signatures = scores.map(score => ({
      confirmateur: score.confirmateur,
      score: parseFloat(score.score.toFixed(2)) || 0,
      name: confirmateurs[score.confirmateur] || 'Inconnu'
    }));

    // Si un confirmateur spécifique est demandé, récupérer les détails
    let details = [];
    if (id_confirmateur && detailsMap[id_confirmateur]) {
      details = detailsMap[id_confirmateur].sort((a, b) => b.ajoute - a.ajoute);
    }

    res.json({
      signatures,
      total: parseFloat(total.toFixed(2)),
      details: details.length > 0 ? details : null
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des signatures:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/suivi/new-repro
// Récupère les statistiques New/Repro
router.get('/new-repro', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin, id_confirmateur } = req.query;

    // Par défaut : aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const dateDebut = date_debut || today;
    const dateFin = date_fin || today;

    let whereClause = `nr.date_modif >= ? AND nr.date_modif <= ?`;
    let params = [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`];

    if (id_confirmateur) {
      whereClause += ' AND nr.id_confirmateur = ?';
      params.push(id_confirmateur);
    }

    const stats = await query(
      `SELECT 
        nr.id_confirmateur,
        SUM(nr.new) as total_new,
        SUM(nr.repro) as total_repro
      FROM new_repro nr
      WHERE ${whereClause}
      GROUP BY nr.id_confirmateur`,
      params
    );

    // Récupérer les noms des confirmateurs
    const confirmateursIds = stats.map(s => s.id_confirmateur).filter(id => id);
    let confirmateurs = {};
    if (confirmateursIds.length > 0) {
      const users = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE id IN (${confirmateursIds.map(() => '?').join(',')})`,
        confirmateursIds
      );
      users.forEach(user => {
        confirmateurs[user.id] = user.pseudo;
      });
    }

    // Ajouter les noms et calculer le total
    const newRepro = stats.map(stat => ({
      id_confirmateur: stat.id_confirmateur,
      new: parseInt(stat.total_new) || 0,
      repro: parseInt(stat.total_repro) || 0,
      total: (parseInt(stat.total_new) || 0) + (parseInt(stat.total_repro) || 0),
      name: confirmateurs[stat.id_confirmateur] || 'Inconnu'
    }));

    res.json({ newRepro });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques New/Repro:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/suivi/suivi-fiches
// Récupère les fiches en suivi (état 9 dans historique, état final 13)
router.get('/suivi-fiches', authenticate, async (req, res) => {
  try {
    const { date_debut, date_fin, produit } = req.query;

    // Par défaut : aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const dateDebut = date_debut || today;
    const dateFin = date_fin || today;

    let whereClause = `histo.id_etat = 9 
      AND fiche.id_etat_final = 13
      AND fiche.date_modif_time >= ?
      AND fiche.date_modif_time <= ?`;
    let params = [`${dateDebut} 00:00:00`, `${dateFin} 23:59:59`];

    if (produit) {
      whereClause += ' AND fiche.produit = ?';
      params.push(produit);
    }

    const fiches = await query(
      `SELECT fiche.*
      FROM fiches_histo histo
      LEFT JOIN fiches fiche ON histo.id_fiche = fiche.id
      WHERE ${whereClause}
      ORDER BY fiche.date_modif_time DESC`,
      params
    );

    res.json({ fiches });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches en suivi:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;

