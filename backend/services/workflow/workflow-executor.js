const { query, queryOne } = require('../../config/database');
const { getDefaultSMSProvider, sendSMSViaProvider } = require('../sms.service');

/**
 * Exécute un workflow pour un événement donné
 * @param {string} triggerType - Type d'événement (fiche_created, etat_changed, etc.)
 * @param {Object} eventData - Données de l'événement (fiche, user, etc.)
 * @returns {Promise<Array>} Liste des workflows exécutés
 */
async function executeWorkflow(triggerType, eventData) {
  console.log('[WORKFLOW] ========== executeWorkflow DÉBUT ==========');
  console.log('[WORKFLOW] Trigger type:', triggerType);
  console.log('[WORKFLOW] Event data (résumé):', JSON.stringify({
    has_fiche: !!eventData.fiche,
    fiche_id: eventData.fiche?.id || eventData.fiche_id,
    fiche_keys: eventData.fiche ? Object.keys(eventData.fiche).slice(0, 10) : null,
    has_user: !!eventData.user,
    user_id: eventData.user?.id,
    user_pseudo: eventData.user?.pseudo,
    changes: eventData.changes ? Object.keys(eventData.changes) : null
  }, null, 2));
  
  try {
    // Récupérer tous les workflows actifs qui ont ce type de trigger
    console.log('[WORKFLOW] Recherche des workflows actifs pour trigger:', triggerType);
    const workflows = await query(`
      SELECT DISTINCT w.*
      FROM workflows w
      INNER JOIN workflow_triggers wt ON w.id = wt.id_workflow
      WHERE w.actif = 1
      AND wt.type = ?
      ORDER BY w.priorite ASC
    `, [triggerType]);

    console.log('[WORKFLOW] Nombre de workflows trouvés:', workflows.length);
    if (workflows.length === 0) {
      console.log('[WORKFLOW] ⚠️  AUCUN WORKFLOW ACTIF TROUVÉ pour le trigger:', triggerType);
      console.log('[WORKFLOW] Vérifiez que:');
      console.log('[WORKFLOW]   1. Un workflow existe avec actif = 1');
      console.log('[WORKFLOW]   2. Le workflow a un trigger de type:', triggerType);
      console.log('[WORKFLOW] ========== executeWorkflow FIN (aucun workflow) ==========');
      return [];
    }

    workflows.forEach((w, index) => {
      console.log(`[WORKFLOW] Workflow ${index + 1}: ID=${w.id}, Nom="${w.nom}", Priorité=${w.priorite}`);
    });

    const executedWorkflows = [];

    for (const workflow of workflows) {
      try {
        console.log(`[WORKFLOW] --- Traitement workflow ID=${workflow.id}, Nom="${workflow.nom}" ---`);
        
        // Vérifier les conditions du trigger
        const triggers = await query(
          'SELECT * FROM workflow_triggers WHERE id_workflow = ? AND type = ?',
          [workflow.id, triggerType]
        );

        console.log(`[WORKFLOW] Nombre de triggers trouvés pour ce workflow:`, triggers.length);
        triggers.forEach((t, index) => {
          console.log(`[WORKFLOW]   Trigger ${index + 1}: ID=${t.id}, Config=${t.config}, Conditions=${t.conditions}`);
        });

        let shouldExecute = false;
        for (const trigger of triggers) {
          const conditions = trigger.conditions ? JSON.parse(trigger.conditions) : null;
          console.log(`[WORKFLOW] Évaluation des conditions pour trigger ID=${trigger.id}:`, JSON.stringify(conditions, null, 2));
          
          const conditionsResult = evaluateConditions(conditions, eventData);
          console.log(`[WORKFLOW] Résultat de l'évaluation des conditions:`, conditionsResult);
          
          if (conditionsResult) {
            shouldExecute = true;
            console.log(`[WORKFLOW] ✅ Conditions satisfaites - Le workflow sera exécuté`);
            break;
          } else {
            console.log(`[WORKFLOW] ❌ Conditions non satisfaites`);
          }
        }

        // Si pas de conditions, exécuter par défaut
        if (triggers.length === 0) {
          console.log(`[WORKFLOW] ⚠️  Aucune condition - exécution par défaut`);
          shouldExecute = true;
        }

        if (shouldExecute) {
          console.log(`[WORKFLOW] 🚀 Exécution du workflow ID=${workflow.id}`);
          const executionId = await executeWorkflowActions(workflow.id, eventData, triggerType);
          executedWorkflows.push({
            workflow_id: workflow.id,
            workflow_nom: workflow.nom,
            execution_id: executionId
          });
          console.log(`[WORKFLOW] ✅ Workflow ID=${workflow.id} exécuté avec succès, Execution ID=${executionId}`);
        } else {
          console.log(`[WORKFLOW] ⏭️  Workflow ID=${workflow.id} ignoré (conditions non satisfaites)`);
        }
      } catch (error) {
        console.error(`[WORKFLOW] ❌ Erreur lors de l'exécution du workflow ${workflow.id}:`, error);
        console.error(`[WORKFLOW] Stack trace:`, error.stack);
        // Continuer avec les autres workflows
      }
    }

    console.log(`[WORKFLOW] Nombre de workflows exécutés:`, executedWorkflows.length);
    console.log('[WORKFLOW] ========== executeWorkflow FIN ==========');
    return executedWorkflows;
  } catch (error) {
    console.error('[WORKFLOW] ❌ Erreur dans executeWorkflow:', error);
    console.error('[WORKFLOW] Stack trace:', error.stack);
    console.log('[WORKFLOW] ========== executeWorkflow FIN (erreur) ==========');
    return [];
  }
}

