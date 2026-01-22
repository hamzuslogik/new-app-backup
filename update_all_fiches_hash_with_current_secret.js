/**
 * Script Node.js pour mettre à jour TOUS les hash des fiches avec le HASH_SECRET actuel
 * 
 * Ce script :
 * 1. Récupère toutes les fiches existantes
 * 2. Régénère leur hash avec le HASH_SECRET actuel
 * 3. Met à jour la base de données
 * 
 * Usage: node update_all_fiches_hash_with_current_secret.js
 * 
 * ⚠️ ATTENTION : Ce script va modifier TOUS les hashes existants.
 * Assurez-vous que le HASH_SECRET dans le fichier .env est le bon avant d'exécuter ce script.
 */

const path = require('path');
const fs = require('fs');

// Chercher le fichier .env dans le répertoire courant ou dans backend/
let envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, 'backend', '.env');
}
if (!fs.existsSync(envPath)) {
  console.warn('⚠️  Fichier .env non trouvé. Utilisation des variables d\'environnement système.');
} else {
  require('dotenv').config({ path: envPath });
  console.log(`✅ Fichier .env chargé depuis: ${envPath}`);
}

const crypto = require('crypto');
const mysql = require('mysql2/promise');
const readline = require('readline');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm',
  charset: 'utf8mb4',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
};

// Afficher la configuration (masquée pour sécurité)
console.log('📋 Configuration de la base de données:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   Password: ${dbConfig.password ? '***' : '(vide)'}`);

// Clé secrète actuelle (identique à celle dans l'application)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

// Fonction pour encoder un ID en hash (identique à celle dans fiche.routes.js)
const encodeFicheId = (id) => {
  if (!id) return null;
  // Créer un hash HMAC basé sur l'ID et le secret
  const hmac = crypto.createHmac('sha256', HASH_SECRET);
  hmac.update(String(id));
  const hash = hmac.digest('hex');
  // Encoder en base64 URL-safe et ajouter l'ID encodé pour pouvoir le décoder
  const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m];
  });
  // Combiner le hash et l'ID encodé
  return `${hash.substring(0, 16)}${encodedId}`;
};

