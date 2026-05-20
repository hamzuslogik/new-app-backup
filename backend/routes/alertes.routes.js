const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');
const ficheRoutes = require('./fiche.routes');
const encodeFicheId = ficheRoutes.encodeFicheId;

/** Session agent qualité qualification (fonction 8 ou CQ hors admin/RE/RP/agent qualif). */
function isQualiteQualificationAgent(fonction, hasControleQualite, isAdmin) {
  if (isAdmin) return false;
  if (Number(fonction) === 8) return true;
  return Boolean(hasControleQualite && ![2, 3, 12].includes(Number(fonction)));
}

/**
 * Liste des agents que l'utilisateur peut filtrer sur la page Alertes (même périmètre que les alertes).
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
           FROM alert_ko a
           INNER JOIN utilisateurs u ON a.id_agent = u.id
           WHERE a.id_qualite = ?
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

    if (hasControleQualite && !isQualiteQualif) {
      const agents = await query(
        'SELECT id, pseudo FROM utilisateurs WHERE fonction = 3 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC'
      );
      return res.json({ success: true, data: agents || [] });
    }
    if (fonction === 3) {
      return res.json({ success: true, data: [{ id: user.id, pseudo: user.pseudo || `Utilisateur ${user.id}` }] });
    }
    if (fonction === 2) {
      const agents = await query(
        'SELECT id, pseudo FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC',
        [user.id]
      );
      return res.json({ success: true, data: agents || [] });
    }
    if (fonction === 12) {
      const superviseurs = await query(
        'SELECT id FROM utilisateurs WHERE id_rp_qualif = ? AND fonction = 2 AND (etat > 0 OR etat IS NULL)',
        [user.id]
      );
      if (!superviseurs || superviseurs.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const superviseurIds = superviseurs.map((s) => s.id);
      const agents = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) AND fonction = 3 AND (etat > 0 OR etat IS NULL) ORDER BY pseudo ASC`,
        superviseurIds
      );
      return res.json({ success: true, data: agents || [] });
    }
    return res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Erreur GET /alertes/agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Liste des alertes KO avec filtrage par rôle :
 * - Agent qualification (fonction 3) : ses alertes (id_agent = user.id)
 * - RE qualification (fonction 2) : alertes des agents de son équipe (id_agent IN (agents où chef_equipe = user.id))
 * - RP qualification (fonction 12) : alertes des agents par RE (id_agent IN (agents sous les RE dont id_rp_qualif = user.id))
 * - Qualité qualification (fonction 8, etc.) : alertes qu'il a envoyées (id_qualite = user.id)
 * - Contrôle qualité / admin : toutes les alertes
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const fonction = Number(user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');
    const isAdmin = [1, 7].includes(fonction);
    const isQualiteQualif = isQualiteQualificationAgent(fonction, hasControleQualite, isAdmin);

    let agentIds = null; // null = tous les agents (contrôle qualité)
    let qualiteScopeId = null; // qualité qualification : ses envois uniquement

    if (isQualiteQualif) {
      qualiteScopeId = user.id;
    } else if (hasControleQualite || isAdmin) {
      agentIds = null;
    } else if (fonction === 3) {
      // Agent qualification : uniquement ses alertes
      agentIds = [user.id];
    } else if (fonction === 2) {
      // RE qualification : agents de son équipe (chef_equipe = user.id)
      const agents = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND (etat > 0 OR etat IS NULL)',
        [user.id]
      );
      agentIds = agents && agents.length ? agents.map((a) => a.id) : [];
    } else if (fonction === 12) {
      // RP qualification : agents des RE sous ce RP (superviseurs avec id_rp_qualif = user.id, puis leurs agents)
      const superviseurs = await query(
        'SELECT id FROM utilisateurs WHERE id_rp_qualif = ? AND fonction = 2 AND (etat > 0 OR etat IS NULL)',
        [user.id]
      );
      if (superviseurs && superviseurs.length > 0) {
        const superviseurIds = superviseurs.map((s) => s.id);
        const agents = await query(
          `SELECT id FROM utilisateurs WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) AND fonction = 3 AND (etat > 0 OR etat IS NULL)`,
          superviseurIds
        );
        agentIds = agents && agents.length ? agents.map((a) => a.id) : [];
      } else {
        agentIds = [];
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Réservé aux agents qualification, RE qualification, RP qualification et contrôle qualité.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (qualiteScopeId != null) {
      whereClause += ' AND a.id_qualite = ?';
      params.push(qualiteScopeId);
    }

    if (agentIds !== null) {
      if (agentIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, pages: 0 }
        });
      }
      whereClause += ` AND a.id_agent IN (${agentIds.map(() => '?').join(',')})`;
      params.push(...agentIds);
    }

    // Optionnel : filtre par id_agent (pour RE/RP/CQ)
    const id_agent_filter = req.query.id_agent ? parseInt(req.query.id_agent, 10) : null;
    if (id_agent_filter) {
      whereClause += ' AND a.id_agent = ?';
      params.push(id_agent_filter);
    }

    const date_debut = req.query.date_debut || null;
    const date_fin = req.query.date_fin || null;
    if (date_debut) {
      whereClause += ' AND DATE(a.date_alerte) >= ?';
      params.push(date_debut);
    }
    if (date_fin) {
      whereClause += ' AND DATE(a.date_alerte) <= ?';
      params.push(date_fin);
    }

    let countSql = `SELECT COUNT(*) AS total FROM alert_ko a WHERE ${whereClause}`;
    let total = 0;
    try {
      const countRow = await queryOne(countSql, params);
      total = countRow?.total ?? 0;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
      throw err;
    }

    const pages = Math.max(1, Math.ceil(total / limit));

    let rows;
    const sqlWithType = `
      SELECT 
        a.id, a.id_fiche, a.id_agent, a.id_qualite, a.type_alerte,
        a.num_alerte, a.date_alerte, a.nom, a.prenom, a.tel, a.commentaire, a.created_at,
        agent.pseudo AS agent_pseudo,
        qualite.pseudo AS qualite_pseudo
      FROM alert_ko a
      LEFT JOIN utilisateurs agent ON a.id_agent = agent.id
      LEFT JOIN utilisateurs qualite ON a.id_qualite = qualite.id
      WHERE ${whereClause}
      ORDER BY a.date_alerte DESC
      LIMIT ? OFFSET ?
    `;
    const sqlWithoutType = `
      SELECT 
        a.id, a.id_fiche, a.id_agent, a.id_qualite,
        a.num_alerte, a.date_alerte, a.nom, a.prenom, a.tel, a.commentaire, a.created_at,
        agent.pseudo AS agent_pseudo,
        qualite.pseudo AS qualite_pseudo
      FROM alert_ko a
      LEFT JOIN utilisateurs agent ON a.id_agent = agent.id
      LEFT JOIN utilisateurs qualite ON a.id_qualite = qualite.id
      WHERE ${whereClause}
      ORDER BY a.date_alerte DESC
      LIMIT ? OFFSET ?
    `;
    try {
      rows = await query(sqlWithType, [...params, limit, offset]);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.message && err.message.includes('type_alerte')) {
        rows = await query(sqlWithoutType, [...params, limit, offset]);
        rows = (rows || []).map((r) => ({ ...r, type_alerte: null }));
      } else {
        throw err;
      }
    }

    const data = (rows || []).map((r) => ({
      ...r,
      fiche_hash: encodeFicheId(r.id_fiche) || null
    }));

    let stats = null;
    if (fonction === 3) {
      try {
        const persoRow = await queryOne(
          `SELECT COUNT(*) AS total FROM alert_ko a WHERE ${whereClause} AND a.type_alerte = 'PERSO'`,
          params
        );
        const techRow = await queryOne(
          `SELECT COUNT(*) AS total FROM alert_ko a WHERE ${whereClause} AND a.type_alerte = 'TECHNIQUE'`,
          params
        );
        stats = {
          perso: Number(persoRow?.total) || 0,
          technique: Number(techRow?.total) || 0
        };
      } catch (statsErr) {
        if (statsErr.code === 'ER_BAD_FIELD_ERROR' && statsErr.message?.includes('type_alerte')) {
          stats = { perso: Number(total) || 0, technique: 0 };
        } else if (statsErr.code !== 'ER_NO_SUCH_TABLE') {
          throw statsErr;
        } else {
          stats = { perso: 0, technique: 0 };
        }
      }
    }

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages },
      ...(stats ? { stats } : {})
    });
  } catch (error) {
    console.error('Erreur GET /alertes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la récupération des alertes'
    });
  }
});

module.exports = router;
