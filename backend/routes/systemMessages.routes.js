const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// GET /api/system-messages
// Récupérer les messages système pour l'utilisateur connecté
// =====================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userFonction = req.user.fonction;

    // Récupérer les messages actifs qui correspondent aux critères de ciblage
    // Critères :
    // 1. Message actif (actif = 1)
    // 2. Date actuelle entre date_debut et date_fin (si définies)
    // 3. L'utilisateur correspond aux critères de ciblage (fonction OU utilisateur)
    // 4. Si "afficher_une_seule_fois" est activé, vérifier que le message n'a pas déjà été lu

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Récupérer tous les messages actifs qui ont au moins un critère de ciblage défini
    const allMessages = await query(
      `SELECT 
        sm.id,
        sm.titre,
        sm.message,
        sm.type,
        sm.priorite,
        sm.afficher_une_seule_fois,
        sm.cibles_fonctions,
        sm.cibles_utilisateurs,
        sm.id_createur,
        sm.afficher_expediteur,
        u_c.pseudo as createur_pseudo,
        CASE 
          WHEN sml.id IS NOT NULL THEN 1 
          ELSE 0 
        END as deja_lu
      FROM system_messages sm
      LEFT JOIN system_messages_lus sml ON sm.id = sml.id_message AND sml.id_utilisateur = ?
      LEFT JOIN utilisateurs u_c ON sm.id_createur = u_c.id
      WHERE sm.actif = 1
        AND (sm.date_debut IS NULL OR sm.date_debut <= ?)
        AND (sm.date_fin IS NULL OR sm.date_fin >= ?)
        AND (sm.cibles_fonctions IS NOT NULL OR sm.cibles_utilisateurs IS NOT NULL)
      ORDER BY sm.priorite DESC, sm.date_creation DESC`,
      [userId, now, now]
    );

    // Filtrer les messages selon les critères de ciblage et l'affichage unique
    const finalMessages = [];
    for (const msg of allMessages) {
      // Vérifier si le message doit être affiché une seule fois et a déjà été lu
      if (msg.afficher_une_seule_fois === 1 && msg.deja_lu === 1) {
        continue;
      }

      let matchesFonction = false;
      let matchesUtilisateur = false;

      // Vérifier le ciblage par fonction
      if (msg.cibles_fonctions) {
        try {
          const fonctions = JSON.parse(msg.cibles_fonctions);
          if (Array.isArray(fonctions) && fonctions.includes(userFonction)) {
            matchesFonction = true;
          }
        } catch (e) {
          console.error('Erreur parsing cibles_fonctions:', e);
        }
      }

      // Vérifier le ciblage par utilisateur
      if (msg.cibles_utilisateurs) {
        try {
          const utilisateurs = JSON.parse(msg.cibles_utilisateurs);
          if (Array.isArray(utilisateurs) && utilisateurs.includes(userId)) {
            matchesUtilisateur = true;
          }
        } catch (e) {
          console.error('Erreur parsing cibles_utilisateurs:', e);
        }
      }

      // Logique de ciblage :
      // - Si les deux critères sont définis : l'utilisateur doit correspondre aux deux (ET)
      // - Si un seul critère est défini : l'utilisateur doit correspondre à ce critère
      // - Si aucun critère n'est défini : le message n'est pas inclus (sécurité)
      if (msg.cibles_fonctions && msg.cibles_utilisateurs) {
        // Les deux sont définis : l'utilisateur doit correspondre aux deux
        if (matchesFonction && matchesUtilisateur) {
          finalMessages.push({
            id: msg.id,
            titre: msg.titre,
            message: msg.message,
            type: msg.type,
            priorite: msg.priorite,
            afficher_une_seule_fois: msg.afficher_une_seule_fois,
            afficher_expediteur: msg.afficher_expediteur,
            createur_pseudo: msg.createur_pseudo
          });
        }
      } else if (msg.cibles_fonctions) {
        // Seulement fonction : l'utilisateur doit avoir cette fonction
        if (matchesFonction) {
          finalMessages.push({
            id: msg.id,
            titre: msg.titre,
            message: msg.message,
            type: msg.type,
            priorite: msg.priorite,
            afficher_une_seule_fois: msg.afficher_une_seule_fois,
            afficher_expediteur: msg.afficher_expediteur,
            createur_pseudo: msg.createur_pseudo
          });
        }
      } else if (msg.cibles_utilisateurs) {
        // Seulement utilisateur : l'utilisateur doit être dans la liste
        if (matchesUtilisateur) {
          finalMessages.push({
            id: msg.id,
            titre: msg.titre,
            message: msg.message,
            type: msg.type,
            priorite: msg.priorite,
            afficher_une_seule_fois: msg.afficher_une_seule_fois,
            afficher_expediteur: msg.afficher_expediteur,
            createur_pseudo: msg.createur_pseudo
          });
        }
      }
      // Si aucun critère n'est défini, le message n'est pas inclus (sécurité)
    }

    res.json({
      success: true,
      data: finalMessages
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages système:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages système'
    });
  }
});