/**
 * Exécute les actions d'un workflow
 */
async function executeWorkflowActions(workflowId, eventData, triggerType) {
  console.log(`[WORKFLOW] ========== executeWorkflowActions DÉBUT (Workflow ID=${workflowId}) ==========`);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Créer l'enregistrement d'exécution
  console.log(`[WORKFLOW] Création de l'enregistrement d'exécution...`);
  const executionResult = await query(`
    INSERT INTO workflow_executions 
    (id_workflow, id_fiche, id_user, trigger_type, status, trigger_data, started_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `, [
    workflowId,
    eventData.fiche?.id || null,
    eventData.user?.id || null,
    triggerType,
    JSON.stringify(eventData),
    now
  ]);
  
  console.log(`[WORKFLOW] Résultat de l'INSERT:`, JSON.stringify(executionResult, null, 2));
  
  if (!executionResult || !executionResult.insertId) {
    console.error(`[WORKFLOW] ❌ Erreur: insertId non trouvé dans le résultat`);
    console.error(`[WORKFLOW] Structure du résultat:`, executionResult);
    throw new Error('Impossible de récupérer l\'ID d\'exécution');
  }
  
  const executionId = executionResult.insertId;
  console.log(`[WORKFLOW] ✅ Enregistrement d'exécution créé - ID=${executionId}`);

  try {
    // Récupérer les actions dans l'ordre
    console.log(`[WORKFLOW] Récupération des actions pour workflow ID=${workflowId}...`);
    const actions = await query(`
      SELECT * FROM workflow_actions 
      WHERE id_workflow = ?
      ORDER BY ordre ASC, id ASC
    `, [workflowId]);

    console.log(`[WORKFLOW] Nombre d'actions trouvées:`, actions.length);
    if (actions.length === 0) {
      console.log(`[WORKFLOW] ⚠️  AUCUNE ACTION TROUVÉE pour le workflow ID=${workflowId}`);
    }

    // Exécuter les actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`[WORKFLOW] --- Action ${i + 1}/${actions.length}: ID=${action.id}, Type="${action.type}", Ordre=${action.ordre} ---`);
      
      const config = action.config ? JSON.parse(action.config) : {};
      const conditions = action.conditions ? JSON.parse(action.conditions) : null;

      console.log(`[WORKFLOW] Config de l'action:`, JSON.stringify(config, null, 2));
      console.log(`[WORKFLOW] Conditions de l'action:`, JSON.stringify(conditions, null, 2));

      // Vérifier les conditions de l'action
      if (conditions && !evaluateConditions(conditions, eventData)) {
        console.log(`[WORKFLOW] ⏭️  Action ID=${action.id} ignorée (conditions non satisfaites)`);
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, executed_at)
          VALUES (?, ?, 'skipped', ?)
        `, [executionId, action.id, now]);
        continue;
      }

      // Attendre le délai si nécessaire
      if (action.delay_seconds > 0) {
        console.log(`[WORKFLOW] ⏳ Attente de ${action.delay_seconds} secondes...`);
        await new Promise(resolve => setTimeout(resolve, action.delay_seconds * 1000));
      }

      // Exécuter l'action
      const actionStart = new Date();
      console.log(`[WORKFLOW] 🚀 Exécution de l'action ID=${action.id}, Type="${action.type}"...`);
      try {
        const result = await executeAction(action.type, config, eventData);
        console.log(`[WORKFLOW] ✅ Action ID=${action.id} exécutée avec succès:`, JSON.stringify(result, null, 2));
        
        // Vérifier que le résultat est valide (surtout pour les notifications)
        if (action.type === 'notification' && result) {
          if (result.count && result.count > 0) {
            console.log(`[WORKFLOW] ✅ ${result.count} notification(s) créée(s) avec succès`);
          } else if (result.notification_id) {
            console.log(`[WORKFLOW] ✅ Notification ID=${result.notification_id} créée avec succès`);
          } else {
            console.warn(`[WORKFLOW] ⚠️  Résultat de notification sans ID ni count:`, result);
          }
        }
        
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, result_data, executed_at)
          VALUES (?, ?, 'completed', ?, ?)
        `, [executionId, action.id, JSON.stringify(result), actionStart.toISOString().slice(0, 19).replace('T', ' ')]);
      } catch (error) {
        console.error(`[WORKFLOW] ❌ Erreur lors de l'exécution de l'action ID=${action.id}:`, error);
        console.error(`[WORKFLOW] Message d'erreur:`, error.message);
        console.error(`[WORKFLOW] Stack trace:`, error.stack);
        console.error(`[WORKFLOW] ⚠️  L'action a échoué - AUCUNE notification NULL ne devrait être créée`);
        
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, error_message, executed_at)
          VALUES (?, ?, 'failed', ?, ?)
        `, [executionId, action.id, error.message, actionStart.toISOString().slice(0, 19).replace('T', ' ')]);
        // Continuer avec les autres actions même en cas d'erreur
        // IMPORTANT: Si l'action échoue, aucune notification ne devrait être créée
      }
    }

    // Marquer l'exécution comme terminée
    console.log(`[WORKFLOW] ✅ Toutes les actions exécutées - Marquage de l'exécution comme terminée`);
    await query(`
      UPDATE workflow_executions 
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `, [now, executionId]);

    console.log(`[WORKFLOW] ========== executeWorkflowActions FIN (Workflow ID=${workflowId}, Execution ID=${executionId}) ==========`);
    return executionId;
  } catch (error) {
    console.error(`[WORKFLOW] ❌ Erreur fatale dans executeWorkflowActions:`, error);
    console.error(`[WORKFLOW] Stack trace:`, error.stack);
    
    // Marquer l'exécution comme échouée
    await query(`
      UPDATE workflow_executions 
      SET status = 'failed', error_message = ?, completed_at = ?
      WHERE id = ?
    `, [error.message, now, executionId]);
    throw error;
  }
}

