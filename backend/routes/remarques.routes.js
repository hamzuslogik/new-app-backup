const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');
const { executeWorkflow } = require('../services/workflow/workflow-executor');

const NATURES_REMARQUE = [
  'Discours non conforme',
  'Traitement',
  'Fausse information',
  'Coordonnées',
  'Autres'
];

/** Session agent qualité qualification (fonction 8 ou CQ hors admin/RE/RP/agent qualif). */
function isQualiteQualificationAgent(fonction, hasControleQualite, isAdmin) {
  if (isAdmin) return false;
  if (Number(fonction) === 8) return true;
  return Boolean(hasControleQualite && ![2, 3, 12].includes(Number(fonction)));
}

/** IDs des agents qualification (fonction 3) visibles pour RE / RP / agent qualif. */
async function getDestinataireIdsForQualifScope(user) {
  const fonction = Number(user?.fonction);
  if (fonction === 3) {
    return [user.id];
  }
  if (fonction === 2) {
    const agents = await query(
      'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND (etat > 0 OR etat IS NULL)',
      [user.id]
    );
    return agents?.length ? agents.map((a) => a.id) : [];
  }
  if (fonction === 12) {
    const superviseurs = await query(
      'SELECT id FROM utilisateurs WHERE id_rp_qualif = ? AND fonction = 2 AND (etat > 0 OR etat IS NULL)',
      [user.id]
    );
    if (!superviseurs?.length) return [];
    const superviseurIds = superviseurs.map((s) => s.id);
    const agents = await query(
      `SELECT id FROM utilisateurs WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) AND fonction = 3 AND (etat > 0 OR etat IS NULL)`,
      superviseurIds
    );
    return agents?.length ? agents.map((a) => a.id) : [];
  }
  return null;
}

