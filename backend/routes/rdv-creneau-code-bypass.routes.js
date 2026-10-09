const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

/** Admin (1, 7), Backoffice (11) */
const ALLOWED_FONCTIONS = new Set([1, 7, 11]);

function canViewBypassPage(fonction) {
  return ALLOWED_FONCTIONS.has(Number(fonction));
}

function buildWhere(filters) {
  const where = ['1=1'];
  const params = [];

  if (filters.date_debut) {
    where.push('b.date_creation >= ?');
    params.push(`${filters.date_debut} 00:00:00`);
  }
  if (filters.date_fin) {
    where.push('b.date_creation <= ?');
    params.push(`${filters.date_fin} 23:59:59`);
  }
  if (filters.id_utilisateur) {
    where.push('b.id_utilisateur = ?');
    params.push(Number(filters.id_utilisateur));
  }
  if (filters.id_fonction) {
    where.push('b.id_fonction = ?');
    params.push(Number(filters.id_fonction));
  }
  if (filters.dep) {
    where.push('b.dep = ?');
    params.push(String(filters.dep).padStart(2, '0'));
  }
  if (filters.motif === 'surplus') {
    where.push('b.is_surplus = 1');
  } else if (filters.motif === 'ferme_politique') {
    where.push('b.is_ferme_politique = 1');
  } else if (filters.motif === 'ferme_db') {
    where.push('b.is_ferme_db = 1');
  } else if (filters.motif === 'zero_dispo') {
    where.push('b.is_zero_dispo = 1');
  }

  return { whereSql: where.join(' AND '), params };
}

/**
 * GET /api/rdv-creneau-code-bypass
 * Liste paginée + répartition par utilisateur
 */
router.get('/', authenticate, async (req, res) => {
  try {
    if (!canViewBypassPage(req.user?.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const filters = {
      date_debut: req.query.date_debut || null,
      date_fin: req.query.date_fin || null,
      id_utilisateur: req.query.id_utilisateur || null,
      id_fonction: req.query.id_fonction || null,
      dep: req.query.dep || null,
      motif: req.query.motif || null,
    };

    const { whereSql, params } = buildWhere(filters);

    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM rdv_creneau_code_bypass b WHERE ${whereSql}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const rows = await query(
      `SELECT
         b.id,
         b.id_fiche,
         b.id_utilisateur,
         b.id_fonction,
         b.date_rdv,
         b.dep,
         b.slot_hour,
         b.week,
         b.year,
         b.is_ferme_politique,
         b.is_ferme_db,
         b.is_surplus,
         b.is_zero_dispo,
         b.motif,
         b.date_creation,
         u.pseudo AS utilisateur_pseudo,
         fn.titre AS fonction_titre,
         f.hash AS fiche_hash,
         f.nom AS fiche_nom,
         f.prenom AS fiche_prenom,
         f.cp AS fiche_cp,
         f.ville AS fiche_ville
       FROM rdv_creneau_code_bypass b
       LEFT JOIN utilisateurs u ON u.id = b.id_utilisateur
       LEFT JOIN fonctions fn ON fn.id = b.id_fonction
       LEFT JOIN fiches f ON f.id = b.id_fiche
       WHERE ${whereSql}
       ORDER BY b.date_creation DESC, b.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const byUser = await query(
      `SELECT
         b.id_utilisateur,
         u.pseudo AS utilisateur_pseudo,
         b.id_fonction,
         fn.titre AS fonction_titre,
         COUNT(*) AS total,
         SUM(CASE WHEN b.is_surplus = 1 THEN 1 ELSE 0 END) AS nb_surplus,
         SUM(CASE WHEN b.is_ferme_politique = 1 THEN 1 ELSE 0 END) AS nb_ferme_politique,
         SUM(CASE WHEN b.is_ferme_db = 1 THEN 1 ELSE 0 END) AS nb_ferme_db,
         SUM(CASE WHEN b.is_zero_dispo = 1 THEN 1 ELSE 0 END) AS nb_zero_dispo
       FROM rdv_creneau_code_bypass b
       LEFT JOIN utilisateurs u ON u.id = b.id_utilisateur
       LEFT JOIN fonctions fn ON fn.id = b.id_fonction
       WHERE ${whereSql}
       GROUP BY b.id_utilisateur, u.pseudo, b.id_fonction, fn.titre
       ORDER BY total DESC, u.pseudo ASC`,
      params
    );

    const byUserWithPct = (byUser || []).map((row) => {
      const n = Number(row.total || 0);
      return {
        ...row,
        total: n,
        nb_surplus: Number(row.nb_surplus || 0),
        nb_ferme_politique: Number(row.nb_ferme_politique || 0),
        nb_ferme_db: Number(row.nb_ferme_db || 0),
        nb_zero_dispo: Number(row.nb_zero_dispo || 0),
        part_pct: total > 0 ? Math.round((n * 1000) / total) / 10 : 0,
      };
    });

    // Utilisateurs ayant déjà un bypass (pour filtre)
    const usersFilter = await query(
      `SELECT DISTINCT b.id_utilisateur AS id, u.pseudo
       FROM rdv_creneau_code_bypass b
       LEFT JOIN utilisateurs u ON u.id = b.id_utilisateur
       ORDER BY u.pseudo ASC`
    );

    res.json({
      success: true,
      data: rows || [],
      byUser: byUserWithPct,
      filtersMeta: {
        users: usersFilter || [],
      },
      totals: {
        total,
        nb_surplus: byUserWithPct.reduce((s, r) => s + r.nb_surplus, 0),
        nb_ferme_politique: byUserWithPct.reduce((s, r) => s + r.nb_ferme_politique, 0),
        nb_ferme_db: byUserWithPct.reduce((s, r) => s + r.nb_ferme_db, 0),
        nb_zero_dispo: byUserWithPct.reduce((s, r) => s + r.nb_zero_dispo, 0),
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Erreur GET rdv-creneau-code-bypass:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des bypass créneau',
      error: error.message,
    });
  }
});

module.exports = router;
