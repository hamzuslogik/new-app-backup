const { query, queryOne } = require('../../config/database');
const { getDefaultSMSProvider, sendSMSViaProvider } = require('../sms.service');

/**
 * Exécute un workflow pour un événement donné
 * @param {string} triggerType - Type d'événement (fiche_created, etat_changed, etc.)
 * @param {Object} eventData - Données de l'événement (fiche, user, etc.)
 * @returns {Promise<Array>} Liste des workflows exécutés
 */
async function executeWorkflow(triggerType, eventData) {
  try {
    // Récupérer tous les workflows actifs qui ont ce type de trigger
    const workflows = await query(`
      SELECT DISTINCT w.*
      FROM workflows w
      INNER JOIN workflow_triggers wt ON w.id = wt.id_workflow
      WHERE w.actif = 1
      AND wt.type = ?
      ORDER BY w.priorite ASC
    `, [triggerType]);

    const executedWorkflows = [];

    for (const workflow of workflows) {
      try {
        // Vérifier les conditions du trigger
        const triggers = await query(
          'SELECT * FROM workflow_triggers WHERE id_workflow = ? AND type = ?',
          [workflow.id, triggerType]
        );

        let shouldExecute = false;
        for (const trigger of triggers) {
          const conditions = trigger.conditions ? JSON.parse(trigger.conditions) : null;
          if (evaluateConditions(conditions, eventData)) {
            shouldExecute = true;
            break;
          }
        }

        // Si pas de conditions, exécuter par défaut
        if (triggers.length === 0 || shouldExecute) {
          const executionId = await executeWorkflowActions(workflow.id, eventData, triggerType);
          executedWorkflows.push({
            workflow_id: workflow.id,
            workflow_nom: workflow.nom,
            execution_id: executionId
          });
        }
      } catch (error) {
        console.error(`Erreur lors de l'exécution du workflow ${workflow.id}:`, error);
        // Continuer avec les autres workflows
      }
    }

    return executedWorkflows;
  } catch (error) {
    console.error('Erreur dans executeWorkflow:', error);
    return [];
  }
}

/**
 * Exécute les actions d'un workflow
 */
async function executeWorkflowActions(workflowId, eventData, triggerType) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Créer l'enregistrement d'exécution
  const [executionResult] = await query(`
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
  const executionId = executionResult.insertId;

  try {
    // Récupérer les actions dans l'ordre
    const actions = await query(`
      SELECT * FROM workflow_actions 
      WHERE id_workflow = ?
      ORDER BY ordre ASC, id ASC
    `, [workflowId]);

    // Exécuter les actions
    for (const action of actions) {
      const config = action.config ? JSON.parse(action.config) : {};
      const conditions = action.conditions ? JSON.parse(action.conditions) : null;

      // Vérifier les conditions de l'action
      if (conditions && !evaluateConditions(conditions, eventData)) {
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, executed_at)
          VALUES (?, ?, 'skipped', ?)
        `, [executionId, action.id, now]);
        continue;
      }

      // Attendre le délai si nécessaire
      if (action.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, action.delay_seconds * 1000));
      }

      // Exécuter l'action
      const actionStart = new Date();
      try {
        const result = await executeAction(action.type, config, eventData);
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, result_data, executed_at)
          VALUES (?, ?, 'completed', ?, ?)
        `, [executionId, action.id, JSON.stringify(result), actionStart.toISOString().slice(0, 19).replace('T', ' ')]);
      } catch (error) {
        await query(`
          INSERT INTO workflow_action_results 
          (id_execution, id_action, status, error_message, executed_at)
          VALUES (?, ?, 'failed', ?, ?)
        `, [executionId, action.id, error.message, actionStart.toISOString().slice(0, 19).replace('T', ' ')]);
        // Continuer avec les autres actions même en cas d'erreur
      }
    }

    // Marquer l'exécution comme terminée
    await query(`
      UPDATE workflow_executions 
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `, [now, executionId]);

    return executionId;
  } catch (error) {
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
  const { query, queryOne } = require('../../config/database');
  const { type, message, destination } = config;
  
  // Validation des paramètres requis
  if (!type || typeof type !== 'string' || type.trim() === '') {
    throw new Error('Type de notification requis et non vide');
  }
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new Error('Message de notification requis et non vide');
  }
  
  // Remplacer les variables dans le message
  const processedMessage = replaceVariables(message, eventData);
  
  // Vérifier que le message final n'est pas vide
  if (!processedMessage || typeof processedMessage !== 'string' || processedMessage.trim() === '') {
    throw new Error('Message de notification vide après remplacement des variables');
  }
  
  // Déterminer le destinataire
  let destId = destination;
  if (destination === 'id_confirmateur' && eventData.fiche?.id_confirmateur) {
    destId = eventData.fiche.id_confirmateur;
  } else if (destination === 'id_agent' && eventData.fiche?.id_agent) {
    destId = eventData.fiche.id_agent;
  } else if (destination === 'id_commercial' && eventData.fiche?.id_commercial) {
    destId = eventData.fiche.id_commercial;
  }

  // Validation stricte du destinataire
  if (!destId || (typeof destId !== 'number' && typeof destId !== 'string')) {
    throw new Error('Destinataire non trouvé ou invalide pour la notification');
  }
  
  // Convertir en nombre si c'est une chaîne
  destId = typeof destId === 'string' ? parseInt(destId, 10) : destId;
  
  if (isNaN(destId) || destId <= 0) {
    throw new Error(`Destinataire invalide (ID: ${destId})`);
  }
  
  // Vérifier que l'utilisateur destinataire existe
  const userExists = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND etat > 0', [destId]);
  if (!userExists) {
    throw new Error(`Utilisateur destinataire (ID: ${destId}) non trouvé ou inactif`);
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await query(`
    INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
    VALUES (?, ?, ?, ?, ?, 0)
  `, [type.trim(), eventData.fiche?.id || null, processedMessage.trim(), destId, now]);

  return { success: true, message: 'Notification créée' };
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
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return true; // Pas de conditions = toujours vrai
  }

  // Support pour conditions simples (AND logique)
  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    let fieldValue = getFieldValue(field, eventData);
    let compareValue = value;

    // Remplacer les valeurs spéciales
    if (compareValue === 'NOW()') {
      compareValue = new Date();
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
      }
    }

    if (!evaluateCondition(fieldValue, operator, compareValue)) {
      return false;
    }
  }

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
  // Support pour notation pointée (ex: fiche.id_etat_final)
  const parts = field.split('.');
  let value = eventData;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }
  
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

