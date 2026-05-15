/**
 * Routes complétude fiche — montées sur le routeur /api/fiches (avant GET /:id).
 * Création : Qualité Confirmation (4).
 * Consultation / traitement : confirmateur 1 de la fiche, RE (14), RP (13).
 */
const FONCTION_QUALITE_CONFIRMATION = 4;
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

function isConfirmateur1OfFiche(userId, fiche) {
  if (!fiche || userId == null) return false;
  return Number(fiche.id_confirmateur) === Number(userId);
}

function canViewCompletude(user, fiche) {
  if (!user) return false;
  const fn = Number(user.fonction);
  if (isQualiteConfirmation(fn)) return true;
  if (isREConfirmation(fn) || isRPConfirmation(fn)) return true;
  if (isConfirmateur1OfFiche(user.id, fiche)) return true;
  return false;
}

function canCreateCompletude(user) {
  return user && isQualiteConfirmation(user.fonction);
}

function canTreatCompletude(user, fiche) {
  if (!user || !fiche) return false;
  const fn = Number(user.fonction);
  if (isREConfirmation(fn) || isRPConfirmation(fn)) return true;
  if (isConfirmateur1OfFiche(user.id, fiche)) return true;
  return false;
}

function statutLabel(statut) {
  if (statut === 'traitee') return 'Traitée';
  if (statut === 'non_traitee') return 'Non traitée';
  return 'En attente';
}

function registerFicheCompletudeRoutes(router, { authenticate, hashToIdMiddleware, query, queryOne }) {
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
          message: 'Seul le confirmateur 1 de la fiche, le RE ou le RP peut marquer la complétude comme traitée'
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
  statutLabel
};
