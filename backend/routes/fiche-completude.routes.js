/**
 * Routes complétude fiche — montées sur le routeur /api/fiches (avant GET /:id).
 */
const FONCTION_QUALITE_CONFIRMATION = 4;

function isQualiteConfirmation(fonction) {
  return Number(fonction) === FONCTION_QUALITE_CONFIRMATION;
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

  router.get('/:hash/completude', authenticate, hashToIdMiddleware, async (req, res) => {
    try {
      const idFiche = ficheIdFromReq(req);
      if (!idFiche) {
        return res.status(400).json({ success: false, message: 'Identifiant de fiche invalide' });
      }
      if (!isQualiteConfirmation(req.user.fonction)) {
        return res.status(403).json({ success: false, message: 'Accès réservé à la Qualité Confirmation' });
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
          return res.json({ success: true, data: [] });
        }
        throw err;
      }

      res.json({
        success: true,
        data: (rows || []).map((r) => ({
          ...r,
          statut_label: statutLabel(r.statut)
        }))
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
      if (!isQualiteConfirmation(req.user.fonction)) {
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

      const fiche = await queryOne('SELECT id FROM fiches WHERE id = ?', [idFiche]);
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
      if (!isQualiteConfirmation(req.user.fonction)) {
        return res.status(403).json({ success: false, message: 'Accès réservé à la Qualité Confirmation' });
      }

      const statut = String(req.body.statut || '').trim();
      if (statut !== 'traitee' && statut !== 'non_traitee') {
        return res.status(400).json({
          success: false,
          message: 'Statut invalide (traitee ou non_traitee attendu)'
        });
      }

      const row = await queryOne(
        'SELECT id FROM fiche_completude WHERE id = ? AND id_fiche = ?',
        [completudeId, idFiche]
      );
      if (!row) {
        return res.status(404).json({ success: false, message: 'Complétude introuvable' });
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const reponse = req.body.reponse_traitement != null
        ? String(req.body.reponse_traitement).trim() || null
        : null;

      await query(
        `UPDATE fiche_completude
         SET statut = ?, id_traite_par = ?, reponse_traitement = ?, date_traitement = ?
         WHERE id = ? AND id_fiche = ?`,
        [statut, req.user.id, reponse, now, completudeId, idFiche]
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
        message: `Complétude marquée : ${statutLabel(statut)}`,
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

module.exports = { registerFicheCompletudeRoutes, isQualiteConfirmation, statutLabel };
