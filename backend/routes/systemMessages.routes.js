const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTES POUR LA GESTION DES MESSAGES SYSTÈME
// =====================================================

// GET /api/system-messages
// Récupère les messages système actifs pour l'utilisateur connecté
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userFonction = req.user.fonction;
    const userCentre = req.user.centre;
    const now = new Date();

    // Récupérer tous les messages actifs qui correspondent aux critères
    let messages = await query(`
      SELECT 
        sm.*,
        CASE 
          WHEN sml.id IS NOT NULL THEN 1 
          ELSE 0 
        END as deja_lu
      FROM system_messages sm
      LEFT JOIN system_messages_lus sml ON sm.id = sml.id_message AND sml.id_utilisateur = ?
      WHERE sm.actif = 1
        AND (sm.date_debut IS NULL OR sm.date_debut <= ?)
        AND (sm.date_fin IS NULL OR sm.date_fin >= ?)
      ORDER BY sm.priorite DESC, sm.date_creation DESC
    `, [userId, now, now]);

    // Filtrer les messages selon les critères de ciblage
    messages = messages.filter(message => {
      // Si le message doit être affiché une seule fois et qu'il a déjà été lu, l'exclure
      if (message.afficher_une_seule_fois === 1 && message.deja_lu === 1) {
        return false;
      }

      // Vérifier si au moins un critère de ciblage est défini
      let hasFonctionsCibles = false;
      let hasCentresCibles = false;
      let hasUtilisateursCibles = false;
      let matchesFonctions = false;
      let matchesCentres = false;
      let matchesUtilisateurs = false;

      // Vérifier les fonctions ciblées
      if (message.cibles_fonctions) {
        try {
          const fonctionsCibles = JSON.parse(message.cibles_fonctions);
          if (Array.isArray(fonctionsCibles) && fonctionsCibles.length > 0) {
            hasFonctionsCibles = true;
            matchesFonctions = fonctionsCibles.includes(userFonction);
          }
        } catch (e) {
          console.error('Erreur parsing cibles_fonctions:', e);
        }
      }

      // Vérifier les centres ciblés
      if (message.cibles_centres) {
        try {
          const centresCibles = JSON.parse(message.cibles_centres);
          if (Array.isArray(centresCibles) && centresCibles.length > 0) {
            hasCentresCibles = true;
            matchesCentres = centresCibles.includes(userCentre);
          }
        } catch (e) {
          console.error('Erreur parsing cibles_centres:', e);
        }
      }

      // Vérifier les utilisateurs ciblés
      if (message.cibles_utilisateurs) {
        try {
          const utilisateursCibles = JSON.parse(message.cibles_utilisateurs);
          if (Array.isArray(utilisateursCibles) && utilisateursCibles.length > 0) {
            hasUtilisateursCibles = true;
            matchesUtilisateurs = utilisateursCibles.includes(userId);
          }
        } catch (e) {
          console.error('Erreur parsing cibles_utilisateurs:', e);
        }
      }

      // Si aucun critère de ciblage n'est défini, exclure le message
      if (!hasFonctionsCibles && !hasCentresCibles && !hasUtilisateursCibles) {
        return false;
      }

      // Si au moins un critère est défini, vérifier que l'utilisateur correspond à au moins un critère
      // Si plusieurs critères sont définis, l'utilisateur doit correspondre à TOUS les critères définis (ET logique)
      let shouldInclude = false;

      if (hasFonctionsCibles && hasCentresCibles && hasUtilisateursCibles) {
        // Tous les critères sont définis : l'utilisateur doit correspondre à tous
        shouldInclude = matchesFonctions && matchesCentres && matchesUtilisateurs;
      } else if (hasFonctionsCibles && hasCentresCibles) {
        // Fonctions et centres définis
        shouldInclude = matchesFonctions && matchesCentres;
      } else if (hasFonctionsCibles && hasUtilisateursCibles) {
        // Fonctions et utilisateurs définis
        shouldInclude = matchesFonctions && matchesUtilisateurs;
      } else if (hasCentresCibles && hasUtilisateursCibles) {
        // Centres et utilisateurs définis
        shouldInclude = matchesCentres && matchesUtilisateurs;
      } else if (hasFonctionsCibles) {
        // Seulement fonctions définies
        shouldInclude = matchesFonctions;
      } else if (hasCentresCibles) {
        // Seulement centres définis
        shouldInclude = matchesCentres;
      } else if (hasUtilisateursCibles) {
        // Seulement utilisateurs définis
        shouldInclude = matchesUtilisateurs;
      }

      return shouldInclude;
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages système:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/system-messages/all
// Récupère tous les messages système (admin uniquement)
router.get('/all', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const messages = await query(`
      SELECT 
        sm.*,
        u.nom as createur_nom,
        u.prenom as createur_prenom
      FROM system_messages sm
      LEFT JOIN utilisateurs u ON sm.id_createur = u.id
      ORDER BY sm.date_creation DESC
    `);

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages système:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/system-messages/:id
// Récupère un message système spécifique
router.get('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const message = await queryOne(`
      SELECT 
        sm.*,
        u.nom as createur_nom,
        u.prenom as createur_prenom
      FROM system_messages sm
      LEFT JOIN utilisateurs u ON sm.id_createur = u.id
      WHERE sm.id = ?
    `, [id]);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    res.json({ success: true, data: message });
  } catch (error) {
    console.error('Erreur lors de la récupération du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/system-messages
// Crée un nouveau message système
router.post('/', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const {
      titre,
      message,
      type = 'info',
      priorite = 1,
      date_debut = null,
      date_fin = null,
      actif = 1,
      afficher_une_seule_fois = 0,
      cibles_fonctions = null,
      cibles_centres = null,
      cibles_utilisateurs = null
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Le message est requis' });
    }

    // Convertir les tableaux en JSON si nécessaire
    const ciblesFonctionsJson = cibles_fonctions ? JSON.stringify(cibles_fonctions) : null;
    const ciblesCentresJson = cibles_centres ? JSON.stringify(cibles_centres) : null;
    const ciblesUtilisateursJson = cibles_utilisateurs ? JSON.stringify(cibles_utilisateurs) : null;

    const result = await query(`
      INSERT INTO system_messages (
        titre, message, type, priorite, date_debut, date_fin,
        actif, afficher_une_seule_fois,
        cibles_fonctions, cibles_centres, cibles_utilisateurs,
        id_createur
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      titre || null,
      message,
      type,
      priorite,
      date_debut || null,
      date_fin || null,
      actif,
      afficher_une_seule_fois,
      ciblesFonctionsJson,
      ciblesCentresJson,
      ciblesUtilisateursJson,
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Message système créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur lors de la création du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/system-messages/:id
// Met à jour un message système
router.put('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titre,
      message,
      type,
      priorite,
      date_debut,
      date_fin,
      actif,
      afficher_une_seule_fois,
      cibles_fonctions,
      cibles_centres,
      cibles_utilisateurs
    } = req.body;

    // Vérifier que le message existe
    const existingMessage = await queryOne('SELECT id FROM system_messages WHERE id = ?', [id]);
    if (!existingMessage) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];

    if (titre !== undefined) {
      updates.push('titre = ?');
      values.push(titre || null);
    }
    if (message !== undefined) {
      updates.push('message = ?');
      values.push(message);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }
    if (priorite !== undefined) {
      updates.push('priorite = ?');
      values.push(priorite);
    }
    if (date_debut !== undefined) {
      updates.push('date_debut = ?');
      values.push(date_debut || null);
    }
    if (date_fin !== undefined) {
      updates.push('date_fin = ?');
      values.push(date_fin || null);
    }
    if (actif !== undefined) {
      updates.push('actif = ?');
      values.push(actif);
    }
    if (afficher_une_seule_fois !== undefined) {
      updates.push('afficher_une_seule_fois = ?');
      values.push(afficher_une_seule_fois);
    }
    if (cibles_fonctions !== undefined) {
      updates.push('cibles_fonctions = ?');
      values.push(cibles_fonctions ? JSON.stringify(cibles_fonctions) : null);
    }
    if (cibles_centres !== undefined) {
      updates.push('cibles_centres = ?');
      values.push(cibles_centres ? JSON.stringify(cibles_centres) : null);
    }
    if (cibles_utilisateurs !== undefined) {
      updates.push('cibles_utilisateurs = ?');
      values.push(cibles_utilisateurs ? JSON.stringify(cibles_utilisateurs) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune modification fournie' });
    }

    values.push(id);

    await query(
      `UPDATE system_messages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Message système mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/system-messages/:id
// Supprime un message système
router.delete('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;

    const message = await queryOne('SELECT id FROM system_messages WHERE id = ?', [id]);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    await query('DELETE FROM system_messages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Message système supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/system-messages/:id/marquer-lu
// Marque un message comme lu pour l'utilisateur connecté
router.post('/:id/marquer-lu', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier que le message existe
    const message = await queryOne('SELECT id FROM system_messages WHERE id = ?', [id]);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    // Insérer ou ignorer si déjà présent
    await query(`
      INSERT IGNORE INTO system_messages_lus (id_message, id_utilisateur)
      VALUES (?, ?)
    `, [id, userId]);

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });
  } catch (error) {
    console.error('Erreur lors du marquage du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
