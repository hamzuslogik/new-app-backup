/**
 * Routes complétude fiche — montées sur le routeur /api/fiches (avant GET /:id).
 * Création : Qualité Confirmation (4).
 * Consultation / traitement : tous les confirmateurs (6), RE (14), RP (13).
 */
const { executeWorkflow } = require('../services/workflow/workflow-executor');

const FONCTION_QUALITE_CONFIRMATION = 4;
const FONCTION_CONFIRMATEUR = 6;
const FONCTION_RP_CONFIRMATION = 13;
const FONCTION_RE_CONFIRMATION = 14;

function isQualiteConfirmation(fonction) {
  return Number(fonction) === FONCTION_QUALITE_CONFIRMATION;
}

function isREConfirmation(fonction) {
  return Number(fonction) === FONCTION_RE_CONFIRMATION;
}

function isRPConfirmation(fonction) {
  return Number(fonction) === FONCTION_RP_CONFIRMATION;
}

function getConfirmateur1IdFromFiche(fiche) {
  if (!fiche || fiche.id_confirmateur == null) return null;
  const id = Number(fiche.id_confirmateur);
  return id > 0 ? id : null;
}

function isConfirmateur1OfFiche(userId, fiche) {
  if (!fiche || userId == null) return false;
  const conf1 = getConfirmateur1IdFromFiche(fiche);
  return conf1 != null && Number(conf1) === Number(userId);
}

function isConfirmateur(fonction) {
  return Number(fonction) === FONCTION_CONFIRMATEUR;
}

function canViewCompletude(user, fiche) {
  if (!user) return false;
  const fn = Number(user.fonction);
  if (isQualiteConfirmation(fn)) return true;
  if (isREConfirmation(fn) || isRPConfirmation(fn)) return true;
  if (isConfirmateur(fn)) return true;
  return false;
}

function canCreateCompletude(user) {
  return user && isQualiteConfirmation(user.fonction);
}

function canTreatCompletude(user, fiche) {
  if (!user || !fiche) return false;
  const fn = Number(user.fonction);
  if (isREConfirmation(fn) || isRPConfirmation(fn)) return true;
  if (isConfirmateur(fn)) return true;
  return false;
}

function statutLabel(statut) {
  if (statut === 'traitee') return 'Traitée';
  if (statut === 'non_traitee') return 'Non traitée';
  return 'En attente';
}

function canAccessListeCompletudes(fonction) {
  return isQualiteConfirmation(fonction) || isREConfirmation(fonction) || isRPConfirmation(fonction);
}

/** Périmètre fiches (confirmateur 1) pour RE / RP / filtre QC. */
async function buildFicheScopeForListe(query, queryOne, user, { id_confirmateur, id_re }) {
  const fn = Number(user.fonction);
  const conditions = [];
  const params = [];

  if (isQualiteConfirmation(fn)) {
    if (id_confirmateur) {
      const cid = parseInt(id_confirmateur, 10);
      if (!Number.isNaN(cid) && cid > 0) {
        conditions.push('f.id_confirmateur = ?');
        params.push(cid);
      }
    }
    return { conditions, params };
  }

  if (isREConfirmation(fn)) {
    if (id_confirmateur && id_confirmateur !== 'all') {
      const confCheck = await queryOne(
        `SELECT id FROM utilisateurs WHERE id = ? AND chef_equipe = ? AND fonction = ?
         AND (etat > 0 OR etat IS NULL)`,
        [id_confirmateur, user.id, FONCTION_CONFIRMATEUR]
      );
      if (!confCheck) {
        return { conditions: ['1 = 0'], params: [] };
      }
      conditions.push('f.id_confirmateur = ?');
      params.push(parseInt(id_confirmateur, 10));
    } else {
      const confs = await query(
        `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = ?
         AND (etat > 0 OR etat IS NULL)`,
        [user.id, FONCTION_CONFIRMATEUR]
      );
      const confIds = (confs || []).map((c) => c.id);
      if (confIds.length === 0) {
        return { conditions: ['1 = 0'], params: [] };
      }
      const ph = confIds.map(() => '?').join(',');
      conditions.push(`f.id_confirmateur IN (${ph})`);
      params.push(...confIds);
    }
    return { conditions, params };
  }

  if (isRPConfirmation(fn)) {
    let reIds = [];
    if (id_re && id_re !== 'all') {
      const reCheck = await queryOne(
        `SELECT id FROM utilisateurs WHERE id = ? AND chef_equipe = ? AND fonction = ?
         AND (etat > 0 OR etat IS NULL)`,
        [id_re, user.id, FONCTION_RE_CONFIRMATION]
      );
      if (!reCheck) {
        return { conditions: ['1 = 0'], params: [] };
      }
      reIds = [parseInt(id_re, 10)];
    } else {
      const reList = await query(
        `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = ?
         AND (etat > 0 OR etat IS NULL)`,
        [user.id, FONCTION_RE_CONFIRMATION]
      );
      reIds = (reList || []).map((r) => r.id);
    }
    if (reIds.length === 0) {
      return { conditions: ['1 = 0'], params: [] };
    }
    const phRE = reIds.map(() => '?').join(',');
    const confs = await query(
      `SELECT id FROM utilisateurs WHERE chef_equipe IN (${phRE}) AND fonction = ?
       AND (etat > 0 OR etat IS NULL)`,
      [...reIds, FONCTION_CONFIRMATEUR]
    );
    const confIds = (confs || []).map((c) => c.id);
    if (confIds.length === 0) {
      return { conditions: ['1 = 0'], params: [] };
    }
    if (id_confirmateur && id_confirmateur !== 'all') {
      const cid = parseInt(id_confirmateur, 10);
      if (!confIds.includes(cid)) {
        return { conditions: ['1 = 0'], params: [] };
      }
      conditions.push('f.id_confirmateur = ?');
      params.push(cid);
    } else {
      const phC = confIds.map(() => '?').join(',');
      conditions.push(`f.id_confirmateur IN (${phC})`);
      params.push(...confIds);
    }
    return { conditions, params };
  }

  return { conditions: ['1 = 0'], params: [] };
}

