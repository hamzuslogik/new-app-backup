const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// Récupérer la liste des conversations (utilisateurs avec qui on a discuté)
router.get('/conversations', authenticate, async (req, res) => {
  try {
    // Créer la table user_activity si elle n'existe pas
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) NOT NULL,
        last_activity DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_user (user_id),
        KEY idx_last_activity (last_activity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    const conversations = await query(
      `SELECT 
        u.id,
        u.pseudo,
        u.photo,
        u.genre,
        u.fonction,
        f.titre as fonction_titre,
        MAX(c.date_modif) as last_message_date,
        (SELECT COUNT(*) FROM chats WHERE destination = ? AND expediteur = u.id AND lu = 0) as unread_count,
        (SELECT message FROM chats WHERE (expediteur = u.id AND destination = ?) OR (expediteur = ? AND destination = u.id) ORDER BY date_modif DESC LIMIT 1) as last_message,
        CASE 
          WHEN ua.last_activity IS NOT NULL 
            AND ua.last_activity >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
          THEN 1 
          ELSE 0 
        END as is_online
       FROM utilisateurs u
       INNER JOIN chats c ON (c.expediteur = u.id AND c.destination = ?) OR (c.expediteur = ? AND c.destination = u.id)
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN user_activity ua ON u.id = ua.user_id
       WHERE u.id != ? AND u.etat > 0
       GROUP BY u.id, u.pseudo, u.photo, u.genre, u.fonction, f.titre
       ORDER BY last_message_date DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversations'
    });
  }
});

// Récupérer les messages d'une conversation spécifique
router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await query(
      `SELECT c.*, 
        u_exp.pseudo as expediteur_pseudo, 
        u_exp.photo as expediteur_photo,
        u_exp.genre as expediteur_genre
       FROM chats c
       JOIN utilisateurs u_exp ON c.expediteur = u_exp.id
       WHERE (c.expediteur = ? AND c.destination = ?) OR (c.expediteur = ? AND c.destination = ?)
       ORDER BY c.date_modif ASC`,
      [req.user.id, userId, userId, req.user.id]
    );

    // Marquer les messages comme lus
    await query(
      `UPDATE chats SET lu = 1 
       WHERE expediteur = ? AND destination = ? AND lu = 0`,
      [userId, req.user.id]
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

// Mettre à jour la dernière activité de l'utilisateur
router.post('/activity', authenticate, async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Créer la table user_activity si elle n'existe pas
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) NOT NULL,
        last_activity DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_user (user_id),
        KEY idx_last_activity (last_activity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {}); // Ignorer l'erreur si la table existe déjà

    // Mettre à jour ou insérer l'activité
    await query(
      `INSERT INTO user_activity (user_id, last_activity)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_activity = ?`,
      [req.user.id, now, now]
    );

    res.json({
      success: true,
      message: 'Activité mise à jour'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'activité:', error);
    // Ne pas bloquer si l'activité ne peut pas être enregistrée
    res.json({
      success: true,
      message: 'Activité mise à jour'
    });
  }
});

// Récupérer tous les utilisateurs actifs (pour démarrer une nouvelle conversation)
router.get('/users', authenticate, async (req, res) => {
  try {
    // Mettre à jour l'activité de l'utilisateur actuel
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) NOT NULL,
        last_activity DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_user (user_id),
        KEY idx_last_activity (last_activity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
    
    await query(
      `INSERT INTO user_activity (user_id, last_activity)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_activity = ?`,
      [req.user.id, now, now]
    ).catch(() => {});

    // Récupérer les informations de l'utilisateur connecté
    const currentUser = await queryOne(
      `SELECT fonction, chef_equipe, id_rp_qualif FROM utilisateurs WHERE id = ?`,
      [req.user.id]
    );

    // Construire la condition WHERE pour filtrer selon les groupes autorisés
    let whereCondition = 'u.id != ? AND u.etat > 0';
    let queryParams = [req.user.id];

    // Cas spécial : Agent Qualification (fonction 3) peut envoyer à son superviseur et aux autres agents sous la même responsabilité
    if (currentUser && currentUser.fonction === 3) {
      if (currentUser.chef_equipe) {
        // L'agent peut voir/envoyer des messages à :
        // 1. Son superviseur (chef_equipe)
        // 2. Les autres agents qui ont le même chef_equipe (même superviseur)
        whereCondition += ' AND (u.id = ? OR (u.fonction = 3 AND u.chef_equipe = ?))';
        queryParams.push(currentUser.chef_equipe, currentUser.chef_equipe);
      } else {
        // Si l'agent n'a pas de superviseur, il ne peut envoyer qu'aux autres agents sans superviseur
        whereCondition += ' AND u.fonction = 3 AND (u.chef_equipe IS NULL OR u.chef_equipe = 0)';
      }
    } else if (currentUser && currentUser.fonction === 2) {
      // Cas spécial : Superviseur Qualification (fonction 2, RE Qualification) peut envoyer à son RP et à ses agents
      // 1. Son RP (celui qui a id_rp_qualif = currentUser.id_rp_qualif et fonction = 12)
      // 2. Ses agents (ceux qui ont chef_equipe = currentUser.id)
      const conditions = [];
      if (currentUser.id_rp_qualif) {
        // Ajouter le RP
        conditions.push('(u.id = ? AND u.fonction = 12)');
        queryParams.push(currentUser.id_rp_qualif);
      }
      // Ajouter les agents sous sa responsabilité
      conditions.push('(u.fonction = 3 AND u.chef_equipe = ?)');
      queryParams.push(req.user.id);
      
      if (conditions.length > 0) {
        whereCondition += ` AND (${conditions.join(' OR ')})`;
      } else {
        // Si pas de RP et pas d'agents, ne rien afficher
        whereCondition += ' AND 1 = 0';
      }
    } else if (currentUser && currentUser.fonction === 12) {
      // Cas spécial : RP Qualification (fonction 12) peut envoyer à ses superviseurs et aux agents de ces superviseurs
      // 1. Ses superviseurs (ceux qui ont id_rp_qualif = currentUser.id et fonction = 2)
      // 2. Les agents de ces superviseurs (ceux qui ont chef_equipe = superviseur.id et fonction = 3)
      // Récupérer d'abord les IDs des superviseurs assignés au RP
      const superviseurs = await query(
        `SELECT id FROM utilisateurs WHERE id_rp_qualif = ? AND fonction = 2 AND etat > 0`,
        [req.user.id]
      );
      const superviseurIds = superviseurs.map(s => s.id);
      
      if (superviseurIds.length > 0) {
        // Ajouter les superviseurs et leurs agents
        const placeholders = superviseurIds.map(() => '?').join(',');
        whereCondition += ` AND (
          (u.fonction = 2 AND u.id_rp_qualif = ?) OR
          (u.fonction = 3 AND u.chef_equipe IN (${placeholders}))
        )`;
        queryParams.push(req.user.id, ...superviseurIds);
      } else {
        // Si pas de superviseurs, ne rien afficher
        whereCondition += ' AND 1 = 0';
      }
    } else {
      // Pour les autres fonctions, utiliser la logique normale avec groupes_messages_autorises
      const userFonction = await queryOne(
        `SELECT groupes_messages_autorises FROM fonctions WHERE id = ?`,
        [req.user.fonction]
      );

      // Si groupes_messages_autorises est défini (pas NULL), filtrer les utilisateurs
      if (userFonction && userFonction.groupes_messages_autorises) {
        try {
          const groupesAutorises = JSON.parse(userFonction.groupes_messages_autorises);
          if (Array.isArray(groupesAutorises) && groupesAutorises.length > 0) {
            // Créer une liste de placeholders pour les IDs de fonctions autorisées
            const placeholders = groupesAutorises.map(() => '?').join(',');
            whereCondition += ` AND u.fonction IN (${placeholders})`;
            queryParams = queryParams.concat(groupesAutorises);
          }
        } catch (parseError) {
          // Si le JSON est invalide, ignorer le filtre (autoriser tous)
          console.error('Erreur lors du parsing des groupes autorisés:', parseError);
        }
      }
      // Si groupes_messages_autorises est NULL, tous les utilisateurs sont autorisés
    }

    // Récupérer tous les utilisateurs avec leur statut de connexion
    // Un utilisateur est considéré en ligne s'il a eu une activité dans les 5 dernières minutes
    const users = await query(
      `SELECT 
        u.id, 
        u.pseudo, 
        u.photo, 
        u.genre, 
        f.titre as fonction_titre,
        CASE 
          WHEN ua.last_activity IS NOT NULL 
            AND ua.last_activity >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
          THEN 1 
          ELSE 0 
        END as is_online,
        ua.last_activity
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN user_activity ua ON u.id = ua.user_id
       WHERE ${whereCondition}
       ORDER BY is_online DESC, u.pseudo ASC`,
      queryParams
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// Envoyer un message
router.post('/', authenticate, async (req, res) => {
  try {
    const { destination, message } = req.body;

    if (!destination || !message) {
      return res.status(400).json({
        success: false,
        message: 'Destination et message requis'
      });
    }

    // Récupérer les informations de l'utilisateur connecté
    const currentUser = await queryOne(
      `SELECT fonction, chef_equipe, id_rp_qualif FROM utilisateurs WHERE id = ?`,
      [req.user.id]
    );

    // Récupérer l'utilisateur destination avec toutes ses informations
    const destUser = await queryOne(
      `SELECT fonction, chef_equipe, id_rp_qualif FROM utilisateurs WHERE id = ? AND etat > 0`,
      [destination]
    );

    if (!destUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur destination introuvable'
      });
    }

    // Cas spécial : Agent Qualification (fonction 3) peut envoyer à son superviseur et aux autres agents sous la même responsabilité
    if (currentUser && currentUser.fonction === 3) {
      if (currentUser.chef_equipe) {
        // Vérifier que la destination est soit le superviseur, soit un autre agent avec le même chef_equipe
        const isSupervisor = parseInt(destination) === currentUser.chef_equipe;
        const isSameTeamAgent = destUser.fonction === 3 && destUser.chef_equipe === currentUser.chef_equipe;

        if (!isSupervisor && !isSameTeamAgent) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez envoyer des messages qu\'à votre superviseur ou aux autres agents de votre équipe'
          });
        }
      } else {
        // Si l'agent n'a pas de superviseur, il ne peut envoyer qu'aux autres agents sans superviseur
        if (destUser.fonction !== 3 || (destUser.chef_equipe !== null && destUser.chef_equipe !== 0)) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez envoyer des messages qu\'aux autres agents sans superviseur'
          });
        }
      }
    } else if (currentUser && currentUser.fonction === 2) {
      // Cas spécial : Superviseur Qualification (fonction 2, RE Qualification) peut envoyer à son RP et à ses agents
      const isRP = currentUser.id_rp_qualif && parseInt(destination) === currentUser.id_rp_qualif && destUser.fonction === 12;
      const isAgent = destUser.fonction === 3 && destUser.chef_equipe === req.user.id;

      if (!isRP && !isAgent) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez envoyer des messages qu\'à votre RP ou à vos agents'
        });
      }
    } else if (currentUser && currentUser.fonction === 12) {
      // Cas spécial : RP Qualification (fonction 12) peut envoyer à ses superviseurs et aux agents de ces superviseurs
      // Vérifier si la destination est un superviseur assigné au RP
      const isSupervisor = destUser.fonction === 2 && destUser.id_rp_qualif === req.user.id;
      
      // Vérifier si la destination est un agent d'un superviseur assigné au RP
      let isAgent = false;
      if (destUser.fonction === 3 && destUser.chef_equipe) {
        const supervisor = await queryOne(
          `SELECT id FROM utilisateurs WHERE id = ? AND id_rp_qualif = ? AND fonction = 2 AND etat > 0`,
          [destUser.chef_equipe, req.user.id]
        );
        isAgent = !!supervisor;
      }

      if (!isSupervisor && !isAgent) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez envoyer des messages qu\'à vos superviseurs ou aux agents de vos superviseurs'
        });
      }
    } else {
      // Pour les autres fonctions, utiliser la logique normale avec groupes_messages_autorises
      const userFonction = await queryOne(
        `SELECT groupes_messages_autorises FROM fonctions WHERE id = ?`,
        [req.user.fonction]
      );

      // Si groupes_messages_autorises est défini, vérifier que la destination est autorisée
      if (userFonction && userFonction.groupes_messages_autorises) {
        try {
          const groupesAutorises = JSON.parse(userFonction.groupes_messages_autorises);
          if (Array.isArray(groupesAutorises) && groupesAutorises.length > 0) {
            // Vérifier que la fonction de destination est dans les groupes autorisés
            if (!groupesAutorises.includes(destUser.fonction)) {
              return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas autorisé à envoyer des messages à cet utilisateur'
              });
            }
          }
        } catch (parseError) {
          // Si le JSON est invalide, autoriser l'envoi (comportement par défaut)
          console.error('Erreur lors du parsing des groupes autorisés:', parseError);
        }
      }
      // Si groupes_messages_autorises est NULL, tous les utilisateurs sont autorisés
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    const result = await query(
      `INSERT INTO chats (expediteur, destination, message, date_modif, lu)
       VALUES (?, ?, ?, ?, 0)`,
      [req.user.id, destination, message, now]
    );

    res.status(201).json({
      success: true,
      message: 'Message envoyé',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message'
    });
  }
});

module.exports = router;

