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
    ['session_lifetime', sessionDefault],
    [
      'production_hours',
      JSON.stringify({
        lundi: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '18:00' },
        ],
        mardi: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '18:00' },
        ],
        mercredi: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '18:00' },
        ],
        jeudi: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '18:00' },
        ],
        vendredi: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '18:00' },
        ],
        samedi: [],
        dimanche: [],
      }),
    ],
  ];
  for (const [key, val] of defaults) {
    // MariaDB / MySQL : sous-requête dérivée obligatoire (pas de « SELECT ?, ?, NULL WHERE NOT EXISTS » sans FROM).
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
      setting_value TEXT DEFAULT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT(11) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Anciennes installs : VARCHAR(255) trop court pour JSON (horaires production…)
  try {
    await query(`ALTER TABLE global_settings MODIFY COLUMN setting_value TEXT DEFAULT NULL`);
  } catch (e) {
    // ignore si déjà TEXT / droits insuffisants
  }
  await ensureDefaultGlobalSettingsRows();
}

const PRODUCTION_DAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

const DEFAULT_PRODUCTION_SLOTS = [
  { start: '09:00', end: '12:00' },
  { start: '13:00', end: '18:00' },
];

function defaultProductionHours() {
  const out = {};
  for (const day of PRODUCTION_DAYS) {
    out[day] = day === 'samedi' || day === 'dimanche' ? [] : DEFAULT_PRODUCTION_SLOTS.map((s) => ({ ...s }));
  }
  return out;
}

function normalizeTimeHm(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeToMinutes(hm) {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

/**
 * Valide et normalise les plages de production par jour.
 * @returns {{ ok: true, data: object } | { ok: false, message: string }}
 */
function normalizeProductionHours(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const data = {};
  for (const day of PRODUCTION_DAYS) {
    const slotsIn = Array.isArray(source[day]) ? source[day] : [];
    const slots = [];
    for (let i = 0; i < slotsIn.length; i++) {
      const start = normalizeTimeHm(slotsIn[i]?.start);
      const end = normalizeTimeHm(slotsIn[i]?.end);
      if (!start || !end) {
        return { ok: false, message: `${day} : créneau ${i + 1} — heures invalides (HH:MM)` };
      }
      if (timeToMinutes(end) <= timeToMinutes(start)) {
        return {
          ok: false,
          message: `${day} : créneau ${i + 1} — l'heure de fin doit être après le début`,
        };
      }
      slots.push({ start, end });
    }
    slots.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < slots.length; i++) {
      if (timeToMinutes(slots[i].start) < timeToMinutes(slots[i - 1].end)) {
        return {
          ok: false,
          message: `${day} : les créneaux se chevauchent`,
        };
      }
    }
    data[day] = slots;
  }
  return { ok: true, data };
}

async function getProductionHours() {
  await ensureGlobalSettingsTable();
  const rows = await query(
    `SELECT setting_value FROM global_settings WHERE setting_key = ?`,
    ['production_hours']
  );
  const raw = rows?.[0]?.setting_value;
  if (!raw) return defaultProductionHours();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const normalized = normalizeProductionHours(parsed);
    return normalized.ok ? normalized.data : defaultProductionHours();
  } catch {
    return defaultProductionHours();
  }
}

function getDayKeyFromYmd(ymd) {
  const text = String(ymd || '').slice(0, 10);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // Midi local pour éviter les décalages DST
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()];
}

function getSlotsMinutes(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return 0;
  return slots.reduce((sum, slot) => {
    const start = normalizeTimeHm(slot?.start);
    const end = normalizeTimeHm(slot?.end);
    if (!start || !end) return sum;
    const diff = timeToMinutes(end) - timeToMinutes(start);
    return sum + (diff > 0 ? diff : 0);
  }, 0);
}

/**
 * Minutes travaillées dans les créneaux jusqu'à une heure de départ (HH:MM[:SS]).
 */
function getWorkedMinutesUntil(slots, heureDepartHm) {
  const cutoff = normalizeTimeHm(heureDepartHm);
  if (!cutoff || !Array.isArray(slots)) return 0;
  const cutoffMin = timeToMinutes(cutoff);
  let worked = 0;
  for (const slot of slots) {
    const start = normalizeTimeHm(slot?.start);
    const end = normalizeTimeHm(slot?.end);
    if (!start || !end) continue;
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (endMin <= startMin) continue;
    if (cutoffMin <= startMin) continue;
    if (cutoffMin >= endMin) {
      worked += endMin - startMin;
    } else {
      worked += cutoffMin - startMin;
    }
  }
  return worked;
}

/**
 * Coefficient de présence pour un jour donné.
 * absence => 0
 * départ à 11h avec production 09–12 + 13–18 (8h) => 2/8 = 0.25
 * présent toute la journée (pas de signalement) => non stocké ici (1 implicite)
 *
 * @returns {{ coefficient: number, heures_travaillees: number, heures_prevues: number, day_key: string|null }}
 */
function computePresenceCoefficient({ type, heureDepart, dateJour, productionHours }) {
  const dayKey = getDayKeyFromYmd(dateJour);
  const slots = dayKey && productionHours ? productionHours[dayKey] || [] : [];
  const plannedMinutes = getSlotsMinutes(slots);
  const heuresPrevues = Math.round((plannedMinutes / 60) * 100) / 100;

  if (type === 'absence') {
    return {
      coefficient: 0,
      heures_travaillees: 0,
      heures_prevues: heuresPrevues,
      day_key: dayKey,
    };
  }

  if (plannedMinutes <= 0) {
    return {
      coefficient: 0,
      heures_travaillees: 0,
      heures_prevues: 0,
      day_key: dayKey,
    };
  }

  const workedMinutes = getWorkedMinutesUntil(slots, heureDepart);
  const heuresTravaillees = Math.round((workedMinutes / 60) * 100) / 100;
  const coefficient = Math.round((workedMinutes / plannedMinutes) * 10000) / 10000;

  return {
    coefficient: Math.max(0, Math.min(1, coefficient)),
    heures_travaillees: heuresTravaillees,
    heures_prevues: heuresPrevues,
    day_key: dayKey,
  };
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
  invalidateBruteForceWhitelistCache,
  PRODUCTION_DAYS,
  defaultProductionHours,
  normalizeProductionHours,
  getProductionHours,
  computePresenceCoefficient,
  getDayKeyFromYmd,
  getSlotsMinutes,
  getWorkedMinutesUntil,
  timeToMinutes,
  normalizeTimeHm,
};
