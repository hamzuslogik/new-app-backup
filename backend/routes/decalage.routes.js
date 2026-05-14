const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate, isAdminOrBackofficeOrRPConfirmation } = require('../middleware/auth.middleware');
const { checkPermissionCode, hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');
const { executeWorkflow } = require('../services/workflow/workflow-executor');

// Clé secrète pour encoder/décoder les IDs (même que dans fiche.routes.js)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

// Fonction pour encoder un ID en hash (réutilisée depuis fiche.routes.js)
const encodeFicheId = (id) => {
  if (!id) return null;
  const hmac = crypto.createHmac('sha256', HASH_SECRET);
  hmac.update(String(id));
  const hash = hmac.digest('hex');
  const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m];
  });
  return `${hash.substring(0, 16)}${encodedId}`;
};

// Récupérer les décalages avec règles de consultation :
// - Confirmateurs (fonction 6) : voient les décalages où ils sont destinataires
// - Commerciaux (fonction 5) : voient leurs propres décalages créés
// - Admins (fonctions 1, 2, 7) : voient tous les décalages
router.get('/', authenticate, async (req, res) => {
  try {
    let whereClause = '';
    let params = [];

    // Règles de consultation selon la fonction
    if (req.user.fonction === 6) {
      // Confirmateurs : voient uniquement les décalages où ils sont destinataires
      // ET où ils sont le confirmateur principal de la fiche (id_confirmateur, pas confirmateur2 ni confirmateur3)
      // Condition : d.destination = req.user.id ET (si fiche existe : f.id_confirmateur = req.user.id, sinon on accepte)
      whereClause = 'WHERE d.destination = ? AND (f.id IS NULL OR f.id_confirmateur = ?)';
      params = [req.user.id, req.user.id];
    } else if (req.user.fonction === 14) {
      // RE Confirmation : voient les décalages de leurs confirmateurs sous responsabilité
      // Récupérer les IDs des confirmateurs sous responsabilité (chef_equipe = RE Confirmation)
      const confirmateursIds = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 6 AND etat > 0',
        [req.user.id]
      );
      
      if (confirmateursIds.length === 0) {
        // Aucun confirmateur sous responsabilité, retourner vide
        return res.json({
          success: true,
          data: []
        });
      }
      
      const ids = confirmateursIds.map(c => c.id);
      whereClause = `WHERE d.destination IN (${ids.map(() => '?').join(',')})`;
      params = ids;
    } else if (req.user.fonction === 13) {
      // RP Confirmation (fonction 13) : voient les décalages de tous les RE Confirmation et confirmateurs sous leur responsabilité
      // Récupérer les IDs des RE Confirmation sous responsabilité (chef_equipe = RP Confirmation)
      const reConfirmationIds = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 14 AND etat > 0',
        [req.user.id]
      );
      
      // Récupérer les IDs des confirmateurs sous responsabilité des RE Confirmation
      let allConfirmateursIds = [];
      if (reConfirmationIds.length > 0) {
        const reIds = reConfirmationIds.map(re => re.id);
        const confirmateursIds = await query(
          `SELECT id FROM utilisateurs WHERE chef_equipe IN (${reIds.map(() => '?').join(',')}) AND fonction = 6 AND etat > 0`,
          reIds
        );
        allConfirmateursIds = confirmateursIds.map(c => c.id);
      }
      
      // Combiner les IDs des RE Confirmation et des confirmateurs
      const allIds = [...reConfirmationIds.map(re => re.id), ...allConfirmateursIds];
      
      if (allIds.length === 0) {
        // Aucun RE Confirmation ou confirmateur sous responsabilité, retourner vide
        return res.json({
          success: true,
          data: []
        });
      }
      
      whereClause = `WHERE d.destination IN (${allIds.map(() => '?').join(',')})`;
      params = allIds;
    } else if (req.user.fonction === 5) {
      // Commerciaux : voient uniquement leurs propres demandes de décalage (où ils sont expéditeurs)
      whereClause = 'WHERE d.expediteur = ?';
      params = [req.user.id];
    } else if ([1, 2].includes(req.user.fonction)) {
      // Admins (fonction 1, 2) : voient tous les décalages
      whereClause = '';
      params = [];
    } else {
      // Par défaut : voient les décalages où ils sont impliqués (expediteur ou destination)
      whereClause = 'WHERE d.destination = ? OR d.expediteur = ?';
      params = [req.user.id, req.user.id];
    }

    const decalages = await query(
      `SELECT d.*, 
        ed.titre as etat_dec,
        u_exp.pseudo as expediteur_pseudo, 
        u_exp.photo as expediteur_photo,
        u_dest.pseudo as destination_pseudo,
        u_dest.photo as destination_photo,
        f.id as fiche_id,
        f.tel as fiche_tel,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.cp as fiche_cp,
        f.hash as fiche_hash
       FROM decalages d
       LEFT JOIN etat_decalage ed ON d.id_etat = ed.id
       LEFT JOIN utilisateurs u_exp ON d.expediteur = u_exp.id
       LEFT JOIN utilisateurs u_dest ON d.destination = u_dest.id
       LEFT JOIN fiches f ON d.id_fiche = f.id
       ${whereClause}
       ORDER BY d.date_creation DESC`,
      params
    );

    // Ajouter le hash de la fiche pour chaque décalage
    const decalagesWithHash = decalages.map(decalage => ({
      ...decalage,
      fiche_hash: decalage.fiche_id ? encodeFicheId(decalage.fiche_id) : null
    }));

    res.json({
      success: true,
      data: decalagesWithHash
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des décalages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des décalages'
    });
  }
});

