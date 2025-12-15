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
router.post('/centres', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/centres/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/centres/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.get('/departements', authenticate, async (req, res) => {
  try {
    const departements = await query(
      'SELECT * FROM departements WHERE etat > 0 ORDER BY departement_code ASC'
    );
    res.json({ success: true, data: departements });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un département
router.post('/departements', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/departements/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/departements/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/fonctions', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/fonctions/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/fonctions/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/produits', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/produits/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/produits/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
    const { pseudo } = req.query;
    
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
       WHERE u.etat > 0`;
    
    const params = [];
    
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
router.post('/utilisateurs', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/utilisateurs/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/utilisateurs/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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

// Récupérer tous les états (accessible à tous)
// Récupérer tous les états (filtrés selon la fonction de l'utilisateur)
router.get('/etats', authenticate, async (req, res) => {
  try {
    let querySql = 'SELECT * FROM etats';
    let params = [];

    // Pour les confirmateurs (fonction 6), seuls les états du groupe 2 sont disponibles
    if (req.user.fonction === 6) {
      querySql += ' WHERE groupe = ?';
      params.push('2');
    }

    querySql += ' ORDER BY ordre ASC';

    const etats = await query(querySql, params);
    res.json({ success: true, data: etats });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un état
router.post('/etats', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/etats/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/etats/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/professions', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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

// Mettre à jour une profession
router.put('/professions/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/professions/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/mode-chauffage', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/mode-chauffage/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/mode-chauffage/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/type-contrat', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/type-contrat/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/type-contrat/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/installateurs', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/installateurs/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/installateurs/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.post('/sous-etat', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.put('/sous-etat/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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
router.delete('/sous-etat/:id', authenticate, checkPermission(1, 2, 7), async (req, res) => {
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

module.exports = router;
