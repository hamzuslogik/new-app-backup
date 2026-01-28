const { executeWorkflow } = require('../services/workflow/workflow-executor');

/**
 * Middleware pour déclencher les workflows après une création de fiche
 */
const triggerWorkflowOnFicheCreated = async (req, res, next) => {
  // Sauvegarder la fonction res.json originale
  const originalJson = res.json.bind(res);
  
  // Intercepter la réponse
  res.json = async function(data) {
    // Appeler la réponse originale
    await originalJson(data);
    
    // Si la création a réussi, déclencher les workflows
    if (data.success && data.data && data.data.id) {
      try {
        const ficheId = data.data.id;
        // Récupérer la fiche complète
        const { queryOne } = require('../config/database');
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [ficheId]);
        
        if (fiche) {
          // Exécuter les workflows de manière asynchrone (ne pas bloquer la réponse)
          executeWorkflow('fiche_created', {
            fiche,
            user: req.user
          }).catch(error => {
            console.error('Erreur lors de l\'exécution des workflows (fiche_created):', error);
          });
        }
      } catch (error) {
        console.error('Erreur lors du déclenchement des workflows:', error);
        // Ne pas bloquer la réponse en cas d'erreur
      }
    }
  };
  
  next();
};

/**
 * Middleware pour déclencher les workflows après une modification de fiche
 */
const triggerWorkflowOnFicheUpdated = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  const { queryOne } = require('../config/database');
  
  // Récupérer l'ancienne fiche AVANT la mise à jour
  let oldFiche = null;
  if (req.params.id) {
    try {
      oldFiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [req.params.id]);
    } catch (error) {
      console.error('[WORKFLOW] Erreur lors de la récupération de l\'ancienne fiche:', error);
    }
  }
  
  res.json = async function(data) {
    await originalJson(data);
    
    console.log('[WORKFLOW] triggerWorkflowOnFicheUpdated - Début');
    console.log('[WORKFLOW] Response data:', JSON.stringify(data, null, 2));
    console.log('[WORKFLOW] Request params:', req.params);
    console.log('[WORKFLOW] Request body:', JSON.stringify(req.body, null, 2));
    
    if (data.success && req.params.id) {
      try {
        const ficheId = req.params.id;
        console.log('[WORKFLOW] Fiche ID:', ficheId);
        
        // Récupérer la fiche mise à jour
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [ficheId]);
        
        if (fiche) {
          console.log('[WORKFLOW] Fiche trouvée:', { id: fiche.id, id_etat_final: fiche.id_etat_final });
          
          // Vérifier si un RDV a été créé (date_rdv_time passe de NULL/vide à une valeur)
          const oldDateRdv = oldFiche?.date_rdv_time || null;
          const newDateRdv = fiche.date_rdv_time || null;
          const hasRdvCreated = (!oldDateRdv || oldDateRdv === '' || oldDateRdv === '0000-00-00 00:00:00') && 
                                 newDateRdv && newDateRdv !== '' && newDateRdv !== '0000-00-00 00:00:00';
          
          if (hasRdvCreated) {
            console.log('[WORKFLOW] RDV créé détecté - Ancien:', oldDateRdv, 'Nouveau:', newDateRdv);
            executeWorkflow('rdv_created', {
              fiche,
              user: req.user,
              old_date_rdv_time: oldDateRdv,
              new_date_rdv_time: newDateRdv
            }).catch(error => {
              console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (rdv_created):', error);
            });
          }
          
          // Vérifier si l'état a changé
          const oldEtat = req.body.id_etat_final || req.body.old_etat || oldFiche?.id_etat_final;
          const newEtat = fiche.id_etat_final;
          
          console.log('[WORKFLOW] État - Ancien:', oldEtat, 'Nouveau:', newEtat);
          
          if (oldEtat && newEtat && oldEtat !== newEtat) {
            // Déclencher workflow de changement d'état
            console.log('[WORKFLOW] Déclenchement workflow: etat_changed');
            executeWorkflow('etat_changed', {
              fiche,
              user: req.user,
              old_etat: oldEtat,
              new_etat: newEtat
            }).then(result => {
              console.log('[WORKFLOW] Workflow etat_changed exécuté avec succès:', JSON.stringify(result, null, 2));
            }).catch(error => {
              console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (etat_changed):', error);
              console.error('[WORKFLOW] Stack trace:', error.stack);
            });
          } else {
            // Déclencher workflow de modification générale seulement si pas de changement d'état ni de RDV créé
            if (!hasRdvCreated) {
              console.log('[WORKFLOW] Déclenchement workflow: fiche_updated');
              console.log('[WORKFLOW] Données de l\'événement:', {
                fiche_id: fiche.id,
                user_id: req.user?.id,
                user_pseudo: req.user?.pseudo,
                changes: Object.keys(req.body)
              });
              
              executeWorkflow('fiche_updated', {
                fiche,
                user: req.user,
                changes: req.body
              }).then(result => {
                console.log('[WORKFLOW] Workflow fiche_updated exécuté avec succès:', JSON.stringify(result, null, 2));
              }).catch(error => {
                console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (fiche_updated):', error);
                console.error('[WORKFLOW] Stack trace:', error.stack);
              });
            }
          }
        } else {
          console.log('[WORKFLOW] Fiche non trouvée pour ID:', ficheId);
        }
      } catch (error) {
        console.error('[WORKFLOW] Erreur lors du déclenchement des workflows:', error);
        console.error('[WORKFLOW] Stack trace:', error.stack);
      }
    } else {
      console.log('[WORKFLOW] Conditions non remplies - success:', data.success, 'params.id:', req.params.id);
    }
    console.log('[WORKFLOW] triggerWorkflowOnFicheUpdated - Fin');
  };
  
  next();
};

