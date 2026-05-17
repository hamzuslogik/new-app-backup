const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requireBackofficeLogin } = require('../middleware/backofficeLogin.middleware');

const router = express.Router();

const CODES_PER_LOT = 10;
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

/** GET statut du lot actuel (sans révéler les codes) */
router.get('/status', authenticate, requireBackofficeLogin, async (req, res) => {
  try {
    await ensureCodesSecoursTable();

    const stats = await queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN utilise = 0 THEN 1 ELSE 0 END) AS disponibles,
         SUM(CASE WHEN utilise = 1 THEN 1 ELSE 0 END) AS utilises,
         MAX(date_creation) AS derniere_generation
       FROM codes_secours`
    );

    const dernierLot = await queryOne(
      `SELECT lot_id, date_creation, id_genere_par
       FROM codes_secours
       ORDER BY date_creation DESC
       LIMIT 1`
    );

    res.json({
      success: true,
      data: {
        total: Number(stats?.total || 0),
        disponibles: Number(stats?.disponibles || 0),
        utilises: Number(stats?.utilises || 0),
        derniere_generation: stats?.derniere_generation || null,
        dernier_lot: dernierLot
          ? {
              lot_id: dernierLot.lot_id,
              date_creation: dernierLot.date_creation,
              id_genere_par: dernierLot.id_genere_par
            }
          : null
      }
    });
  } catch (error) {
    console.error('Erreur GET /codes-secours/status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la lecture des codes de secours'
    });
  }
});

/**
 * POST génère 10 nouveaux codes (remplace tous les codes existants).
 * Les codes en clair ne sont renvoyés qu'une seule fois dans la réponse.
 */
router.post('/generate', authenticate, requireBackofficeLogin, async (req, res) => {
  try {
    await ensureCodesSecoursTable();

    const plainCodes = generateFourDigitCodes(CODES_PER_LOT);
    const lotId = crypto.randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const userId = req.user.id;

    await query('DELETE FROM codes_secours');

    for (const code of plainCodes) {
      const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
      await query(
        `INSERT INTO codes_secours (code_hash, lot_id, utilise, date_utilisation, id_genere_par, date_creation)
         VALUES (?, ?, 0, NULL, ?, ?)`,
        [codeHash, lotId, userId, now]
      );
    }

    res.json({
      success: true,
      message: `${CODES_PER_LOT} codes de secours générés. Conservez-les : ils ne seront plus affichés.`,
      data: {
        lot_id: lotId,
        codes: plainCodes,
        date_creation: now
      }
    });
  } catch (error) {
    console.error('Erreur POST /codes-secours/generate:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des codes de secours'
    });
  }
});

module.exports = router;