// Fonction pour demander confirmation à l'utilisateur
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function updateAllFichesHash() {
  let connection;
  
  try {
    console.log('🔌 Connexion à la base de données...');
    console.log(`   Tentative de connexion à ${dbConfig.host}:${dbConfig.port}...`);
    
    // Test de connexion avec timeout
    connection = await mysql.createConnection({
      ...dbConfig,
      connectTimeout: 10000 // 10 secondes
    });
    
    console.log('✅ Connexion réussie');

    // Afficher le HASH_SECRET utilisé (masqué pour la sécurité)
    const secretPreview = HASH_SECRET.length > 10 
      ? HASH_SECRET.substring(0, 6) + '...' + HASH_SECRET.substring(HASH_SECRET.length - 4)
      : '***';
    console.log(`\n🔑 HASH_SECRET utilisé: ${secretPreview}`);
    console.log(`   (Longueur: ${HASH_SECRET.length} caractères)\n`);

    // Récupérer toutes les fiches
    console.log('📋 Récupération de toutes les fiches...');
    const [fiches] = await connection.execute(
      'SELECT id, hash FROM fiches ORDER BY id'
    );
    
    console.log(`📊 Total de fiches trouvées: ${fiches.length}`);

    if (fiches.length === 0) {
      console.log('✅ Aucune fiche à mettre à jour');
      return;
    }

    // Vérifier combien de fiches ont des hash différents
    let fichesAvecHashDifferent = 0;
    let fichesSansHash = 0;
    let fichesAvecHashIdentique = 0;

    console.log('\n🔍 Analyse des hashes existants...');
    for (const fiche of fiches) {
      const nouveauHash = encodeFicheId(fiche.id);
      if (!fiche.hash || fiche.hash === '') {
        fichesSansHash++;
      } else if (fiche.hash !== nouveauHash) {
        fichesAvecHashDifferent++;
      } else {
        fichesAvecHashIdentique++;
      }
    }

    console.log(`   - Fiches sans hash: ${fichesSansHash}`);
    console.log(`   - Fiches avec hash différent: ${fichesAvecHashDifferent}`);
    console.log(`   - Fiches avec hash identique: ${fichesAvecHashIdentique}`);
    console.log(`   - Total à mettre à jour: ${fichesSansHash + fichesAvecHashDifferent}`);

    if (fichesAvecHashDifferent === 0 && fichesSansHash === 0) {
      console.log('\n✅ Tous les hashes sont déjà à jour avec le HASH_SECRET actuel!');
      return;
    }

    // Demander confirmation
    console.log('\n⚠️  ATTENTION: Ce script va modifier les hashes de toutes les fiches.');
    console.log(`   ${fichesSansHash + fichesAvecHashDifferent} fiche(s) seront mises à jour.`);
    const confirmed = await askConfirmation('\nVoulez-vous continuer? (oui/non): ');

    if (!confirmed) {
      console.log('\n❌ Opération annulée par l\'utilisateur');
      return;
    }

    // Mettre à jour toutes les fiches
    console.log('\n🔄 Mise à jour des hashes...\n');
    let updated = 0;
    let errors = 0;
    let unchanged = 0;

    for (const fiche of fiches) {
      try {
        const nouveauHash = encodeFicheId(fiche.id);
        
        // Ne mettre à jour que si le hash est différent ou absent
        if (!fiche.hash || fiche.hash === '' || fiche.hash !== nouveauHash) {
          await connection.execute(
            'UPDATE fiches SET hash = ? WHERE id = ?',
            [nouveauHash, fiche.id]
          );
          updated++;
          
          // Afficher la progression tous les 100 enregistrements
          if (updated % 100 === 0) {
            console.log(`⏳ Progression: ${updated} fiches mises à jour...`);
          }
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour la fiche ID ${fiche.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n✅ Mise à jour terminée!');
    console.log(`   - Fiches mises à jour: ${updated}`);
    console.log(`   - Fiches inchangées: ${unchanged}`);
    console.log(`   - Erreurs: ${errors}`);

    // Vérifier le résultat
    const [stats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_fiches,
        COUNT(hash) as fiches_avec_hash,
        COUNT(*) - COUNT(hash) as fiches_sans_hash
      FROM fiches`
    );
    
    console.log('\n📊 Statistiques finales:');
    console.log(`   - Total fiches: ${stats[0].total_fiches}`);
    console.log(`   - Fiches avec hash: ${stats[0].fiches_avec_hash}`);
    console.log(`   - Fiches sans hash: ${stats[0].fiches_sans_hash}`);

    // Vérifier que tous les hash sont valides maintenant
    console.log('\n🔍 Vérification de la cohérence des hash...');
    let invalidHashes = 0;
    for (const fiche of fiches) {
      const expectedHash = encodeFicheId(fiche.id);
      const [updatedFiche] = await connection.execute(
        'SELECT hash FROM fiches WHERE id = ?',
        [fiche.id]
      );
      if (updatedFiche[0] && updatedFiche[0].hash !== expectedHash) {
        invalidHashes++;
      }
    }

    if (invalidHashes === 0) {
      console.log('✅ Tous les hash sont cohérents avec le HASH_SECRET actuel!');
    } else {
      console.warn(`⚠️  ${invalidHashes} hash(s) invalide(s) détecté(s)`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Suggestions pour résoudre l\'erreur de connexion:');
      console.error('   1. Vérifiez que MySQL/MariaDB est démarré:');
      console.error('      sudo systemctl status mysql');
      console.error('      ou');
      console.error('      sudo systemctl status mariadb');
      console.error('   2. Vérifiez les paramètres de connexion dans backend/.env:');
      console.error('      DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME');
      console.error('   3. Vérifiez que MySQL écoute sur le bon port:');
      console.error('      sudo netstat -tlnp | grep 3306');
      console.error('   4. Si MySQL est sur un autre serveur, vérifiez le firewall');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Erreur d\'authentification:');
      console.error('   Vérifiez DB_USER et DB_PASSWORD dans backend/.env');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Base de données introuvable:');
      console.error('   Vérifiez DB_NAME dans backend/.env');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

// Exécuter le script
updateAllFichesHash()
  .then(() => {
    console.log('\n✨ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

