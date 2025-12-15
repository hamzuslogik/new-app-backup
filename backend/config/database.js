const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Configuration de la connexion à la base de données
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// Créer le pool de connexions
const pool = mysql.createPool(dbConfig);

// Tester la connexion
pool.getConnection()
  .then(connection => {
    console.log('✅ Connexion à la base de données MySQL réussie');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
    process.exit(1);
  });

// Fonction helper pour exécuter des requêtes
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Erreur SQL:', error);
    throw error;
  }
};

// Fonction helper pour obtenir une seule ligne
const queryOne = async (sql, params = []) => {
  const results = await query(sql, params);
  return results[0] || null;
};

// Fonction helper pour transactions
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Fonction helper pour obtenir une connexion
const getConnection = async () => {
  return await pool.getConnection();
};

module.exports = {
  pool,
  query,
  queryOne,
  transaction,
  getConnection
};

