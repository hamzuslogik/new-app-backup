const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// Fonction pour encoder un ID en hash (réutilisée depuis fiche.routes.js)
const crypto = require('crypto');
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

// Vérifier et créer la table notifications si elle n'existe pas
const ensureNotificationsTable = async () => {
  try {
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = SCHEMA() 
       AND table_name = 'notifications'`
    );
    
    if (!tableExists || tableExists.count === 0) {
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id int(11) NOT NULL AUTO_INCREMENT,
          type varchar(50) CHARACTER SET utf8 DEFAULT NULL,
          id_fiche int(11) DEFAULT NULL,
          message text CHARACTER SET utf8 DEFAULT NULL,
          destination int(11) DEFAULT NULL,
          date_creation datetime DEFAULT NULL,
          lu int(11) DEFAULT 0,
          metadata text CHARACTER SET utf8 DEFAULT NULL,
          action varchar(20) DEFAULT NULL,
          PRIMARY KEY (id),
          KEY idx_destination (destination),
          KEY idx_lu (lu),
          KEY idx_type (type),
          KEY idx_id_fiche (id_fiche),
          KEY idx_date_creation (date_creation),
          KEY idx_action (action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1
      `);
      
      // Ajouter les colonnes si elles n'existent pas (pour les tables existantes)
      try {
        await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata text CHARACTER SET utf8 DEFAULT NULL`);
      } catch (e) {
        // Colonne peut déjà exister, ignorer l'erreur
      }
      try {
        await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action varchar(20) DEFAULT NULL`);
      } catch (e) {
        // Colonne peut déjà exister, ignorer l'erreur
      }
      try {
        await query(`ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_action (action)`);
      } catch (e) {
        // Index peut déjà exister, ignorer l'erreur
      }
      console.log('Table notifications créée avec succès');
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création de la table notifications:', error);
  }
};

// Vérifier la table au chargement du module
ensureNotificationsTable();

const encodeFicheId = (id) => {
  if (!id) return null;
  const hmac = crypto.createHmac('sha256', HASH_SECRET);
  hmac.update(String(id));
  const hash = hmac.digest('hex');
  const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m];
  });
  return `${hash.substring(0, 16)}${encodedId}`;
};

