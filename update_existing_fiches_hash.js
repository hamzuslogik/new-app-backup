/**
 * Script Node.js pour mettre à jour le champ hash des fiches existantes
 * Utilise exactement la même fonction encodeFicheId que l'application
 * 
 * Usage: node update_existing_fiches_hash.js
 */

require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};

// Clé secrète (identique à celle dans l'application)
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

async function updateFichesHash() {
  let connection;
  
  try {
    console.log('🔌 Connexion à la base de données...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connexion réussie');

    // Récupérer toutes les fiches sans hash
    console.log('📋 Récupération des fiches sans hash...');
    const [fiches] = await connection.execute(
      'SELECT id FROM fiches WHERE hash IS NULL OR hash = "" ORDER BY id'
    );
    
    console.log(`📊 ${fiches.length} fiches à mettre à jour`);

    if (fiches.length === 0) {
      console.log('✅ Toutes les fiches ont déjà un hash');
      return;
    }

    // Mettre à jour chaque fiche
    let updated = 0;
    let errors = 0;

    for (const fiche of fiches) {
      try {
        const hash = encodeFicheId(fiche.id);
        
        await connection.execute(
          'UPDATE fiches SET hash = ? WHERE id = ?',
          [hash, fiche.id]
        );
        
        updated++;
        
        // Afficher la progression tous les 100 enregistrements
        if (updated % 100 === 0) {
          console.log(`⏳ Progression: ${updated}/${fiches.length} fiches mises à jour...`);
        }
      } catch (error) {
        console.error(`❌ Erreur pour la fiche ID ${fiche.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n✅ Mise à jour terminée!');
    console.log(`   - Fiches mises à jour: ${updated}`);
    console.log(`   - Erreurs: ${errors}`);

    // Vérifier le résultat
    const [stats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_fiches,
        COUNT(hash) as fiches_avec_hash,
        COUNT(*) - COUNT(hash) as fiches_sans_hash
      FROM fiches`
    );
    
    console.log('\n📊 Statistiques:');
    console.log(`   - Total fiches: ${stats[0].total_fiches}`);
    console.log(`   - Fiches avec hash: ${stats[0].fiches_avec_hash}`);
    console.log(`   - Fiches sans hash: ${stats[0].fiches_sans_hash}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connexion fermée');
    }
  }
}

// Exécuter le script
updateFichesHash()
  .then(() => {
    console.log('\n✨ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

