const jwt = require('jsonwebtoken');
const { queryOne, query } = require('../config/database');
const { isClientIpAllowedForFonction } = require('../utils/ipAllowlist');

// Middleware d'authentification
const authenticate = async (req, res, next) => {
  try {
    // Récupérer le token depuis le header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant'
      });
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'utilisateur depuis la base de données
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat,
       f.ip_acces_tous AS fonction_ip_acces_tous,
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.id = ? AND u.etat > 0`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Vérifier que la fonction et le centre sont actifs
    if (user.fonction_etat === 0 || user.centre_etat === 0) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte, fonction ou centre est désactivé'
      });
    }

    const allowAllIp =
      user.fonction_ip_acces_tous == null || Number(user.fonction_ip_acces_tous) === 1;
    let ipRules = [];
    if (!allowAllIp && user.fonction != null) {
      ipRules = (
        await query('SELECT ip_rule FROM fonction_ips_autorisees WHERE id_fonction = ?', [
          user.fonction
        ])
      ).map((r) => r.ip_rule);
    }
    if (!isClientIpAllowedForFonction(allowAllIp ? 1 : 0, ipRules, req)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé depuis cette adresse IP pour votre fonction.'
      });
    }

    // Ajouter l'utilisateur à la requête
    req.user = {
      id: user.id,
      login: user.login,
      pseudo: user.pseudo,
      fonction: user.fonction,
      fonction_titre: user.fonction_titre,
      centre: user.centre,
      centre_titre: user.centre_titre,
      photo: user.photo,
      genre: user.genre
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
    }
    console.error('Erreur d\'authentification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

// Middleware pour vérifier les permissions par fonction
const checkPermission = (...allowedFunctions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!allowedFunctions.includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Permissions insuffisantes.'
      });
    }

    next();
  };
};

// Helper pour vérifier si l'utilisateur est admin, backoffice ou RP confirmation
// Admin : fonctions 1, 2, 7
// Backoffice : fonction 11
// RP Confirmation : fonction 13 (valeur officielle)
const isAdminOrBackofficeOrRPConfirmation = (fonction) => {
  return [1, 2, 7, 11, 13].includes(Number(fonction));
};

module.exports = {
  authenticate,
  checkPermission,
  isAdminOrBackofficeOrRPConfirmation
};

