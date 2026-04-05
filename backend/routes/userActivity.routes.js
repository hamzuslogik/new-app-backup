const express = require('express');
const router = express.Router();
const { authenticate, isAdminOrBackofficeOrRPConfirmation } = require('../middleware/auth.middleware');
const { logUserActivityEvent, listUserActivityLog } = require('../utils/userActivitySession');

router.post('/log', authenticate, async (req, res) => {
  try {
    const { nature, detail } = req.body || {};
    if (!nature || typeof nature !== 'string') {
      return res.status(400).json({ success: false, message: 'nature requise' });
    }
    let detailPayload = detail;
    if (detail != null && typeof detail === 'object') {
      detailPayload = JSON.stringify(detail);
    } else if (detail != null && typeof detail !== 'string') {
      detailPayload = String(detail);
    }
    if (detailPayload != null && String(detailPayload).length > 8000) {
      return res.status(400).json({ success: false, message: 'detail trop long' });
    }
    await logUserActivityEvent(req.user.id, nature, detailPayload);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /user-activity/log:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.get('/log', authenticate, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let userId = req.user.id;
    if (req.query.user_id != null && req.query.user_id !== '') {
      const qid = parseInt(req.query.user_id, 10);
      if (Number.isFinite(qid) && qid > 0) {
        if (qid !== req.user.id && !isAdminOrBackofficeOrRPConfirmation(req.user.fonction)) {
          return res.status(403).json({ success: false, message: 'Accès refusé' });
        }
        userId = qid;
      }
    }
    const rows = await listUserActivityLog(userId, limit, offset);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur GET /user-activity/log:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;