/**
 * Middleware pour déclencher les workflows après un changement d'état rapide
 */
const triggerWorkflowOnEtatChanged = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = async function(data) {
    await originalJson(data);
    
    if (data.success && data.data) {
      try {
        const { id, id_etat_final, old_etat } = data.data;
        const { queryOne } = require('../config/database');
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
        
        if (fiche && old_etat && id_etat_final && old_etat !== id_etat_final) {
          executeWorkflow('etat_changed', {
            fiche,
            user: req.user,
            old_etat,
            new_etat: id_etat_final
          }).catch(error => {
            console.error('Erreur lors de l\'exécution des workflows (etat_changed):', error);
          });
        }
      } catch (error) {
        console.error('Erreur lors du déclenchement des workflows:', error);
      }
    }
  };
  
  next();
};

/**
 * Middleware pour déclencher les workflows après validation d'un RDV
 */
const triggerWorkflowOnRdvValidated = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  const { queryOne } = require('../config/database');
  
  // Récupérer l'ancienne fiche AVANT la validation
  let oldFiche = null;
  if (req.params.id) {
    try {
      oldFiche = await queryOne('SELECT valider FROM fiches WHERE id = ?', [req.params.id]);
    } catch (error) {
      console.error('[WORKFLOW] Erreur lors de la récupération de l\'ancienne fiche:', error);
    }
  }
  
  res.json = async function(data) {
    await originalJson(data);
    
    if (data.success && data.data && req.params.id) {
      try {
        const ficheId = req.params.id;
        const { valider } = data.data;
        
        // Récupérer la fiche après validation
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [ficheId]);
        
        if (fiche && oldFiche) {
          const oldValider = oldFiche.valider || 0;
          const newValider = valider || fiche.valider || 0;
          
          // Déclencher seulement si valider passe de 0/NULL à 1
          if (oldValider === 0 && newValider === 1) {
            console.log('[WORKFLOW] RDV validé détecté - Fiche ID:', ficheId);
            executeWorkflow('rdv_validated', {
              fiche,
              user: req.user,
              old_valider: oldValider,
              new_valider: newValider,
              conf_rdv_avec: data.data.conf_rdv_avec,
              conf_presence_couple: data.data.conf_presence_couple
            }).catch(error => {
              console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (rdv_validated):', error);
            });
          }
        }
      } catch (error) {
        console.error('[WORKFLOW] Erreur lors du déclenchement des workflows (rdv_validated):', error);
      }
    }
  };
  
  next();
};

/**
 * Middleware pour déclencher les workflows après création d'un compte rendu
 */
const triggerWorkflowOnCompteRenduCreated = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = async function(data) {
    await originalJson(data);
    
    if (data.success && data.data && data.data.id) {
      try {
        const compteRenduId = data.data.id;
        const { id_fiche } = req.body;
        const { queryOne } = require('../config/database');
        
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id_fiche]);
        if (fiche) {
          console.log('[WORKFLOW] Compte rendu créé détecté - Compte rendu ID:', compteRenduId);
          executeWorkflow('compte_rendu_created', {
            fiche,
            user: req.user,
            compte_rendu: { id: compteRenduId, id_fiche }
          }).catch(error => {
            console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (compte_rendu_created):', error);
          });
        }
      } catch (error) {
        console.error('[WORKFLOW] Erreur lors du déclenchement des workflows (compte_rendu_created):', error);
      }
    }
  };
  
  next();
};

/**
 * Middleware pour déclencher les workflows après approbation d'un compte rendu
 */
const triggerWorkflowOnCompteRenduApproved = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  const { queryOne } = require('../config/database');
  
  // Récupérer l'ancien compte rendu AVANT l'approbation
  let oldCompteRendu = null;
  if (req.params.id) {
    try {
      oldCompteRendu = await queryOne('SELECT * FROM compte_rendu_pending WHERE id = ?', [req.params.id]);
    } catch (error) {
      console.error('[WORKFLOW] Erreur lors de la récupération de l\'ancien compte rendu:', error);
    }
  }
  
  res.json = async function(data) {
    await originalJson(data);
    
    if (data.success && req.params.id) {
      try {
        const compteRenduId = req.params.id;
        
        // Récupérer le compte rendu après approbation
        const compteRendu = await queryOne('SELECT * FROM compte_rendu_pending WHERE id = ?', [compteRenduId]);
        
        // Vérifier si le statut a changé de 'pending' à 'approved'
        if (compteRendu && oldCompteRendu && 
            oldCompteRendu.statut === 'pending' && compteRendu.statut === 'approved') {
          const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [compteRendu.id_fiche]);
          if (fiche) {
            console.log('[WORKFLOW] Compte rendu approuvé détecté - Compte rendu ID:', compteRenduId);
            executeWorkflow('compte_rendu_approved', {
              fiche,
              user: req.user,
              compte_rendu: compteRendu
            }).catch(error => {
              console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (compte_rendu_approved):', error);
            });
          }
        }
      } catch (error) {
        console.error('[WORKFLOW] Erreur lors du déclenchement des workflows (compte_rendu_approved):', error);
      }
    }
  };
  
  next();
};

module.exports = {
  triggerWorkflowOnFicheCreated,
  triggerWorkflowOnFicheUpdated,
  triggerWorkflowOnEtatChanged,
  triggerWorkflowOnRdvValidated,
  triggerWorkflowOnCompteRenduCreated,
  triggerWorkflowOnCompteRenduApproved
};

