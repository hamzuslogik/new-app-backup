const express = require('express');
const crypto = require('crypto');
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requireBackofficeLogin } = require('../middleware/backofficeLogin.middleware');
const {
  ensureCodesSecoursTable,
  generateFourDigitCodes,
  hashBackupCode
} = require('../utils/codesSecoursHelper');

const router = express.Router();

const CODES_PER_LOT = 10;

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
      const codeHash = await hashBackupCode(code);
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
