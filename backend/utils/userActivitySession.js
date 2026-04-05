const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

let userActivityTableEnsured = false;

async function ensureUserActivityTable() {
  if (userActivityTableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id INT(11) NOT NULL AUTO_INCREMENT,
      user_id INT(11) NOT NULL,
      last_activity DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user (user_id),
      KEY idx_last_activity (last_activity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  userActivityTableEnsured = true;
}

/**
 * Durée d'inactivité max = même chaîne que session JWT (jsonwebtoken expiresIn).
 * @returns {number} millisecondes
 */
function sessionLifetimeToIdleMs(sessionLifetime) {
  const s = String(sessionLifetime || '').trim();
  if (!s) return 24 * 60 * 60 * 1000;
  try {
    const secret = process.env.JWT_SECRET || 'idle-parse-secret';
    const token = jwt.sign({ sub: 'idle' }, secret, { expiresIn: s });
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp != null && decoded.iat != null) {
      return (decoded.exp - decoded.iat) * 1000;
    }
  } catch (e) {
    console.warn('[session-idle] durée invalide, fallback 24h:', s, e.message);
  }
  return 24 * 60 * 60 * 1000;
}

/**
 * Met à jour last_activity (appelé après connexion et à chaque requête authentifiée).
 */
async function touchUserActivity(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return;
  await ensureUserActivityTable();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await query(
    `INSERT INTO user_activity (user_id, last_activity)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_activity = ?`,
    [id, now, now]
  );
}

module.exports = {
  ensureUserActivityTable,
  sessionLifetimeToIdleMs,
  touchUserActivity
};