/**
 * Liste des remarques avec filtrage par rôle :
 * - Agent qualification (fonction 3) : uniquement les remarques qui lui sont adressées (id_destinataire = user.id)
 * - RE qualification (fonction 2) : remarques adressées aux agents de son équipe
 * - RP qualification (fonction 12) : remarques adressées aux agents sous sa responsabilité (via RE)
 * - Qualité qualification (fonction 8, etc.) : uniquement les remarques qu'il a envoyées (id_expediteur = user.id)
 * - Admin / supervision CQ : toutes les remarques avec filtres optionnels
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const fonction = Number(user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');
    const isAdmin = [1, 7].includes(fonction); // Admin, Resp ADV : voient tout
    const isQualiteQualif = isQualiteQualificationAgent(fonction, hasControleQualite, isAdmin);

    let destinataireIds = null; // null = tous (qualité / admin)
    let expediteurScopeId = null; // qualité qualification : ses envois uniquement

    if (isQualiteQualif) {
      expediteurScopeId = user.id;
    } else if (fonction === 3 || fonction === 2 || fonction === 12) {
      // RE / RP / agent qualif : remarques adressées aux agents de leur périmètre (priorité sur CQ global)
      destinataireIds = await getDestinataireIdsForQualifScope(user);
    } else if (hasControleQualite || isAdmin) {
      destinataireIds = null;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Réservé aux agents qualification, RE qualification, RP qualification et contrôle qualité.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const id_destinataire = req.query.id_destinataire ? parseInt(req.query.id_destinataire, 10) : null;
    const id_expediteur = req.query.id_expediteur ? parseInt(req.query.id_expediteur, 10) : null;
    const nature_remarque = req.query.nature_remarque || null;
    const recherche = (req.query.recherche || '').trim();
    const date_debut = req.query.date_debut || null;
    const date_fin = req.query.date_fin || null;

    let whereClause = '1=1';
    const params = [];
    const joinClause = `
      LEFT JOIN utilisateurs exp ON r.id_expediteur = exp.id
      LEFT JOIN utilisateurs dest ON r.id_destinataire = dest.id`;

    if (expediteurScopeId != null) {
      whereClause += ' AND r.id_expediteur = ?';
      params.push(expediteurScopeId);
    }

    if (destinataireIds !== null) {
      if (destinataireIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 }
        });
      }
      whereClause += ` AND r.id_destinataire IN (${destinataireIds.map(() => '?').join(',')})`;
      params.push(...destinataireIds);
    }

    if (id_destinataire) {
      whereClause += ' AND r.id_destinataire = ?';
      params.push(id_destinataire);
    }
    if (id_expediteur && expediteurScopeId == null) {
      whereClause += ' AND r.id_expediteur = ?';
      params.push(id_expediteur);
    }
    if (date_debut) {
      whereClause += ' AND DATE(r.date_remarque) >= ?';
      params.push(date_debut);
    }
    if (date_fin) {
      whereClause += ' AND DATE(r.date_remarque) <= ?';
      params.push(date_fin);
    }
    if (nature_remarque) {
      whereClause += ' AND r.nature_remarque = ?';
      params.push(nature_remarque);
    }
    if (recherche) {
      const term = `%${recherche}%`;
      whereClause += ' AND (r.nature_remarque LIKE ? OR r.commentaire LIKE ? OR exp.pseudo LIKE ? OR dest.pseudo LIKE ?)';
      params.push(term, term, term, term);
    }

    let total = 0;
    try {
      const countRow = await queryOne(
        `SELECT COUNT(*) AS total FROM remarques r ${joinClause} WHERE ${whereClause}`,
        params
      );
      total = countRow?.total ?? 0;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
      throw err;
    }

    const pages = Math.max(1, Math.ceil(total / limit));

    const sql = `
      SELECT 
        r.id,
        r.nature_remarque,
        r.commentaire,
        r.id_expediteur,
        r.id_destinataire,
        r.date_remarque,
        r.id_fiche,
        r.created_at,
        exp.pseudo AS expediteur_pseudo,
        dest.pseudo AS destinataire_pseudo
      FROM remarques r
      ${joinClause}
      WHERE ${whereClause}
      ORDER BY r.date_remarque DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, limit, offset]);

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, pages }
    });
  } catch (error) {
    console.error('Erreur GET /remarques:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la récupération des remarques'
    });
  }
});

/**
 * Créer une remarque (réservé aux agents qualité / admin).
 * Body: nature_remarque, commentaire, id_destinataire, id_fiche (optionnel)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const fonction = Number(req.user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');
    const isAdmin = [1, 7].includes(fonction);

    if (!hasControleQualite && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les agents qualité et les administrateurs peuvent envoyer des remarques.'
      });
    }

    const { nature_remarque, commentaire, id_destinataire, id_fiche } = req.body;
    if (!nature_remarque || !id_destinataire) {
      return res.status(400).json({
        success: false,
        message: 'Nature de la remarque et destinataire obligatoires.'
      });
    }
    if (!NATURES_REMARQUE.includes(nature_remarque)) {
      return res.status(400).json({
        success: false,
        message: 'Nature de remarque non valide.'
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const idFicheParsed = id_fiche != null && id_fiche !== '' ? parseInt(id_fiche, 10) : null;
    const idDestParsed = parseInt(id_destinataire, 10);
    let insertResult;
    try {
      insertResult = await query(
        `INSERT INTO remarques (nature_remarque, commentaire, id_expediteur, id_destinataire, date_remarque, id_fiche)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          nature_remarque,
          commentaire || null,
          req.user.id,
          idDestParsed,
          now,
          idFicheParsed
        ]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
          success: false,
          message: 'Table remarques non créée. Exécutez le script create_table_remarques.sql.'
        });
      }
      throw insertErr;
    }

    res.status(201).json({
      success: true,
      message: 'Remarque envoyée.',
      data: { nature_remarque, id_destinataire: idDestParsed, date_remarque: now }
    });

    const remarqueId = insertResult && insertResult.insertId ? insertResult.insertId : null;
    let fiche = null;
    if (idFicheParsed) {
      try {
        fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [idFicheParsed]);
      } catch (e) {
        /* ignore */
      }
    }
    executeWorkflow('remarque_created', {
      user: req.user,
      fiche: fiche || undefined,
      fiche_id: idFicheParsed || undefined,
      remarque: {
        id: remarqueId,
        nature_remarque,
        commentaire: commentaire || null,
        id_expediteur: req.user.id,
        id_destinataire: idDestParsed,
        id_fiche: idFicheParsed,
        date_remarque: now
      }
    }).catch((wfError) => {
      console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (remarque_created):', wfError);
    });
  } catch (error) {
    console.error('Erreur POST /remarques:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'envoi de la remarque'
    });
  }
});

/**
 * Agents qualification filtrables (même périmètre que la liste des remarques).
 */
router.get('/agents', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const fonction = Number(user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');
    const isAdmin = [1, 7].includes(fonction);
    const isQualiteQualif = isQualiteQualificationAgent(fonction, hasControleQualite, isAdmin);

    if (isQualiteQualif) {
      try {
        const agents = await query(
          `SELECT DISTINCT u.id, u.pseudo
           FROM remarques r
           INNER JOIN utilisateurs u ON r.id_destinataire = u.id
           WHERE r.id_expediteur = ?
           ORDER BY u.pseudo ASC`,
          [user.id]
        );
        return res.json({ success: true, data: agents || [] });
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.json({ success: true, data: [] });
        }
        throw err;
      }
    }

    if (fonction === 3 || fonction === 2 || fonction === 12) {
      const ids = await getDestinataireIdsForQualifScope(user);
      if (!ids?.length) {
        return res.json({ success: true, data: [] });
      }
      const agents = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY pseudo ASC`,
        ids
      );
      return res.json({ success: true, data: agents || [] });
    }

    if (hasControleQualite || isAdmin) {
      const agents = await query(
        'SELECT id, pseudo FROM utilisateurs WHERE fonction = 3 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC'
      );
      return res.json({ success: true, data: agents || [] });
    }

    return res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Erreur GET /remarques/agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Natures de remarque autorisées (pour le formulaire).
 */
router.get('/natures', authenticate, (req, res) => {
  res.json({ success: true, data: NATURES_REMARQUE });
});

module.exports = router;
