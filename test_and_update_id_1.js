/**
 * Script de test et mise à jour pour l'ID = 1
 * Utilise exactement la même fonction que l'application
 * 
 * Usage: node test_and_update_id_1.js
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
console.log('   Longueur:', HASH_SECRET.length);

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

async function testAndUpdateId1() {
  let connection;
  
  try {
    console.log('\n🔌 Connexion à la base de données...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connexion réussie\n');

    const testId = 1;
    
    // Récupérer l'état actuel
    const [rows] = await connection.execute(
      'SELECT id, hash FROM fiches WHERE id = ?',
      [testId]
    );
    
    if (rows.length === 0) {
      console.log('⚠️  Aucune fiche trouvée avec l\'ID =', testId);
      return;
    }
    
    const fiche = rows[0];
    console.log('📋 AVANT UPDATE:');
    console.log('   ID:', fiche.id);
    console.log('   Hash actuel:', fiche.hash || '(NULL)');
    console.log('   Longueur:', fiche.hash ? fiche.hash.length : 0);
    
    // Calculer le nouveau hash
    const calculatedHash = encodeFicheId(testId);
    console.log('\n📊 HASH CALCULÉ (JavaScript):');
    console.log('   Hash:', calculatedHash);
    console.log('   Longueur:', calculatedHash ? calculatedHash.length : 0);
    
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
    
    // Comparer avec le hash actuel
    if (fiche.hash === calculatedHash) {
      console.log('\n✅ Le hash est déjà correct, aucune mise à jour nécessaire');
      return;
    }
    
    console.log('\n🔄 Mise à jour du hash...');
    
    // Mettre à jour le hash
    const [updateResult] = await connection.execute(
      'UPDATE fiches SET hash = ? WHERE id = ?',
      [calculatedHash, testId]
    );
    
    console.log('   Lignes modifiées:', updateResult.affectedRows);
    
    // Vérifier le résultat
    const [updatedRows] = await connection.execute(
      'SELECT id, hash FROM fiches WHERE id = ?',
      [testId]
    );
    
    const updatedFiche = updatedRows[0];
    console.log('\n📋 APRÈS UPDATE:');
    console.log('   ID:', updatedFiche.id);
    console.log('   Hash:', updatedFiche.hash);
    console.log('   Longueur:', updatedFiche.hash ? updatedFiche.hash.length : 0);
    
    // Vérification finale
    console.log('\n✅ VÉRIFICATION FINALE:');
    if (updatedFiche.hash === calculatedHash) {
      console.log('   ✅ MISE À JOUR RÉUSSIE - Les hash correspondent');
    } else {
      console.log('   ❌ ERREUR - Les hash ne correspondent pas');
      console.log('   Hash calculé:', calculatedHash);
      console.log('   Hash en DB:  ', updatedFiche.hash);
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
testAndUpdateId1()
  .then(() => {
    console.log('\n✨ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });

