#!/usr/bin/env node
/**
 * Script pour générer un token JWT permanent pour l'API
 * Usage: node generate-permanent-token.js [userId] [pseudo]
 * 
 * Si userId ou pseudo n'est pas fourni, le script demandera l'ID ou le pseudo de l'utilisateur.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

async function generatePermanentToken(userIdOrPseudo) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ ERREUR: JWT_SECRET n\'est pas défini dans le fichier .env');
      process.exit(1);
    }

    let user;

    // Si un argument est fourni, essayer de trouver l'utilisateur par ID ou pseudo
    if (userIdOrPseudo) {
      const isNumeric = /^\d+$/.test(userIdOrPseudo);
      
      if (isNumeric) {
        // Recherche par ID
        user = await queryOne(
          `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat, 
           c.titre as centre_titre, c.etat as centre_etat
           FROM utilisateurs u
           LEFT JOIN fonctions f ON u.fonction = f.id
           LEFT JOIN centres c ON u.centre = c.id
           WHERE u.id = ? AND u.etat > 0`,
          [parseInt(userIdOrPseudo)]
        );
      } else {
        // Recherche par pseudo
        user = await queryOne(
          `SELECT u.*, f.titre as fonction_titre, f.etat as fonction_etat, 
           c.titre as centre_titre, c.etat as centre_etat
           FROM utilisateurs u
           LEFT JOIN fonctions f ON u.fonction = f.id
           LEFT JOIN centres c ON u.centre = c.id
           WHERE LOWER(TRIM(u.pseudo)) = LOWER(TRIM(?)) AND u.etat > 0`,
          [userIdOrPseudo]
        );
      }
    }

    if (!user) {
      console.error('❌ ERREUR: Utilisateur non trouvé ou inactif');
      if (userIdOrPseudo) {
        console.log(`   Tentative de recherche: ${userIdOrPseudo}`);
      }
      process.exit(1);
    }

    // Vérifier que la fonction et le centre sont actifs
    if (user.fonction_etat === 0 || user.centre_etat === 0) {
      console.error('❌ ERREUR: La fonction ou le centre de l\'utilisateur est désactivé');
      process.exit(1);
    }

    // Générer un token permanent (sans expiration)
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET
      // Pas d'option expiresIn = token permanent
    );

    console.log('\n✅ Token permanent généré avec succès!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Informations utilisateur:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Login: ${user.login}`);
    console.log(`   Pseudo: ${user.pseudo}`);
    console.log(`   Fonction: ${user.fonction_titre} (ID: ${user.fonction})`);
    console.log(`   Centre: ${user.centre_titre || 'N/A'} (ID: ${user.centre || 'N/A'})`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔑 TOKEN PERMANENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  ATTENTION: Ce token ne expire JAMAIS.');
    console.log('   - Conservez-le en sécurité');
    console.log('   - Ne le partagez pas publiquement');
    console.log('   - Utilisez-le uniquement pour les intégrations API');
    console.log('\n📝 Pour l\'utiliser dans vos requêtes API:');
    console.log(`   Authorization: Bearer ${token.substring(0, 50)}...`);
    console.log('\n');

    return token;
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    process.exit(1);
  }
}

// Point d'entrée du script
const userIdOrPseudo = process.argv[2];

if (userIdOrPseudo) {
  generatePermanentToken(userIdOrPseudo)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ ERREUR:', error);
      process.exit(1);
    });
} else {
  console.log('📝 Usage: node generate-permanent-token.js [userId|pseudo]');
  console.log('\n   Exemples:');
  console.log('   node generate-permanent-token.js 123');
  console.log('   node generate-permanent-token.js USERNAME');
  console.log('\n   Si aucun argument n\'est fourni, le script affichera cette aide.\n');
  process.exit(0);
}