// Créer un décalage (nécessite la permission decalage_create)
router.post('/', authenticate, checkPermissionCode('decalage_create'), async (req, res) => {
  try {
    const { id_fiche, destination, message, date_prevu, date_nouvelle, id_etat = 1 } = req.body;

    console.log('Requête de création de décalage reçue:', {
      id_fiche,
      destination,
      message: message ? 'présent' : 'absent',
      date_prevu,
      date_nouvelle,
      user_id: req.user.id,
      user_fonction: req.user.fonction
    });

    if (!id_fiche || !destination || !message || !date_prevu) {
      console.error('Données manquantes:', {
        id_fiche: !!id_fiche,
        destination: !!destination,
        message: !!message,
        date_prevu: !!date_prevu
      });
      return res.status(400).json({
        success: false,
        message: 'id_fiche, destination, message et date_prevu sont requis'
      });
    }

    // S'assurer que id_fiche est un nombre valide
    const idFicheNum = parseInt(id_fiche, 10);
    if (isNaN(idFicheNum) || idFicheNum <= 0) {
      console.error('ID de fiche invalide:', id_fiche);
      return res.status(400).json({
        success: false,
        message: 'ID de fiche invalide'
      });
    }

    // Vérifier que la fiche existe et est active, récupérer aussi la date RDV
    const fiche = await queryOne(
      'SELECT id, archive, ko, active, date_rdv_time FROM fiches WHERE id = ?', 
      [idFicheNum]
    );
    
    console.log('Résultat de la recherche de fiche:', {
      fiche_trouvee: !!fiche,
      fiche_id: fiche?.id,
      archive: fiche?.archive,
      ko: fiche?.ko,
      active: fiche?.active
    });
    
    if (!fiche) {
      console.error('Fiche non trouvée avec ID:', idFicheNum);
      return res.status(404).json({
        success: false,
        message: `Fiche non trouvée avec l'ID: ${idFicheNum}`
      });
    }
    
    // Vérifier que la fiche n'est pas archivée, KO ou inactive
    if (fiche.archive === 1 || fiche.ko === 1 || fiche.active === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cette fiche est archivée, KO ou inactive. Impossible de créer un décalage.'
      });
    }

    // Vérifier que le destinataire existe
    const destinataire = await queryOne(
      'SELECT id, fonction FROM utilisateurs WHERE id = ? AND etat > 0',
      [destination]
    );
    if (!destinataire) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé ou inactif'
      });
    }

    // Pour les admins/backoffice/RP confirmation, permettre de sélectionner n'importe quel confirmateur
    // Pour les autres, vérifier que le destinataire est bien le confirmateur de la fiche
    if (!isAdminOrBackofficeOrRPConfirmation(req.user.fonction)) {
      // Récupérer le confirmateur de la fiche
      const ficheConfirmateur = await queryOne(
        'SELECT id_confirmateur FROM fiches WHERE id = ?',
        [idFicheNum]
      );
      
      // Pour les commerciaux (fonction 5), le destinataire doit être le confirmateur de la fiche
      if (req.user.fonction === 5) {
        if (!ficheConfirmateur || ficheConfirmateur.id_confirmateur !== parseInt(destination)) {
          return res.status(403).json({
            success: false,
            message: 'Le destinataire doit être le confirmateur assigné à cette fiche'
          });
        }
      }
      
      // Vérifier que le destinataire est un confirmateur (fonction 6)
      if (destinataire.fonction !== 6) {
        return res.status(400).json({
          success: false,
          message: 'Le destinataire doit être un confirmateur (fonction 6)'
        });
      }
    } else {
      // Pour les admins, vérifier quand même que le destinataire est un confirmateur
      if (destinataire.fonction !== 6) {
        return res.status(400).json({
          success: false,
          message: 'Le destinataire doit être un confirmateur (fonction 6)'
        });
      }
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Déterminer la date RDV originale (date_prevu) : utiliser celle fournie ou celle de la fiche
    const dateRdvOriginale = date_prevu || fiche.date_rdv_time || null;
    
    // Déterminer la nouvelle date (date_nouvelle) : utiliser celle fournie ou date_prevu comme fallback
    const dateNouvelle = date_nouvelle || date_prevu || null;

    // Toujours créer un nouveau décalage (même s'il en existe déjà pour cette fiche)
    const result = await query(
      `INSERT INTO decalages 
      (id_fiche, date_creation, id_etat, message, expediteur, destination, date_prevu, date_nouvelle, modifie_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idFicheNum, now, id_etat, message, req.user.id, destination, dateRdvOriginale, dateNouvelle, now]
    );

    // Enregistrer dans l'historique des modifications
    try {
      // Vérifier d'abord si la table modifica existe
      const tableExists = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = SCHEMA() 
         AND table_name = 'modifica'`
      );
      
      if (tableExists && tableExists.count > 0) {
        // Détecter la structure de la table
        const columns = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = SCHEMA() 
           AND TABLE_NAME = 'modifica'`
        );
        const columnNames = columns.map(col => col.COLUMN_NAME);
        
        const hasNewStructure = columnNames.includes('type') && 
                                columnNames.includes('ancien_valeur') && 
                                columnNames.includes('nouvelle_valeur');
        const hasOldStructure = columnNames.includes('champ') && 
                                columnNames.includes('last_val') && 
                                columnNames.includes('val');
        
        const dateCol = columnNames.includes('date_modif_time') ? 'date_modif_time' : 'date';
        
        if (hasNewStructure) {
          // Utiliser la nouvelle structure
          await query(
            `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, \`${dateCol}\`)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idFicheNum, req.user.id, 'Creation Decalage', '', message, now]
          );
        } else if (hasOldStructure) {
          // Utiliser l'ancienne structure
          await query(
            `INSERT INTO modifica (id_fiche, id_user, champ, last_val, val, \`${dateCol}\`)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idFicheNum, req.user.id, 'Creation Decalage', '', message, now]
          );
        }
      }
    } catch (err) {
      // Ignorer l'erreur si la table modifica n'existe pas ou si la structure n'est pas reconnue
      console.log('Impossible d\'enregistrer dans modifica:', err.message);
    }

    // Notifications manuelles désactivées: la création de décalage passe par le workflow "decalage_created".

    res.status(201).json({
      success: true,
      message: 'Décalage créé avec succès',
      data: { id: result.insertId }
    });
    executeWorkflow('decalage_created', {
      fiche: { id: idFicheNum, date_rdv_time: fiche?.date_rdv_time || null },
      user: req.user,
      decalage: {
        id: result.insertId,
        id_fiche: idFicheNum,
        expediteur: req.user.id,
        destination: parseInt(destination, 10),
        id_etat: id_etat || 1,
        date_prevu: dateRdvOriginale,
        date_nouvelle: dateNouvelle,
        date_creation: now,
      },
    }).catch((wfError) => {
      console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (decalage_created):', wfError);
    });
  } catch (error) {
    console.error('Erreur lors de la création du décalage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du décalage',
      error: error.message
    });
  }
});

// Mettre à jour le statut d'un décalage
router.put('/:id/statut', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_etat } = req.body;

    if (!id_etat) {
      return res.status(400).json({
        success: false,
        message: 'id_etat est requis'
      });
    }

    // Vérifier que le décalage existe et récupérer les informations nécessaires
    const decalage = await queryOne(
      `SELECT d.*, ed.titre as etat_titre 
       FROM decalages d 
       LEFT JOIN etat_decalage ed ON d.id_etat = ed.id 
       WHERE d.id = ?`, 
      [id]
    );
    if (!decalage) {
      return res.status(404).json({
        success: false,
        message: 'Décalage non trouvé'
      });
    }

    const idEtatRequested = parseInt(id_etat, 10);
    const currentEtat = parseInt(decalage.id_etat, 10);

    // Annulation (état 6) : uniquement si la demande est encore en attente (id 1), et rôle autorisé
    if (idEtatRequested === 6) {
      if (Number.isNaN(currentEtat) || currentEtat !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Seules les demandes de décalage en attente peuvent être annulées.'
        });
      }
      const isCommercial = req.user.fonction === 5;
      const canStaffAnnuler = [1, 2, 7, 11].includes(req.user.fonction);
      if (isCommercial) {
        if (parseInt(decalage.expediteur, 10) !== parseInt(req.user.id, 10)) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez annuler que vos propres demandes de décalage.'
          });
        }
      } else if (!canStaffAnnuler) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission d\'annuler cette demande.'
        });
      }
    }

    // Vérifier les permissions :
    // - Les commerciaux (fonction 5) peuvent annuler (id_etat = 6)
    // - Les confirmateurs (fonction 6), RE Confirmation (fonction 14), RP Confirmation (fonction 13) et admins peuvent refuser (id_etat = 4) ou valider
    // - Les admins (1, 2, 7) peuvent tout faire
    if (req.user.fonction === 5) {
      // Commerciaux : peuvent seulement annuler
      if (id_etat !== 6) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier ce statut'
        });
      }
    } else if (req.user.fonction === 6 || req.user.fonction === 14 || req.user.fonction === 13) {
      // Confirmateurs, RE Confirmation, RP Confirmation (13) : peuvent refuser ou valider, mais pas annuler
      if (id_etat === 6) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission d\'annuler un décalage'
        });
      }
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await query(
      `UPDATE decalages SET
       id_etat = ?,
       modifie_le = ?
       WHERE id = ?`,
      [id_etat, now, id]
    );

    // Récupérer le titre du nouvel état pour vérifier s'il s'agit d'un état "validé/accepté"
    const nouvelEtat = await queryOne('SELECT titre FROM etat_decalage WHERE id = ?', [id_etat]);
    
    // Considérer comme validé si :
    // - Le titre contient "VALID", "ACCEPT", "APPROUV" (insensible à la casse)
    // - ET ce n'est ni "REFUSÉ" (id_etat = 4) ni "ANNULÉ" (id_etat = 6) ni "EN-ATTENTE" (id_etat = 1)
    const titreEtat = nouvelEtat?.titre?.toUpperCase() || '';
    const estRefuse = id_etat === 4 || titreEtat.includes('REFUS');
    const estAnnule = id_etat === 6 || titreEtat.includes('ANNUL');
    const estEnAttente = id_etat === 1 || titreEtat.includes('EN-ATTENTE') || titreEtat.includes('ATTENTE');
    
    // Le décalage est considéré comme validé s'il n'est ni refusé, ni annulé, ni en attente
    const estValide = !estRefuse && !estAnnule && !estEnAttente;

    // Si le décalage est validé/accepté et qu'il y a une date_nouvelle, mettre à jour la date RDV de la fiche
    if (estValide && decalage.date_nouvelle && decalage.id_fiche) {
      try {
        // Mettre à jour la date_rdv_time de la fiche avec date_nouvelle
        await query(
          `UPDATE fiches 
           SET date_rdv_time = ?,
               date_modif_time = ?
           WHERE id = ?`,
          [decalage.date_nouvelle, now, decalage.id_fiche]
        );
        
        console.log(`Date RDV de la fiche ${decalage.id_fiche} mise à jour avec la nouvelle date: ${decalage.date_nouvelle}`);
        
        // Enregistrer dans l'historique de la fiche
        await query(
          `INSERT INTO fiches_histo (id_fiche, id_etat, date_rdv_time, date_creation) 
           VALUES (?, (SELECT id_etat_final FROM fiches WHERE id = ?), ?, ?)`,
          [decalage.id_fiche, decalage.id_fiche, decalage.date_nouvelle, now]
        ).catch(err => {
          console.log('Impossible d\'enregistrer dans l\'historique:', err.message);
        });
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour de la date RDV de la fiche:', updateError);
        // Ne pas bloquer la réponse si la mise à jour de la fiche échoue
      }
    }

    // Enregistrer dans l'historique
    try {
      // Vérifier d'abord si la table modifica existe
      const tableExists = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = SCHEMA() 
         AND table_name = 'modifica'`
      );
      
      if (tableExists && tableExists.count > 0) {
        // Détecter la structure de la table
        const columns = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = SCHEMA() 
           AND TABLE_NAME = 'modifica'`
        );
        const columnNames = columns.map(col => col.COLUMN_NAME);
        
        const hasNewStructure = columnNames.includes('type') && 
                                columnNames.includes('ancien_valeur') && 
                                columnNames.includes('nouvelle_valeur');
        const hasOldStructure = columnNames.includes('champ') && 
                                columnNames.includes('last_val') && 
                                columnNames.includes('val');
        
        const dateCol = columnNames.includes('date_modif_time') ? 'date_modif_time' : 'date';
        const oldEtat = decalage.id_etat || '';
        const newEtat = id_etat || '';
        
        if (hasNewStructure) {
          // Utiliser la nouvelle structure
          await query(
            `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, \`${dateCol}\`)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [decalage.id_fiche, req.user.id, 'Decalage etat', String(oldEtat), String(newEtat), now]
          );
        } else if (hasOldStructure) {
          // Utiliser l'ancienne structure
          await query(
            `INSERT INTO modifica (id_fiche, id_user, champ, last_val, val, \`${dateCol}\`)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [decalage.id_fiche, req.user.id, 'Decalage etat', String(oldEtat), String(newEtat), now]
          );
        }
      }
    } catch (err) {
      // Ignorer l'erreur si la table modifica n'existe pas ou si la structure n'est pas reconnue
      console.log('Impossible d\'enregistrer dans modifica:', err.message);
    }

    // Refus : notification interne remplacée par le déclencheur workflow decalage_refused.

    res.json({
      success: true,
      message: 'Statut du décalage mis à jour'
    });
    if (estValide) {
      executeWorkflow('decalage_accepted', {
        fiche: decalage?.id_fiche ? { id: decalage.id_fiche, date_rdv_time: decalage.date_nouvelle || decalage.date_prevu || null } : null,
        user: req.user,
        decalage: {
          id: parseInt(id, 10),
          id_fiche: decalage.id_fiche,
          old_etat: decalage.id_etat,
          new_etat: id_etat,
          expediteur: decalage.expediteur,
          destination: decalage.destination,
          date_prevu: decalage.date_prevu,
          date_nouvelle: decalage.date_nouvelle,
          modifie_le: now,
        },
      }).catch((wfError) => {
        console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (decalage_accepted):', wfError);
      });
    }
    if (estRefuse) {
      executeWorkflow('decalage_refused', {
        fiche: decalage?.id_fiche ? { id: decalage.id_fiche, date_rdv_time: decalage.date_prevu || decalage.date_nouvelle || null } : null,
        user: req.user,
        decalage: {
          id: parseInt(id, 10),
          id_fiche: decalage.id_fiche,
          old_etat: decalage.id_etat,
          new_etat: id_etat,
          expediteur: decalage.expediteur,
          destination: decalage.destination,
          date_prevu: decalage.date_prevu,
          date_nouvelle: decalage.date_nouvelle,
          modifie_le: now,
        },
      }).catch((wfError) => {
        console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (decalage_refused):', wfError);
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

// Récupérer un décalage spécifique
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const decalage = await queryOne(
      `SELECT d.*, 
        ed.titre as etat_dec, 
        u_exp.pseudo as expediteur_pseudo, 
        u_dest.pseudo as destination_pseudo,
        f.tel as fiche_tel,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom
       FROM decalages d
       LEFT JOIN etat_decalage ed ON d.id_etat = ed.id
       LEFT JOIN utilisateurs u_exp ON d.expediteur = u_exp.id
       LEFT JOIN utilisateurs u_dest ON d.destination = u_dest.id
       LEFT JOIN fiches f ON d.id_fiche = f.id
       WHERE d.id = ?`,
      [id]
    );

    if (!decalage) {
      return res.status(404).json({
        success: false,
        message: 'Décalage non trouvé'
      });
    }

    // Vérifier les permissions de consultation
    const canView = 
      isAdminOrBackofficeOrRPConfirmation(req.user.fonction) || // Admins, Backoffice, RP Confirmation
      decalage.expediteur === req.user.id || // Créateur
      (req.user.fonction === 6 && decalage.destination === req.user.id); // Confirmateur destinataire

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de voir ce décalage'
      });
    }

    res.json({
      success: true,
      data: decalage
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du décalage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du décalage'
    });
  }
});

module.exports = router;

