const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

// Récupérer les fiches confirmées (état 7) non affectées pour affectation
router.get('/fiches-confirmees', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      id_centre, 
      produit,
      departement, // Code département (2 premiers chiffres du code postal)
      id_commercial, // Filtre par commercial
      affectees // '1' pour affectées, '0' pour non affectées
    } = req.query;

    // Construire les conditions
    // Afficher uniquement les fiches confirmées
    const conditions = ['f.id_etat_final = 7'];
    const queryParams = [];

    // Filtrer selon si on veut les affectées ou non affectées
    if (affectees === '1') {
      // Fiches affectées (id_commercial > 0)
      conditions.push('f.id_commercial > 0');
    } else {
      // Fiches non affectées (par défaut)
      conditions.push('(f.id_commercial = 0 OR f.id_commercial IS NULL)');
    }

    // Filtrer par date de RDV (date_rdv_time) au lieu de date_modif_time
    // Si un filtre de date est spécifié, ne montrer que les fiches avec une date de RDV dans la plage
    if (date_debut || date_fin) {
      // Exclure les fiches sans date de RDV quand un filtre de date est appliqué
      const dateFilters = ['f.date_rdv_time IS NOT NULL'];
      
      if (date_debut) {
        dateFilters.push('f.date_rdv_time >= ?');
        queryParams.push(`${date_debut} 00:00:00`);
      }
      
      if (date_fin) {
        dateFilters.push('f.date_rdv_time <= ?');
        queryParams.push(`${date_fin} 23:59:59`);
      }
      
      conditions.push(`(${dateFilters.join(' AND ')})`);
    }

    if (id_centre) {
      conditions.push('f.id_centre = ?');
      queryParams.push(parseInt(id_centre));
    }

    if (produit && (produit === '1' || produit === '2')) {
      conditions.push('f.produit = ?');
      queryParams.push(parseInt(produit));
    }

    // Filtrer par département (2 premiers chiffres du code postal)
    // Support de plusieurs départements séparés par des virgules
    if (departement) {
      const departements = String(departement).split(',').map(d => d.trim().padStart(2, '0')).filter(d => d.length > 0);
      if (departements.length > 0) {
        if (departements.length === 1) {
          // Un seul département
          conditions.push('LEFT(f.cp, 2) = ?');
          queryParams.push(departements[0]);
        } else {
          // Plusieurs départements
          conditions.push(`LEFT(f.cp, 2) IN (${departements.map(() => '?').join(',')})`);
          queryParams.push(...departements);
        }
      }
    }

    // Filtrer par commercial
    if (id_commercial) {
      conditions.push('f.id_commercial = ?');
      queryParams.push(parseInt(id_commercial));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const fiches = await query(
      `SELECT 
        f.id,
        f.tel,
        f.gsm1,
        f.nom,
        f.prenom,
        f.adresse,
        f.cp as code_postal,
        f.ville,
        f.produit,
        f.id_centre,
        f.id_commercial,
        f.id_confirmateur,
        f.date_rdv_time,
        f.date_modif_time,
        f.valider,
        f.conf_rdv_avec,
        c.titre as centre_nom,
        com.pseudo as commercial_nom,
        conf.pseudo as confirmateur_nom,
        prod.nom as produit_nom
      FROM fiches f
      LEFT JOIN centres c ON f.id_centre = c.id
      LEFT JOIN utilisateurs com ON f.id_commercial = com.id
      LEFT JOIN utilisateurs conf ON f.id_confirmateur = conf.id
      LEFT JOIN produits prod ON f.produit = prod.id
      ${whereClause}
      AND (f.archive = 0 OR f.archive IS NULL)
      AND f.active = 1
      ORDER BY f.date_rdv_time DESC, f.date_modif_time DESC
      LIMIT 500`,
      queryParams
    );

    res.json({
      success: true,
      data: fiches
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches confirmées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches confirmées',
      error: error.message
    });
  }
});

