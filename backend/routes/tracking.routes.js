const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');
const ficheRoutes = require('./fiche.routes');
const encodeFicheId = ficheRoutes.encodeFicheId;
const {
  canAccessTrackingPage,
  canManageTrackingFromCompteRendu,
} = require('../utils/trackingAccess');

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function fetchTrackingHisto(idTracking) {
  try {
    const rows = await query(
      `SELECT h.*, u.pseudo AS user_pseudo
       FROM tracking_histo h
       LEFT JOIN utilisateurs u ON u.id = h.id_user
       WHERE h.id_tracking = ?
       ORDER BY h.date_histo DESC`,
      [idTracking]
    );
    return (rows || []).map((h) => ({
      ...h,
      rappel_client: h.rappel_client === 1 || h.rappel_client === '1',
      action_label: h.action === 'create' ? 'Création' : 'Modification',
    }));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

async function insertTrackingHisto(connOrQuery, trackingRow, action, userId) {
  const q = connOrQuery;
  await q(
    `INSERT INTO tracking_histo (
      id_tracking, action, date_histo, id_user,
      id_fiche, id_compte_rendu, date_rdv, rappel_client, commentaire_client, constat
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trackingRow.id,
      action,
      nowSql(),
      userId,
      trackingRow.id_fiche,
      trackingRow.id_compte_rendu ?? null,
      trackingRow.date_rdv ?? null,
      trackingRow.rappel_client ? 1 : 0,
      trackingRow.commentaire_client ?? null,
      trackingRow.constat ?? null,
    ]
  );
}

const LIST_SELECT = `
  SELECT t.*,
    f.nom AS fiche_nom,
    f.prenom AS fiche_prenom,
    f.tel AS fiche_tel,
    f.date_rdv_time AS fiche_date_rdv_time,
    cr.commentaire AS compte_rendu_commentaire,
    cr.statut AS compte_rendu_statut,
    u_com.pseudo AS commercial_pseudo,
    u_conf.pseudo AS confirmateur_pseudo,
    e.titre AS etat_titre,
    u_editor.pseudo AS editor_pseudo
  FROM tracking t
  INNER JOIN fiches f ON f.id = t.id_fiche
  LEFT JOIN compte_rendu_pending cr ON cr.id = t.id_compte_rendu
  LEFT JOIN utilisateurs u_com ON cr.id_commercial = u_com.id
  LEFT JOIN utilisateurs u_conf ON f.id_confirmateur = u_conf.id
  LEFT JOIN etats e ON f.id_etat_final = e.id
  LEFT JOIN utilisateurs u_editor ON t.id_user = u_editor.id
`;

/**
 * Liste des trackings (backoffice uniquement).
 */
router.get('/', authenticate, async (req, res) => {
  try {
    if (!canAccessTrackingPage(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à la page Tracking',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const { date_debut, date_fin, search } = req.query;

    const whereParts = ['1=1'];
    const params = [];

    if (date_debut && /^\d{4}-\d{2}-\d{2}$/.test(String(date_debut))) {
      whereParts.push('DATE(t.date_creation) >= ?');
      params.push(date_debut);
    }
    if (date_fin && /^\d{4}-\d{2}-\d{2}$/.test(String(date_fin))) {
      whereParts.push('DATE(t.date_creation) <= ?');
      params.push(date_fin);
    }
    const searchTrim = String(search || '').trim();
    if (searchTrim) {
      const like = `%${searchTrim}%`;
      whereParts.push('(f.nom LIKE ? OR f.prenom LIKE ? OR f.tel LIKE ? OR t.constat LIKE ? OR t.commentaire_client LIKE ?)');
      params.push(like, like, like, like, like);
    }

    const whereSql = whereParts.join(' AND ');

    let total = 0;
    let rows = [];
    try {
      const countRow = await queryOne(
        `SELECT COUNT(*) AS total FROM tracking t INNER JOIN fiches f ON f.id = t.id_fiche WHERE ${whereSql}`,
        params
      );
      total = countRow?.total ?? 0;
      rows = await query(
        `${LIST_SELECT} WHERE ${whereSql} ORDER BY t.date_creation DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 1 },
        });
      }
      throw err;
    }

    res.json({
      success: true,
      data: (rows || []).map((r) => ({
        ...r,
        fiche_hash: encodeFicheId(r.id_fiche),
        rappel_client_label: r.rappel_client === 1 || r.rappel_client === '1' ? 'Oui' : 'Non',
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('GET /tracking:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Contexte pour le modal (compte rendu + fiche + tracking existant).
 */
router.get('/context/compte-rendu/:idCr', authenticate, async (req, res) => {
  try {
    if (!canManageTrackingFromCompteRendu(req.user)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const idCr = parseInt(req.params.idCr, 10);
    if (!idCr || Number.isNaN(idCr)) {
      return res.status(400).json({ success: false, message: 'ID compte rendu invalide' });
    }

    const cr = await queryOne(
      `SELECT cr.*,
        f.id AS fiche_id,
        f.nom AS fiche_nom,
        f.prenom AS fiche_prenom,
        f.tel AS fiche_tel,
        f.gsm1 AS fiche_gsm1,
        f.cp AS fiche_cp,
        f.ville AS fiche_ville,
        f.date_rdv_time,
        f.id_etat_final,
        f.id_confirmateur,
        u_com.pseudo AS commercial_pseudo,
        u_conf.pseudo AS confirmateur_pseudo,
        e.titre AS etat_titre,
        se.titre AS sous_etat_titre
       FROM compte_rendu_pending cr
       INNER JOIN fiches f ON f.id = cr.id_fiche
       LEFT JOIN utilisateurs u_com ON cr.id_commercial = u_com.id
       LEFT JOIN utilisateurs u_conf ON f.id_confirmateur = u_conf.id
       LEFT JOIN etats e ON f.id_etat_final = e.id
       LEFT JOIN sous_etat se ON cr.id_sous_etat = se.id
       WHERE cr.id = ?`,
      [idCr]
    );

    if (!cr) {
      return res.status(404).json({ success: false, message: 'Compte rendu introuvable' });
    }

    let tracking = null;
    try {
      tracking = await queryOne('SELECT * FROM tracking WHERE id_compte_rendu = ?', [idCr]);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    let historique = [];
    if (tracking?.id) {
      historique = await fetchTrackingHisto(tracking.id);
    }

    res.json({
      success: true,
      data: {
        compte_rendu: {
          id: cr.id,
          id_fiche: cr.id_fiche,
          commentaire: cr.commentaire,
          statut: cr.statut,
          commercial_pseudo: cr.commercial_pseudo,
          id_commercial: cr.id_commercial,
        },
        fiche: {
          id: cr.fiche_id,
          hash: encodeFicheId(cr.fiche_id),
          nom: cr.fiche_nom,
          prenom: cr.fiche_prenom,
          tel: cr.fiche_tel || cr.fiche_gsm1,
          cp: cr.fiche_cp,
          ville: cr.fiche_ville,
          date_rdv_time: cr.date_rdv_time,
          id_etat_final: cr.id_etat_final,
          etat_titre: cr.etat_titre,
          sous_etat_titre: cr.sous_etat_titre,
          confirmateur_pseudo: cr.confirmateur_pseudo,
        },
        tracking: tracking
          ? {
              ...tracking,
              rappel_client: tracking.rappel_client === 1 || tracking.rappel_client === '1',
            }
          : null,
        historique,
      },
    });
  } catch (error) {
    console.error('GET /tracking/context:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Historique des modifications d'un tracking (page liste / détail).
 */
router.get('/:id/histo', authenticate, async (req, res) => {
  try {
    if (!canAccessTrackingPage(req.user) && !canManageTrackingFromCompteRendu(req.user)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const idTracking = parseInt(req.params.id, 10);
    if (!idTracking || Number.isNaN(idTracking)) {
      return res.status(400).json({ success: false, message: 'ID tracking invalide' });
    }

    const row = await queryOne('SELECT id FROM tracking WHERE id = ?', [idTracking]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Tracking introuvable' });
    }

    const historique = await fetchTrackingHisto(idTracking);
    res.json({ success: true, data: historique });
  } catch (error) {
    console.error('GET /tracking/:id/histo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Créer ou mettre à jour un tracking pour un compte rendu.
 */
router.put('/compte-rendu/:idCr', authenticate, async (req, res) => {
  try {
    if (!canManageTrackingFromCompteRendu(req.user)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const idCr = parseInt(req.params.idCr, 10);
    if (!idCr || Number.isNaN(idCr)) {
      return res.status(400).json({ success: false, message: 'ID compte rendu invalide' });
    }

    const rappel_client = req.body.rappel_client === true || req.body.rappel_client === 1 || req.body.rappel_client === '1' ? 1 : 0;
    const commentaire_client =
      req.body.commentaire_client != null ? String(req.body.commentaire_client).trim() || null : null;
    const constat = req.body.constat != null ? String(req.body.constat).trim() || null : null;

    const cr = await queryOne(
      `SELECT cr.id, cr.id_fiche, f.date_rdv_time
       FROM compte_rendu_pending cr
       INNER JOIN fiches f ON f.id = cr.id_fiche
       WHERE cr.id = ?`,
      [idCr]
    );
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Compte rendu introuvable' });
    }

    const now = nowSql();
    let existing;
    try {
      existing = await queryOne('SELECT * FROM tracking WHERE id_compte_rendu = ?', [idCr]);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
          success: false,
          message: 'Tables tracking absentes. Exécutez backend/scripts/create-tracking-tables.sql',
        });
      }
      throw err;
    }

    if (existing) {
      await query(
        `UPDATE tracking SET
          date_modif = ?, id_user = ?, rappel_client = ?, commentaire_client = ?, constat = ?,
          date_rdv = ?
         WHERE id = ?`,
        [now, req.user.id, rappel_client, commentaire_client, constat, cr.date_rdv_time || null, existing.id]
      );
      const updated = await queryOne('SELECT * FROM tracking WHERE id = ?', [existing.id]);
      await insertTrackingHisto(query, updated, 'update', req.user.id);
      return res.json({
        success: true,
        message: 'Tracking mis à jour',
        data: { ...updated, rappel_client: !!updated.rappel_client },
      });
    }

    const insertResult = await query(
      `INSERT INTO tracking (
        id_fiche, id_compte_rendu, date_rdv, date_creation, date_modif, id_user,
        rappel_client, commentaire_client, constat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cr.id_fiche,
        idCr,
        cr.date_rdv_time || null,
        now,
        now,
        req.user.id,
        rappel_client,
        commentaire_client,
        constat,
      ]
    );

    const created = await queryOne('SELECT * FROM tracking WHERE id = ?', [insertResult.insertId]);
    await insertTrackingHisto(query, created, 'create', req.user.id);

    res.status(201).json({
      success: true,
      message: 'Tracking créé',
      data: { ...created, rappel_client: !!created.rappel_client },
    });
  } catch (error) {
    console.error('PUT /tracking/compte-rendu:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
