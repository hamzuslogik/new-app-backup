/**
 * Mots de passe partagés avec l'app PHP (même table utilisateurs.mdp).
 *
 * Formats supportés en lecture :
 * - bcrypt PHP password_hash() : $2y$… / $2a$… / $2b$…
 * - ancien SHA-256 hex (64 car.) — rétrocompatibilité
 *
 * Nouveaux hashs : bcrypt ($2y$) compatible password_verify() côté PHP.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

function isBcryptHash(stored) {
  const s = String(stored || '');
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(s);
}

function isSha256Hex(stored) {
  return /^[a-f0-9]{64}$/i.test(String(stored || '').trim());
}

/** bcryptjs ne gère pas toujours $2y$ (préfixe PHP) → normaliser en $2a$ */
function normalizeBcryptForNode(hash) {
  const s = String(hash || '');
  if (s.startsWith('$2y$')) return `$2a$${s.slice(4)}`;
  return s;
}

/** Stocker en $2y$ pour une compatibilité maximale avec password_verify PHP */
function toPhpBcryptPrefix(hash) {
  const s = String(hash || '');
  if (s.startsWith('$2a$') || s.startsWith('$2b$')) return `$2y$${s.slice(4)}`;
  return s;
}

function hashSha256(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}

/**
 * Hash pour écriture DB (création / changement de mot de passe).
 * @returns {Promise<string>}
 */
async function hashPassword(plain) {
  const raw = await bcrypt.hash(String(plain), BCRYPT_ROUNDS);
  return toPhpBcryptPrefix(raw);
}

/**
 * Vérifie un mot de passe contre le hash stocké (bcrypt ou SHA-256 legacy).
 * @returns {Promise<{ ok: boolean, needsRehash: boolean }>}
 */
async function verifyPassword(plain, stored) {
  const hash = stored == null ? '' : String(stored).trim();
  if (!hash || plain == null) {
    return { ok: false, needsRehash: false };
  }

  if (isBcryptHash(hash)) {
    try {
      const ok = await bcrypt.compare(String(plain), normalizeBcryptForNode(hash));
      return { ok, needsRehash: false };
    } catch (e) {
      console.error('[passwordHash] bcrypt.compare:', e.message);
      return { ok: false, needsRehash: false };
    }
  }

  if (isSha256Hex(hash)) {
    const ok = hashSha256(plain).toLowerCase() === hash.toLowerCase();
    // Migrer vers bcrypt après login réussi (alignement app PHP)
    return { ok, needsRehash: ok };
  }

  // Hash inconnu (argon2 $argon2id$, etc.) — tenter bcrypt au cas où le regex serait trop strict
  if (hash.startsWith('$2')) {
    try {
      const ok = await bcrypt.compare(String(plain), normalizeBcryptForNode(hash));
      return { ok, needsRehash: false };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }

  console.warn(
    `[passwordHash] format mdp non reconnu (len=${hash.length}, prefix=${hash.slice(0, 4)})`
  );
  return { ok: false, needsRehash: false };
}

/**
 * Vérifie et, si besoin (legacy SHA-256), réécrit le hash en bcrypt.
 * @param {(sql: string, params?: any[]) => Promise<any>} queryFn
 */
async function verifyPasswordAndUpgrade(plain, stored, userId, queryFn) {
  const result = await verifyPassword(plain, stored);
  if (result.ok && result.needsRehash && userId != null && typeof queryFn === 'function') {
    try {
      const newHash = await hashPassword(plain);
      await queryFn('UPDATE utilisateurs SET mdp = ? WHERE id = ?', [newHash, userId]);
      console.log(`[passwordHash] migration SHA-256 → bcrypt userId=${userId}`);
    } catch (e) {
      console.error('[passwordHash] échec migration bcrypt:', e.message);
    }
  }
  return result.ok;
}

module.exports = {
  BCRYPT_ROUNDS,
  isBcryptHash,
  isSha256Hex,
  hashPassword,
  hashSha256,
  verifyPassword,
  verifyPasswordAndUpgrade
};
