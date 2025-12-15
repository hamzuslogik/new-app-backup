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

require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const readline = require('readline');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};

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
    connection = await mysql.createConnection(dbConfig);
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
    console.error('❌ Erreur:', error);
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