function registerFicheCompletudeRoutes(router, { authenticate, hashToIdMiddleware, query, queryOne, encodeFicheId }) {
  const ficheIdFromReq = (req) => {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    return id && !Number.isNaN(id) && id > 0 ? id : null;
  };

  const loadFicheForCompletude = async (idFiche) => {
    return queryOne(
      'SELECT id, id_confirmateur FROM fiches WHERE id = ?',
      [idFiche]
    );
  };

  const loadFicheForWorkflow = async (idFiche) => {
    try {
      return await queryOne('SELECT * FROM fiches WHERE id = ?', [idFiche]);
    } catch {
      return null;
    }
  };

  const buildCompletudeWorkflowPayload = (row) => {
    if (!row) return null;
    return {
      id: row.id,
      id_fiche: row.id_fiche,
      motif: row.motif,
      completes: row.completes,
      statut: row.statut,
      id_created_by: row.id_created_by,
      created_by_pseudo: row.created_by_pseudo ?? null,
      id_traite_par: row.id_traite_par ?? null,
      traite_par_pseudo: row.traite_par_pseudo ?? null,
      reponse_traitement: row.reponse_traitement ?? null,
      date_creation: row.date_creation,
      date_traitement: row.date_traitement ?? null,
    };
  };

  router.get('/liste-completudes', authenticate, async (req, res) => {
    try {
      if (!canAccessListeCompletudes(req.user.fonction)) {
        return res.status(403).json({
          success: false,
          message: 'Accès réservé à la Qualité Confirmation, au RE et au RP'
        });
      }

      const {
        page = 1,
        limit = 50,
        statut,
        date_debut,
        date_fin,
        id_confirmateur,
        id_re,
        search
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const whereParts = ['1 = 1'];
      const params = [];

      const scope = await buildFicheScopeForListe(query, queryOne, req.user, {
        id_confirmateur,
        id_re
      });
      whereParts.push(...scope.conditions);
      params.push(...scope.params);

      if (statut && ['en_attente', 'traitee', 'non_traitee'].includes(String(statut))) {
        whereParts.push('c.statut = ?');
        params.push(statut);
      }

      if (date_debut && /^\d{4}-\d{2}-\d{2}$/.test(String(date_debut))) {
        whereParts.push('c.date_creation >= ?');
        params.push(`${date_debut} 00:00:00`);
      }
      if (date_fin && /^\d{4}-\d{2}-\d{2}$/.test(String(date_fin))) {
        whereParts.push('c.date_creation <= ?');
        params.push(`${date_fin} 23:59:59`);
      }

      const searchTrim = String(search || '').trim();
      if (searchTrim) {
        const like = `%${searchTrim}%`;
        whereParts.push('(f.nom LIKE ? OR f.prenom LIKE ? OR f.tel LIKE ? OR f.gsm1 LIKE ? OR c.motif LIKE ?)');
        params.push(like, like, like, like, like);
      }

      const whereSql = whereParts.join(' AND ');
      const fromJoin = `
        FROM fiche_completude c
        INNER JOIN fiches f ON f.id = c.id_fiche
        LEFT JOIN utilisateurs u_create ON c.id_created_by = u_create.id
        LEFT JOIN utilisateurs u_trait ON c.id_traite_par = u_trait.id
        LEFT JOIN utilisateurs u_conf ON f.id_confirmateur = u_conf.id
        WHERE ${whereSql}`;

      let total = 0;
      let rows = [];
      try {
        const totalRow = await queryOne(`SELECT COUNT(*) AS total ${fromJoin}`, params);
        total = totalRow?.total || 0;
        rows = await query(
          `SELECT c.*,
            f.id AS fiche_id,
            f.nom AS fiche_nom,
            f.prenom AS fiche_prenom,
            f.tel AS fiche_tel,
            f.id_confirmateur,
            u_create.pseudo AS created_by_pseudo,
            u_trait.pseudo AS traite_par_pseudo,
            u_conf.pseudo AS confirmateur_pseudo
           ${fromJoin}
           ORDER BY c.date_creation DESC
           LIMIT ? OFFSET ?`,
          [...params, limitNum, offset]
        );
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.json({
            success: true,
            data: [],
            pagination: { page: pageNum, limit: limitNum, total: 0, pages: 1 },
            permissions: { can_treat: isREConfirmation(req.user.fonction) || isRPConfirmation(req.user.fonction) }
          });
        }
        throw err;
      }

      const fn = Number(req.user.fonction);
      const userCanTreatRole = isREConfirmation(fn) || isRPConfirmation(fn);

      res.json({
        success: true,
        data: (rows || []).map((r) => {
          const ficheRef = { id_confirmateur: r.id_confirmateur };
          const canTreatRow =
            r.statut === 'en_attente' &&
            (userCanTreatRole || isConfirmateur1OfFiche(req.user.id, ficheRef));
          return {
            ...r,
            hash: encodeFicheId ? encodeFicheId(r.fiche_id) : r.fiche_id,
            statut_label: statutLabel(r.statut),
            can_treat: canTreatRow
          };
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        },
        permissions: {
          can_treat: userCanTreatRole
        }
      });
    } catch (error) {
      console.error('GET liste-completudes:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
    }
  });

  router.get('/:hash/completude', authenticate, hashToIdMiddleware, async (req, res) => {
    try {
      const idFiche = ficheIdFromReq(req);
      if (!idFiche) {
        return res.status(400).json({ success: false, message: 'Identifiant de fiche invalide' });
      }

      const fiche = await loadFicheForCompletude(idFiche);
      if (!fiche) {
        return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
      }
      if (!canViewCompletude(req.user, fiche)) {
        return res.status(403).json({ success: false, message: 'Accès non autorisé' });
      }

      let rows;
      try {
        rows = await query(
          `SELECT c.*,
            u_create.pseudo AS created_by_pseudo,
            u_trait.pseudo AS traite_par_pseudo
           FROM fiche_completude c
           LEFT JOIN utilisateurs u_create ON c.id_created_by = u_create.id
           LEFT JOIN utilisateurs u_trait ON c.id_traite_par = u_trait.id
           WHERE c.id_fiche = ?
           ORDER BY c.date_creation DESC`,
          [idFiche]
        );
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.json({
            success: true,
            data: [],
            permissions: {
              can_create: canCreateCompletude(req.user),
              can_treat: canTreatCompletude(req.user, fiche)
            }
          });
        }
        throw err;
      }

      res.json({
        success: true,
        data: (rows || []).map((r) => ({
          ...r,
          statut_label: statutLabel(r.statut)
        })),
        permissions: {
          can_create: canCreateCompletude(req.user),
          can_treat: canTreatCompletude(req.user, fiche)
        }
      });
    } catch (error) {
      console.error('GET fiche completude:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
    }
  });

  router.post('/:hash/completude', authenticate, hashToIdMiddleware, async (req, res) => {
    try {
      const idFiche = ficheIdFromReq(req);
      if (!idFiche) {
        return res.status(400).json({ success: false, message: 'Identifiant de fiche invalide' });
      }
      if (!canCreateCompletude(req.user)) {
        return res.status(403).json({ success: false, message: 'Accès réservé à la Qualité Confirmation' });
      }

      const motif = String(req.body.motif || '').trim();
      const completes = String(req.body.completes || '').trim();
      if (!motif) {
        return res.status(400).json({ success: false, message: 'Le motif est requis' });
      }
      if (!completes) {
        return res.status(400).json({ success: false, message: 'Les complétudes sont requises' });
      }

      const fiche = await loadFicheForCompletude(idFiche);
      if (!fiche) {
        return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const result = await query(
        `INSERT INTO fiche_completude
         (id_fiche, motif, completes, statut, id_created_by, date_creation)
         VALUES (?, ?, ?, 'en_attente', ?, ?)`,
        [idFiche, motif.slice(0, 500), completes, req.user.id, now]
      );

      const insertId = result?.insertId;
      const created = insertId
        ? await queryOne(
            `SELECT c.*, u.pseudo AS created_by_pseudo
             FROM fiche_completude c
             LEFT JOIN utilisateurs u ON c.id_created_by = u.id
             WHERE c.id = ?`,
            [insertId]
          )
        : null;

      res.status(201).json({
        success: true,
        message: 'Complétude enregistrée',
        data: created ? { ...created, statut_label: statutLabel(created.statut) } : null
      });

      if (created) {
        const ficheWorkflow = await loadFicheForWorkflow(idFiche);
        executeWorkflow('completude_created', {
          fiche: ficheWorkflow || undefined,
          user: req.user,
          completude: buildCompletudeWorkflowPayload(created),
        }).catch((wfError) => {
          console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (completude_created):', wfError);
        });
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
          success: false,
          message: 'Table fiche_completude absente. Exécutez backend/scripts/create-fiche-completude-table.sql'
        });
      }
      console.error('POST fiche completude:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
    }
  });

  router.patch('/:hash/completude/:completudeId', authenticate, hashToIdMiddleware, async (req, res) => {
    try {
      const idFiche = ficheIdFromReq(req);
      const completudeId = parseInt(req.params.completudeId, 10);
      if (!idFiche || !completudeId || Number.isNaN(completudeId)) {
        return res.status(400).json({ success: false, message: 'Identifiants invalides' });
      }

      const fiche = await loadFicheForCompletude(idFiche);
      if (!fiche) {
        return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
      }
      if (!canTreatCompletude(req.user, fiche)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les confirmateurs, le RE ou le RP peuvent marquer la complétude comme traitée'
        });
      }

      const statut = String(req.body.statut || '').trim();
      if (statut !== 'traitee') {
        return res.status(400).json({
          success: false,
          message: 'Statut invalide (traitee attendu)'
        });
      }

      const row = await queryOne(
        'SELECT id, statut FROM fiche_completude WHERE id = ? AND id_fiche = ?',
        [completudeId, idFiche]
      );
      if (!row) {
        return res.status(404).json({ success: false, message: 'Complétude introuvable' });
      }
      if (row.statut !== 'en_attente') {
        return res.status(400).json({ success: false, message: 'Cette complétude a déjà été traitée' });
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const reponse = req.body.reponse_traitement != null
        ? String(req.body.reponse_traitement).trim() || null
        : null;

      await query(
        `UPDATE fiche_completude
         SET statut = 'traitee', id_traite_par = ?, reponse_traitement = ?, date_traitement = ?
         WHERE id = ? AND id_fiche = ?`,
        [req.user.id, reponse, now, completudeId, idFiche]
      );

      const updated = await queryOne(
        `SELECT c.*,
          u_create.pseudo AS created_by_pseudo,
          u_trait.pseudo AS traite_par_pseudo
         FROM fiche_completude c
         LEFT JOIN utilisateurs u_create ON c.id_created_by = u_create.id
         LEFT JOIN utilisateurs u_trait ON c.id_traite_par = u_trait.id
         WHERE c.id = ?`,
        [completudeId]
      );

      res.json({
        success: true,
        message: 'Complétude marquée comme traitée',
        data: updated ? { ...updated, statut_label: statutLabel(updated.statut) } : null
      });

      if (updated) {
        const ficheWorkflow = await loadFicheForWorkflow(idFiche);
        executeWorkflow('completude_accepted', {
          fiche: ficheWorkflow || undefined,
          user: req.user,
          completude: buildCompletudeWorkflowPayload(updated),
        }).catch((wfError) => {
          console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (completude_accepted):', wfError);
        });
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
          success: false,
          message: 'Table fiche_completude absente. Exécutez backend/scripts/create-fiche-completude-table.sql'
        });
      }
      console.error('PATCH fiche completude:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
    }
  });
}

module.exports = {
  registerFicheCompletudeRoutes,
  isQualiteConfirmation,
  canViewCompletude,
  canCreateCompletude,
  canTreatCompletude,
  canAccessListeCompletudes,
  statutLabel
};
