const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

let securityCache = { expiresAt: 0, data: null };

async function ensureGlobalSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS global_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(255) DEFAULT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT(11) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function invalidateSecuritySettingsCache() {
  securityCache = { expiresAt: 0, data: null };
}

/**
 * @returns {Promise<{ failedLoginMaxBeforeIpBlock: number, failedLoginWindowMinutes: number, sessionLifetime: string }>}
 */
async function getSecuritySettings() {
  if (securityCache.data && Date.now() < securityCache.expiresAt) {
    return securityCache.data;
  }
  await ensureGlobalSettingsTable();
  const keys = ['failed_login_max_before_ip_block', 'failed_login_window_minutes', 'session_lifetime'];
  const rows = await query(
    `SELECT setting_key, setting_value FROM global_settings WHERE setting_key IN (?, ?, ?)`,
    keys
  );
  const map = {};
  for (const r of rows) map[r.setting_key] = r.setting_value;

  const maxRaw = map.failed_login_max_before_ip_block;
  const maxFails =
    maxRaw !== undefined && maxRaw !== null && String(maxRaw).trim() !== ''
      ? parseInt(String(maxRaw).trim(), 10)
      : 0;

  const winRaw = map.failed_login_window_minutes;
  const windowMin =
    winRaw !== undefined && winRaw !== null && String(winRaw).trim() !== ''
      ? parseInt(String(winRaw).trim(), 10)
      : 60;

  let sessionLifetime =
    map.session_lifetime != null && String(map.session_lifetime).trim() !== ''
      ? String(map.session_lifetime).trim()
      : process.env.JWT_EXPIRE || '24h';

  if (!sessionLifetime) sessionLifetime = '24h';

  const data = {
    failedLoginMaxBeforeIpBlock: Number.isFinite(maxFails) && maxFails >= 0 ? Math.min(maxFails, 100000) : 0,
    failedLoginWindowMinutes:
      Number.isFinite(windowMin) && windowMin >= 1 ? Math.min(windowMin, 10080) : 60,
    sessionLifetime
  };
  securityCache = { data, expiresAt: Date.now() + 5000 };
  return data;
}

/**
 * Tentatives échouées (même IP) dans la fenêtre glissante — pour blocage anti-brute-force.
 */
async function countFailedLoginAttemptsForIp(clientIp, windowMinutes) {
  if (!clientIp) return 0;
  const rows = await query(
    `SELECT COUNT(*) AS c FROM connexions_echouees
     WHERE adresse_ip = ?
     AND date_tentative >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     AND raison_echec IN ('login_inconnu', 'mot_de_passe_incorrect', 'compte_ou_fonction_centre_desactive')`,
    [clientIp, windowMinutes]
  );
  const c = rows[0]?.c ?? 0;
  return typeof c === 'bigint' ? Number(c) : Number(c);
}

function isValidJwtExpiresIn(value) {
  if (value == null || String(value).trim() === '') return false;
  try {
    jwt.sign({ _v: 1 }, 'secret', { expiresIn: String(value).trim() });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ensureGlobalSettingsTable,
  ensureDefaultGlobalSettingsRows,
  getSecuritySettings,
  invalidateSecuritySettingsCache,
  countFailedLoginAttemptsForIp,
  isValidJwtExpiresIn
};
