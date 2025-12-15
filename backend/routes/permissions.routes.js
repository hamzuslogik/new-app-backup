const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTES POUR LA GESTION DES PERMISSIONS
// =====================================================

// GET /api/permissions
// Récupère toutes les permissions disponibles
router.get('/', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const permissions = await query(
      `SELECT * FROM permissions WHERE etat = 1 ORDER BY categorie, ordre ASC`
    );
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/permissions/fonction/:id_fonction
// Récupère les permissions d'une fonction spécifique
router.get('/fonction/:id_fonction', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id_fonction } = req.params;

    // Récupérer toutes les permissions avec leur statut pour cette fonction
    const permissions = await query(
      `SELECT 
        p.*,
        COALESCE(fp.autorise, 1) as autorise,
        fp.id as id_fonction_permission
      FROM permissions p
      LEFT JOIN fonction_permissions fp ON p.id = fp.id_permission AND fp.id_fonction = ?
      WHERE p.etat = 1
      ORDER BY p.categorie, p.ordre ASC`,
      [id_fonction]
    );

    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions de la fonction:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/permissions/fonction/:id_fonction
// Met à jour les permissions d'une fonction
router.post('/fonction/:id_fonction', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id_fonction } = req.params;
    const { permissions } = req.body; // Array de { id_permission, autorise }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Les permissions doivent être un tableau' 
      });
    }

    // Vérifier que la fonction existe
    const fonction = await queryOne('SELECT id FROM fonctions WHERE id = ?', [id_fonction]);
    if (!fonction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fonction non trouvée' 
      });
    }

      // Utiliser une transaction pour garantir la cohérence
      const { getConnection } = require('../config/database');
      const connection = await getConnection();
      await connection.beginTransaction();

      try {
        // Récupérer les anciennes permissions pour l'historique
        const oldPermissions = await query(
          'SELECT id_permission, autorise FROM fonction_permissions WHERE id_fonction = ?',
          [id_fonction]
        );
        const oldPermsMap = {};
        oldPermissions.forEach(p => {
          oldPermsMap[p.id_permission] = p.autorise;
        });

        // Supprimer toutes les permissions existantes pour cette fonction
        await connection.execute(
          'DELETE FROM fonction_permissions WHERE id_fonction = ?',
          [id_fonction]
        );

        // Insérer les nouvelles permissions et enregistrer l'historique
        for (const perm of permissions) {
          if (perm.id_permission && perm.autorise !== undefined) {
            const newAutorise = perm.autorise ? 1 : 0;
            const oldAutorise = oldPermsMap[perm.id_permission] !== undefined 
              ? oldPermsMap[perm.id_permission] 
              : null;

            // Insérer la nouvelle permission
            await connection.execute(
              `INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
               VALUES (?, ?, ?)`,
              [id_fonction, perm.id_permission, newAutorise]
            );

            // Enregistrer dans l'historique si changement
            if (oldAutorise !== newAutorise) {
              await connection.execute(
                `INSERT INTO permission_history 
                 (id_fonction, id_permission, ancien_etat, nouveau_etat, modified_by, modified_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [id_fonction, perm.id_permission, oldAutorise, newAutorise, req.user.id]
              );
            }
          }
        }

        await connection.commit();

      res.json({ 
        success: true, 
        message: 'Permissions mises à jour avec succès' 
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des permissions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/permissions/check/:code
// Vérifie si l'utilisateur actuel a une permission spécifique
router.get('/check/:code', authenticate, async (req, res) => {
  try {
    const { code } = req.params;
    const { user_id } = req.query; // Optionnel: pour tester un autre utilisateur
    const userId = user_id ? parseInt(user_id) : req.user.id;
    const fonctionId = user_id 
      ? (await queryOne('SELECT fonction FROM utilisateurs WHERE id = ?', [userId]))?.fonction
      : req.user.fonction;

    // Récupérer la permission
    const permission = await queryOne(
      'SELECT id FROM permissions WHERE code = ? AND etat = 1',
      [code]
    );

    if (!permission) {
      return res.json({ success: true, hasPermission: false, reason: 'Permission non trouvée' });
    }

    if (!fonctionId) {
      return res.json({ 
        success: true, 
        hasPermission: false, 
        reason: 'Fonction non trouvée pour cet utilisateur' 
      });
    }

    // Vérifier si la fonction a cette permission
    const fonctionPermission = await queryOne(
      `SELECT autorise FROM fonction_permissions 
       WHERE id_fonction = ? AND id_permission = ?`,
      [fonctionId, permission.id]
    );

    // Si aucune entrée n'existe, la permission est autorisée par défaut (pour rétrocompatibilité)
    const hasPermission = fonctionPermission 
      ? fonctionPermission.autorise === 1 
      : true;

    res.json({ 
      success: true, 
      hasPermission,
      reason: hasPermission 
        ? 'Permission accordée par la fonction' 
        : 'Permission refusée par la fonction',
      permission: {
        code,
        id: permission.id
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification de la permission:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/permissions/user
// Récupère toutes les permissions de l'utilisateur actuel
router.get('/user', authenticate, async (req, res) => {
  try {
    const fonctionId = req.user.fonction;

    // Récupérer toutes les permissions avec leur statut pour cette fonction
    const permissions = await query(
      `SELECT 
        p.code,
        p.nom,
        p.categorie,
        COALESCE(fp.autorise, 1) as autorise
      FROM permissions p
      LEFT JOIN fonction_permissions fp ON p.id = fp.id_permission AND fp.id_fonction = ?
      WHERE p.etat = 1
      ORDER BY p.categorie, p.ordre ASC`,
      [fonctionId]
    );

    // Transformer en objet pour faciliter l'utilisation côté frontend
    const permissionsMap = {};
    permissions.forEach(perm => {
      permissionsMap[perm.code] = perm.autorise === 1;
    });

    res.json({ 
      success: true, 
      data: permissionsMap,
      permissions: permissions
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =====================================================
// TEMPLATES DE PERMISSIONS
// =====================================================

// GET /api/permissions/templates
// Récupère tous les templates de permissions
router.get('/templates', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const templates = await query(
      `SELECT pt.*, u.pseudo as created_by_name
       FROM permission_templates pt
       LEFT JOIN utilisateurs u ON pt.created_by = u.id
       ORDER BY pt.created_at DESC`
    );
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Erreur lors de la récupération des templates:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/permissions/templates/:id
// Récupère un template spécifique avec ses permissions
router.get('/templates/:id', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await queryOne(
      `SELECT pt.*, u.pseudo as created_by_name
       FROM permission_templates pt
       LEFT JOIN utilisateurs u ON pt.created_by = u.id
       WHERE pt.id = ?`,
      [id]
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template non trouvé' });
    }

    const templatePermissions = await query(
      `SELECT ptp.id_permission, ptp.autorise, p.nom, p.code, p.categorie
       FROM permission_template_permissions ptp
       JOIN permissions p ON ptp.id_permission = p.id
       WHERE ptp.id_template = ?`,
      [id]
    );

    res.json({ 
      success: true, 
      data: {
        ...template,
        permissions: templatePermissions
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du template:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/permissions/templates
// Crée un nouveau template de permissions
router.post('/templates', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { nom, description, permissions } = req.body;

    if (!nom || !Array.isArray(permissions)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom et permissions requis' 
      });
    }

    const { getConnection } = require('../config/database');
    const connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Créer le template
      const result = await connection.execute(
        `INSERT INTO permission_templates (nom, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [nom, description || null, req.user.id]
      );

      const templateId = result[0].insertId;

      // Insérer les permissions du template
      for (const perm of permissions) {
        if (perm.id_permission && perm.autorise !== undefined) {
          await connection.execute(
            `INSERT INTO permission_template_permissions (id_template, id_permission, autorise)
             VALUES (?, ?, ?)`,
            [templateId, perm.id_permission, perm.autorise ? 1 : 0]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: 'Template créé avec succès', data: { id: templateId } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur lors de la création du template:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/permissions/templates/:id/apply
// Applique un template à une fonction
router.post('/templates/:id/apply', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id } = req.params;
    const { id_fonction } = req.body;

    if (!id_fonction) {
      return res.status(400).json({ success: false, message: 'id_fonction requis' });
    }

    // Récupérer le template
    const template = await queryOne('SELECT id FROM permission_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template non trouvé' });
    }

    // Récupérer les permissions du template
    const templatePermissions = await query(
      'SELECT id_permission, autorise FROM permission_template_permissions WHERE id_template = ?',
      [id]
    );

    // Appliquer le template (utiliser la route de mise à jour existante)
    const permissionsArray = templatePermissions.map(tp => ({
      id_permission: tp.id_permission,
      autorise: tp.autorise === 1
    }));

    // Utiliser la logique de mise à jour existante
    const { getConnection } = require('../config/database');
    const connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Récupérer les anciennes permissions pour l'historique
      const oldPermissions = await query(
        'SELECT id_permission, autorise FROM fonction_permissions WHERE id_fonction = ?',
        [id_fonction]
      );
      const oldPermsMap = {};
      oldPermissions.forEach(p => {
        oldPermsMap[p.id_permission] = p.autorise;
      });

      // Supprimer toutes les permissions existantes
      await connection.execute(
        'DELETE FROM fonction_permissions WHERE id_fonction = ?',
        [id_fonction]
      );

      // Insérer les nouvelles permissions
      for (const perm of permissionsArray) {
        const newAutorise = perm.autorise ? 1 : 0;
        const oldAutorise = oldPermsMap[perm.id_permission] !== undefined 
          ? oldPermsMap[perm.id_permission] 
          : null;

        await connection.execute(
          `INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
           VALUES (?, ?, ?)`,
          [id_fonction, perm.id_permission, newAutorise]
        );

        // Enregistrer dans l'historique si changement
        if (oldAutorise !== newAutorise) {
          await connection.execute(
            `INSERT INTO permission_history 
             (id_fonction, id_permission, ancien_etat, nouveau_etat, modified_by, modified_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [id_fonction, perm.id_permission, oldAutorise, newAutorise, req.user.id]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: 'Template appliqué avec succès' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur lors de l\'application du template:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/permissions/templates/:id
// Supprime un template
router.delete('/templates/:id', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM permission_templates WHERE id = ?', [id]);
    res.json({ success: true, message: 'Template supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du template:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =====================================================
// HISTORIQUE DES MODIFICATIONS
// =====================================================

// GET /api/permissions/history/:id_fonction
// Récupère l'historique des modifications pour une fonction
router.get('/history/:id_fonction', authenticate, checkPermission(1, 7), async (req, res) => {
  try {
    const { id_fonction } = req.params;
    const { limit = 50 } = req.query;

    const history = await query(
      `SELECT 
        ph.*,
        p.nom as permission_nom,
        p.code as permission_code,
        p.categorie as permission_categorie,
        u.pseudo as modified_by_name
       FROM permission_history ph
       JOIN permissions p ON ph.id_permission = p.id
       LEFT JOIN utilisateurs u ON ph.modified_by = u.id
       WHERE ph.id_fonction = ?
       ORDER BY ph.modified_at DESC
       LIMIT ?`,
      [id_fonction, parseInt(limit)]
    );

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;