/**
 * Exécute une action spécifique
 */
async function executeAction(actionType, config, eventData) {
  switch (actionType) {
    case 'notification':
      return await executeNotificationAction(config, eventData);
    
    case 'sms':
      return await executeSMSAction(config, eventData);
    
    case 'update_field':
      return await executeUpdateFieldAction(config, eventData);
    
    case 'change_etat':
      return await executeChangeEtatAction(config, eventData);
    
    case 'webhook':
      return await executeWebhookAction(config, eventData);
    
    default:
      throw new Error(`Type d'action non supporté: ${actionType}`);
  }
}

/**
 * Action : Notification interne
 */
async function executeNotificationAction(config, eventData) {
  console.log(`[WORKFLOW] ========== executeNotificationAction DÉBUT ==========`);
  console.log(`[WORKFLOW] Config reçue:`, JSON.stringify(config, null, 2));
  console.log(`[WORKFLOW] EventData reçue:`, JSON.stringify({
    has_fiche: !!eventData.fiche,
    fiche_id: eventData.fiche?.id || eventData.fiche_id,
    has_user: !!eventData.user,
    user_id: eventData.user?.id
  }, null, 2));
  
  const { query, queryOne } = require('../../config/database');
  const { type, message, destination } = config;
  
  // Si fiche n'existe pas mais fiche_id existe, récupérer la fiche
  if (!eventData.fiche && eventData.fiche_id) {
    console.log(`[WORKFLOW] Fiche non trouvée dans eventData, récupération depuis fiche_id=${eventData.fiche_id}...`);
    eventData.fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [eventData.fiche_id]);
    if (eventData.fiche) {
      console.log(`[WORKFLOW] ✅ Fiche récupérée: ID=${eventData.fiche.id}`);
    } else {
      console.log(`[WORKFLOW] ⚠️  Fiche non trouvée pour ID=${eventData.fiche_id}`);
    }
  }
  
  console.log(`[WORKFLOW] Type:`, type);
  console.log(`[WORKFLOW] Message original:`, message);
  console.log(`[WORKFLOW] Destination:`, destination);
  
  // Validation des paramètres requis
  if (!type || typeof type !== 'string' || type.trim() === '') {
    console.error(`[WORKFLOW] ❌ Type de notification manquant ou vide`);
    throw new Error('Type de notification requis et non vide');
  }
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.error(`[WORKFLOW] ❌ Message de notification manquant ou vide`);
    throw new Error('Message de notification requis et non vide');
  }
  
  // Remplacer les variables dans le message
  console.log(`[WORKFLOW] Remplacement des variables dans le message...`);
  const processedMessage = replaceVariables(message, eventData);
  console.log(`[WORKFLOW] Message après remplacement:`, processedMessage);
  
  // Vérifier que le message final n'est pas vide
  if (!processedMessage || typeof processedMessage !== 'string' || processedMessage.trim() === '') {
    console.error(`[WORKFLOW] ❌ Message vide après remplacement des variables`);
    throw new Error('Message de notification vide après remplacement des variables');
  }
  
  // Déterminer le destinataire
  let destId = destination;
  console.log(`[WORKFLOW] Destination initiale:`, destId, `(type: ${typeof destId})`);
  
  // Gérer le cas "Tous les admins" (destination vide, null, ou chaîne vide)
  if (!destination || destination === '' || destination === 'null' || destination === null) {
    console.log(`[WORKFLOW] Destination vide/null - Création pour tous les admins`);
    const admins = await query('SELECT id FROM utilisateurs WHERE fonction IN (1, 2, 7) AND etat > 0');
    
    if (!admins || admins.length === 0) {
      console.error(`[WORKFLOW] ❌ Aucun administrateur trouvé`);
      throw new Error('Aucun administrateur actif trouvé pour la notification');
    }
    
    console.log(`[WORKFLOW] ${admins.length} administrateur(s) trouvé(s)`);
    
    // Créer une notification pour chaque admin
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const finalType = type.trim();
    const finalMessage = processedMessage.trim();
    // Récupérer fiche_id depuis fiche.id ou fiche_id directement
    const finalFicheId = eventData.fiche?.id || eventData.fiche_id || null;
    console.log(`[WORKFLOW] Fiche ID récupéré:`, finalFicheId, `(depuis fiche.id: ${eventData.fiche?.id}, depuis fiche_id: ${eventData.fiche_id})`);
    
    // Validation avant de créer les notifications
    if (!finalType || finalType === '') {
      console.error(`[WORKFLOW] ❌ Type vide - ABANDON`);
      throw new Error('Type de notification vide');
    }
    if (!finalMessage || finalMessage === '') {
      console.error(`[WORKFLOW] ❌ Message vide - ABANDON`);
      throw new Error('Message de notification vide');
    }
    
    const validAdmins = admins.filter(admin => admin && admin.id && admin.id > 0);
    console.log(`[WORKFLOW] Admins valides après filtrage:`, validAdmins.length);
    
    if (validAdmins.length === 0) {
      console.error(`[WORKFLOW] ❌ Aucun admin valide trouvé`);
      throw new Error('Aucun administrateur valide trouvé');
    }
    
    // Construire les valeurs pour l'insertion en lot
    const flatValues = [];
    const placeholders = [];
    
    for (const admin of validAdmins) {
      placeholders.push('(?, ?, ?, ?, ?, 0)');
      // S'assurer que toutes les valeurs sont définies (pas undefined)
      flatValues.push(finalType || null);
      flatValues.push(finalFicheId !== undefined ? finalFicheId : null);
      flatValues.push(finalMessage || null);
      flatValues.push(admin.id || null);
      flatValues.push(now || null);
    }
    
    console.log(`[WORKFLOW] Insertion de ${validAdmins.length} notification(s) pour les admins...`);
    console.log(`[WORKFLOW] Nombre de placeholders:`, placeholders.length);
    console.log(`[WORKFLOW] Nombre de valeurs:`, flatValues.length);
    console.log(`[WORKFLOW] Exemple de valeurs (première notification):`, {
      type: flatValues[0],
      id_fiche: flatValues[1],
      message: flatValues[2]?.substring(0, 50) + '...',
      destination: flatValues[3],
      date: flatValues[4]
    });
    
    // Vérifier que le nombre de valeurs correspond aux placeholders
    const expectedValues = placeholders.length * 5; // 5 valeurs par placeholder (lu est hardcodé à 0)
    if (flatValues.length !== expectedValues) {
      console.error(`[WORKFLOW] ❌ Nombre de valeurs incorrect: ${flatValues.length} au lieu de ${expectedValues}`);
      throw new Error(`Erreur de construction des valeurs: ${flatValues.length} valeurs pour ${expectedValues} attendues`);
    }
    
    // Log détaillé des valeurs avant insertion
    console.log(`[WORKFLOW] === VALEURS DÉTAILLÉES AVANT INSERTION ===`);
    for (let i = 0; i < validAdmins.length; i++) {
      const baseIndex = i * 5;
      console.log(`[WORKFLOW] Notification ${i + 1}:`, {
        type: flatValues[baseIndex],
        type_type: typeof flatValues[baseIndex],
        id_fiche: flatValues[baseIndex + 1],
        id_fiche_type: typeof flatValues[baseIndex + 1],
        message: flatValues[baseIndex + 2]?.substring(0, 50),
        message_type: typeof flatValues[baseIndex + 2],
        destination: flatValues[baseIndex + 3],
        destination_type: typeof flatValues[baseIndex + 3],
        date_creation: flatValues[baseIndex + 4],
        date_creation_type: typeof flatValues[baseIndex + 4]
      });
    }
    console.log(`[WORKFLOW] === FIN VALEURS DÉTAILLÉES ===`);
    
    const sqlQuery = `
      INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
      VALUES ${placeholders.join(', ')}
    `;
    console.log(`[WORKFLOW] Requête SQL:`, sqlQuery);
    console.log(`[WORKFLOW] Nombre de paramètres:`, flatValues.length);
    
    const insertResult = await query(sqlQuery, flatValues);
    
    console.log(`[WORKFLOW] Résultat de l'INSERT:`, JSON.stringify(insertResult, null, 2));
    console.log(`[WORKFLOW] ✅ ${validAdmins.length} notification(s) créée(s) avec succès`);
    
    return { success: true, message: `${validAdmins.length} notification(s) créée(s)`, count: validAdmins.length };
  }
  
  // Gérer les destinations spécifiques
  if (destination === 'id_confirmateur' && eventData.fiche?.id_confirmateur) {
    destId = eventData.fiche.id_confirmateur;
    console.log(`[WORKFLOW] Destination résolue depuis id_confirmateur:`, destId);
  } else if (destination === 'id_agent' && eventData.fiche?.id_agent) {
    destId = eventData.fiche.id_agent;
    console.log(`[WORKFLOW] Destination résolue depuis id_agent:`, destId);
  } else if (destination === 'id_commercial' && eventData.fiche?.id_commercial) {
    destId = eventData.fiche.id_commercial;
    console.log(`[WORKFLOW] Destination résolue depuis id_commercial:`, destId);
  }

  // Validation stricte du destinataire
  if (!destId || destId === '' || destId === 'null' || destId === null || (typeof destId !== 'number' && typeof destId !== 'string')) {
    console.error(`[WORKFLOW] ❌ Destinataire invalide:`, destId, `(type: ${typeof destId})`);
    throw new Error('Destinataire non trouvé ou invalide pour la notification');
  }
  
  // Convertir en nombre si c'est une chaîne
  destId = typeof destId === 'string' ? parseInt(destId, 10) : destId;
  console.log(`[WORKFLOW] Destinataire après conversion:`, destId, `(type: ${typeof destId})`);
  
  if (isNaN(destId) || destId <= 0) {
    console.error(`[WORKFLOW] ❌ Destinataire invalide (NaN ou <= 0):`, destId);
    throw new Error(`Destinataire invalide (ID: ${destId})`);
  }
  
  // Vérifier que l'utilisateur destinataire existe
  console.log(`[WORKFLOW] Vérification de l'existence de l'utilisateur ID=${destId}...`);
  const userExists = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND etat > 0', [destId]);
  if (!userExists) {
    console.error(`[WORKFLOW] ❌ Utilisateur ID=${destId} non trouvé ou inactif`);
    throw new Error(`Utilisateur destinataire (ID: ${destId}) non trouvé ou inactif`);
  }
  console.log(`[WORKFLOW] ✅ Utilisateur ID=${destId} trouvé et actif`);

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  // Validation finale AVANT insertion pour éviter les notifications NULL
  const finalType = type.trim();
  const finalMessage = processedMessage.trim();
  const finalDestId = destId;
  // Récupérer fiche_id depuis fiche.id ou fiche_id directement
  const finalFicheId = eventData.fiche?.id || eventData.fiche_id || null;
  console.log(`[WORKFLOW] Fiche ID récupéré (destination spécifique):`, finalFicheId, `(depuis fiche.id: ${eventData.fiche?.id}, depuis fiche_id: ${eventData.fiche_id})`);
  
  console.log(`[WORKFLOW] Validation finale avant insertion...`);
  console.log(`[WORKFLOW] Type:`, finalType, `(valide: ${finalType && finalType !== ''})`);
  console.log(`[WORKFLOW] Message:`, finalMessage.substring(0, 50) + '...', `(valide: ${finalMessage && finalMessage !== ''})`);
  console.log(`[WORKFLOW] Destination:`, finalDestId, `(valide: ${finalDestId && finalDestId > 0})`);
  console.log(`[WORKFLOW] Fiche ID:`, finalFicheId);
  
  if (!finalType || finalType === '') {
    console.error(`[WORKFLOW] ❌ Type vide avant insertion - ABANDON`);
    throw new Error('Type de notification vide - insertion annulée');
  }
  if (!finalMessage || finalMessage === '') {
    console.error(`[WORKFLOW] ❌ Message vide avant insertion - ABANDON`);
    throw new Error('Message de notification vide - insertion annulée');
  }
  if (!finalDestId || finalDestId <= 0 || isNaN(finalDestId)) {
    console.error(`[WORKFLOW] ❌ Destination invalide avant insertion - ABANDON:`, finalDestId);
    throw new Error(`Destination invalide (${finalDestId}) - insertion annulée`);
  }
  
  console.log(`[WORKFLOW] ✅ Toutes les validations passées - Insertion de la notification...`);
  console.log(`[WORKFLOW] Données finales:`, {
    type: finalType,
    id_fiche: finalFicheId,
    message: finalMessage.substring(0, 50) + '...',
    destination: finalDestId,
    date_creation: now
  });
  
  // S'assurer que toutes les valeurs sont définies (pas undefined)
  const insertValues = [
    finalType || null,
    finalFicheId !== undefined ? finalFicheId : null,
    finalMessage || null,
    finalDestId || null,
    now || null
  ];
  
  console.log(`[WORKFLOW] Valeurs finales pour insertion:`, {
    type: insertValues[0],
    id_fiche: insertValues[1],
    message: insertValues[2]?.substring(0, 50) + '...',
    destination: insertValues[3],
    date_creation: insertValues[4]
  });
  
  const insertResult = await query(`
    INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
    VALUES (?, ?, ?, ?, ?, 0)
  `, insertValues);

  console.log(`[WORKFLOW] ✅ Notification créée avec succès - ID=${insertResult.insertId}`);
  console.log(`[WORKFLOW] ========== executeNotificationAction FIN ==========`);
  
  return { success: true, message: 'Notification créée', notification_id: insertResult.insertId };
}

