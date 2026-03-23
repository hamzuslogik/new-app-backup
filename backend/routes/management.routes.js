const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne, transaction } = require('../config/database');

// Fonction pour hasher un mot de passe avec SHA-256 (compatible avec SHA2 de MySQL)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// =====================================================
// CENTRES
// =====================================================

// Récupérer tous les centres (accessible à tous les utilisateurs authentifiés)
router.get('/centres', authenticate, async (req, res) => {
  try {
    const centres = await query(
      'SELECT * FROM centres WHERE etat > 0 ORDER BY titre ASC'
    );
    res.json({ success: true, data: centres });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un centre
router.post('/centres', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { titre, etat = 1 } = req.body;
    
    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    const result = await query(
      'INSERT INTO centres (titre, etat) VALUES (?, ?)',
      [titre, etat]
    );

    res.status(201).json({
      success: true,
      message: 'Centre créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du centre' });
  }
});

// Mettre à jour un centre
router.put('/centres/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, etat } = req.body;

    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    await query(
      'UPDATE centres SET titre = ?, etat = ? WHERE id = ?',
      [titre, etat, id]
    );

    res.json({ success: true, message: 'Centre mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un centre
router.delete('/centres/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM centres WHERE id = ?', [id]);
    res.json({ success: true, message: 'Centre supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// DÉPARTEMENTS
// =====================================================

// Récupérer tous les départements (accessible à tous)
// Pour la page de gestion, on affiche tous les départements, même ceux désactivés
router.get('/departements', authenticate, async (req, res) => {
  try {
    const departements = await query(
      'SELECT * FROM departements ORDER BY departement_code ASC'
    );
    res.json({ success: true, data: departements });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un département
router.post('/departements', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { departement_code, departement_nom, departement_nom_uppercase, etat = 1 } = req.body;
    
    if (!departement_code || !departement_nom) {
      return res.status(400).json({ success: false, message: 'Le code et le nom sont requis' });
    }

    const result = await query(
      'INSERT INTO departements (departement_code, departement_nom, departement_nom_uppercase, etat) VALUES (?, ?, ?, ?)',
      [departement_code, departement_nom, departement_nom_uppercase || departement_nom.toUpperCase(), etat]
    );

    res.status(201).json({
      success: true,
      message: 'Département créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du département' });
  }
});

// Mettre à jour un département
router.put('/departements/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { departement_code, departement_nom, departement_nom_uppercase, etat } = req.body;

    await query(
      'UPDATE departements SET departement_code = ?, departement_nom = ?, departement_nom_uppercase = ?, etat = ? WHERE id = ?',
      [departement_code, departement_nom, departement_nom_uppercase, etat, id]
    );

    res.json({ success: true, message: 'Département mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un département
router.delete('/departements/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM departements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Département supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// FONCTIONS
// =====================================================

// Récupérer toutes les fonctions (accessible à tous)
// Si ?all=true, retourne toutes les fonctions (actives et inactives) pour la gestion
router.get('/fonctions', authenticate, async (req, res) => {
  try {
    const { all } = req.query;
    let queryStr = 'SELECT * FROM fonctions';
    if (all !== 'true') {
      queryStr += ' WHERE etat > 0';
    }
    queryStr += ' ORDER BY titre ASC';
    
    const fonctions = await query(queryStr);
    res.json({ success: true, data: fonctions });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une fonction
router.post('/fonctions', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { titre, etat = 1, page_accueil = '/dashboard', groupes_messages_autorises } = req.body;
    
    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    // Convertir groupes_messages_autorises en JSON si c'est un tableau
    const groupesMessagesJson = groupes_messages_autorises 
      ? (Array.isArray(groupes_messages_autorises) 
          ? JSON.stringify(groupes_messages_autorises) 
          : groupes_messages_autorises)
      : null;

    const result = await query(
      'INSERT INTO fonctions (titre, etat, page_accueil, groupes_messages_autorises) VALUES (?, ?, ?, ?)',
      [titre, etat, page_accueil, groupesMessagesJson]
    );

    res.status(201).json({
      success: true,
      message: 'Fonction créée avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la fonction' });
  }
});

// Mettre à jour une fonction
router.put('/fonctions/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, etat, page_accueil, groupes_messages_autorises } = req.body;

    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    // Convertir groupes_messages_autorises en JSON si c'est un tableau
    const groupesMessagesJson = groupes_messages_autorises !== undefined
      ? (Array.isArray(groupes_messages_autorises) 
          ? JSON.stringify(groupes_messages_autorises) 
          : (groupes_messages_autorises || null))
      : null;

    await query(
      'UPDATE fonctions SET titre = ?, etat = ?, page_accueil = ?, groupes_messages_autorises = ? WHERE id = ?',
      [titre, etat, page_accueil || '/dashboard', groupesMessagesJson, id]
    );

    res.json({ success: true, message: 'Fonction mise à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer une fonction
router.delete('/fonctions/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM fonctions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Fonction supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// PRODUITS
// =====================================================

// Récupérer tous les produits
// Accessible à tous les utilisateurs authentifiés (lecture seule)
// Les Confirmateurs (fonction 6) ont besoin de voir les produits pour créer des RDV
router.get('/produits', authenticate, async (req, res) => {
  try {
    // La table produits n'a pas de colonne etat, donc on récupère tous les produits
    const produits = await query(
      'SELECT * FROM produits ORDER BY nom ASC'
    );
    res.json({ success: true, data: produits });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// Créer un produit
router.post('/produits', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const result = await query(
      'INSERT INTO produits (nom) VALUES (?)',
      [nom]
    );

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du produit' });
  }
});

// Mettre à jour un produit
router.put('/produits/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    await query(
      'UPDATE produits SET nom = ? WHERE id = ?',
      [nom, id]
    );

    res.json({ success: true, message: 'Produit mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un produit
router.delete('/produits/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM produits WHERE id = ?', [id]);
    res.json({ success: true, message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// UTILISATEURS (Gestion complète)
// =====================================================

// Récupérer tous les utilisateurs avec leurs relations (accessible à tous pour les filtres)
router.get('/utilisateurs', authenticate, async (req, res) => {
  try {
    const { pseudo, include_inactive } = req.query;
    const withInactive = include_inactive === '1' || include_inactive === 1 || include_inactive === true || include_inactive === 'true';
    
    // Construire la requête avec ou sans filtre par pseudo
    let sql = `SELECT u.*, 
       f.titre as fonction_titre, 
       c.titre as centre_titre,
       supervisor.pseudo as supervisor_pseudo,
       rp.pseudo as rp_qualif_pseudo
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       LEFT JOIN utilisateurs supervisor ON u.chef_equipe = supervisor.id
       LEFT JOIN utilisateurs rp ON u.id_rp_qualif = rp.id
       WHERE 1=1`;
    
    const params = [];
    
    // Inclure les inactifs uniquement si demandé (ex. page Gestion > Utilisateurs)
    if (!withInactive) {
      sql += ` AND u.etat > 0`;
    }
    
    // Si un pseudo est fourni, filtrer par pseudo (insensible à la casse)
    if (pseudo) {
      sql += ` AND LOWER(TRIM(u.pseudo)) = LOWER(TRIM(?))`;
      params.push(pseudo);
    }
    
    sql += ` ORDER BY u.pseudo ASC`;
    
    const utilisateurs = await query(sql, params);

    // Pour les utilisateurs de fonction 9, récupérer les centres multiples
    for (let user of utilisateurs) {
      if (user.fonction === 9) {
        const userCentres = await query(
          `SELECT c.id, c.titre 
           FROM utilisateurs_centres uc
           LEFT JOIN centres c ON uc.id_centre = c.id
           WHERE uc.id_utilisateur = ? AND c.etat > 0
           ORDER BY c.titre ASC`,
          [user.id]
        );
        user.centres = userCentres.map(c => ({ id: c.id, titre: c.titre }));
        user.centres_ids = userCentres.map(c => c.id);
      }
    }

    // Si un pseudo est fourni et qu'un seul utilisateur est trouvé, retourner directement l'objet
    if (pseudo && utilisateurs.length === 1) {
      return res.json({ success: true, data: utilisateurs[0] });
    }

    res.json({ success: true, data: utilisateurs });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un utilisateur
router.post('/utilisateurs', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const {
      nom, prenom, pseudo, login, mdp, mail, tel,
      fonction, centre, centres, genre, etat = 1, color, chef_equipe, id_rp_qualif
    } = req.body;
    
    if (!login || !mdp || !pseudo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Login, mot de passe et pseudo sont requis' 
      });
    }

    // Vérifier si le login existe déjà
    const existing = await queryOne(
      'SELECT id FROM utilisateurs WHERE login = ?',
      [login]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce login existe déjà' 
      });
    }

    // Hasher le mot de passe avec SHA-256
    const hashedPassword = hashPassword(mdp);

    // Pour la fonction 9, utiliser le premier centre de la liste si centres est fourni, sinon utiliser centre
    const centreValue = (fonction === 9 && centres && Array.isArray(centres) && centres.length > 0) 
      ? centres[0] 
      : centre;

    const result = await query(
      `INSERT INTO utilisateurs 
       (nom, prenom, pseudo, login, mdp, mail, tel, fonction, centre, genre, etat, color, chef_equipe, id_rp_qualif, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(NOW()))`,
      [nom, prenom, pseudo, login, hashedPassword, mail, tel, fonction, centreValue, genre, etat, color, chef_equipe, id_rp_qualif]
    );

    const userId = result.insertId;

    // Si fonction 9 et centres est fourni, créer les relations dans utilisateurs_centres
    if (fonction === 9 && centres && Array.isArray(centres) && centres.length > 0) {
      // Supprimer les doublons
      const uniqueCentres = [...new Set(centres.filter(c => c && c > 0))];
      
      if (uniqueCentres.length > 0) {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const placeholders = uniqueCentres.map(() => '(?, ?, ?)').join(', ');
        const values = uniqueCentres.flatMap(c => [userId, c, now]);
        
        await query(
          `INSERT INTO utilisateurs_centres (id_utilisateur, id_centre, date_creation) VALUES ${placeholders}`,
          values
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: { id: userId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// Mettre à jour un utilisateur
router.put('/utilisateurs/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom, prenom, pseudo, login, mdp, mail, tel,
      fonction, centre, centres, genre, etat, color, chef_equipe, id_rp_qualif, photo
    } = req.body;

    // Récupérer l'utilisateur actuel pour vérifier sa fonction
    const currentUser = await queryOne('SELECT fonction FROM utilisateurs WHERE id = ?', [id]);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const isFonction9 = fonction === 9 || currentUser.fonction === 9;

    // Construire la requête dynamiquement
    const updates = [];
    const values = [];

    if (nom !== undefined) { updates.push('nom = ?'); values.push(nom); }
    if (prenom !== undefined) { updates.push('prenom = ?'); values.push(prenom); }
    if (pseudo !== undefined) { updates.push('pseudo = ?'); values.push(pseudo); }
    if (login !== undefined) { updates.push('login = ?'); values.push(login); }
    if (mdp !== undefined) { 
      // Hasher le mot de passe avec SHA-256
      const hashedPassword = hashPassword(mdp);
      updates.push('mdp = ?'); 
      values.push(hashedPassword); 
    }
    if (mail !== undefined) { updates.push('mail = ?'); values.push(mail); }
    if (tel !== undefined) { updates.push('tel = ?'); values.push(tel); }
    if (fonction !== undefined) { updates.push('fonction = ?'); values.push(fonction); }
    
    // Pour la fonction 9, utiliser le premier centre de la liste si centres est fourni
    if (isFonction9 && centres !== undefined && Array.isArray(centres) && centres.length > 0) {
      updates.push('centre = ?');
      values.push(centres[0]);
    } else if (centre !== undefined) {
      updates.push('centre = ?');
      values.push(centre);
    }
    
    if (genre !== undefined) { updates.push('genre = ?'); values.push(genre); }
    if (etat !== undefined) { updates.push('etat = ?'); values.push(etat); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (chef_equipe !== undefined) { updates.push('chef_equipe = ?'); values.push(chef_equipe); }
    if (id_rp_qualif !== undefined) { updates.push('id_rp_qualif = ?'); values.push(id_rp_qualif); }
    if (photo !== undefined) { updates.push('photo = ?'); values.push(photo); }

    if (updates.length === 0 && centres === undefined) {
      return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' });
    }

    // Mettre à jour l'utilisateur si nécessaire
    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE utilisateurs SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Gérer les centres multiples pour la fonction 9
    if (isFonction9 && centres !== undefined) {
      // Supprimer toutes les relations existantes
      await query('DELETE FROM utilisateurs_centres WHERE id_utilisateur = ?', [id]);
      
      // Créer les nouvelles relations si centres est fourni
      if (Array.isArray(centres) && centres.length > 0) {
        const uniqueCentres = [...new Set(centres.filter(c => c && c > 0))];
        
        if (uniqueCentres.length > 0) {
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const placeholders = uniqueCentres.map(() => '(?, ?, ?)').join(', ');
          const centreValues = uniqueCentres.flatMap(c => [id, c, now]);
          
          await query(
            `INSERT INTO utilisateurs_centres (id_utilisateur, id_centre, date_creation) VALUES ${placeholders}`,
            centreValues
          );
        }
      }
    }

    res.json({ success: true, message: 'Utilisateur mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un utilisateur
router.delete('/utilisateurs/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ne pas permettre la suppression de l'utilisateur actuel
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas supprimer votre propre compte' 
      });
    }

    await query('DELETE FROM utilisateurs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// Générer un token pour l'utilisateur connecté
router.post('/utilisateurs/generate-token', authenticate, async (req, res) => {
  try {
    // Récupérer les informations complètes de l'utilisateur
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat,
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.id = ? AND u.etat > 0`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Vérifier que la fonction et le centre sont actifs
    if (user.fonction_etat === 0 || user.centre_etat === 0) {
      return res.status(403).json({
        success: false,
        message: 'Votre fonction ou centre est désactivé'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Token généré avec succès',
      data: {
        token,
        user: {
          id: user.id,
          login: user.login,
          pseudo: user.pseudo,
          fonction: user.fonction,
          fonction_titre: user.fonction_titre,
          centre: user.centre,
          centre_titre: user.centre_titre
        },
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    });
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du token'
    });
  }
});

// =====================================================
// ÉTATS
// =====================================================

// Matrice des états sélectionnables depuis un état actuel pour la session confirmateur (6)
// id_etat_actuel -> [ids des états autorisés]
const CONFIRMATEUR_TRANSITIONS = {
  1: [5, 7, 6, 29, 24, 2, 19],    // EN-ATTENTE
  2: [5, 7, 6, 29, 24, 2, 19],    // NRP
  19: [5, 7, 6, 29, 24, 2, 19],   // RAPPEL POUR BUREAU
  5: [22, 7, 6, 29, 24, 19],      // ANNULER
  29: [], 6: [], 24: [], 22: [],  // HC et ANNULER 2 FOIS : aucun
  7: [8, 9, 11, 12],              // CONFIRMER
  8: [8, 7, 11],                  // ANNULER ET A REPROGRAMMER
  9: [9, 7, 29, 12],              // CLIENT HONORE A SUIVRE
  11: [26, 8, 7, 29],             // RDV ANNULER
  26: [], 12: [25, 8, 7, 2, 19, 6],  // RDV ANN 2 FOIS, REFUSER
  34: [], 25: [], 35: [], 13: [], 16: []  // HHC FIN A VERIFIER, REF 2 FOIS, HHC TEC, SIGNER, SIGNER RETRACTER
};

// Liste des titres d'états visibles par les confirmateurs (6) dans le filtre de recherche et le détail fiche
// Phase 2 : Confirmer, Annuler à reprogrammer, Client honoré à suivre, Honoré hors cible confirmateurs, RDV annulé, Refuser
// Phase 3 : Signer
const CONFIRMATEUR_ETAT_TITRES_NORMALISES = [
  'confirmer',
  'annuler a reprogrammer',
  'client honore a suivre',
  'honore hors cible confirmateurs',
  'rdv annule',
  'refuser',
  'signer'
].map(t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

function normalizeTitre(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Récupérer tous les états (accessible à tous)
// Groupe 0 (Phase 0) : visible uniquement par RE qualification (2), Agent qualification (3), Qualité qualification (8), RP qualification (12)
// Confirmateurs (6) : uniquement Phase 2 (Confirmer, Annuler à reprogrammer, Client honoré à suivre, etc.) et Phase 3 (Signer)
router.get('/etats', authenticate, async (req, res) => {
  try {
    const querySql = 'SELECT id, titre, color, groupe, ordre, taux, abbreviation FROM etats ORDER BY ordre ASC';
    let etats = await query(querySql);
    const fonction = Number(req.user.fonction);
    const idEtatFiche = req.query.id_etat_fiche ? parseInt(req.query.id_etat_fiche, 10) : null;
    // Groupe 0 visible par : Admin (1), RE qualification (2), Agent qualification (3), Resp ADV (7), Qualité qualification (8), Admin call (11), RP qualification (12)
    const canSeeGroupe0 = [1, 2, 3, 7, 8, 11, 12].includes(fonction);
    if (!canSeeGroupe0) {
      etats = etats.filter(e => String(e.groupe) !== '0' && e.groupe !== 0);
    }
    // Session confirmateur (6) : selon id_etat_fiche (page détail fiche), appliquer la matrice de transitions
    if (fonction === 6) {
      if (idEtatFiche != null && idEtatFiche > 0 && CONFIRMATEUR_TRANSITIONS[idEtatFiche] !== undefined) {
        const allowedIds = CONFIRMATEUR_TRANSITIONS[idEtatFiche];
        etats = etats.filter(e => allowedIds.includes(Number(e.id)));
      } else {
        etats = etats.filter(e => {
          const g = String(e.groupe);
          if (g !== '2' && g !== '3') return false;
          const titreNorm = normalizeTitre(e.titre);
          return CONFIRMATEUR_ETAT_TITRES_NORMALISES.some(allowed => titreNorm.includes(allowed) || allowed.includes(titreNorm));
        });
      }
    }
    res.json({ success: true, data: etats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un état
router.post('/etats', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { titre, color, groupe, ordre, taux, abbreviation } = req.body;
    
    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    const result = await query(
      'INSERT INTO etats (titre, color, groupe, ordre, taux, abbreviation) VALUES (?, ?, ?, ?, ?, ?)',
      [titre, color || null, groupe || null, ordre || 0, taux || null, abbreviation || null]
    );

    res.status(201).json({
      success: true,
      message: 'État créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'état' });
  }
});

// Mettre à jour un état
router.put('/etats/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, color, groupe, ordre, taux, abbreviation } = req.body;

    if (!titre) {
      return res.status(400).json({ success: false, message: 'Le titre est requis' });
    }

    await query(
      'UPDATE etats SET titre = ?, color = ?, groupe = ?, ordre = ?, taux = ?, abbreviation = ? WHERE id = ?',
      [titre, color || null, groupe || null, ordre || 0, taux || null, abbreviation || null, id]
    );

    res.json({ success: true, message: 'État mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un état
router.delete('/etats/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si l'état est utilisé dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE id_etat_final = ?',
      [id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cet état car il est utilisé par ${fichesCount.count} fiche(s)`
      });
    }

    // Vérifier si l'état est utilisé dans l'historique
    const histoCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches_histo WHERE id_etat = ?',
      [id]
    );
    
    if (histoCount && histoCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cet état car il est utilisé dans l'historique de ${histoCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM etats WHERE id = ?', [id]);
    res.json({ success: true, message: 'État supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// DONNÉES DE RÉFÉRENCE POUR LES FICHES
// =====================================================

// Récupérer toutes les professions (accessible à tous)
router.get('/professions', authenticate, async (req, res) => {
  try {
    const professions = await query(
      'SELECT * FROM professions ORDER BY nom ASC'
    );
    res.json({ success: true, data: professions });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une profession
router.post('/professions', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si la profession existe déjà
    const existing = await queryOne(
      'SELECT id FROM professions WHERE nom = ?',
      [nom]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette profession existe déjà' 
      });
    }

    const result = await query(
      'INSERT INTO professions (nom) VALUES (?)',
      [nom]
    );

    res.status(201).json({
      success: true,
      message: 'Profession créée avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la profession' });
  }
});

// Trouver une profession par nom ou la créer si elle n'existe pas (pour formulaires RDV / confirmation)
router.post('/professions/find-or-create', authenticate, async (req, res) => {
  try {
    let { nom } = req.body;
    if (nom == null) nom = '';
    const trimmed = String(nom).trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const existing = await queryOne(
      'SELECT id, nom FROM professions WHERE LOWER(TRIM(nom)) = LOWER(?)',
      [trimmed]
    );
    if (existing) {
      return res.json({ success: true, data: { id: existing.id, nom: existing.nom } });
    }

    const result = await query('INSERT INTO professions (nom) VALUES (?)', [trimmed]);
    res.status(201).json({
      success: true,
      data: { id: result.insertId, nom: trimmed }
    });
  } catch (error) {
    console.error('Erreur find-or-create profession:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la profession' });
  }
});

// Mettre à jour une profession
router.put('/professions/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si une autre profession avec le même nom existe
    const existing = await queryOne(
      'SELECT id FROM professions WHERE nom = ? AND id != ?',
      [nom, id]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Une profession avec ce nom existe déjà' 
      });
    }

    await query(
      'UPDATE professions SET nom = ? WHERE id = ?',
      [nom, id]
    );

    res.json({ success: true, message: 'Profession mise à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer une profession
router.delete('/professions/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la profession est utilisée dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE profession_mr = ? OR profession_madame = ?',
      [id, id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cette profession car elle est utilisée par ${fichesCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM professions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Profession supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// MODE DE CHAUFFAGE
// =====================================================

// Récupérer tous les modes de chauffage (accessible à tous)
router.get('/mode-chauffage', authenticate, async (req, res) => {
  try {
    const modes = await query(
      'SELECT * FROM mode_chauffage ORDER BY nom ASC'
    );
    res.json({ success: true, data: modes });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un mode de chauffage
router.post('/mode-chauffage', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si le mode de chauffage existe déjà
    const existing = await queryOne(
      'SELECT id FROM mode_chauffage WHERE nom = ?',
      [nom]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce mode de chauffage existe déjà' 
      });
    }

    const result = await query(
      'INSERT INTO mode_chauffage (nom) VALUES (?)',
      [nom]
    );

    res.status(201).json({
      success: true,
      message: 'Mode de chauffage créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du mode de chauffage' });
  }
});

// Mettre à jour un mode de chauffage
router.put('/mode-chauffage/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si un autre mode de chauffage avec le même nom existe
    const existing = await queryOne(
      'SELECT id FROM mode_chauffage WHERE nom = ? AND id != ?',
      [nom, id]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un mode de chauffage avec ce nom existe déjà' 
      });
    }

    await query(
      'UPDATE mode_chauffage SET nom = ? WHERE id = ?',
      [nom, id]
    );

    res.json({ success: true, message: 'Mode de chauffage mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un mode de chauffage
router.delete('/mode-chauffage/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si le mode de chauffage est utilisé dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE mode_chauffage = ?',
      [id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer ce mode de chauffage car il est utilisé par ${fichesCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM mode_chauffage WHERE id = ?', [id]);
    res.json({ success: true, message: 'Mode de chauffage supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// Récupérer toutes les raisons d'étude (accessible à tous)
router.get('/etude-raison', authenticate, async (req, res) => {
  try {
    const raisons = await query(
      'SELECT * FROM etude_raison ORDER BY nom ASC'
    );
    res.json({ success: true, data: raisons });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer tous les types de contrat (accessible à tous)
router.get('/type-contrat', authenticate, async (req, res) => {
  try {
    const contrats = await query(
      'SELECT * FROM type_contrat ORDER BY nom ASC'
    );
    res.json({ success: true, data: contrats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un type de contrat
router.post('/type-contrat', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si le type de contrat existe déjà
    const existing = await queryOne(
      'SELECT id FROM type_contrat WHERE nom = ?',
      [nom]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce type de contrat existe déjà' 
      });
    }

    const result = await query(
      'INSERT INTO type_contrat (nom) VALUES (?)',
      [nom]
    );

    res.status(201).json({
      success: true,
      message: 'Type de contrat créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du type de contrat' });
  }
});

// Mettre à jour un type de contrat
router.put('/type-contrat/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si un autre type de contrat avec le même nom existe
    const existing = await queryOne(
      'SELECT id FROM type_contrat WHERE nom = ? AND id != ?',
      [nom, id]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un type de contrat avec ce nom existe déjà' 
      });
    }

    await query(
      'UPDATE type_contrat SET nom = ? WHERE id = ?',
      [nom, id]
    );

    res.json({ success: true, message: 'Type de contrat mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un type de contrat
router.delete('/type-contrat/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si le type de contrat est utilisé dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE type_contrat_mr = ? OR type_contrat_madame = ?',
      [id, id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer ce type de contrat car il est utilisé par ${fichesCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM type_contrat WHERE id = ?', [id]);
    res.json({ success: true, message: 'Type de contrat supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// TYPES FINANCEMENT (à saisir lors de la signature)
// =====================================================

// Récupérer tous les types de financement
router.get('/financement', authenticate, async (req, res) => {
  try {
    const data = await query(
      'SELECT * FROM types_financement ORDER BY ordre ASC, nom ASC'
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un type de financement
router.post('/financement', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom, ordre, etat } = req.body;

    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const existing = await queryOne(
      'SELECT id FROM types_financement WHERE TRIM(nom) = TRIM(?)',
      [nom]
    );
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ce type de financement existe déjà' });
    }

    const ordreVal = ordre != null ? parseInt(ordre, 10) : 0;
    const etatVal = etat != null ? (etat ? 1 : 0) : 1;

    const result = await query(
      'INSERT INTO types_financement (nom, ordre, etat) VALUES (?, ?, ?)',
      [String(nom).trim(), ordreVal, etatVal]
    );
    res.status(201).json({ success: true, message: 'Type de financement créé avec succès', data: { id: result.insertId } });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création' });
  }
});

// Mettre à jour un type de financement
router.put('/financement/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, ordre, etat } = req.body;

    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const existing = await queryOne(
      'SELECT id FROM types_financement WHERE TRIM(nom) = TRIM(?) AND id != ?',
      [nom, id]
    );
    if (existing) {
      return res.status(400).json({ success: false, message: 'Un type de financement avec ce nom existe déjà' });
    }

    const ordreVal = ordre != null ? parseInt(ordre, 10) : 0;
    const etatVal = etat != null ? (etat ? 1 : 0) : 1;

    await query(
      'UPDATE types_financement SET nom = ?, ordre = ?, etat = ? WHERE id = ?',
      [String(nom).trim(), ordreVal, etatVal, id]
    );
    res.json({ success: true, message: 'Type de financement mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un type de financement
router.delete('/financement/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM types_financement WHERE id = ?', [id]);
    res.json({ success: true, message: 'Type de financement supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// INSTALLATEURS
// =====================================================

// Récupérer tous les installateurs (accessible à tous)
router.get('/installateurs', authenticate, async (req, res) => {
  try {
    const installateurs = await query(
      'SELECT * FROM installateurs WHERE etat > 0 ORDER BY nom ASC'
    );
    res.json({ success: true, data: installateurs });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un installateur
router.post('/installateurs', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom, etat = 1 } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si l'installateur existe déjà
    const existing = await queryOne(
      'SELECT id FROM installateurs WHERE nom = ?',
      [nom]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet installateur existe déjà' 
      });
    }

    const result = await query(
      'INSERT INTO installateurs (nom, etat) VALUES (?, ?)',
      [nom, etat]
    );

    res.status(201).json({
      success: true,
      message: 'Installateur créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'installateur' });
  }
});

// Mettre à jour un installateur
router.put('/installateurs/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, etat } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    // Vérifier si un autre installateur avec le même nom existe
    const existing = await queryOne(
      'SELECT id FROM installateurs WHERE nom = ? AND id != ?',
      [nom, id]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un installateur avec ce nom existe déjà' 
      });
    }

    await query(
      'UPDATE installateurs SET nom = ?, etat = ? WHERE id = ?',
      [nom, etat !== undefined ? etat : 1, id]
    );

    res.json({ success: true, message: 'Installateur mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un installateur
router.delete('/installateurs/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si l'installateur est utilisé dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE ph3_installateur = ?',
      [id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cet installateur car il est utilisé par ${fichesCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM installateurs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Installateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// Récupérer toutes les qualifications (accessible à tous)
// Note: La table qualif peut ne pas exister dans toutes les installations
router.get('/qualifications', authenticate, async (req, res) => {
  try {
    // Vérifier si la table qualif existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = SCHEMA() 
       AND table_name = 'qualif'`
    );
    
    if (tableExists && tableExists.count > 0) {
      const qualifications = await query(
        'SELECT * FROM qualif ORDER BY code ASC'
      );
      res.json({ success: true, data: qualifications });
    } else {
      // Si la table n'existe pas, retourner un tableau vide
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error('Erreur:', error);
    // En cas d'erreur, retourner un tableau vide plutôt qu'une erreur
    res.json({ success: true, data: [] });
  }
});

// =====================================================
// SOUS-ÉTATS
// =====================================================

// Récupérer tous les sous-états (accessible à tous)
router.get('/sous-etat', authenticate, async (req, res) => {
  try {
    const sousEtats = await query(
      `SELECT se.*, e.titre as etat_titre 
       FROM sous_etat se 
       LEFT JOIN etats e ON se.id_etat = e.id 
       ORDER BY e.titre ASC, se.titre ASC`
    );
    res.json({ success: true, data: sousEtats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer les sous-états pour un état donné
router.get('/sous-etat/:id_etat', authenticate, async (req, res) => {
  try {
    const { id_etat } = req.params;
    const sousEtats = await query(
      'SELECT * FROM sous_etat WHERE id_etat = ? ORDER BY titre ASC',
      [id_etat]
    );
    res.json({ success: true, data: sousEtats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un sous-état
router.post('/sous-etat', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id_etat, titre } = req.body;
    
    if (!id_etat || !titre) {
      return res.status(400).json({ success: false, message: 'L\'état et le titre sont requis' });
    }

    // Vérifier si le sous-état existe déjà pour cet état
    const existing = await queryOne(
      'SELECT id FROM sous_etat WHERE id_etat = ? AND titre = ?',
      [id_etat, titre]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce sous-état existe déjà pour cet état' 
      });
    }

    const result = await query(
      'INSERT INTO sous_etat (id_etat, titre) VALUES (?, ?)',
      [id_etat, titre]
    );

    res.status(201).json({
      success: true,
      message: 'Sous-état créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du sous-état' });
  }
});

// Mettre à jour un sous-état
router.put('/sous-etat/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { id_etat, titre } = req.body;

    if (!id_etat || !titre) {
      return res.status(400).json({ success: false, message: 'L\'état et le titre sont requis' });
    }

    // Vérifier si un autre sous-état avec le même titre existe pour cet état
    const existing = await queryOne(
      'SELECT id FROM sous_etat WHERE id_etat = ? AND titre = ? AND id != ?',
      [id_etat, titre, id]
    );

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un sous-état avec ce titre existe déjà pour cet état' 
      });
    }

    await query(
      'UPDATE sous_etat SET id_etat = ?, titre = ? WHERE id = ?',
      [id_etat, titre, id]
    );

    res.json({ success: true, message: 'Sous-état mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer un sous-état
router.delete('/sous-etat/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si le sous-état est utilisé dans des fiches
    const fichesCount = await queryOne(
      'SELECT COUNT(*) as count FROM fiches WHERE id_sous_etat = ?',
      [id]
    );
    
    if (fichesCount && fichesCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer ce sous-état car il est utilisé par ${fichesCount.count} fiche(s)`
      });
    }

    await query('DELETE FROM sous_etat WHERE id = ?', [id]);
    res.json({ success: true, message: 'Sous-état supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// ÉTATS DE DÉCALAGE
// =====================================================

// Récupérer tous les états de décalage
router.get('/etat-decalage', authenticate, async (req, res) => {
  try {
    const etats = await query(
      'SELECT * FROM etat_decalage ORDER BY id ASC'
    );
    res.json({ success: true, data: etats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =====================================================
// FOURNISSEURS SMS
// =====================================================

// Récupérer tous les fournisseurs SMS
router.get('/fournisseurs-sms', authenticate, async (req, res) => {
  try {
    // Vérifier si la table existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'fournisseurs_sms'`
    );
    
    if (!tableExists || tableExists.count === 0) {
      console.log('Table fournisseurs_sms n\'existe pas');
      return res.json({ success: true, data: [] });
    }

    // Par défaut, retourner tous les fournisseurs (actifs et inactifs)
    // Utiliser ?all=false pour ne retourner que les actifs
    const { all } = req.query;
    let queryStr = 'SELECT * FROM fournisseurs_sms';
    if (all === 'false') {
      queryStr += ' WHERE actif > 0';
    }
    queryStr += ' ORDER BY nom ASC';
    
    const fournisseurs = await query(queryStr);
    // S'assurer de toujours retourner un tableau
    const result = Array.isArray(fournisseurs) ? fournisseurs : [];
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs SMS:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// Créer un fournisseur SMS
router.post('/fournisseurs-sms', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom, login, api_key, api_url, actif = 1 } = req.body;
    
    if (!nom || !login || !api_key || !api_url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom, le login, la clé API et l\'URL API sont requis' 
      });
    }

    const result = await query(
      'INSERT INTO fournisseurs_sms (nom, login, api_key, api_url, actif, date_creation) VALUES (?, ?, ?, ?, ?, NOW())',
      [nom, login, api_key, api_url, actif]
    );

    res.status(201).json({
      success: true,
      message: 'Fournisseur SMS créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du fournisseur SMS' });
  }
});

// Mettre à jour un fournisseur SMS
router.put('/fournisseurs-sms/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, login, api_key, api_url, actif } = req.body;
    
    if (!nom || !login || !api_url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom, le login et l\'URL API sont requis' 
      });
    }

    // Si api_key est fournie, la mettre à jour, sinon garder l'ancienne
    let queryStr = 'UPDATE fournisseurs_sms SET nom = ?, login = ?, api_url = ?, actif = ?, date_modification = NOW()';
    const params = [nom, login, api_url, actif !== undefined ? actif : 1];
    
    if (api_key && api_key.trim() !== '') {
      queryStr = 'UPDATE fournisseurs_sms SET nom = ?, login = ?, api_key = ?, api_url = ?, actif = ?, date_modification = NOW()';
      params.splice(2, 0, api_key); // Insérer api_key après login
    }
    
    queryStr += ' WHERE id = ?';
    params.push(id);

    await query(queryStr, params);

    res.json({
      success: true,
      message: 'Fournisseur SMS mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du fournisseur SMS' });
  }
});

// Supprimer un fournisseur SMS
router.delete('/fournisseurs-sms/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si le fournisseur est actif (on peut empêcher la suppression d'un fournisseur actif)
    const fournisseur = await queryOne(
      'SELECT actif FROM fournisseurs_sms WHERE id = ?',
      [id]
    );
    
    if (!fournisseur) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur SMS non trouvé'
      });
    }

    if (fournisseur.actif === 1) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un fournisseur SMS actif. Désactivez-le d\'abord.'
      });
    }

    await query('DELETE FROM fournisseurs_sms WHERE id = ?', [id]);
    res.json({ success: true, message: 'Fournisseur SMS supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// CATÉGORIES DE MESSAGES SMS
// =====================================================

// Récupérer toutes les catégories SMS
router.get('/sms-categories', authenticate, async (req, res) => {
  try {
    // Vérifier si la table existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'sms_categories'`
    );

    if (!tableExists || tableExists.count === 0) {
      console.log('Table sms_categories n\'existe pas');
      return res.json({ success: true, data: [] });
    }

    const categories = await query(
      'SELECT * FROM sms_categories WHERE actif = 1 ORDER BY ordre ASC, id ASC'
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer toutes les catégories SMS (y compris inactives) pour la gestion
router.get('/sms-categories/all', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    // Vérifier si la table existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'sms_categories'`
    );

    if (!tableExists || tableExists.count === 0) {
      console.log('Table sms_categories n\'existe pas');
      return res.json({ success: true, data: [] });
    }

    const categories = await query(
      'SELECT * FROM sms_categories ORDER BY ordre ASC, id ASC'
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une catégorie SMS
router.post('/sms-categories', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { code, titre, message, ordre = 0, actif = 1 } = req.body;
    
    if (!code || !titre || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le code, le titre et le message sont requis' 
      });
    }

    // Vérifier si le code existe déjà
    const existing = await queryOne(
      'SELECT id FROM sms_categories WHERE code = ?',
      [code]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Une catégorie avec ce code existe déjà'
      });
    }

    await query(
      'INSERT INTO sms_categories (code, titre, message, ordre, actif, date_creation) VALUES (?, ?, ?, ?, ?, NOW())',
      [code, titre, message, ordre, actif]
    );

    res.status(201).json({
      success: true,
      message: 'Catégorie SMS créée avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création' });
  }
});

// Modifier une catégorie SMS
router.put('/sms-categories/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, titre, message, ordre, actif } = req.body;
    
    if (!code || !titre || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le code, le titre et le message sont requis' 
      });
    }

    // Vérifier si le code existe déjà pour un autre enregistrement
    const existing = await queryOne(
      'SELECT id FROM sms_categories WHERE code = ? AND id != ?',
      [code, id]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Une catégorie avec ce code existe déjà'
      });
    }

    await query(
      'UPDATE sms_categories SET code = ?, titre = ?, message = ?, ordre = ?, actif = ?, date_modif = NOW() WHERE id = ?',
      [code, titre, message, ordre !== undefined ? ordre : 0, actif !== undefined ? actif : 1, id]
    );

    res.json({
      success: true,
      message: 'Catégorie SMS mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer une catégorie SMS
router.delete('/sms-categories/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('DELETE FROM sms_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Catégorie SMS supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
});

// =====================================================
// EXTRACTION FICHES (CSV / EXCEL)
// =====================================================

const FICHE_EXPORT_FIELDS = {
  id: 'f.id',
  hash: 'f.hash',
  civ: 'f.civ',
  nom: 'f.nom',
  prenom: 'f.prenom',
  tel: 'f.tel',
  gsm1: 'f.gsm1',
  gsm2: 'f.gsm2',
  email: 'f.email',
  adresse: 'f.adresse',
  cp: 'f.cp',
  ville: 'f.ville',
  produit: 'f.produit',
  id_centre: 'f.id_centre',
  centre_titre: 'c.titre',
  id_etat_final: 'f.id_etat_final',
  etat_titre: 'e.titre',
  id_sous_etat: 'f.id_sous_etat',
  sous_etat_titre: 'se.titre',
  id_confirmateur: 'f.id_confirmateur',
  id_confirmateur_2: 'f.id_confirmateur_2',
  id_confirmateur_3: 'f.id_confirmateur_3',
  id_commercial: 'f.id_commercial',
  id_commercial_2: 'f.id_commercial_2',
  id_agent: 'f.id_agent',
  commentaire: 'f.commentaire',
  date_insert_time: 'f.date_insert_time',
  date_modif_time: 'f.date_modif_time',
  date_appel_time: 'f.date_appel_time',
  date_rdv_time: 'f.date_rdv_time',
  archive: 'f.archive',
  ko: 'f.ko',
  active: 'f.active',
  valider: 'f.valider'
};

const FICHE_EXPORT_ALLOWED_DATE_FIELDS = [
  'date_insert_time',
  'date_modif_time',
  'date_appel_time',
  'date_rdv_time'
];

router.post('/fiches-export', authenticate, async (req, res) => {
  try {
    const {
      date_field,
      date_start,
      date_end,
      etat_ids = [],
      sous_etat_ids = [],
      centre_ids = [],
      departements = [],
      selected_fields = []
    } = req.body || {};

    if (!date_field || !FICHE_EXPORT_ALLOWED_DATE_FIELDS.includes(String(date_field))) {
      return res.status(400).json({
        success: false,
        message: 'Champ de date invalide'
      });
    }

    if (!date_start || !date_end) {
      return res.status(400).json({
        success: false,
        message: 'La période (date début et date fin) est obligatoire'
      });
    }

    const safeSelectedFields = Array.isArray(selected_fields)
      ? selected_fields.filter((field) => FICHE_EXPORT_FIELDS[field])
      : [];

    if (safeSelectedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez sélectionner au moins un champ à extraire'
      });
    }

    console.log('[fiches-export] Payload recu:', {
      date_field,
      date_start,
      date_end,
      etat_ids,
      sous_etat_ids,
      centre_ids,
      departements,
      selected_fields: safeSelectedFields
    });

    const selectSql = safeSelectedFields
      .map((field) => `${FICHE_EXPORT_FIELDS[field]} AS \`${field}\``)
      .join(', ');

    const whereConditions = [];
    const params = [];

    whereConditions.push(`f.${date_field} IS NOT NULL`);
    whereConditions.push(`f.${date_field} >= ?`);
    whereConditions.push(`f.${date_field} <= ?`);
    params.push(`${date_start} 00:00:00`, `${date_end} 23:59:59`);

    const etatIds = Array.isArray(etat_ids)
      ? etat_ids.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0)
      : [];
    if (etatIds.length > 0) {
      whereConditions.push(`f.id_etat_final IN (${etatIds.map(() => '?').join(',')})`);
      params.push(...etatIds);
    }

    const sousEtatIds = Array.isArray(sous_etat_ids)
      ? sous_etat_ids.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0)
      : [];
    if (sousEtatIds.length > 0) {
      whereConditions.push(`f.id_sous_etat IN (${sousEtatIds.map(() => '?').join(',')})`);
      params.push(...sousEtatIds);
    }

    const centreIds = Array.isArray(centre_ids)
      ? centre_ids.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0)
      : [];
    if (centreIds.length > 0) {
      whereConditions.push(`f.id_centre IN (${centreIds.map(() => '?').join(',')})`);
      params.push(...centreIds);
    }

    const depCodes = Array.isArray(departements)
      ? departements
          .map((d) => String(d || '').trim())
          .filter((d) => d.length > 0)
      : [];
    if (depCodes.length > 0) {
      const depOr = depCodes.map(() => 'TRIM(f.cp) LIKE ?').join(' OR ');
      whereConditions.push(`(${depOr})`);
      params.push(...depCodes.map((d) => `${d}%`));
    }

    console.log('[fiches-export] Filtres normalises:', {
      date_field: date_field,
      date_start: date_start,
      date_end: date_end,
      etat_count: etatIds.length,
      sous_etat_count: sousEtatIds.length,
      centre_count: centreIds.length,
      departement_count: depCodes.length,
      fields_count: safeSelectedFields.length
    });

    const sql = `
      SELECT ${selectSql}
      FROM fiches f
      LEFT JOIN etats e ON f.id_etat_final = e.id
      LEFT JOIN sous_etat se ON f.id_sous_etat = se.id
      LEFT JOIN centres c ON f.id_centre = c.id
      ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''}
      ORDER BY f.${date_field} DESC
      LIMIT 200000
    `;

    console.log('[fiches-export] SQL executee:', sql.replace(/\s+/g, ' ').trim());
    console.log('[fiches-export] Params SQL:', params);

    const rows = await query(sql, params);
    console.log('[fiches-export] Nb lignes retournees:', Array.isArray(rows) ? rows.length : 0);

    res.json({
      success: true,
      data: rows || [],
      meta: {
        count: Array.isArray(rows) ? rows.length : 0
      }
    });
  } catch (error) {
    console.error('Erreur extraction fiches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'extraction des fiches'
    });
  }
});

module.exports = router;