// Affecter des fiches à un commercial
router.post('/affecter', authenticate, async (req, res) => {
  try {
    const { fiches_ids, id_commercial } = req.body;
    const userId = req.user.id;
    const dateModifTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (!fiches_ids || !Array.isArray(fiches_ids) || fiches_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune fiche sélectionnée'
      });
    }

    if (!id_commercial || id_commercial <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Commercial invalide'
      });
    }

    // Vérifier que le commercial existe et est bien un commercial (fonction 5)
    const commercial = await queryOne(
      'SELECT id, pseudo, fonction FROM utilisateurs WHERE id = ? AND etat > 0',
      [parseInt(id_commercial)]
    );

    if (!commercial) {
      return res.status(404).json({
        success: false,
        message: 'Commercial non trouvé'
      });
    }

    const results = [];
    const errors = [];

    for (const ficheId of fiches_ids) {
      try {
        // Vérifier que la fiche existe et est confirmée (état 7)
        const fiche = await queryOne(
          'SELECT id, id_commercial FROM fiches WHERE id = ? AND id_etat_final = 7',
          [parseInt(ficheId)]
        );

        if (!fiche) {
          errors.push({ fiche_id: ficheId, error: 'Fiche non trouvée ou non confirmée' });
          continue;
        }

        const ancienCommercial = fiche.id_commercial || 0;

        // Mettre à jour la fiche
        await query(
          'UPDATE fiches SET id_commercial = ? WHERE id = ?',
          [parseInt(id_commercial), parseInt(ficheId)]
        );

        // Mettre à jour ou créer l'affectation
        const affectation = await queryOne(
          'SELECT id, id_commercial FROM affectations WHERE id_fiche = ?',
          [parseInt(ficheId)]
        );

        if (affectation) {
          await query(
            `UPDATE affectations 
             SET id_commercial = ?, 
                 date_modif = UNIX_TIMESTAMP(), 
                 date_modif_time = ? 
             WHERE id = ?`,
            [parseInt(id_commercial), dateModifTime, affectation.id]
          );
        } else {
          await query(
            `INSERT INTO affectations (id_fiche, id_commercial, date_modif, date_modif_time) 
             VALUES (?, ?, UNIX_TIMESTAMP(), ?)`,
            [parseInt(ficheId), parseInt(id_commercial), dateModifTime]
          );
        }

        // Enregistrer dans modifica
        try {
          await query(
            `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, date_modif_time) 
             VALUES (?, ?, 'Affectation', ?, ?, ?)`,
            [parseInt(ficheId), userId, String(ancienCommercial), String(id_commercial), dateModifTime]
          );
        } catch (modifError) {
          console.error('Erreur lors de l\'enregistrement dans modifica:', modifError);
          // Ne pas bloquer l'affectation si modifica échoue
        }

        results.push({
          fiche_id: ficheId,
          success: true,
          commercial: commercial.pseudo
        });
      } catch (error) {
        console.error(`Erreur lors de l'affectation de la fiche ${ficheId}:`, error);
        errors.push({ fiche_id: ficheId, error: error.message });
      }
    }

    res.json({
      success: errors.length === 0,
      data: {
        affectees: results,
        erreurs: errors
      },
      message: `${results.length} fiche(s) affectée(s) avec succès${errors.length > 0 ? `, ${errors.length} erreur(s)` : ''}`
    });
  } catch (error) {
    console.error('Erreur lors de l\'affectation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'affectation',
      error: error.message
    });
  }
});

// Désaffecter des fiches (retirer l'affectation)
router.post('/desaffecter', authenticate, async (req, res) => {
  try {
    const { fiches_ids } = req.body;
    const userId = req.user.id;
    const dateModifTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (!fiches_ids || !Array.isArray(fiches_ids) || fiches_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune fiche sélectionnée'
      });
    }

    const results = [];
    const errors = [];

    for (const ficheId of fiches_ids) {
      try {
        // Vérifier que la fiche existe
        const fiche = await queryOne(
          'SELECT id, id_commercial FROM fiches WHERE id = ?',
          [parseInt(ficheId)]
        );

        if (!fiche) {
          errors.push({ fiche_id: ficheId, error: 'Fiche non trouvée' });
          continue;
        }

        const ancienCommercial = fiche.id_commercial || 0;

        // Retirer l'affectation de la fiche
        await query(
          'UPDATE fiches SET id_commercial = 0 WHERE id = ?',
          [parseInt(ficheId)]
        );

        // Mettre à jour l'affectation
        const affectation = await queryOne(
          'SELECT id FROM affectations WHERE id_fiche = ?',
          [parseInt(ficheId)]
        );

        if (affectation) {
          await query(
            `UPDATE affectations 
             SET id_commercial = 0, 
                 date_modif = UNIX_TIMESTAMP(), 
                 date_modif_time = ? 
             WHERE id = ?`,
            [dateModifTime, affectation.id]
          );
        }

        // Enregistrer dans modifica
        try {
          await query(
            `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, date_modif_time) 
             VALUES (?, ?, 'Affectation', ?, '0', ?)`,
            [parseInt(ficheId), userId, String(ancienCommercial), dateModifTime]
          );
        } catch (modifError) {
          console.error('Erreur lors de l\'enregistrement dans modifica:', modifError);
        }

        results.push({
          fiche_id: ficheId,
          success: true
        });
      } catch (error) {
        console.error(`Erreur lors de la désaffectation de la fiche ${ficheId}:`, error);
        errors.push({ fiche_id: ficheId, error: error.message });
      }
    }

    res.json({
      success: errors.length === 0,
      data: {
        desaffectees: results,
        erreurs: errors
      },
      message: `${results.length} fiche(s) désaffectée(s) avec succès${errors.length > 0 ? `, ${errors.length} erreur(s)` : ''}`
    });
  } catch (error) {
    console.error('Erreur lors de la désaffectation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désaffectation',
      error: error.message
    });
  }
});

module.exports = router;

