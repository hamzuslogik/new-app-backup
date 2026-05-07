const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

const ALLOWED_MANAGERS = [1, 2, 7, 11, 13, 14];
const SLOT_HOURS = new Set(['09:00:00', '11:00:00', '13:00:00', '16:00:00', '18:00:00', '19:30:00']);
const DAY_NAMES = new Set(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);

function normalizeDayName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeVisibilityFunctions(rawValue) {
  const list = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  const cleaned = [...new Set(list.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n) && n > 0))];
  return cleaned.sort((a, b) => a - b);
}

async function ensurePlanningAlertsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS planning_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dep VARCHAR(10) NOT NULL,
      day_name VARCHAR(16) NOT NULL DEFAULT 'lundi',
      slot_hour VARCHAR(8) NOT NULL,
      message TEXT NOT NULL,
      visible_functions VARCHAR(255) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uniq_dep_day_slot (dep, day_name, slot_hour)
    )
  `);
  const dayNameCol = await queryOne(`
    SELECT 1 AS ok
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'planning_alerts'
      AND COLUMN_NAME = 'day_name'
    LIMIT 1
  `);
  if (!dayNameCol?.ok) {
    await query("ALTER TABLE planning_alerts ADD COLUMN day_name VARCHAR(16) NOT NULL DEFAULT 'lundi' AFTER dep");
  }
  const visibleFunctionsCol = await queryOne(`
    SELECT 1 AS ok
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'planning_alerts'
      AND COLUMN_NAME = 'visible_functions'
    LIMIT 1
  `);
  if (!visibleFunctionsCol?.ok) {
    await query("ALTER TABLE planning_alerts ADD COLUMN visible_functions VARCHAR(255) NOT NULL DEFAULT '' AFTER message");
  }
  const oldUnique = await queryOne(`
    SELECT 1 AS ok
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'planning_alerts'
      AND INDEX_NAME = 'uniq_dep_slot'
    LIMIT 1
  `);
  if (oldUnique?.ok) {
    await query('ALTER TABLE planning_alerts DROP INDEX uniq_dep_slot');
  }
  const newUnique = await queryOne(`
    SELECT 1 AS ok
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'planning_alerts'
      AND INDEX_NAME = 'uniq_dep_day_slot'
    LIMIT 1
  `);
  if (!newUnique?.ok) {
    await query('ALTER TABLE planning_alerts ADD UNIQUE KEY uniq_dep_day_slot (dep, day_name, slot_hour)');
  }
}

router.get('/', authenticate, async (req, res) => {
  try {
    await ensurePlanningAlertsTable();
    const dep = String(req.query.dep || '').trim();
    const dayName = normalizeDayName(req.query.day_name);
    const activeOnly = String(req.query.active_only || '1') !== '0';
    const viewerFonction = parseInt(req.query.viewer_fonction, 10);
    const where = [];
    const params = [];

    if (dep) {
      where.push('dep = ?');
      params.push(dep);
    }
    if (dayName) {
      where.push('day_name = ?');
      params.push(dayName);
    }
    if (activeOnly) {
      where.push('is_active = 1');
    }
    if (Number.isFinite(viewerFonction) && viewerFonction > 0) {
      where.push("(visible_functions = '' OR FIND_IN_SET(?, visible_functions) > 0)");
      params.push(String(viewerFonction));
    }

    const sql = `
      SELECT id, dep, day_name, slot_hour, message, visible_functions, is_active, created_by, updated_by, created_at, updated_at
      FROM planning_alerts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY dep ASC, day_name ASC, slot_hour ASC
    `;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error('Erreur GET /planning-alerts:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des alertes planning' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const fonction = Number(req.user?.fonction);
    if (!ALLOWED_MANAGERS.includes(fonction)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await ensurePlanningAlertsTable();
    const dep = String(req.body.dep || '').trim();
    const dayName = normalizeDayName(req.body.day_name);
    const slotHourRaw = String(req.body.slot_hour || '').trim();
    const slotHour = slotHourRaw.length === 5 ? `${slotHourRaw}:00` : slotHourRaw;
    const message = String(req.body.message || '').trim();
    const visibleFunctions = normalizeVisibilityFunctions(req.body.visible_functions);

    if (!dep || !dayName || !slotHour || !message || visibleFunctions.length === 0) {
      return res.status(400).json({ success: false, message: 'dep, day_name, slot_hour, message et visible_functions sont requis' });
    }
    if (!SLOT_HOURS.has(slotHour)) {
      return res.status(400).json({ success: false, message: 'Créneau invalide' });
    }
    if (!DAY_NAMES.has(dayName)) {
      return res.status(400).json({ success: false, message: 'Jour invalide' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `INSERT INTO planning_alerts (dep, day_name, slot_hour, message, visible_functions, is_active, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         message = VALUES(message),
         visible_functions = VALUES(visible_functions),
         is_active = 1,
         updated_by = VALUES(updated_by),
         updated_at = VALUES(updated_at)`,
      [dep, dayName, slotHour, message, visibleFunctions.join(','), req.user.id || null, req.user.id || null, now, now]
    );

    const saved = await queryOne(
      'SELECT id, dep, day_name, slot_hour, message, visible_functions, is_active, created_by, updated_by, created_at, updated_at FROM planning_alerts WHERE dep = ? AND day_name = ? AND slot_hour = ?',
      [dep, dayName, slotHour]
    );
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Erreur POST /planning-alerts:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement de l\'alerte planning' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const fonction = Number(req.user?.fonction);
    if (!ALLOWED_MANAGERS.includes(fonction)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    await ensurePlanningAlertsTable();
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }
    await query('DELETE FROM planning_alerts WHERE id = ?', [id]);
    res.json({ success: true, message: 'Alerte planning supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /planning-alerts/:id:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'alerte planning' });
  }
});

module.exports = router;