// Récupérer les notifications pour l'utilisateur connecté
router.get('/', authenticate, async (req, res) => {
  try {
    const { all } = req.query;
    const includeRead = all === 'true' || all === '1';
    
    // Construire la condition WHERE pour lu
    const luCondition = includeRead ? '' : 'AND n.lu = 0';
    
    // Récupérer les notifications pour :
    // - Admins (fonction 1, 2, 7) et Backoffice (fonction 11) : toutes les notifications
    // - Confirmateurs (fonction 6) : notifications où ils sont destinataires
    // - Autres utilisateurs : notifications où ils sont destinataires (pour les demandes d'insertion)
    
    let notifications = [];
    
    if ([1, 2, 7, 11].includes(req.user.fonction)) {
      // Admins et Backoffice : toutes les notifications (même si la fiche n'existe plus)
      // IMPORTANT: Utiliser n.id_fiche pour garantir qu'on a toujours l'ID même si la fiche est supprimée
      notifications = await query(
        `SELECT n.*, n.id_fiche as notification_fiche_id,
         f.nom, f.prenom, f.tel, f.date_rdv_time, f.id as fiche_id, f.id_etat_final,
         f.archive, f.ko, f.active
         FROM notifications n
         LEFT JOIN fiches f ON n.id_fiche = f.id AND f.archive = 0 AND f.ko = 0 AND f.active = 1
         WHERE n.destination = ?
         ${luCondition}
         ORDER BY n.date_creation DESC
         LIMIT ${includeRead ? 200 : 50}`,
        [req.user.id]
      );
    } else if (req.user.fonction === 6) {
      // Confirmateurs : notifications où ils sont destinataires (même si la fiche n'existe plus)
      // IMPORTANT: Utiliser n.id_fiche pour garantir qu'on a toujours l'ID même si la fiche est supprimée
      notifications = await query(
        `SELECT n.*, n.id_fiche as notification_fiche_id,
         f.nom, f.prenom, f.tel, f.date_rdv_time, f.id as fiche_id, f.id_etat_final,
         f.archive, f.ko, f.active
         FROM notifications n
         LEFT JOIN fiches f ON n.id_fiche = f.id AND f.archive = 0 AND f.ko = 0 AND f.active = 1
         WHERE n.destination = ?
         ${luCondition}
         AND (n.type = 'decalage_request' OR n.type LIKE 'demande_insertion_%')
         ORDER BY n.date_creation DESC
         LIMIT ${includeRead ? 200 : 50}`,
        [req.user.id]
      );
    } else if (req.user.fonction === 14) {
      // RE Confirmation (superviseur des confirmateurs) : notifications de décalage pour leurs confirmateurs
      // Récupérer les IDs des confirmateurs sous responsabilité
      const confirmateursIds = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 6 AND etat > 0',
        [req.user.id]
      );
      
      if (confirmateursIds.length === 0) {
        notifications = [];
      } else {
        const ids = confirmateursIds.map(c => c.id);
        notifications = await query(
          `SELECT n.*, n.id_fiche as notification_fiche_id,
           f.nom, f.prenom, f.tel, f.date_rdv_time, f.id as fiche_id, f.id_etat_final,
           f.archive, f.ko, f.active
           FROM notifications n
           LEFT JOIN fiches f ON n.id_fiche = f.id AND f.archive = 0 AND f.ko = 0 AND f.active = 1
           WHERE n.destination = ?
           ${luCondition}
           AND n.type = 'decalage_request'
           ORDER BY n.date_creation DESC
           LIMIT ${includeRead ? 200 : 50}`,
          [req.user.id]
        );
      }
    } else {
      // Autres utilisateurs : notifications où ils sont destinataires (pour les demandes d'insertion et réponses de décalages)
      notifications = await query(
        `SELECT n.*, n.id_fiche as notification_fiche_id,
         f.nom, f.prenom, f.tel, f.date_rdv_time, f.id as fiche_id, f.id_etat_final,
         f.archive, f.ko, f.active
         FROM notifications n
         LEFT JOIN fiches f ON n.id_fiche = f.id
         WHERE n.destination = ?
         ${luCondition}
         AND (n.type LIKE 'demande_insertion_%' OR n.type = 'decalage_request' OR n.type = 'decalage_response')
         ORDER BY n.date_creation DESC
         LIMIT ${includeRead ? 200 : 50}`,
        [req.user.id]
      );
    }

    // Ajouter le hash et parser les métadonnées pour chaque notification
    // IMPORTANT: Utiliser id_fiche de la notification (pas fiche_id du JOIN) car la fiche peut ne plus exister
    const notificationsWithHash = (notifications || []).map(notif => {
      let metadata = null;
      try {
        metadata = notif.metadata ? JSON.parse(notif.metadata) : null;
      } catch (e) {
        console.error('Erreur lors du parsing des métadonnées:', e);
      }
      
      // Générer le hash à partir de id_fiche de la notification (même si la fiche n'existe plus dans le JOIN)
      // PRIORITÉ: Utiliser notification_fiche_id (n.id_fiche) qui est toujours présent, sinon id_fiche, sinon fiche_id du JOIN
      const ficheIdForHash = notif.notification_fiche_id || notif.id_fiche || notif.fiche_id;
      let hash = null;
      
      if (ficheIdForHash && ficheIdForHash > 0) {
        try {
          hash = encodeFicheId(ficheIdForHash);
        } catch (e) {
          console.error('Erreur lors de l\'encodage du hash pour la fiche:', ficheIdForHash, e);
          hash = null;
        }
      }
      
      return {
        ...notif,
        hash: hash,
        fiche_id: ficheIdForHash || notif.fiche_id, // S'assurer que fiche_id est toujours présent pour le frontend
        id_fiche: ficheIdForHash || notif.id_fiche, // Garantir que id_fiche est présent
        metadata: metadata
      };
    });

    res.json({
      success: true,
      data: notificationsWithHash
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
});

// Compter les notifications non lues
router.get('/count', authenticate, async (req, res) => {
  try {
    let count = 0;
    
    if ([1, 2, 7, 11].includes(req.user.fonction)) {
      // Admins et Backoffice : compter toutes les notifications
      const result = await queryOne(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE destination = ?
         AND lu = 0`,
        [req.user.id]
      );
      count = result?.count || 0;
    } else if (req.user.fonction === 6) {
      // Confirmateurs : compter les notifications de décalage et demandes d'insertion
      const result = await queryOne(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE destination = ?
         AND lu = 0
         AND (type = 'decalage_request' OR type LIKE 'demande_insertion_%')`,
        [req.user.id]
      );
      count = result?.count || 0;
    } else if (req.user.fonction === 14) {
      // RE Confirmation (superviseur des confirmateurs) : compter les notifications de décalage pour leurs confirmateurs
      const confirmateursIds = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 6 AND etat > 0',
        [req.user.id]
      );
      
      if (confirmateursIds.length === 0) {
        count = 0;
      } else {
        const result = await queryOne(
          `SELECT COUNT(*) as count
           FROM notifications
           WHERE destination = ?
           AND lu = 0
           AND type = 'decalage_request'`,
          [req.user.id]
        );
        count = result?.count || 0;
      }
    } else {
      // Autres utilisateurs : compter les notifications de demandes d'insertion, décalages et réponses de décalages
      const result = await queryOne(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE destination = ?
         AND lu = 0
         AND (type LIKE 'demande_insertion_%' OR type = 'decalage_request' OR type = 'decalage_response')`,
        [req.user.id]
      );
      count = result?.count || 0;
    }

    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Erreur lors du comptage des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du comptage des notifications'
    });
  }
});

// Fonction pour décoder un hash en ID
const decodeFicheId = (hash) => {
  if (!hash) return null;
  try {
    const encodedId = hash.substring(16);
    const base64 = encodedId.replace(/[-_]/g, (m) => {
      return { '-': '+', '_': '/' }[m];
    });
    const id = Buffer.from(base64, 'base64').toString('utf8');
    const idNum = parseInt(id, 10);
    
    const hmac = crypto.createHmac('sha256', HASH_SECRET);
    hmac.update(id);
    const expectedHash = hmac.digest('hex').substring(0, 16);
    
    if (hash.substring(0, 16) === expectedHash) {
      return idNum;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};

// Créer une notification
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, id_fiche, fiche_hash, message, destination, date_rdv_time, metadata } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type et message requis'
      });
    }

    // Si fiche_hash est fourni, le décoder en ID
    let ficheId = id_fiche;
    if (fiche_hash && !ficheId) {
      ficheId = decodeFicheId(fiche_hash);
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Stocker les métadonnées (date_rdv_time, etc.) dans un champ JSON ou texte
    // Pour simplifier, on utilise un champ texte pour stocker du JSON
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    // Si destination est spécifiée, créer pour cet utilisateur
    // Sinon, créer pour tous les admins (fonction 1, 2, 7)
    if (destination) {
      const result = await query(
        `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [type, ficheId || null, message, destination, now, metadataStr]
      );

      res.status(201).json({
        success: true,
        message: 'Notification créée avec succès',
        data: { id: result.insertId }
      });
    } else {
      // Créer pour tous les admins
      const admins = await query(
        'SELECT id FROM utilisateurs WHERE fonction IN (1, 2, 7) AND etat > 0'
      );

      if (admins.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucun administrateur trouvé'
        });
      }

      const values = admins.map(admin => [type, ficheId || null, message, admin.id, now, 0, metadataStr]);
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, 0, ?)').join(', ');
      const flatValues = values.flat();

      await query(
        `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
         VALUES ${placeholders}`,
        flatValues
      );

      res.status(201).json({
        success: true,
        message: `Notifications créées pour ${admins.length} administrateur(s)`,
        data: { count: admins.length }
      });
    }
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la notification',
      error: error.message
    });
  }
});

