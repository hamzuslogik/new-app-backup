/**
 * Adresse IP client (derrière proxy : X-Forwarded-For).
 * Configurer trust proxy sur Express + TRUST_PROXY=1 en production derrière nginx.
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const raw = req.socket?.remoteAddress || req.ip || '';
  return String(raw);
}

/** ::ffff:192.168.1.1 → 192.168.1.1 */
function normalizeClientIp(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}

/**
 * IP normalisée pour audit / anti-brute-force : même logique que le journal connexions_echouees.
 * Si X-Forwarded-For / req.ip sont vides, retombe sur la socket (souvent utile sans trust proxy).
 */
function getNormalizedClientIpForRateLimit(req) {
  let ip = normalizeClientIp(getClientIp(req));
  if (ip) return ip;
  const raw = req.socket?.remoteAddress || req.ip || '';
  return normalizeClientIp(raw);
}

function parseIPv4(str) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(str).trim());
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

/**
 * @param {string} clientIpNorm - IP normalisée
 * @param {string} rule - ex. 203.0.113.10 ou 192.168.0.0/24
 */
function clientIpMatchesRule(clientIpNorm, rule) {
  const r = String(rule || '').trim();
  if (!r) return false;

  if (r.includes('/')) {
    const parts = r.split('/');
    const net = parts[0].trim();
    const bits = parseInt(parts[1], 10);
    if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
    const ipInt = parseIPv4(clientIpNorm);
    const netInt = parseIPv4(net);
    if (ipInt === null || netInt === null) return false;
    let mask;
    if (bits === 0) mask = 0;
    else if (bits >= 32) mask = 0xffffffff >>> 0;
    else mask = (~((1 << (32 - bits)) - 1)) >>> 0;
    return (ipInt & mask) === (netInt & mask);
  }

  const a = parseIPv4(clientIpNorm);
  const b = parseIPv4(r);
  if (a !== null && b !== null) return a === b;
  return clientIpNorm === r;
}

function clientIpMatchesAnyRule(clientIpRaw, rules) {
  const ip = normalizeClientIp(clientIpRaw);
  if (!ip) return false;
  const list = Array.isArray(rules) ? rules : [];
  if (list.length === 0) return false;
  return list.some((rule) => clientIpMatchesRule(ip, rule));
}

/**
 * @param {boolean|number} allowAll - ip_acces_tous depuis la base (1 = toutes les IP)
 * @param {string[]} rules
 * @param {import('express').Request} req
 */
function isClientIpAllowedForFonction(allowAll, rules, req) {
  const all = allowAll === true || allowAll === 1 || allowAll === '1';
  if (all) return true;
  return clientIpMatchesAnyRule(getClientIp(req), rules);
}

/** IPv4 seule ou notation CIDR IPv4 (ex. 192.168.1.1 ou 10.0.0.0/24). */
function isValidIpRuleString(rule) {
  const r = String(rule || '').trim();
  if (!r || r.length > 64) return false;
  if (r.includes('/')) {
    const parts = r.split('/');
    if (parts.length !== 2) return false;
    const bits = parseInt(parts[1].trim(), 10);
    if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
    return parseIPv4(parts[0].trim()) !== null;
  }
  return parseIPv4(r) !== null;
}

module.exports = {
  getClientIp,
  normalizeClientIp,
  getNormalizedClientIpForRateLimit,
  clientIpMatchesRule,
  clientIpMatchesAnyRule,
  isClientIpAllowedForFonction,
  isValidIpRuleString,
};