/**
 * Action : Envoi SMS
 */
async function executeSMSAction(config, eventData) {
  const { message, tel_field = 'tel', id_confirmateur } = config;
  
  const fiche = eventData.fiche;
  if (!fiche) {
    throw new Error('Fiche non trouvée pour l\'envoi SMS');
  }

  const tel = fiche[tel_field] || fiche.tel;
  if (!tel) {
    throw new Error(`Numéro de téléphone non trouvé (champ: ${tel_field})`);
  }

  // Remplacer les variables dans le message
  const processedMessage = replaceVariables(message, eventData);

  const provider = await getDefaultSMSProvider();
  if (!provider) {
    throw new Error('Aucun fournisseur SMS configuré');
  }

  const result = await sendSMSViaProvider(provider, tel, processedMessage, 'RAPPEL');
  
  return { success: result.success, message: result.message };
}

/**
 * Action : Mise à jour d'un champ
 */
async function executeUpdateFieldAction(config, eventData) {
  const { query } = require('../../config/database');
  const { field, value } = config;
  
  const ficheId = eventData.fiche?.id;
  if (!ficheId) {
    throw new Error('Fiche non trouvée pour la mise à jour');
  }

  // Remplacer les variables dans la valeur
  const processedValue = replaceVariables(value, eventData);

  await query(`UPDATE fiches SET \`${field}\` = ? WHERE id = ?`, [processedValue, ficheId]);

  return { success: true, field, value: processedValue };
}

