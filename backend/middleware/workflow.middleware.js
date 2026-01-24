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
  
  res.json = async function(data) {
    await originalJson(data);
    
    if (data.success && req.params.id) {
      try {
        const ficheId = req.params.id;
        const { queryOne } = require('../config/database');
        const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [ficheId]);
        
        if (fiche) {
          // Vérifier si l'état a changé
          const oldEtat = req.body.id_etat_final || req.body.old_etat;
          const newEtat = fiche.id_etat_final;
          
          if (oldEtat && newEtat && oldEtat !== newEtat) {
            // Déclencher workflow de changement d'état
            executeWorkflow('etat_changed', {
              fiche,
              user: req.user,
              old_etat: oldEtat,
              new_etat: newEtat
            }).catch(error => {
              console.error('Erreur lors de l\'exécution des workflows (etat_changed):', error);
            });
          } else {
            // Déclencher workflow de modification générale
            executeWorkflow('fiche_updated', {
              fiche,
              user: req.user,
              changes: req.body
            }).catch(error => {
              console.error('Erreur lors de l\'exécution des workflows (fiche_updated):', error);
            });
          }
        }
      } catch (error) {
        console.error('Erreur lors du déclenchement des workflows:', error);
      }
    }
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

module.exports = {
  triggerWorkflowOnFicheCreated,
  triggerWorkflowOnFicheUpdated,
  triggerWorkflowOnEtatChanged
};

