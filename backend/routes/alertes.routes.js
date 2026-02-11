const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');
const ficheRoutes = require('./fiche.routes');
const encodeFicheId = ficheRoutes.encodeFicheId;

/**
 * Liste des agents que l'utilisateur peut filtrer sur la page Alertes (même périmètre que les alertes).
 */
router.get('/agents', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const fonction = Number(user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');

    let agentIds = null;

    if (hasControleQualite) {
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
 * - Contrôle qualité (permission controle_qualite_view) : toutes les alertes
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const fonction = Number(user?.fonction);
    const hasControleQualite = await hasPermission(fonction, 'controle_qualite_view');

    let agentIds = null; // null = tous les agents (contrôle qualité)

    if (hasControleQualite) {
      // Contrôle qualité : voir toutes les alertes
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

    const sql = `
      SELECT 
        a.id,
        a.id_fiche,
        a.id_agent,
        a.id_qualite,
        a.id_etat,
        a.id_sous_etat,
        a.num_alerte,
        a.date_alerte,
        a.nom,
        a.prenom,
        a.tel,
        a.commentaire,
        a.created_at,
        agent.pseudo AS agent_pseudo,
        qualite.pseudo AS qualite_pseudo,
        etat.titre AS etat_titre,
        sous_etat.titre AS sous_etat_titre
      FROM alert_ko a
      LEFT JOIN utilisateurs agent ON a.id_agent = agent.id
      LEFT JOIN utilisateurs qualite ON a.id_qualite = qualite.id
      LEFT JOIN etats etat ON a.id_etat = etat.id
      LEFT JOIN sous_etat ON a.id_sous_etat = sous_etat.id
      WHERE ${whereClause}
      ORDER BY a.date_alerte DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, limit, offset]);

    const data = rows.map((r) => ({
      ...r,
      fiche_hash: encodeFicheId(r.id_fiche) || null
    }));

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages }
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