/**
 * Action : Changement d'état
 */
async function executeChangeEtatAction(config, eventData) {
  const { query } = require('../../config/database');
  const { etat_id } = config;
  
  const ficheId = eventData.fiche?.id;
  if (!ficheId) {
    throw new Error('Fiche non trouvée pour le changement d\'état');
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  // Mettre à jour l'état
  await query(`
    UPDATE fiches 
    SET id_etat_final = ?, date_appel_time = ?, date_modif_time = ?
    WHERE id = ?
  `, [etat_id, now, now, ficheId]);

  // Enregistrer dans l'historique
  await query(`
    INSERT INTO fiches_histo (id_fiche, id_etat, date_creation)
    VALUES (?, ?, ?)
  `, [ficheId, etat_id, now]);

  return { success: true, etat_id };
}

/**
 * Action : Webhook HTTP
 */
async function executeWebhookAction(config, eventData) {
  const axios = require('axios');
  const { url, method = 'POST', headers = {}, body = {} } = config;

  // Remplacer les variables dans l'URL et le body
  const processedUrl = replaceVariables(url, eventData);
  const processedBody = {};
  for (const [key, value] of Object.entries(body)) {
    processedBody[key] = replaceVariables(value, eventData);
  }

  const response = await axios({
    method,
    url: processedUrl,
    headers,
    data: processedBody
  });

  return { success: true, status: response.status, data: response.data };
}

/**
 * Évalue les conditions
 */
function evaluateConditions(conditions, eventData) {
  console.log(`[WORKFLOW] evaluateConditions - Début`);
  console.log(`[WORKFLOW] Conditions reçues:`, JSON.stringify(conditions, null, 2));
  
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    console.log(`[WORKFLOW] ✅ Aucune condition - retourne true (toujours vrai)`);
    return true; // Pas de conditions = toujours vrai
  }

  console.log(`[WORKFLOW] Nombre de conditions à évaluer:`, conditions.length);

  // Support pour conditions simples (AND logique)
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const { field, operator, value } = condition;
    
    console.log(`[WORKFLOW] Condition ${i + 1}/${conditions.length}:`, {
      field,
      operator,
      value
    });
    
    let fieldValue = getFieldValue(field, eventData);
    let compareValue = value;

    console.log(`[WORKFLOW] Valeur du champ "${field}":`, fieldValue, `(type: ${typeof fieldValue})`);
    console.log(`[WORKFLOW] Valeur de comparaison initiale:`, compareValue, `(type: ${typeof compareValue})`);

    // Remplacer les valeurs spéciales
    if (compareValue === 'NOW()') {
      compareValue = new Date();
      console.log(`[WORKFLOW] Valeur NOW() convertie:`, compareValue);
    } else if (typeof compareValue === 'string' && compareValue.startsWith('NOW()')) {
      // Support pour NOW() + INTERVAL
      const match = compareValue.match(/NOW\(\)\s*([+-])\s*(\d+)\s*(HOUR|DAY|MINUTE)/i);
      if (match) {
        const op = match[1];
        const amount = parseInt(match[2]);
        const unit = match[3].toLowerCase();
        const now = new Date();
        let interval = 0;
        if (unit === 'hour') interval = amount * 60 * 60 * 1000;
        else if (unit === 'day') interval = amount * 24 * 60 * 60 * 1000;
        else if (unit === 'minute') interval = amount * 60 * 1000;
        compareValue = new Date(now.getTime() + (op === '+' ? interval : -interval));
        console.log(`[WORKFLOW] Valeur NOW() + INTERVAL convertie:`, compareValue);
      }
    }

    const conditionResult = evaluateCondition(fieldValue, operator, compareValue);
    console.log(`[WORKFLOW] Résultat de la condition ${i + 1}:`, conditionResult);
    
    if (!conditionResult) {
      console.log(`[WORKFLOW] ❌ Condition ${i + 1} échouée - retourne false`);
      return false;
    } else {
      console.log(`[WORKFLOW] ✅ Condition ${i + 1} satisfaite`);
    }
  }

  console.log(`[WORKFLOW] ✅ Toutes les conditions satisfaites - retourne true`);
  return true;
}

