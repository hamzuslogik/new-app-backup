const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');

let userActivityTableEnsured = false;
let userActivityColumnsEnsured = false;

const MAX_EVENTS = 100;

async function ensureUserActivityTable() {
  if (userActivityTableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id INT(11) NOT NULL AUTO_INCREMENT,
      user_id INT(11) NOT NULL,
      last_activity DATETIME NOT NULL,
      nature VARCHAR(64) NULL DEFAULT NULL,
      detail TEXT NULL,
      activity_events LONGTEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user (user_id),
      KEY idx_last_activity (last_activity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  userActivityTableEnsured = true;

  if (!userActivityColumnsEnsured) {
    const cols = await query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_activity'`
    );
    const names = new Set((cols || []).map((c) => c.COLUMN_NAME));
    if (!names.has('nature')) {
      await query(
        `ALTER TABLE user_activity ADD COLUMN nature VARCHAR(64) NULL DEFAULT NULL AFTER last_activity`
      );
    }
    if (!names.has('detail')) {
      await query(`ALTER TABLE user_activity ADD COLUMN detail TEXT NULL AFTER nature`);
    }
    if (!names.has('activity_events')) {
      await query(
        `ALTER TABLE user_activity ADD COLUMN activity_events LONGTEXT NULL AFTER detail`
      );
    }
    userActivityColumnsEnsured = true;
  }
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
 * Ne modifie pas nature, detail ni activity_events.
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

function parseDetailField(detailStr) {
  if (detailStr == null || detailStr === '') return null;
  if (typeof detailStr !== 'string') return detailStr;
  try {
    return JSON.parse(detailStr);
  } catch {
    return detailStr;
  }
}

/**
 * Enregistre un événement : met à jour nature/detail (dernier événement) et ajoute une entrée dans activity_events (liste).
 */
async function logUserActivityEvent(userId, nature, detail) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return;
  const n = String(nature || '').trim().slice(0, 64);
  if (!n) return;
  let detailStr = null;
  if (detail != null && detail !== '') {
    detailStr =
      typeof detail === 'string'
        ? detail.slice(0, 8000)
        : JSON.stringify(detail).slice(0, 8000);
  }
  try {
    await ensureUserActivityTable();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const row = await queryOne('SELECT activity_events FROM user_activity WHERE user_id = ?', [id]);
    let events = [];
    if (row && row.activity_events) {
      try {
        events = JSON.parse(row.activity_events);
        if (!Array.isArray(events)) events = [];
      } catch {
        events = [];
      }
    }
    events.unshift({ nature: n, detail: detailStr, created_at: now });
    if (events.length > MAX_EVENTS) {
      events = events.slice(0, MAX_EVENTS);
    }

    await query(
      `INSERT INTO user_activity (user_id, last_activity, nature, detail, activity_events)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_activity = VALUES(last_activity),
         nature = VALUES(nature),
         detail = VALUES(detail),
         activity_events = VALUES(activity_events)`,
      [id, now, n, detailStr, JSON.stringify(events)]
    );
  } catch (e) {
    console.warn('[user-activity]', e.message);
  }
}

async function listUserActivityLog(userId, limit, offset) {
  await ensureUserActivityTable();
  const uid = Number(userId);
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const row = await queryOne(
    'SELECT nature, detail, activity_events FROM user_activity WHERE user_id = ?',
    [uid]
  );
  if (!row || !row.activity_events) {
    return [];
  }
  let events = [];
  try {
    events = JSON.parse(row.activity_events);
    if (!Array.isArray(events)) events = [];
  } catch {
    return [];
  }
  const slice = events.slice(off, off + lim);
  return slice.map((ev, i) => ({
    id: off + i + 1,
    user_id: uid,
    nature: ev.nature,
    detail: parseDetailField(ev.detail),
    created_at: ev.created_at
  }));
}

module.exports = {
  ensureUserActivityTable,
  sessionLifetimeToIdleMs,
  touchUserActivity,
  logUserActivityEvent,
  listUserActivityLog
};