// =====================================================
// GET /api/system-messages/all
// Récupérer tous les messages système (admin uniquement)
// =====================================================
router.get('/all', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const messages = await query(
      `SELECT 
        sm.*,
        u.nom as createur_nom,
        u.prenom as createur_prenom
      FROM system_messages sm
      LEFT JOIN utilisateurs u ON sm.id_createur = u.id
      ORDER BY sm.date_creation DESC`
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages'
    });
  }
});

// =====================================================
// GET /api/system-messages/:id
// Récupérer un message système spécifique (admin uniquement)
// =====================================================
router.get('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const message = await queryOne(
      `SELECT 
        sm.*,
        u.nom as createur_nom,
        u.prenom as createur_prenom
      FROM system_messages sm
      LEFT JOIN utilisateurs u ON sm.id_createur = u.id
      WHERE sm.id = ?`,
      [id]
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du message'
    });
  }
});

// =====================================================
// POST /api/system-messages
// Créer un nouveau message système (admin uniquement)
// =====================================================
router.post('/', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const {
      titre,
      message,
      type = 'info',
      priorite = 1,
      date_debut,
      date_fin,
      actif = 1,
      afficher_une_seule_fois = 0,
      cibles_fonctions,
      cibles_utilisateurs
    } = req.body;

    // Validation
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Le message est requis'
      });
    }

    // Vérifier qu'au moins un critère de ciblage est défini
    if ((!cibles_fonctions || (Array.isArray(cibles_fonctions) && cibles_fonctions.length === 0)) &&
        (!cibles_utilisateurs || (Array.isArray(cibles_utilisateurs) && cibles_utilisateurs.length === 0))) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un critère de ciblage doit être sélectionné (fonctions ou utilisateurs)'
      });
    }

    // Convertir les tableaux en JSON
    const ciblesFonctionsJson = (cibles_fonctions && Array.isArray(cibles_fonctions) && cibles_fonctions.length > 0) 
      ? JSON.stringify(cibles_fonctions) 
      : null;
    const ciblesUtilisateursJson = (cibles_utilisateurs && Array.isArray(cibles_utilisateurs) && cibles_utilisateurs.length > 0) 
      ? JSON.stringify(cibles_utilisateurs) 
      : null;

    const result = await query(
      `INSERT INTO system_messages 
        (titre, message, type, priorite, date_debut, date_fin, actif, afficher_une_seule_fois, 
         cibles_fonctions, cibles_utilisateurs, id_createur)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titre || null,
        message,
        type,
        priorite,
        date_debut || null,
        date_fin || null,
        actif,
        afficher_une_seule_fois,
        ciblesFonctionsJson,
        ciblesUtilisateursJson,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Message créé avec succès',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur lors de la création du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du message'
    });
  }
});

// =====================================================
// PUT /api/system-messages/:id
// Mettre à jour un message système (admin uniquement)
// =====================================================
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
      cibles_utilisateurs
    } = req.body;

    // Vérifier que le message existe
    const existingMessage = await queryOne(
      'SELECT id FROM system_messages WHERE id = ?',
      [id]
    );

    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Validation
    if (message !== undefined && (!message || !message.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Le message est requis'
      });
    }

    // Vérifier qu'au moins un critère de ciblage est défini si on les met à jour
    if (cibles_fonctions !== undefined || cibles_utilisateurs !== undefined) {
      const finalCiblesFonctions = cibles_fonctions !== undefined ? cibles_fonctions : 
        (existingMessage.cibles_fonctions ? JSON.parse(existingMessage.cibles_fonctions) : null);
      const finalCiblesUtilisateurs = cibles_utilisateurs !== undefined ? cibles_utilisateurs : 
        (existingMessage.cibles_utilisateurs ? JSON.parse(existingMessage.cibles_utilisateurs) : null);

      if ((!finalCiblesFonctions || (Array.isArray(finalCiblesFonctions) && finalCiblesFonctions.length === 0)) &&
          (!finalCiblesUtilisateurs || (Array.isArray(finalCiblesUtilisateurs) && finalCiblesUtilisateurs.length === 0))) {
        return res.status(400).json({
          success: false,
          message: 'Au moins un critère de ciblage doit être sélectionné (fonctions ou utilisateurs)'
        });
      }
    }

    // Construire la requête de mise à jour dynamiquement
    const updateFields = [];
    const updateValues = [];

    if (titre !== undefined) {
      updateFields.push('titre = ?');
      updateValues.push(titre || null);
    }
    if (message !== undefined) {
      updateFields.push('message = ?');
      updateValues.push(message);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (priorite !== undefined) {
      updateFields.push('priorite = ?');
      updateValues.push(priorite);
    }
    if (date_debut !== undefined) {
      updateFields.push('date_debut = ?');
      updateValues.push(date_debut || null);
    }
    if (date_fin !== undefined) {
      updateFields.push('date_fin = ?');
      updateValues.push(date_fin || null);
    }
    if (actif !== undefined) {
      updateFields.push('actif = ?');
      updateValues.push(actif);
    }
    if (afficher_une_seule_fois !== undefined) {
      updateFields.push('afficher_une_seule_fois = ?');
      updateValues.push(afficher_une_seule_fois);
    }
    if (cibles_fonctions !== undefined) {
      updateFields.push('cibles_fonctions = ?');
      updateValues.push(
        (cibles_fonctions && Array.isArray(cibles_fonctions) && cibles_fonctions.length > 0) 
          ? JSON.stringify(cibles_fonctions) 
          : null
      );
    }
    if (cibles_utilisateurs !== undefined) {
      updateFields.push('cibles_utilisateurs = ?');
      updateValues.push(
        (cibles_utilisateurs && Array.isArray(cibles_utilisateurs) && cibles_utilisateurs.length > 0) 
          ? JSON.stringify(cibles_utilisateurs) 
          : null
      );
    }

    // Toujours mettre à jour date_modification
    updateFields.push('date_modification = NOW()');

    updateValues.push(id);

    await query(
      `UPDATE system_messages SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Message mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du message'
    });
  }
});