// Marquer une notification comme lue
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE notifications SET lu = 1 WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la notification'
    });
  }
});

// Marquer toutes les notifications comme lues
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin (fonction 1, 2, 7)
    if (![1, 2, 7].includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    await query(
      `UPDATE notifications 
       SET lu = 1 
       WHERE destination = ?
       AND lu = 0`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Toutes les notifications marquées comme lues'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des notifications'
    });
  }
});

// Accepter une demande de RDV
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'utilisateur est admin
    if (![1, 2, 7].includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent approuver les demandes.'
      });
    }

    // Récupérer la notification
    const notification = await queryOne(
      `SELECT n.*, f.id_etat_final 
       FROM notifications n
       LEFT JOIN fiches f ON n.id_fiche = f.id
       WHERE n.id = ? AND n.destination = ? AND n.type = 'rdv_approval' AND (n.action IS NULL OR n.action = 'pending')`,
      [id, req.user.id]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée ou déjà traitée'
      });
    }

    // Parser les métadonnées
    let metadata = null;
    try {
      metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
    } catch (e) {
      console.error('Erreur lors du parsing des métadonnées:', e);
    }

    if (!metadata || !metadata.date_rdv_time) {
      return res.status(400).json({
        success: false,
        message: 'Données de RDV manquantes dans la notification'
      });
    }

    const ficheId = notification.id_fiche;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Mettre à jour la fiche : état CONFIRMER (7) et date_rdv_time
    await query(
      `UPDATE fiches 
       SET id_etat_final = 7, 
           date_rdv_time = ?,
           date_modif_time = ?
       WHERE id = ?`,
      [metadata.date_rdv_time, now, ficheId]
    );

    // Enregistrer dans l'historique
    await query(
      `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, 7, ?)`,
      [ficheId, now]
    );

    // Marquer la notification comme acceptée
    await query(
      `UPDATE notifications SET action = 'accepted', lu = 1 WHERE id = ?`,
      [id]
    );

    // Marquer toutes les autres notifications pour cette fiche et ce RDV comme traitées
    if (metadata && metadata.date_rdv_time) {
      const otherNotifications = await query(
        `SELECT id FROM notifications 
         WHERE id_fiche = ? 
         AND type = 'rdv_approval' 
         AND metadata LIKE ?
         AND id != ?`,
        [ficheId, `%"date_rdv_time":"${metadata.date_rdv_time}"%`, id]
      );
      
      if (otherNotifications && otherNotifications.length > 0) {
        const otherIds = otherNotifications.map(n => n.id);
        await query(
          `UPDATE notifications SET lu = 1 WHERE id IN (${otherIds.map(() => '?').join(',')})`,
          otherIds
        );
      }
    }

    res.json({
      success: true,
      message: 'Demande de RDV approuvée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'approbation de la demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation de la demande',
      error: error.message
    });
  }
});

