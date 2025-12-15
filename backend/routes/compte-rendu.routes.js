const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { checkPermissionCode, hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// =====================================================
// ROUTE: POST /api/compte-rendu
// Créer un compte rendu (pour les commerciaux)
// =====================================================
router.post('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Vérifier que l'utilisateur est un commercial (fonction 5)
    if (user.fonction !== 5) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les commerciaux peuvent créer des comptes rendus'
      });
    }

    const { 
      id_fiche, 
      modifications, 
      commentaire,
      id_etat_final,
      id_sous_etat,
      // Informations de vente
      ph3_installateur,
      ph3_pac,
      ph3_puissance,
      ph3_puissance_pv,
      ph3_rr_model,
      ph3_ballon,
      ph3_marque_ballon,
      ph3_alimentation,
      ph3_type,
      ph3_prix,
      ph3_bonus_30,
      ph3_mensualite,
      ph3_attente,
      nbr_annee_finance,
      credit_immobilier,
      credit_autre
    } = req.body;

    // Validation
    if (!id_fiche) {
      return res.status(400).json({
        success: false,
        message: 'ID de fiche requis'
      });
    }

    if (!modifications || typeof modifications !== 'object' || Object.keys(modifications).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins une modification est requise'
      });
    }

    // Vérifier que la fiche existe et appartient au commercial
    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id_fiche]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    // Vérifier que le commercial est assigné à cette fiche
    if (fiche.id_commercial !== user.id && fiche.id_commercial_2 !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas assigné à cette fiche'
      });
    }

    // Vérifier qu'il n'y a pas déjà un compte rendu en attente pour cette fiche
    const pendingCompteRendu = await queryOne(
      'SELECT id FROM compte_rendu_pending WHERE id_fiche = ? AND id_commercial = ? AND statut = ?',
      [id_fiche, user.id, 'pending']
    );

    if (pendingCompteRendu) {
      return res.status(400).json({
        success: false,
        message: 'Un compte rendu est déjà en attente pour cette fiche'
      });
    }

    // Liste des champs autorisés pour éviter les injections SQL
    const allowedFields = [
      'nom', 'prenom', 'civ', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville',
      'situation_conjugale', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'date_rdv_time', 'date_appel_time', 'id_centre', 'id_commercial',
      'id_commercial_2', 'id_etat_final',
      'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'commentaire_commercial', 'type_contrat_mr', 'type_contrat_madame',
      // Champs de confirmation
      'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
      'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
      'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec',
      'surface_chauffee', 'consommation_chauffage', 'mode_chauffage', 'annee_systeme_chauffage'
    ];

    // Filtrer les modifications pour ne garder que les champs autorisés
    const filteredModifications = {};
    for (const [key, value] of Object.entries(modifications)) {
      if (allowedFields.includes(key)) {
        filteredModifications[key] = value;
      }
    }

    // Vérifier qu'il y a au moins une modification, un état, ou des informations de vente
    const hasModifications = Object.keys(filteredModifications).length > 0;
    const hasEtat = id_etat_final !== undefined && id_etat_final !== null;
    const hasPh3Data = ph3_installateur || ph3_pac || ph3_puissance || ph3_prix || ph3_mensualite;
    
    if (!hasModifications && !hasEtat && !hasPh3Data) {
      return res.status(400).json({
        success: false,
        message: 'Au moins une modification, un état, ou une information de vente est requise'
      });
    }

    // Créer le compte rendu
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await query(
      `INSERT INTO compte_rendu_pending 
       (id_fiche, id_commercial, statut, id_etat_final, id_sous_etat, modifications, commentaire, 
        ph3_installateur, ph3_pac, ph3_puissance, ph3_puissance_pv, ph3_rr_model, ph3_ballon, 
        ph3_marque_ballon, ph3_alimentation, ph3_type, ph3_prix, ph3_bonus_30, ph3_mensualite, 
        ph3_attente, nbr_annee_finance, credit_immobilier, credit_autre, date_creation) 
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_fiche, 
        user.id, 
        id_etat_final || null,
        id_sous_etat || null,
        JSON.stringify(filteredModifications), 
        commentaire || null,
        ph3_installateur || null,
        ph3_pac || null,
        ph3_puissance || null,
        ph3_puissance_pv || null,
        ph3_rr_model || null,
        ph3_ballon || null,
        ph3_marque_ballon || null,
        ph3_alimentation || null,
        ph3_type || null,
        ph3_prix || null,
        ph3_bonus_30 || null,
        ph3_mensualite || null,
        ph3_attente || null,
        nbr_annee_finance || null,
        credit_immobilier || null,
        credit_autre || null,
        now
      ]
    );

    res.json({
      success: true,
      message: 'Compte rendu créé avec succès, en attente d\'approbation',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création du compte rendu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte rendu',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: GET /api/compte-rendu
// Lister les comptes rendus (pour les commerciaux et admins)
// =====================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { statut, id_fiche } = req.query;

    console.log('[COMPTE-RENDU] GET /compte-rendu - User:', user.id, 'Fonction:', user.fonction, 'Query:', { statut, id_fiche });

    let whereConditions = [];
    let params = [];

    // Si commercial, voir seulement ses propres comptes rendus
    if (user.fonction === 5) {
      whereConditions.push('cr.id_commercial = ?');
      params.push(user.id);
    }
    // Si admin, voir tous les comptes rendus

    // Filtrer par statut si spécifié
    if (statut) {
      whereConditions.push('cr.statut = ?');
      params.push(statut);
    }

    // Filtrer par fiche si spécifié
    if (id_fiche) {
      whereConditions.push('cr.id_fiche = ?');
      params.push(id_fiche);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Sélectionner explicitement les colonnes pour éviter les erreurs si certaines colonnes n'existent pas
    const sqlQuery = `SELECT 
        cr.id,
        cr.id_fiche,
        cr.id_commercial,
        cr.id_approbateur,
        cr.statut,
        cr.id_etat_final,
        cr.id_sous_etat,
        cr.modifications,
        cr.commentaire,
        cr.commentaire_admin,
        cr.date_creation,
        cr.date_modif,
        cr.date_approbation,
        cr.ph3_installateur,
        cr.ph3_pac,
        cr.ph3_puissance,
        cr.ph3_puissance_pv,
        cr.ph3_rr_model,
        cr.ph3_ballon,
        cr.ph3_marque_ballon,
        cr.ph3_alimentation,
        cr.ph3_type,
        cr.ph3_prix,
        cr.ph3_bonus_30,
        cr.ph3_mensualite,
        cr.ph3_attente,
        cr.nbr_annee_finance,
        cr.credit_immobilier,
        cr.credit_autre,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        u_commercial.pseudo as commercial_pseudo,
        u_approbateur.pseudo as approbateur_pseudo,
        e.titre as etat_titre,
        se.titre as sous_etat_titre
      FROM compte_rendu_pending cr
      LEFT JOIN fiches f ON cr.id_fiche = f.id
      LEFT JOIN utilisateurs u_commercial ON cr.id_commercial = u_commercial.id
      LEFT JOIN utilisateurs u_approbateur ON cr.id_approbateur = u_approbateur.id
      LEFT JOIN etats e ON cr.id_etat_final = e.id
      LEFT JOIN sous_etat se ON cr.id_sous_etat = se.id
      ${whereClause}
      ORDER BY cr.date_creation DESC`;

    console.log('[COMPTE-RENDU] SQL Query:', sqlQuery);
    console.log('[COMPTE-RENDU] SQL Params:', params);

    let comptesRendus;
    try {
      comptesRendus = await query(sqlQuery, params);
      console.log('[COMPTE-RENDU] Résultat query:', comptesRendus.length, 'comptes rendus trouvés');
    } catch (sqlError) {
      console.error('[COMPTE-RENDU] Erreur SQL:', sqlError);
      console.error('[COMPTE-RENDU] SQL Error Code:', sqlError.code);
      console.error('[COMPTE-RENDU] SQL Error SQL:', sqlError.sql);
      throw sqlError;
    }

    // Parser les modifications JSON
    const result = comptesRendus.map(cr => {
      try {
        return {
          ...cr,
          modifications: cr.modifications ? JSON.parse(cr.modifications) : {}
        };
      } catch (error) {
        console.error('Erreur lors du parsing des modifications pour CR ID:', cr.id, error);
        return {
          ...cr,
          modifications: {}
        };
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[COMPTE-RENDU] Erreur lors de la récupération des comptes rendus:', error);
    console.error('[COMPTE-RENDU] Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des comptes rendus',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// =====================================================
// ROUTE: GET /api/compte-rendu/:id
// Récupérer un compte rendu spécifique
// =====================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const compteRendu = await queryOne(
      `SELECT 
        cr.*,
        f.*,
        u_commercial.pseudo as commercial_pseudo,
        u_approbateur.pseudo as approbateur_pseudo,
        e.titre as etat_titre,
        se.titre as sous_etat_titre
      FROM compte_rendu_pending cr
      LEFT JOIN fiches f ON cr.id_fiche = f.id
      LEFT JOIN utilisateurs u_commercial ON cr.id_commercial = u_commercial.id
      LEFT JOIN utilisateurs u_approbateur ON cr.id_approbateur = u_approbateur.id
      LEFT JOIN etats e ON cr.id_etat_final = e.id
      LEFT JOIN sous_etat se ON cr.id_sous_etat = se.id
      WHERE cr.id = ?`,
      [id]
    );

    if (!compteRendu) {
      return res.status(404).json({
        success: false,
        message: 'Compte rendu non trouvé'
      });
    }

    // Vérifier les permissions
    if (user.fonction === 5 && compteRendu.id_commercial !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à ce compte rendu'
      });
    }

    // Parser les modifications JSON
    try {
      compteRendu.modifications = compteRendu.modifications ? JSON.parse(compteRendu.modifications) : {};
    } catch (error) {
      console.error('Erreur lors du parsing des modifications pour CR ID:', compteRendu.id, error);
      compteRendu.modifications = {};
    }

    res.json({
      success: true,
      data: compteRendu
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du compte rendu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du compte rendu',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: PUT /api/compte-rendu/:id
// Modifier un compte rendu (admin seulement)
// =====================================================
router.put('/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { 
      modifications,
      commentaire,
      id_etat_final,
      id_sous_etat,
      ph3_installateur,
      ph3_pac,
      ph3_puissance,
      ph3_puissance_pv,
      ph3_rr_model,
      ph3_ballon,
      ph3_marque_ballon,
      ph3_alimentation,
      ph3_type,
      ph3_prix,
      ph3_bonus_30,
      ph3_mensualite,
      ph3_attente,
      nbr_annee_finance,
      credit_immobilier,
      credit_autre
    } = req.body;

    // Récupérer le compte rendu
    const compteRendu = await queryOne(
      'SELECT * FROM compte_rendu_pending WHERE id = ?',
      [id]
    );

    if (!compteRendu) {
      return res.status(404).json({
        success: false,
        message: 'Compte rendu non trouvé'
      });
    }

    if (compteRendu.statut !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Seuls les comptes rendus en attente peuvent être modifiés'
      });
    }

    // Vérifier les permissions : admin ou commercial propriétaire du compte rendu
    if (![1, 2, 7].includes(user.fonction) && (user.fonction !== 5 || compteRendu.id_commercial !== user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de modifier ce compte rendu'
      });
    }

    // Liste des champs autorisés
    const allowedFields = [
      'nom', 'prenom', 'civ', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville',
      'situation_conjugale', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'date_rdv_time', 'date_appel_time', 'id_centre', 'id_commercial',
      'id_commercial_2', 'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'type_contrat_mr', 'type_contrat_madame',
      'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
      'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
      'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec'
    ];

    // Filtrer les modifications si fournies
    let filteredModifications = {};
    try {
      filteredModifications = compteRendu.modifications ? JSON.parse(compteRendu.modifications) : {};
    } catch (error) {
      console.error('Erreur lors du parsing des modifications pour CR ID:', compteRendu.id, error);
      filteredModifications = {};
    }
    if (modifications && typeof modifications === 'object') {
      filteredModifications = {};
      for (const [key, value] of Object.entries(modifications)) {
        if (allowedFields.includes(key)) {
          filteredModifications[key] = value;
        }
      }
    }

    // Construire la requête de mise à jour
    const updateFields = [];
    const updateValues = [];

    if (id_etat_final !== undefined) {
      updateFields.push('id_etat_final = ?');
      updateValues.push(id_etat_final);
    }

    if (id_sous_etat !== undefined) {
      updateFields.push('id_sous_etat = ?');
      updateValues.push(id_sous_etat);
    }

    if (modifications !== undefined) {
      updateFields.push('modifications = ?');
      updateValues.push(JSON.stringify(filteredModifications));
    }

    if (commentaire !== undefined) {
      updateFields.push('commentaire = ?');
      updateValues.push(commentaire);
    }

    // Champs Phase 3
    const ph3Fields = [
      'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
      'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
      'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
      'credit_immobilier', 'credit_autre'
    ];

    for (const field of ph3Fields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(req.body[field] || null);
      }
    }

    updateFields.push('date_modif = ?');
    updateValues.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
    updateValues.push(id);

    if (updateFields.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification à apporter'
      });
    }

    await query(
      `UPDATE compte_rendu_pending SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Compte rendu modifié avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la modification du compte rendu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du compte rendu',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: POST /api/compte-rendu/:id/approve
// Approuver un compte rendu (admin seulement)
// =====================================================
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { commentaire_admin } = req.body;

    // Vérifier que l'utilisateur est admin (fonction 1, 2, ou 7)
    if (![1, 2, 7].includes(user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent approuver des comptes rendus'
      });
    }

    // Récupérer le compte rendu
    const compteRendu = await queryOne(
      'SELECT * FROM compte_rendu_pending WHERE id = ?',
      [id]
    );

    if (!compteRendu) {
      return res.status(404).json({
        success: false,
        message: 'Compte rendu non trouvé'
      });
    }

    if (compteRendu.statut !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Ce compte rendu a déjà été ${compteRendu.statut === 'approved' ? 'approuvé' : 'rejeté'}`
      });
    }

    // Parser les modifications
    let modifications = {};
    try {
      modifications = compteRendu.modifications ? JSON.parse(compteRendu.modifications) : {};
    } catch (error) {
      console.error('Erreur lors du parsing des modifications pour CR ID:', compteRendu.id, error);
      modifications = {};
    }

    // Récupérer l'ancien état de la fiche AVANT les modifications pour l'historique
    const ancienneFiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [compteRendu.id_fiche]);
    if (!ancienneFiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    const ancienEtat = ancienneFiche.id_etat_final;
    const nouveauEtat = compteRendu.id_etat_final || modifications.id_etat_final || ancienEtat;

    // Appliquer les modifications à la fiche
    const fields = [];
    const values = [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Fonction locale pour enregistrer les modifications dans modifica
    const logModification = async (idFiche, userId, field, oldValue, newValue, dateModif) => {
      try {
        const tableExists = await queryOne(
          `SELECT COUNT(*) as count 
           FROM information_schema.tables 
           WHERE table_schema = DATABASE() 
           AND table_name = 'modifica'`
        );
        
        if (!tableExists || tableExists.count === 0) {
          console.log('Table modifica n\'existe pas, impossible d\'enregistrer la modification');
          return;
        }
        
        const columns = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'modifica'`
        );
        const columnNames = columns.map(col => col.COLUMN_NAME);
        
        const hasNewStructure = columnNames.includes('type') && 
                                columnNames.includes('ancien_valeur') && 
                                columnNames.includes('nouvelle_valeur');
        const hasOldStructure = columnNames.includes('champ') &&
                                (columnNames.includes('last_val') || columnNames.includes('ancien_valeur')) &&
                                (columnNames.includes('val') || columnNames.includes('nouvelle_valeur'));
        
        const oldValStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : '';
        const newValStr = newValue !== null && newValue !== undefined ? String(newValue) : '';
        
        if (oldValStr !== newValStr) {
          const dateCol = columnNames.includes('date_modif_time') ? 'date_modif_time' : 
                         (columnNames.includes('date') ? 'date' : 'date_creation');
          
          if (hasNewStructure) {
            await query(
              `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, \`${dateCol}\`)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [idFiche, userId, field, oldValStr, newValStr, dateModif]
            );
          } else if (hasOldStructure) {
            const champCol = columnNames.includes('champ') ? 'champ' : 'type';
            const oldCol = columnNames.includes('last_val') ? 'last_val' : 'ancien_valeur';
            const newCol = columnNames.includes('val') ? 'val' : 'nouvelle_valeur';
            await query(
              `INSERT INTO modifica (id_fiche, id_user, \`${champCol}\`, \`${oldCol}\`, \`${newCol}\`, \`${dateCol}\`)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [idFiche, userId, field, oldValStr, newValStr, dateModif]
            );
          }
        }
      } catch (err) {
        console.log('Impossible d\'enregistrer dans modifica:', err.message);
      }
    };

    // Ajouter les modifications JSON et enregistrer dans modifica
    for (const [key, value] of Object.entries(modifications)) {
      const oldValue = ancienneFiche[key];
      const newValue = value;
      
      // Enregistrer la modification dans modifica si la valeur a changé
      if (oldValue !== newValue) {
        await logModification(compteRendu.id_fiche, user.id, key, oldValue, newValue, now);
      }
      
      fields.push(`\`${key}\` = ?`);
      values.push(value);
    }

    // Ajouter l'état final si présent dans le compte rendu
    if (compteRendu.id_etat_final && compteRendu.id_etat_final !== ancienEtat) {
      if (!fields.includes('`id_etat_final` = ?')) {
        // Enregistrer le changement d'état dans modifica
        await logModification(compteRendu.id_fiche, user.id, 'id_etat_final', ancienEtat, compteRendu.id_etat_final, now);
        
        fields.push('`id_etat_final` = ?');
        values.push(compteRendu.id_etat_final);
      }
    }

    // Ajouter les informations de vente (Phase 3) et enregistrer dans modifica
    const ph3Fields = [
      'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
      'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
      'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
      'credit_immobilier', 'credit_autre', 'pseudo', 'valeur_mensualite', 'conf_consommations'
    ];

    for (const field of ph3Fields) {
      if (compteRendu[field] !== null && compteRendu[field] !== undefined) {
        const oldValue = ancienneFiche[field];
        const newValue = compteRendu[field];
        
        // Enregistrer la modification dans modifica si la valeur a changé
        if (oldValue !== newValue) {
          await logModification(compteRendu.id_fiche, user.id, field, oldValue, newValue, now);
        }
        
        if (!fields.includes(`\`${field}\` = ?`)) {
          fields.push(`\`${field}\` = ?`);
          values.push(compteRendu[field]);
        }
      }
    }

    // Ajouter le commentaire commercial dans commentaire_commercial s'il existe
    if (compteRendu.commentaire) {
      const oldComment = ancienneFiche.commentaire_commercial;
      const newComment = compteRendu.commentaire;
      
      if (oldComment !== newComment) {
        await logModification(compteRendu.id_fiche, user.id, 'commentaire_commercial', oldComment, newComment, now);
      }
      
      if (!fields.includes('`commentaire_commercial` = ?')) {
        fields.push('`commentaire_commercial` = ?');
        values.push(compteRendu.commentaire);
      }
    }

    // Ajouter la date de modification
    fields.push('`date_modif_time` = ?');
    values.push(now);
    values.push(compteRendu.id_fiche);

    // Mettre à jour la fiche
    if (fields.length > 1) { // Plus que juste date_modif_time
      await query(
        `UPDATE fiches SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Enregistrer l'historique si l'état a changé
    if (nouveauEtat && nouveauEtat !== ancienEtat) {
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, ?, ?)`,
        [compteRendu.id_fiche, nouveauEtat, now]
      );
    }

    // Mettre à jour le compte rendu
    // Note: On ne met pas id_commercial à NULL car il y a une contrainte de clé étrangère
    // L'id_commercial reste pour garder l'historique de qui a créé le compte rendu
    await query(
      `UPDATE compte_rendu_pending 
       SET statut = 'approved', 
           id_approbateur = ?, 
           commentaire_admin = ?,
           date_approbation = ?
       WHERE id = ?`,
      [user.id, commentaire_admin || null, now, id]
    );

    res.json({
      success: true,
      message: 'Compte rendu approuvé et modifications appliquées avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'approbation du compte rendu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation du compte rendu',
      error: error.message
    });
  }
});

