const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

let securityCache = { expiresAt: 0, data: null };
let bruteForceWhitelistCache = { expiresAt: 0, rules: null };
let globalLoginIpWhitelistTableEnsured = false;

/**
 * Insère les lignes par défaut si absentes (sans écraser une config existante).
 */
async function ensureDefaultGlobalSettingsRows() {
  const sessionDefault =
    process.env.JWT_EXPIRE && String(process.env.JWT_EXPIRE).trim() !== ''
      ? String(process.env.JWT_EXPIRE).trim()
      : '24h';
  const defaults = [
    ['phone_url_search_enabled', '1'],
    // 0 = désactivé ; 5 = bloquer après 5 échecs dans la fenêtre (défaut)
    ['failed_login_max_before_ip_block', '5'],
    ['failed_login_window_minutes', '60'],
    ['session_lifetime', sessionDefault]
  ];
  for (const [key, val] of defaults) {
    // Sous-requête dérivée : compatible MariaDB (pas de SELECT … WHERE sans FROM)
    await query(
      `INSERT INTO global_settings (setting_key, setting_value, updated_by)
       SELECT t.k, t.v, NULL
       FROM (SELECT ? AS k, ? AS v) AS t
       WHERE NOT EXISTS (SELECT 1 FROM global_settings g WHERE g.setting_key = t.k)`,
      [key, val]
    );
  }
}

async function ensureGlobalSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS global_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(255) DEFAULT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT(11) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureDefaultGlobalSettingsRows();
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
  try {
    const rows = await query(
      `SELECT COUNT(*) AS c FROM connexions_echouees
       WHERE adresse_ip = ?
       AND date_tentative >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND raison_echec IN ('login_inconnu', 'mot_de_passe_incorrect', 'compte_ou_fonction_centre_desactive')`,
      [clientIp, windowMinutes]
    );
    const c = rows[0]?.c ?? 0;
    return typeof c === 'bigint' ? Number(c) : Number(c);
  } catch (e) {
    console.error('countFailedLoginAttemptsForIp:', e.message);
    return 0;
  }
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

async function ensureGlobalLoginIpWhitelistTable() {
  if (globalLoginIpWhitelistTableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS global_login_ip_whitelist (
      id INT(11) NOT NULL AUTO_INCREMENT,
      ip_rule VARCHAR(64) NOT NULL,
      commentaire VARCHAR(255) NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_ip_rule (ip_rule)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  globalLoginIpWhitelistTableEnsured = true;
}

/**
 * Règles IPv4 / CIDR pour lesquelles le blocage anti-brute-force à la connexion ne s’applique pas.
 */
async function getBruteForceWhitelistRules() {
  if (bruteForceWhitelistCache.rules != null && Date.now() < bruteForceWhitelistCache.expiresAt) {
    return bruteForceWhitelistCache.rules;
  }
  await ensureGlobalLoginIpWhitelistTable();
  const rows = await query('SELECT ip_rule FROM global_login_ip_whitelist ORDER BY id ASC');
  const rules = (rows || []).map((r) => r.ip_rule).filter(Boolean);
  bruteForceWhitelistCache = { rules, expiresAt: Date.now() + 5000 };
  return rules;
}

function invalidateBruteForceWhitelistCache() {
  bruteForceWhitelistCache = { expiresAt: 0, rules: null };
}

module.exports = {
  ensureGlobalSettingsTable,
  ensureDefaultGlobalSettingsRows,
  getSecuritySettings,
  invalidateSecuritySettingsCache,
  countFailedLoginAttemptsForIp,
  isValidJwtExpiresIn,
  ensureGlobalLoginIpWhitelistTable,
  getBruteForceWhitelistRules,
  invalidateBruteForceWhitelistCache
};
