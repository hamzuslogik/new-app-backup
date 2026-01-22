/**
 * Script Node.js pour mettre à jour le champ hash des fiches existantes
 * Utilise exactement la même fonction encodeFicheId que l'application
 * 
 * Usage: node update_existing_fiches_hash.js
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
  // Options pour améliorer les performances
  multipleStatements: false,
  connectionLimit: 1
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

    // Mettre à jour les fiches par lots (batch) pour améliorer les performances
    console.log('🔄 Calcul des hash et préparation des mises à jour...');
    
    // Préparer tous les hash en mémoire
    const updates = fiches.map(fiche => ({
      id: fiche.id,
      hash: encodeFicheId(fiche.id)
    }));
    
    console.log('💾 Mise à jour par lots (optimisé)...');
    
    // Mettre à jour par lots de 500 pour optimiser les performances
    // (1000 peut être trop pour certains serveurs MySQL)
    const batchSize = 500;
    let updated = 0;
    let errors = 0;
    
    // Démarrer une transaction pour améliorer les performances
    await connection.beginTransaction();
    
    try {
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Construire une requête UPDATE multiple avec CASE WHEN pour mettre à jour plusieurs lignes en une seule requête
        // Format: UPDATE fiches SET hash = CASE id WHEN ? THEN ? WHEN ? THEN ? ... END WHERE id IN (?, ?, ...)
        const whenClauses = [];
        const ids = [];
        const params = [];
        
        for (const update of batch) {
          whenClauses.push('WHEN ? THEN ?');
          ids.push(update.id);
          params.push(update.id, update.hash);
        }
        
        // Ajouter les IDs à la fin pour la clause WHERE
        params.push(...ids);
        
        const updateQuery = `
          UPDATE fiches 
          SET hash = CASE id 
            ${whenClauses.join(' ')}
          END 
          WHERE id IN (${ids.map(() => '?').join(',')})
        `;
        
        await connection.execute(updateQuery, params);
        
        updated += batch.length;
        
        // Afficher la progression
        if (updated % 1000 === 0 || updated === updates.length) {
          console.log(`⏳ Progression: ${updated}/${updates.length} fiches mises à jour...`);
        }
      }
      
      // Valider la transaction
      await connection.commit();
      console.log('✅ Transaction validée');
      
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await connection.rollback();
      console.error('❌ Erreur lors de la mise à jour par lots:', error.message);
      throw error;
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