/**
 * Évalue une condition simple
 */
function evaluateCondition(fieldValue, operator, compareValue) {
  if (fieldValue === null || fieldValue === undefined) {
    fieldValue = '';
  }
  if (compareValue === null || compareValue === undefined) {
    compareValue = '';
  }

  switch (operator) {
    case '=':
    case 'equals':
      return String(fieldValue) === String(compareValue);
    case '!=':
    case 'not_equals':
      return String(fieldValue) !== String(compareValue);
    case '>':
    case 'greater_than':
      return Number(fieldValue) > Number(compareValue);
    case '>=':
    case 'greater_or_equal':
      return Number(fieldValue) >= Number(compareValue);
    case '<':
    case 'less_than':
      return Number(fieldValue) < Number(compareValue);
    case '<=':
    case 'less_or_equal':
      return Number(fieldValue) <= Number(compareValue);
    case 'contains':
      return String(fieldValue).includes(String(compareValue));
    case 'not_contains':
      return !String(fieldValue).includes(String(compareValue));
    case 'starts_with':
      return String(fieldValue).startsWith(String(compareValue));
    case 'ends_with':
      return String(fieldValue).endsWith(String(compareValue));
    case 'in':
      const values = Array.isArray(compareValue) ? compareValue : [compareValue];
      return values.includes(String(fieldValue));
    case 'not_in':
      const notValues = Array.isArray(compareValue) ? compareValue : [compareValue];
      return !notValues.includes(String(fieldValue));
    default:
      console.warn(`Opérateur non supporté: ${operator}`);
      return false;
  }
}

