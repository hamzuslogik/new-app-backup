const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const {
  isClientIpAllowedForFonction,
  getClientIp,
  normalizeClientIp
} = require('../utils/ipAllowlist');
const { logConnexionEchouee, RAISON } = require('../utils/logConnexionEchouee');
const { getSecuritySettings, countFailedLoginAttemptsForIp } = require('../utils/globalSettingsHelper');

// Fonction pour hasher un mot de passe avec SHA-256 (compatible avec SHA2 de MySQL)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login et mot de passe requis'
      });
    }

    const securitySettings = await getSecuritySettings();
    const clientIp = normalizeClientIp(getClientIp(req));
    if (securitySettings.failedLoginMaxBeforeIpBlock > 0 && clientIp) {
      const failCount = await countFailedLoginAttemptsForIp(
        clientIp,
        securitySettings.failedLoginWindowMinutes
      );
      if (failCount >= securitySettings.failedLoginMaxBeforeIpBlock) {
        return res.status(429).json({
          success: false,
          message:
            'Trop de tentatives de connexion depuis cette adresse. Veuillez patienter avant de réessayer.'
        });
      }
    }

    // Récupérer l'utilisateur avec ses relations
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat,
       f.ip_acces_tous AS fonction_ip_acces_tous,
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.login = ?`,
      [login]
    );

    if (!user) {
      await logConnexionEchouee({
        login,
        idUtilisateur: null,
        req,
        raison: RAISON.LOGIN_INCONNU
      });
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Vérifier le mot de passe (hashé avec SHA-256)
    const hashedPassword = hashPassword(password);
    const isPasswordValid = user.mdp === hashedPassword;

    if (!isPasswordValid) {
      await logConnexionEchouee({
        login,
        idUtilisateur: user.id,
        req,
        raison: RAISON.MOT_DE_PASSE_INCORRECT
      });
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Vérifier que l'utilisateur, sa fonction et son centre sont actifs
    if (user.etat === 0 || user.fonction_etat === 0 || user.centre_etat === 0) {
      await logConnexionEchouee({
        login,
        idUtilisateur: user.id,
        req,
        raison: RAISON.COMPTE_OU_FONCTION_CENTRE_DESACTIVE
      });
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
      await logConnexionEchouee({
        login,
        idUtilisateur: user.id,
        req,
        raison: RAISON.IP_NON_AUTORISEE
      });
      return res.status(403).json({
        success: false,
        message: 'Connexion non autorisée depuis cette adresse IP pour votre fonction.'
      });
    }

    let expiresIn = securitySettings.sessionLifetime;
    try {
      jwt.sign({ _check: 1 }, process.env.JWT_SECRET, { expiresIn });
    } catch {
      expiresIn = process.env.JWT_EXPIRE || '24h';
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn });

    // Retourner les informations utilisateur (sans le mot de passe)
    const { mdp, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      expiresIn,
      user: {
        id: user.id,
        login: user.login,
        pseudo: user.pseudo,
        fonction: user.fonction,
        fonction_titre: user.fonction_titre,
        centre: user.centre,
        centre_titre: user.centre_titre,
        photo: user.photo,
        genre: user.genre
      }
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
});

// Vérifier le token (pour vérifier si l'utilisateur est toujours connecté)
router.get('/verify', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Profil de l'utilisateur connecté (infos complètes sans mot de passe)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.login, u.pseudo, u.nom, u.prenom, u.mail, u.tel, u.fonction, u.centre, u.genre, u.photo, u.color,
       f.titre as fonction_titre, f.etat as fonction_etat,
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.id = ? AND u.etat > 0`,
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    if (user.fonction_etat === 0 || user.centre_etat === 0) {
      return res.status(403).json({
        success: false,
        message: 'Votre fonction ou centre est désactivé'
      });
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        login: user.login,
        pseudo: user.pseudo,
        nom: user.nom,
        prenom: user.prenom,
        mail: user.mail,
        tel: user.tel,
        fonction: user.fonction,
        fonction_titre: user.fonction_titre,
        centre: user.centre,
        centre_titre: user.centre_titre,
        genre: user.genre,
        photo: user.photo,
        color: user.color
      }
    });
  } catch (error) {
    console.error('Erreur GET /auth/me:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du profil' });
  }
});

// Changer le mot de passe (utilisateur connecté)
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }
    const user = await queryOne('SELECT id, mdp FROM utilisateurs WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    const currentHashed = hashPassword(currentPassword);
    if (user.mdp !== currentHashed) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }
    const newHashed = hashPassword(newPassword);
    await query('UPDATE utilisateurs SET mdp = ? WHERE id = ?', [newHashed, req.user.id]);
    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    console.error('Erreur POST /auth/change-password:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du changement de mot de passe' });
  }
});

// Déconnexion (côté client, mais on peut logger ici)
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// Générer un token permanent pour l'API (réservé aux administrateurs)
router.post('/generate-permanent-token', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Si userId n'est pas fourni, utiliser l'utilisateur connecté
    const targetUserId = userId || req.user.id;
    
    // Vérifier que l'utilisateur existe et est actif
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat, 
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.id = ? AND u.etat > 0`,
      [targetUserId]
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
        message: 'La fonction ou le centre de l\'utilisateur est désactivé'
      });
    }

    // Générer un token permanent (sans expiration)
    const token = jwt.sign(
      { userId: targetUserId },
      process.env.JWT_SECRET
      // Pas d'option expiresIn = token permanent
    );

    res.json({
      success: true,
      message: 'Token permanent généré avec succès',
      token,
      user: {
        id: user.id,
        login: user.login,
        pseudo: user.pseudo,
        fonction: user.fonction,
        fonction_titre: user.fonction_titre
      },
      warning: 'Ce token ne expire jamais. Conservez-le en sécurité et ne le partagez pas.'
    });
  } catch (error) {
    console.error('Erreur lors de la génération du token permanent:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du token'
    });
  }
});

module.exports = router;