// Refuser une demande de RDV
router.post('/:id/refuse', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'utilisateur est admin
    if (![1, 2, 7].includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent refuser les demandes.'
      });
    }

    // Récupérer la notification
    const notification = await queryOne(
      `SELECT n.*, f.id_etat_final 
       FROM notifications n
       LEFT JOIN fiches f ON n.id_fiche = f.id
       WHERE n.id = ? AND n.destination = ? AND n.type = 'rdv_approval' AND (n.action IS NULL OR n.action = 'pending')`,
      [id, req.user.id]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée ou déjà traitée'
      });
    }

    const ficheId = notification.id_fiche;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Chercher l'état REFUS-ADMIN
    const refusAdminEtat = await queryOne(
      `SELECT id FROM etats 
       WHERE (titre LIKE '%REFUS-ADMIN%' OR titre LIKE '%REFUS ADMIN%' OR titre LIKE '%REFUSADMIN%')
       AND etat = 1
       LIMIT 1`
    );

    if (!refusAdminEtat) {
      return res.status(400).json({
        success: false,
        message: 'État REFUS-ADMIN non trouvé dans la base de données'
      });
    }

    // Mettre à jour la fiche : état REFUS-ADMIN et supprimer date_rdv_time
    await query(
      `UPDATE fiches 
       SET id_etat_final = ?,
           date_rdv_time = NULL,
           date_modif_time = ?
       WHERE id = ?`,
      [refusAdminEtat.id, now, ficheId]
    );

    // Enregistrer dans l'historique
    await query(
      `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, ?, ?)`,
      [ficheId, refusAdminEtat.id, now]
    );

    // Marquer la notification comme refusée
    await query(
      `UPDATE notifications SET action = 'refused', lu = 1 WHERE id = ?`,
      [id]
    );

    // Marquer toutes les autres notifications pour cette fiche et ce RDV comme traitées
    let metadata = null;
    try {
      metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
    } catch (e) {
      console.error('Erreur lors du parsing des métadonnées:', e);
    }
    
    if (metadata && metadata.date_rdv_time) {
      const otherNotifications = await query(
        `SELECT id FROM notifications 
         WHERE id_fiche = ? 
         AND type = 'rdv_approval' 
         AND metadata LIKE ?
         AND id != ?`,
        [ficheId, `%"date_rdv_time":"${metadata.date_rdv_time}"%`, id]
      );
      
      if (otherNotifications && otherNotifications.length > 0) {
        const otherIds = otherNotifications.map(n => n.id);
        await query(
          `UPDATE notifications SET lu = 1 WHERE id IN (${otherIds.map(() => '?').join(',')})`,
          otherIds
        );
      }
    }

    res.json({
      success: true,
      message: 'Demande de RDV refusée'
    });
  } catch (error) {
    console.error('Erreur lors du refus de la demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du refus de la demande',
      error: error.message
    });
  }
});

module.exports = router;