// =====================================================
// DELETE /api/system-messages/:id
// Supprimer un message système (admin uniquement)
// =====================================================
router.delete('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le message existe
    const existingMessage = await queryOne(
      'SELECT id FROM system_messages WHERE id = ?',
      [id]
    );

    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Supprimer le message (les messages lus seront supprimés en cascade grâce à la foreign key)
    await query('DELETE FROM system_messages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Message supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message'
    });
  }
});

// =====================================================
// POST /api/system-messages/:id/marquer-lu
// Marquer un message comme lu pour l'utilisateur connecté
// =====================================================
router.post('/:id/marquer-lu', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier que le message existe
    const message = await queryOne(
      'SELECT id FROM system_messages WHERE id = ?',
      [id]
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Vérifier si le message a déjà été marqué comme lu
    const alreadyRead = await queryOne(
      'SELECT id FROM system_messages_lus WHERE id_message = ? AND id_utilisateur = ?',
      [id, userId]
    );

    if (!alreadyRead) {
      // Insérer le marquage comme lu
      await query(
        'INSERT INTO system_messages_lus (id_message, id_utilisateur) VALUES (?, ?)',
        [id, userId]
      );
    }

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });
  } catch (error) {
    console.error('Erreur lors du marquage du message comme lu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du message comme lu'
    });
  }
});

module.exports = router;
