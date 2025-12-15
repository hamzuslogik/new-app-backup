const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// Route publique pour vérifier la santé de l'API
router.get('/health', async (req, res) => {
  try {
    // Test de connexion à la base de données
    await queryOne('SELECT 1 as test');
    
    res.json({
      success: true,
      status: 'OK',
      message: 'API is running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Route pour vérifier l'existence des tables (nécessite authentification)
router.get('/tables', authenticate, async (req, res) => {
  try {
    const requiredTables = [
      'utilisateurs',
      'fonctions',
      'centres',
      'fiches',
      'etats',
      'chats',
      'user_activity',
      'permissions',
      'fonction_permissions',
      'compte_rendu'
    ];

    const tableStatus = [];

    for (const tableName of requiredTables) {
      const exists = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = SCHEMA() 
         AND table_name = ?`,
        [tableName]
      );

      tableStatus.push({
        table: tableName,
        exists: exists.count > 0,
        status: exists.count > 0 ? 'OK' : 'MISSING'
      });
    }

    // Vérifier les colonnes importantes de chats
    const chatsColumns = await query(
      `SELECT column_name 
       FROM information_schema.columns
       WHERE table_schema = DATABASE() 
       AND table_name = 'chats'
       AND column_name IN ('id', 'expediteur', 'destination', 'message', 'lu', 'date_modif')`
    );
    const requiredChatsColumns = ['id', 'expediteur', 'destination', 'message', 'lu', 'date_modif'];
    const existingChatsColumns = chatsColumns.map(c => c.column_name);
    const missingChatsColumns = requiredChatsColumns.filter(col => !existingChatsColumns.includes(col));

    // Vérifier les colonnes importantes de user_activity
    const userActivityColumns = await query(
      `SELECT column_name 
       FROM information_schema.columns
       WHERE table_schema = DATABASE() 
       AND table_name = 'user_activity'
       AND column_name IN ('id', 'user_id', 'last_activity')`
    );
    const requiredUserActivityColumns = ['id', 'user_id', 'last_activity'];
    const existingUserActivityColumns = userActivityColumns.map(c => c.column_name);
    const missingUserActivityColumns = requiredUserActivityColumns.filter(col => !existingUserActivityColumns.includes(col));

    // Créer les tables manquantes si nécessaire
    const missingTables = tableStatus.filter(t => !t.exists).map(t => t.table);
    
    if (missingTables.includes('user_activity')) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS user_activity (
            id INT(11) NOT NULL AUTO_INCREMENT,
            user_id INT(11) NOT NULL,
            last_activity DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_user (user_id),
            KEY idx_last_activity (last_activity)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        // Mettre à jour le statut
        const index = tableStatus.findIndex(t => t.table === 'user_activity');
        if (index !== -1) {
          tableStatus[index].exists = true;
          tableStatus[index].status = 'CREATED';
        }
      } catch (error) {
        console.error('Erreur lors de la création de user_activity:', error);
      }
    }

    if (missingTables.includes('chats')) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS chats (
            id INT(11) NOT NULL AUTO_INCREMENT,
            expediteur INT(11) DEFAULT NULL,
            destination INT(11) DEFAULT NULL,
            message TEXT CHARACTER SET utf8 DEFAULT NULL,
            lu INT(11) DEFAULT 0,
            date_modif DATETIME DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_expediteur (expediteur),
            KEY idx_destination (destination),
            KEY idx_lu (lu),
            KEY idx_date_modif (date_modif)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1
        `);
        // Mettre à jour le statut
        const index = tableStatus.findIndex(t => t.table === 'chats');
        if (index !== -1) {
          tableStatus[index].exists = true;
          tableStatus[index].status = 'CREATED';
        }
      } catch (error) {
        console.error('Erreur lors de la création de chats:', error);
      }
    }

    const allTablesExist = tableStatus.every(t => t.exists);
    const hasMissingColumns = missingChatsColumns.length > 0 || missingUserActivityColumns.length > 0;

    res.json({
      success: allTablesExist && !hasMissingColumns,
      tables: tableStatus,
      columns: {
        chats: {
          existing: existingChatsColumns,
          missing: missingChatsColumns
        },
        user_activity: {
          existing: existingUserActivityColumns,
          missing: missingUserActivityColumns
        }
      },
      summary: {
        total: requiredTables.length,
        existing: tableStatus.filter(t => t.exists).length,
        missing: tableStatus.filter(t => !t.exists).length,
        created: tableStatus.filter(t => t.status === 'CREATED').length
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification des tables:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des tables',
      error: error.message
    });
  }
});

module.exports = router;

