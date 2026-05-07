const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

const ALLOWED_MANAGERS = [1, 2, 7, 11, 13, 14];
const SLOT_HOURS = new Set(['09:00:00', '11:00:00', '13:00:00', '16:00:00', '18:00:00', '19:30:00']);

async function ensurePlanningAlertsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS planning_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dep VARCHAR(10) NOT NULL,
      slot_hour VARCHAR(8) NOT NULL,
      message TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uniq_dep_slot (dep, slot_hour)
    )
  `);
}

router.get('/', authenticate, async (req, res) => {
  try {
    await ensurePlanningAlertsTable();
    const dep = String(req.query.dep || '').trim();
    const activeOnly = String(req.query.active_only || '1') !== '0';
    const where = [];
    const params = [];

    if (dep) {
      where.push('dep = ?');
      params.push(dep);
    }
    if (activeOnly) {
      where.push('is_active = 1');
    }

    const sql = `
      SELECT id, dep, slot_hour, message, is_active, created_by, updated_by, created_at, updated_at
      FROM planning_alerts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY dep ASC, slot_hour ASC
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
    const slotHourRaw = String(req.body.slot_hour || '').trim();
    const slotHour = slotHourRaw.length === 5 ? `${slotHourRaw}:00` : slotHourRaw;
    const message = String(req.body.message || '').trim();

    if (!dep || !slotHour || !message) {
      return res.status(400).json({ success: false, message: 'dep, slot_hour et message sont requis' });
    }
    if (!SLOT_HOURS.has(slotHour)) {
      return res.status(400).json({ success: false, message: 'Créneau invalide' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `INSERT INTO planning_alerts (dep, slot_hour, message, is_active, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         message = VALUES(message),
         is_active = 1,
         updated_by = VALUES(updated_by),
         updated_at = VALUES(updated_at)`,
      [dep, slotHour, message, req.user.id || null, req.user.id || null, now, now]
    );

    const saved = await queryOne(
      'SELECT id, dep, slot_hour, message, is_active, created_by, updated_by, created_at, updated_at FROM planning_alerts WHERE dep = ? AND slot_hour = ?',
      [dep, slotHour]
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
