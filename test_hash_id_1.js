/**
 * Script de test pour vérifier le hash généré pour l'ID = 1
 * Compare avec le résultat du script SQL
 * 
 * Usage: node test_hash_id_1.js
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

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm',
  charset: 'utf8mb4',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
};

// Clé secrète (identique à celle dans l'application)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

console.log('\n🔑 HASH_SECRET utilisé:', HASH_SECRET.substring(0, 20) + '...');

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

async function testHashId1() {
  let connection;
  
  try {
    console.log('\n🔌 Connexion à la base de données...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connexion réussie\n');

    const testId = 1;
    
    // Calculer le hash avec la fonction JavaScript
    const calculatedHash = encodeFicheId(testId);
    console.log('📊 RÉSULTAT DU SCRIPT JAVASCRIPT:');
    console.log('   ID:', testId);
    console.log('   Hash calculé:', calculatedHash);
    console.log('   Longueur:', calculatedHash ? calculatedHash.length : 0);
    
    // Récupérer le hash actuel dans la base de données
    const [rows] = await connection.execute(
      'SELECT id, hash FROM fiches WHERE id = ?',
      [testId]
    );
    
    if (rows.length === 0) {
      console.log('\n⚠️  Aucune fiche trouvée avec l\'ID =', testId);
      return;
    }
    
    const fiche = rows[0];
    console.log('\n📊 RÉSULTAT DANS LA BASE DE DONNÉES:');
    console.log('   ID:', fiche.id);
    console.log('   Hash actuel:', fiche.hash || '(NULL)');
    console.log('   Longueur:', fiche.hash ? fiche.hash.length : 0);
    
    // Comparer les résultats
    console.log('\n🔍 COMPARAISON:');
    if (fiche.hash === calculatedHash) {
      console.log('   ✅ Les hash sont IDENTIQUES !');
    } else {
      console.log('   ❌ Les hash sont DIFFÉRENTS !');
      console.log('   Hash calculé (JS):', calculatedHash);
      console.log('   Hash en DB:       ', fiche.hash);
      
      // Afficher les différences caractère par caractère
      if (fiche.hash && calculatedHash) {
        const minLen = Math.min(fiche.hash.length, calculatedHash.length);
        let diffCount = 0;
        for (let i = 0; i < minLen; i++) {
          if (fiche.hash[i] !== calculatedHash[i]) {
            diffCount++;
            if (diffCount <= 5) {
              console.log(`   Différence à la position ${i}: DB='${fiche.hash[i]}' vs JS='${calculatedHash[i]}'`);
            }
          }
        }
        if (diffCount > 5) {
          console.log(`   ... et ${diffCount - 5} autres différences`);
        }
        if (fiche.hash.length !== calculatedHash.length) {
          console.log(`   Longueurs différentes: DB=${fiche.hash.length}, JS=${calculatedHash.length}`);
        }
      }
    }
    
    // Détails du hash calculé
    console.log('\n🔬 DÉTAILS DU HASH CALCULÉ:');
    const hmac = crypto.createHmac('sha256', HASH_SECRET);
    hmac.update(String(testId));
    const fullHash = hmac.digest('hex');
    const encodedId = Buffer.from(String(testId)).toString('base64').replace(/[+/=]/g, (m) => {
      return { '+': '-', '/': '_', '=': '' }[m];
    });
    console.log('   HMAC complet (64 chars):', fullHash);
    console.log('   HMAC tronqué (16 chars):', fullHash.substring(0, 16));
    console.log('   ID encodé base64:', Buffer.from(String(testId)).toString('base64'));
    console.log('   ID encodé URL-safe:', encodedId);
    console.log('   Hash final:', `${fullHash.substring(0, 16)}${encodedId}`);

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

// Exécuter le test
testHashId1()
  .then(() => {
    console.log('\n✨ Test terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

