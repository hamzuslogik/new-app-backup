const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { authenticate, checkPermission } = require('../middleware/auth.middleware');

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

    // Récupérer l'utilisateur avec ses relations
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat,
       c.titre as centre_titre, c.etat as centre_etat
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.login = ?`,
      [login]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Vérifier le mot de passe (hashé avec SHA-256)
    const hashedPassword = hashPassword(password);
    const isPasswordValid = user.mdp === hashedPassword;

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Vérifier que l'utilisateur, sa fonction et son centre sont actifs
    if (user.etat === 0 || user.fonction_etat === 0 || user.centre_etat === 0) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte, fonction ou centre est désactivé'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Retourner les informations utilisateur (sans le mot de passe)
    const { mdp, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
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

