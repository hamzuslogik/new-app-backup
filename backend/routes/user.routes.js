const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// Récupérer tous les utilisateurs actifs
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.pseudo, u.login, u.fonction, u.centre, u.photo, u.genre, u.etat,
       f.titre as fonction_titre, c.titre as centre_titre
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.etat > 0
       ORDER BY u.pseudo ASC`
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

// Récupérer un utilisateur par ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await queryOne(
      `SELECT u.*, f.titre as fonction_titre, c.titre as centre_titre
       FROM utilisateurs u
       LEFT JOIN fonctions f ON u.fonction = f.id
       LEFT JOIN centres c ON u.centre = c.id
       WHERE u.id = ?`,
      [id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const { mdp, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
});

// Récupérer les utilisateurs par fonction
router.get('/fonction/:fonctionId', authenticate, async (req, res) => {
  try {
    const { fonctionId } = req.params;
    const users = await query(
      `SELECT u.id, u.pseudo, u.photo, u.genre
       FROM utilisateurs u
       WHERE u.fonction = ? AND u.etat > 0
       ORDER BY u.pseudo ASC`,
      [fonctionId]
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

module.exports = router;

