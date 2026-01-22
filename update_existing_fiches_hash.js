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
  connectionLimit: 1,
  // Optimisations pour les grandes tables
  supportBigNumbers: true,
  bigNumberStrings: true
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

    // Compter le nombre total de fiches sans hash
    console.log('📋 Comptage des fiches sans hash...');
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM fiches WHERE hash IS NULL OR hash = ""'
    );
    const totalFiches = countResult[0].total;
    
    console.log(`📊 ${totalFiches} fiches à mettre à jour`);

    if (totalFiches === 0) {
      console.log('✅ Toutes les fiches ont déjà un hash');
      return;
    }

    // Configuration optimisée pour grandes tables
    const chunkSize = 10000; // Traiter 10 000 fiches à la fois
    const batchSize = 2000; // Mettre à jour par lots de 2000 dans chaque transaction
    let totalUpdated = 0;
    let offset = 0;
    const startTime = Date.now();
    
    console.log('💾 Mise à jour optimisée (chunks de ' + chunkSize + ', batches de ' + batchSize + ')...');
    console.log('');
    
    // Traiter par chunks pour éviter de charger toutes les fiches en mémoire
    while (offset < totalFiches) {
      const chunkStartTime = Date.now();
      
      // Récupérer un chunk de fiches
      const [fiches] = await connection.execute(
        'SELECT id FROM fiches WHERE (hash IS NULL OR hash = "") ORDER BY id LIMIT ? OFFSET ?',
        [chunkSize, offset]
      );
      
      if (fiches.length === 0) {
        break;
      }
      
      // Préparer tous les hash pour ce chunk
      const updates = fiches.map(fiche => ({
        id: fiche.id,
        hash: encodeFicheId(fiche.id)
      }));
      
      // Traiter ce chunk par batches avec transactions séparées
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Démarrer une transaction pour ce batch
        await connection.beginTransaction();
        
        try {
          // Construire une requête UPDATE multiple avec CASE WHEN
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
          await connection.commit();
          
          totalUpdated += batch.length;
          
        } catch (error) {
          await connection.rollback();
          console.error(`❌ Erreur lors de la mise à jour du batch (offset ${offset + i}):`, error.message);
          // Continuer avec le batch suivant au lieu de tout arrêter
        }
      }
      
      const chunkTime = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const rate = (totalUpdated / (Date.now() - startTime) * 1000).toFixed(0);
      const remaining = totalFiches - totalUpdated;
      const estimatedTime = remaining > 0 ? ((remaining / rate) / 60).toFixed(1) : '0';
      
      console.log(`⏳ Progression: ${totalUpdated.toLocaleString()}/${totalFiches.toLocaleString()} (${((totalUpdated/totalFiches)*100).toFixed(1)}%) | ` +
                  `Vitesse: ${rate} lignes/sec | ` +
                  `Temps écoulé: ${elapsedTime}s | ` +
                  `Temps estimé restant: ${estimatedTime} min`);
      
      offset += chunkSize;
    }
    
    console.log('\n✅ Toutes les transactions validées');

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgRate = (totalUpdated / (Date.now() - startTime) * 1000).toFixed(0);
    
    console.log('\n✅ Mise à jour terminée!');
    console.log(`   - Fiches mises à jour: ${totalUpdated.toLocaleString()}`);
    console.log(`   - Temps total: ${totalTime}s (${(totalTime/60).toFixed(1)} min)`);
    console.log(`   - Vitesse moyenne: ${avgRate} lignes/sec`);

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

