const { queryOne } = require('../config/database');

/**
 * Middleware pour vérifier une permission spécifique
 * @param {string} permissionCode - Code de la permission à vérifier
 * @returns {Function} Middleware Express
 */
const checkPermissionCode = (permissionCode) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié'
        });
      }

      const fonctionId = req.user.fonction;

      // Récupérer la permission
      const permission = await queryOne(
        'SELECT id FROM permissions WHERE code = ? AND etat = 1',
        [permissionCode]
      );

      if (!permission) {
        // Si la permission n'existe pas, autoriser par défaut (pour rétrocompatibilité)
        return next();
      }

      // Vérifier si la fonction a cette permission
      const fonctionPermission = await queryOne(
        `SELECT autorise FROM fonction_permissions 
         WHERE id_fonction = ? AND id_permission = ?`,
        [fonctionId, permission.id]
      );

      // Si aucune entrée n'existe, la permission est autorisée par défaut
      const hasPermission = fonctionPermission 
        ? fonctionPermission.autorise === 1 
        : true;

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Accès refusé. Permission requise: ${permissionCode}`
        });
      }

      next();
    } catch (error) {
      console.error('Erreur lors de la vérification de la permission:', error);
      // En cas d'erreur, autoriser par défaut pour ne pas bloquer l'application
      next();
    }
  };
};

/**
 * Helper pour vérifier une permission dans le code
 * @param {number} fonctionId - ID de la fonction
 * @param {string} permissionCode - Code de la permission
 * @returns {Promise<boolean>} True si autorisé, false sinon
 */
const hasPermission = async (fonctionId, permissionCode) => {
  try {
    const permission = await queryOne(
      'SELECT id FROM permissions WHERE code = ? AND etat = 1',
      [permissionCode]
    );

    if (!permission) {
      return true; // Permission non trouvée = autorisé par défaut
    }

    const fonctionPermission = await queryOne(
      `SELECT autorise FROM fonction_permissions 
       WHERE id_fonction = ? AND id_permission = ?`,
      [fonctionId, permission.id]
    );

    return fonctionPermission ? fonctionPermission.autorise === 1 : true;
  } catch (error) {
    console.error('Erreur lors de la vérification de la permission:', error);
    return true; // En cas d'erreur, autoriser par défaut
  }
};

module.exports = {
  checkPermissionCode,
  hasPermission
};

