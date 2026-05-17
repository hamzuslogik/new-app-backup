const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');

const BCRYPT_ROUNDS = 10;

async function ensureCodesSecoursTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS codes_secours (
      id INT NOT NULL AUTO_INCREMENT,
      code_hash VARCHAR(255) NOT NULL,
      lot_id VARCHAR(36) NOT NULL,
      utilise TINYINT(1) NOT NULL DEFAULT 0,
      date_utilisation DATETIME NULL,
      id_genere_par INT NOT NULL,
      date_creation DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_codes_secours_lot (lot_id),
      KEY idx_codes_secours_utilise (utilise)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function normalizeBackupCodeInput(value) {
  if (value == null || String(value).trim() === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return null;
  const normalized = digits.slice(-4).padStart(4, '0');
  return /^\d{4}$/.test(normalized) ? normalized : null;
}

function generateFourDigitCodes(count) {
  const codes = new Set();
  let guard = 0;
  while (codes.size < count && guard < count * 200) {
    guard += 1;
    const n = crypto.randomInt(0, 10000);
    codes.add(String(n).padStart(4, '0'));
  }
  if (codes.size < count) {
    throw new Error('Impossible de générer des codes uniques');
  }
  return [...codes];
}

/**
 * Vérifie un code de secours et le marque utilisé (usage unique).
 * @returns {Promise<{ ok: boolean, codeId?: number, reason?: string }>}
 */
async function verifyAndConsumeBackupCode(plainCode) {
  await ensureCodesSecoursTable();

  const normalized = normalizeBackupCodeInput(plainCode);
  if (!normalized) {
    return { ok: false, reason: 'invalid_format' };
  }

  const rows = await query(
    'SELECT id, code_hash FROM codes_secours WHERE utilise = 0 ORDER BY id ASC'
  );

  for (const row of rows) {
    const match = await bcrypt.compare(normalized, row.code_hash);
    if (!match) continue;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await query(
      `UPDATE codes_secours
       SET utilise = 1, date_utilisation = ?
       WHERE id = ? AND utilise = 0`,
      [now, row.id]
    );

    if (result.affectedRows > 0) {
      return { ok: true, codeId: row.id };
    }
    return { ok: false, reason: 'already_used' };
  }

  return { ok: false, reason: 'not_found' };
}

async function hashBackupCode(plainCode) {
  return bcrypt.hash(plainCode, BCRYPT_ROUNDS);
}

module.exports = {
  ensureCodesSecoursTable,
  normalizeBackupCodeInput,
  generateFourDigitCodes,
  verifyAndConsumeBackupCode,
  hashBackupCode,
  BCRYPT_ROUNDS
};