// =====================================================
// ROUTE: POST /api/compte-rendu/:id/reject
// Rejeter un compte rendu (admin seulement)
// =====================================================
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { commentaire_admin } = req.body;

    // Vérifier que l'utilisateur est admin (fonction 1, 2, ou 7)
    if (![1, 2, 7].includes(user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent rejeter des comptes rendus'
      });
    }

    // Récupérer le compte rendu
    const compteRendu = await queryOne(
      'SELECT * FROM compte_rendu_pending WHERE id = ?',
      [id]
    );

    if (!compteRendu) {
      return res.status(404).json({
        success: false,
        message: 'Compte rendu non trouvé'
      });
    }

    if (compteRendu.statut !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Ce compte rendu a déjà été ${compteRendu.statut === 'approved' ? 'approuvé' : 'rejeté'}`
      });
    }

    // Mettre à jour le compte rendu
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `UPDATE compte_rendu_pending 
       SET statut = 'rejected', 
           id_approbateur = ?, 
           commentaire_admin = ?,
           date_approbation = ?
       WHERE id = ?`,
      [user.id, commentaire_admin || null, now, id]
    );

    res.json({
      success: true,
      message: 'Compte rendu rejeté'
    });
  } catch (error) {
    console.error('Erreur lors du rejet du compte rendu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet du compte rendu',
      error: error.message
    });
  }
});

module.exports = router;