/**
 * Récupère la valeur d'un champ depuis les données de l'événement
 */
function getFieldValue(field, eventData) {
  console.log(`[WORKFLOW] getFieldValue - Champ demandé:`, field);
  
  // Support pour notation pointée (ex: fiche.id_etat_final)
  const parts = field.split('.');
  console.log(`[WORKFLOW] getFieldValue - Parties du champ:`, parts);
  
  let value = eventData;
  console.log(`[WORKFLOW] getFieldValue - Valeur initiale (eventData):`, {
    has_fiche: !!eventData.fiche,
    fiche_id: eventData.fiche?.id,
    has_user: !!eventData.user,
    user_id: eventData.user?.id,
    has_changes: !!eventData.changes
  });
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log(`[WORKFLOW] getFieldValue - Partie ${i + 1}/${parts.length}:`, part);
    console.log(`[WORKFLOW] getFieldValue - Valeur actuelle:`, value, `(type: ${typeof value})`);
    
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
      console.log(`[WORKFLOW] getFieldValue - Valeur après accès à "${part}":`, value, `(type: ${typeof value})`);
    } else {
      console.log(`[WORKFLOW] getFieldValue - ❌ Impossible d'accéder à "${part}" - retourne null`);
      console.log(`[WORKFLOW] getFieldValue - Valeur actuelle:`, value);
      console.log(`[WORKFLOW] getFieldValue - Type de valeur:`, typeof value);
      console.log(`[WORKFLOW] getFieldValue - Est un objet:`, value && typeof value === 'object');
      console.log(`[WORKFLOW] getFieldValue - Contient la clé "${part}":`, value && typeof value === 'object' && part in value);
      return null;
    }
  }
  
  console.log(`[WORKFLOW] getFieldValue - ✅ Valeur finale pour "${field}":`, value, `(type: ${typeof value})`);
  return value;
}

/**
 * Remplace les variables dans une chaîne
 */
function replaceVariables(template, eventData) {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = getFieldValue(key, eventData);
    return value !== null && value !== undefined ? String(value) : match;
  });
}

module.exports = {
  executeWorkflow,
  executeWorkflowActions,
  executeAction
};

