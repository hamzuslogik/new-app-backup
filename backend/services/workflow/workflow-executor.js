const { query, queryOne } = require('../../config/database');
const { getDefaultSMSProvider, sendSMSViaProvider } = require('../sms.service');

/**
 * Libellé affichage agent (qualification) : pseudo si présent, sinon « prénom nom ».
 */
function formatAgentQualificationDisplayName(u) {
  if (!u) return '';
  const p = u.pseudo != null && String(u.pseudo).trim() !== '' ? String(u.pseudo).trim() : '';
  if (p) return p;
  const parts = [u.prenom, u.nom].map((x) => (x != null ? String(x).trim() : '')).filter(Boolean);
  return parts.join(' ') || '';
}

/**
 * Normalise les alias ID fiche pour les templates ({fiche_id}, {id_fiche}, {fiche.id}).
 */
function resolveFicheIdFromEvent(eventData) {
  if (!eventData || typeof eventData !== 'object') return null;
  const raw =
    eventData.fiche?.id ??
    eventData.fiche_id ??
    eventData.id_fiche ??
    null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : raw;
}

/**
 * Ajoute fiche_id / id_fiche en racine (alias) et charge la fiche si seul l'ID est fourni.
 */
async function ensureFicheOnEventData(eventData) {
  if (!eventData || typeof eventData !== 'object') return eventData;

  let fiche = eventData.fiche || null;
  let ficheId = resolveFicheIdFromEvent(eventData);

  if (!fiche && ficheId != null) {
    fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [ficheId]);
    if (fiche) {
      ficheId = resolveFicheIdFromEvent({ fiche }) ?? ficheId;
    }
  }

  if (fiche && (ficheId == null || ficheId === '')) {
    ficheId = resolveFicheIdFromEvent({ fiche });
  }

  return {
    ...eventData,
    fiche: fiche || eventData.fiche,
    fiche_id: ficheId,
    id_fiche: ficheId
  };
}

/**
 * Ajoute pseudo / nom affichage pour l'agent qualification selon le déclencheur
 * (remarque → destinataire ; alerte KO → id_agent fiche ; fiche KO → id_agent fiche).
 */
async function enrichWorkflowEventData(triggerType, eventData) {
  if (!eventData || typeof eventData !== 'object') {
    return eventData;
  }

  const loadUser = async (userId) => {
    const id = userId != null && userId !== '' ? parseInt(userId, 10) : NaN;
    if (!Number.isFinite(id) || id <= 0) return null;
    return queryOne('SELECT id, pseudo, nom, prenom FROM utilisateurs WHERE id = ?', [id]);
  };

  try {
    // Toujours exposer fiche_id / id_fiche (utilisés dans SQL / templates PHP historiques)
    eventData = await ensureFicheOnEventData(eventData);

    if (triggerType === 'remarque_created' && eventData.remarque && eventData.remarque.id_destinataire) {
      const u = await loadUser(eventData.remarque.id_destinataire);
      const nomAff = formatAgentQualificationDisplayName(u);
      return {
        ...eventData,
        remarque: {
          ...eventData.remarque,
          destinataire_pseudo: u?.pseudo ?? null,
          agent_qualification_nom: nomAff || null
        }
      };
    }

    if (triggerType === 'message_recu' && eventData.message) {
      const expediteur = await loadUser(eventData.message.id_expediteur);
      const destinataire = await loadUser(eventData.message.id_destinataire);
      return {
        ...eventData,
        message: {
          ...eventData.message,
          expediteur_pseudo: expediteur?.pseudo ?? null,
          destinataire_pseudo: destinataire?.pseudo ?? null
        }
      };
    }

    if (
      (triggerType === 'alerte_ko_created' || triggerType === 'alerte_controle_qualite_created') &&
      eventData.alerte_ko &&
      eventData.alerte_ko.id_agent
    ) {
      const u = await loadUser(eventData.alerte_ko.id_agent);
      const nomAff = formatAgentQualificationDisplayName(u);
      return {
        ...eventData,
        alerte_ko: {
          ...eventData.alerte_ko,
          agent_pseudo: u?.pseudo ?? null,
          agent_qualification_nom: nomAff || null
        }
      };
    }

    if (triggerType === 'fiche_ko_created' && eventData.fiche && eventData.fiche.id_agent) {
      const u = await loadUser(eventData.fiche.id_agent);
      const nomAff = formatAgentQualificationDisplayName(u);
      return {
        ...eventData,
        fiche: {
          ...eventData.fiche,
          agent_pseudo: u?.pseudo ?? null,
          agent_qualification_nom: nomAff || null
        }
      };
    }

    if (
      typeof triggerType === 'string' &&
      triggerType.startsWith('demande_insertion_') &&
      eventData.demande_insertion?.id_agent
    ) {
      const u = await loadUser(eventData.demande_insertion.id_agent);
      const nomAff = formatAgentQualificationDisplayName(u);
      return {
        ...eventData,
        demande_insertion: {
          ...eventData.demande_insertion,
          agent_pseudo: eventData.demande_insertion.agent_pseudo ?? u?.pseudo ?? null,
          agent_qualification_nom: nomAff || null
        }
      };
    }
  } catch (e) {
    console.error('[WORKFLOW] enrichWorkflowEventData:', e);
  }

  return eventData;
}

/** La config contient-elle un filtre de transition d'état (même schéma que « État changé ») ? */
function configSpecifiesEtatTransition(config) {
  if (!config || typeof config !== 'object') return false;
  if (config.etat_from_any === true || config.etat_to_any === true) return true;
  if (config.etat_id !== undefined && config.etat_id !== null && config.etat_id !== '') return true;
  const from = config.etat_from;
  const to = config.etat_to;
  if (Array.isArray(from) && from.length > 0) return true;
  if (from !== undefined && from !== null && from !== '') return true;
  if (Array.isArray(to) && to.length > 0) return true;
  if (to !== undefined && to !== null && to !== '') return true;
  const fromTitres = titreEtatVersListe('etat_from_titres', config);
  const toTitres = titreEtatVersListe('etat_to_titres', config);
  if (fromTitres.length > 0 || toTitres.length > 0) return true;
  return false;
}

function normalizeEtatTitreLabel(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Lit etat_*_titres : tableau ou chaîne avec retours / virgules */
function titreEtatVersListe(key, config) {
  const raw = config[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  return String(raw)
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasEtatIdNumbers(config) {
  return config.etat_id !== undefined && config.etat_id !== null && config.etat_id !== '';
}

function hasEtatFromNumbers(config) {
  const from = config.etat_from;
  if (Array.isArray(from) && from.length > 0) return true;
  if (!Array.isArray(from) && from !== undefined && from !== null && from !== '') return true;
  return false;
}

function hasEtatToNumbers(config) {
  const to = config.etat_to;
  if (Array.isArray(to) && to.length > 0) return true;
  if (!Array.isArray(to) && to !== undefined && to !== null && to !== '') return true;
  return false;
}

/** Au moins un motif non vide */
function matchEtatTitresList(patterns, titreReel, logTag, direction) {
  if (!patterns.length) return true;
  const t = normalizeEtatTitreLabel(titreReel);
  if (!t) {
    console.log(`[WORKFLOW] [${logTag}] ❌ Titre état ${direction} absent — motifs:`, patterns);
    return false;
  }
  const ok = patterns.some((p) => {
    const n = normalizeEtatTitreLabel(p);
    if (!n) return false;
    return t === n || t.includes(n) || n.includes(t);
  });
  if (!ok) {
    console.log(
      `[WORKFLOW] [${logTag}] ❌ Titre état ${direction} « ${String(titreReel).trim()} » (norm="${t}") ne correspond à aucun motif`,
      patterns.map((p) => normalizeEtatTitreLabel(p))
    );
  } else {
    console.log(`[WORKFLOW] [${logTag}] ✅ Titre état ${direction} OK pour motifs`, patterns);
  }
  return ok;
}

/**
 * etat_from / etat_to (IDs) + optionnel etat_from_titres / etat_to_titres (libellés états en base).
 * @param {string|null|undefined} oldEtatTitre
 * @param {string|null|undefined} newEtatTitre
 */
function matchEtatTransitionConfig(config, oldEtatRaw, newEtatRaw, logTag = 'etat', oldEtatTitre = null, newEtatTitre = null) {
  const oldEtatNum = oldEtatRaw != null && oldEtatRaw !== '' ? parseInt(oldEtatRaw, 10) : null;
  const newEtatNum = newEtatRaw != null && newEtatRaw !== '' ? parseInt(newEtatRaw, 10) : null;
  const fromTitres = titreEtatVersListe('etat_from_titres', config);
  const toTitres = titreEtatVersListe('etat_to_titres', config);

  console.log(`[WORKFLOW] [${logTag}] État — Ancien: ${oldEtatRaw} (${oldEtatNum}) «${oldEtatTitre || ''}», Nouveau: ${newEtatRaw} (${newEtatNum}) «${newEtatTitre || ''}»`);
  console.log(`[WORKFLOW] [${logTag}] Config etat_from:`, config.etat_from, 'etat_from_any:', config.etat_from_any, 'etat_from_titres:', fromTitres);
  console.log(`[WORKFLOW] [${logTag}] Config etat_to:`, config.etat_to, 'etat_to_any:', config.etat_to_any, 'etat_to_titres:', toTitres);

  let triggerMatches = true;

  const fromAnyState = config.etat_from_any === true ||
    (config.etat_from === undefined || config.etat_from === null || config.etat_from === '');
  const hasFromNums = hasEtatFromNumbers(config);
  const hasFromTitres = fromTitres.length > 0;
  const fromNoSelection = !fromAnyState && !hasFromNums && !hasFromTitres;

  if (fromNoSelection) {
    console.log(`[WORKFLOW] [${logTag}] ❌ État source: aucune sélection (IDs ni titres)`);
    triggerMatches = false;
  } else if (fromAnyState) {
    console.log(`[WORKFLOW] [${logTag}] ✅ État source: n'importe quel état (etat_from_any ou non défini)`);
  } else {
    let fromOk = true;
    if (hasFromNums) {
      const etatFrom = Array.isArray(config.etat_from) ? config.etat_from : [config.etat_from];
      const etatFromNums = etatFrom.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      if (oldEtatNum === null || !etatFromNums.includes(oldEtatNum)) {
        console.log(`[WORKFLOW] [${logTag}] ❌ État source (ID) ne correspond pas: ${oldEtatNum} pas dans [${etatFromNums.join(', ')}]`);
        fromOk = false;
      } else {
        console.log(`[WORKFLOW] [${logTag}] ✅ État source (ID) correspond: ${oldEtatNum}`);
      }
    }
    if (hasFromTitres) {
      if (!matchEtatTitresList(fromTitres, oldEtatTitre, logTag, 'source')) fromOk = false;
    }
    if (!fromOk) triggerMatches = false;
  }

  const toAnyState = config.etat_to_any === true ||
    (config.etat_to === undefined || config.etat_to === null || config.etat_to === '');
  const hasToNums = hasEtatToNumbers(config);
  const hasToTitres = toTitres.length > 0;
  const toNoSelection = !toAnyState && !hasToNums && !hasToTitres && !hasEtatIdNumbers(config);

  if (toNoSelection) {
    console.log(`[WORKFLOW] [${logTag}] ❌ État cible: aucune sélection (IDs, titres ni etat_id)`);
    triggerMatches = false;
  } else if (toAnyState) {
    console.log(`[WORKFLOW] [${logTag}] ✅ État cible: n'importe quel état (etat_to_any ou non défini)`);
  } else {
    let toOk = true;
    if (hasToNums) {
      const etatTo = Array.isArray(config.etat_to) ? config.etat_to : [config.etat_to];
      const etatToNums = etatTo.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      if (newEtatNum === null || !etatToNums.includes(newEtatNum)) {
        console.log(`[WORKFLOW] [${logTag}] ❌ État cible (ID) ne correspond pas: ${newEtatNum} pas dans [${etatToNums.join(', ')}]`);
        toOk = false;
      } else {
        console.log(`[WORKFLOW] [${logTag}] ✅ État cible (ID) correspond: ${newEtatNum}`);
      }
    }
    if (hasToTitres) {
      if (!matchEtatTitresList(toTitres, newEtatTitre, logTag, 'cible')) toOk = false;
    }
    if (!toOk) triggerMatches = false;
  }

  if (triggerMatches && !toAnyState &&
      (config.etat_to === undefined || config.etat_to === null || (Array.isArray(config.etat_to) && config.etat_to.length === 0)) &&
      !hasToTitres &&
      hasEtatIdNumbers(config)) {
    const etatId = Array.isArray(config.etat_id) ? config.etat_id : [config.etat_id];
    const etatIdNums = etatId.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    if (newEtatNum === null || !etatIdNums.includes(newEtatNum)) {
      console.log(`[WORKFLOW] [${logTag}] ❌ État ID ne correspond pas: ${newEtatNum} n'est pas dans [${etatIdNums.join(', ')}]`);
      triggerMatches = false;
    } else {
      console.log(`[WORKFLOW] [${logTag}] ✅ État ID correspond: ${newEtatNum}`);
    }
  }

  return triggerMatches;
}

/**
 * Une ligne workflow_triggers (DB) matche-t-elle l'événement + conditions JSON ?
 * @returns {boolean}
 */
function doesWorkflowTriggerRowFire(trigger, triggerType, eventData) {
  let conditions = null;
  let config = {};
  try {
    conditions = trigger.conditions ? JSON.parse(trigger.conditions) : null;
    config = trigger.config ? JSON.parse(trigger.config) : {};
  } catch (parseErr) {
    console.error(`[WORKFLOW] Trigger id=${trigger.id}: JSON config/conditions invalide:`, parseErr.message);
    return false;
  }

  console.log(`[WORKFLOW] Évaluation du trigger ID=${trigger.id}`);
  console.log(`[WORKFLOW] Config:`, JSON.stringify(config, null, 2));
  console.log(`[WORKFLOW] Conditions:`, JSON.stringify(conditions, null, 2));

  let triggerMatches = true;

  if (triggerType === 'etat_changed') {
    const oldEtat = eventData.old_etat;
    const newEtat = eventData.new_etat || eventData.fiche?.id_etat_final;
    triggerMatches = matchEtatTransitionConfig(
      config,
      oldEtat,
      newEtat,
      'etat_changed',
      eventData.old_etat_titre,
      eventData.new_etat_titre
    );
  } else if (triggerType === 'compte_rendu_approved' && configSpecifiesEtatTransition(config)) {
    const oldEtat = eventData.old_etat;
    const newEtat = eventData.new_etat != null && eventData.new_etat !== ''
      ? eventData.new_etat
      : eventData.fiche?.id_etat_final;
    if (oldEtat == null || oldEtat === '' || newEtat == null || newEtat === '') {
      console.warn(
        '[WORKFLOW] compte_rendu_approved : filtre état (etat_from/etat_to) présent dans la config mais old_etat/new_etat absents — non matche. ' +
        'Vérifier que la route d’approbation transmet bien la transition (backend à jour).'
      );
      triggerMatches = false;
    } else {
      triggerMatches = matchEtatTransitionConfig(
        config,
        oldEtat,
        newEtat,
        'compte_rendu_approved+état',
        eventData.old_etat_titre,
        eventData.new_etat_titre
      );
    }
  }

  if (!triggerMatches) {
    console.log(`[WORKFLOW] ❌ Trigger ne correspond pas aux critères spécifiés`);
    return false;
  }

  const conditionsResult = evaluateConditions(conditions, eventData);
  console.log(`[WORKFLOW] Résultat de l'évaluation des conditions:`, conditionsResult);
  if (conditionsResult) {
    console.log(`[WORKFLOW] ✅ Ligne de déclencheur satisfaite`);
  } else {
    console.log(`[WORKFLOW] ❌ Conditions non satisfaites`);
  }
  return !!conditionsResult;
}

/**
 * Exécute un workflow pour un événement donné
 * @param {string} triggerType - Type d'événement (fiche_created, etat_changed, rdv_affecte, rdv_desaffecte, remarque_created, completude_created, completude_accepted, alerte_ko_created, alerte_controle_qualite_created, fiche_ko_created, decalage_refused, demande_decalage_annulee, demande_insertion_refusee, etc.)
 * @param {Object} eventData - Données de l'événement (fiche, user, etc.)
 * @returns {Promise<Array>} Liste des workflows exécutés
 */
async function executeWorkflow(triggerType, eventDataIn) {
  const eventData = await enrichWorkflowEventData(triggerType, eventDataIn);
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
    const targetWorkflowId = Number(eventData?.__workflow_id);
    const workflows = await query(`
      SELECT DISTINCT w.*
      FROM workflows w
      INNER JOIN workflow_triggers wt ON w.id = wt.id_workflow
      WHERE w.actif = 1
      AND wt.type = ?
      ${Number.isFinite(targetWorkflowId) && targetWorkflowId > 0 ? 'AND w.id = ?' : ''}
      ORDER BY w.priorite ASC
    `, Number.isFinite(targetWorkflowId) && targetWorkflowId > 0 ? [triggerType, targetWorkflowId] : [triggerType]);

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
        if (triggers.length === 0) {
          console.log(`[WORKFLOW] ⚠️  Aucune ligne de déclencheur pour ce type - exécution par défaut`);
          shouldExecute = true;
        } else {
          for (const trigger of triggers) {
            if (doesWorkflowTriggerRowFire(trigger, triggerType, eventData)) {
              shouldExecute = true;
              console.log(`[WORKFLOW] ✅ Au moins une ligne de déclencheur matche - le workflow sera exécuté`);
              break;
            }
          }
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
          if (result.count > 0) {
            console.log(`[WORKFLOW] ✅ ${result.count} notification(s) créée(s) avec succès`);
          } else if (result.notification_id) {
            console.log(`[WORKFLOW] ✅ Notification ID=${result.notification_id} créée avec succès`);
          } else if (result.skipped > 0) {
            console.log(`[WORKFLOW] ℹ️  Notification(s) non créées : ${result.skipped} doublon(s) (même fiche, destinataire, type et message aujourd’hui). Réf. existante si besoin dans les logs d’insertion.`);
          } else {
            console.warn(`[WORKFLOW] ⚠️  Résultat de notification inattendu:`, result);
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
    
    case 'system_message':
      return await executeSystemMessageAction(config, eventData);
    
    case 'execute_sql':
      return await executeSQLAction(config, eventData);
    
    default:
      throw new Error(`Type d'action non supporté: ${actionType}`);
  }
}

/**
 * Métadonnées JSON pour lien au clic (slug ou chemin relatif app interne uniquement).
 * @param {string} [linkPage] — ex. "compte-rendu" ou "/compte-rendu"
 * @returns {string|null}
 */
function buildNotificationLinkMetadataJson(linkPage) {
  if (linkPage == null) return null;
  const raw = String(linkPage).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('://') || lower.startsWith('//') || lower.includes('javascript:') || lower.includes('@')) {
    return null;
  }
  let path = raw.startsWith('/') ? raw : `/${raw}`;
  path = path.replace(/\/+/g, '/');
  if (path === '/' || path.length < 2) return null;
  return JSON.stringify({ link_path: path, link_page: raw });
}

/**
 * Insère une notification. Tente d'abord avec id_expediteur, afficher_expediteur et metadata ;
 * en cas de colonnes absentes, réessaie avec des schémas plus simples.
 */
async function insertNotification(query, type, id_fiche, message, destination, date_creation, idExpediteur, showExpediteur, metadataStr = null) {
  // Anti-douplication : même événement rejoué (ex. deux déclencheurs le même payload) ne doit pas
  // dupliquer la même ligne. On compare type + message : deux alertes différentes le même jour restent possibles.
  if (id_fiche !== null && id_fiche !== undefined && destination && type != null && message != null) {
    const alreadyExists = await query(
      `SELECT id
       FROM notifications
       WHERE destination = ?
         AND id_fiche = ?
         AND DATE(date_creation) = DATE(?)
         AND COALESCE(type, '') = COALESCE(?, '')
         AND message = ?
       LIMIT 1`,
      [destination, id_fiche, date_creation, type, message]
    );
    if (Array.isArray(alreadyExists) && alreadyExists.length > 0) {
      return { skipped: true, reason: 'duplicate_same_fiche_dest_type_message_day', id: alreadyExists[0].id };
    }
  }

  const attempts = [
    {
      sql: `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, id_expediteur, afficher_expediteur, metadata)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      params: [type, id_fiche, message, destination, date_creation, idExpediteur, showExpediteur, metadataStr]
    },
    {
      sql: `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, id_expediteur, afficher_expediteur)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      params: [type, id_fiche, message, destination, date_creation, idExpediteur, showExpediteur]
    },
    {
      sql: `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      params: [type, id_fiche, message, destination, date_creation, metadataStr]
    },
    {
      sql: `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
            VALUES (?, ?, ?, ?, ?, 0)`,
      params: [type, id_fiche, message, destination, date_creation]
    }
  ];

  let lastErr = null;
  for (const { sql, params } of attempts) {
    try {
      await query(sql, params);
      return;
    } catch (err) {
      const unknownColumn =
        err.errno === 1054 ||
        err.code === 'ER_BAD_FIELD_ERROR' ||
        (err.message && String(err.message).includes('Unknown column'));
      if (!unknownColumn) throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('insertNotification: aucun schéma INSERT compatible');
}

/**
 * Enrichit eventData.fiche avec id_superviseur_qualif_agent :
 * id de l'utilisateur (fonction 2 = superviseur qualification) qui est le chef_equipe
 * de l'agent (fonction 3) dont l'id figure dans fiche.id_agent.
 * Modifie l'objet en place ; ne fait rien si pas d'agent rattaché.
 */
async function enrichSuperviseurQualifAgent(eventData) {
  try {
    if (!eventData) return;
    const agentId =
      eventData.fiche?.id_agent ||
      eventData.demande_insertion?.id_agent ||
      null;
    if (!agentId) return;

    if (!eventData.fiche) eventData.fiche = {};
    if (
      eventData.fiche.id_superviseur_qualif_agent !== undefined &&
      eventData.fiche.id_superviseur_qualif_agent !== null
    ) {
      return;
    }
    const { queryOne } = require('../../config/database');
    const row = await queryOne(
      `SELECT u_sup.id AS id_superviseur
         FROM utilisateurs u_agent
         LEFT JOIN utilisateurs u_sup ON u_sup.id = u_agent.chef_equipe AND u_sup.fonction = 2 AND (u_sup.etat > 0 OR u_sup.etat IS NULL)
        WHERE u_agent.id = ? AND u_agent.fonction = 3
        LIMIT 1`,
      [agentId]
    );
    if (row && row.id_superviseur) {
      eventData.fiche.id_superviseur_qualif_agent = parseInt(row.id_superviseur, 10);
      console.log(`[WORKFLOW] enrichSuperviseurQualifAgent: id_agent=${agentId} → id_superviseur_qualif_agent=${eventData.fiche.id_superviseur_qualif_agent}`);
    } else {
      eventData.fiche.id_superviseur_qualif_agent = null;
    }
  } catch (e) {
    console.warn(`[WORKFLOW] enrichSuperviseurQualifAgent erreur :`, e.message);
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
  const { type, message, destination, destination_type, destination_fonctions, destination_utilisateurs, afficher_expediteur, link_page, link_page_manual } = config;

  const linkRaw =
    link_page_manual != null && String(link_page_manual).trim() !== ''
      ? String(link_page_manual).trim()
      : link_page != null && String(link_page).trim() !== ''
        ? String(link_page).trim()
        : '';
  const metadataJson = buildNotificationLinkMetadataJson(linkRaw);

  // Pré-calcule fiche.id_superviseur_qualif_agent (superviseur qualif de l'agent qui a créé la fiche)
  // pour qu'il soit résoluble via destination_utilisateurs ou destination legacy.
  await enrichSuperviseurQualifAgent(eventData);
  const idExpediteur = eventData.user?.id ?? null;
  const showExpediteur = afficher_expediteur !== false ? 1 : 0;
  
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

  const finalType = type.trim();
  const finalMessage = processedMessage.trim();
  const finalFicheId = eventData.fiche?.id || eventData.fiche_id || null;

  // Destinataires par fonction(s) et/ou utilisateur(s) explicites
  const hasFonctions = Array.isArray(destination_fonctions) && destination_fonctions.length > 0;
  const hasUtilisateurs = Array.isArray(destination_utilisateurs) && destination_utilisateurs.length > 0;
  if (hasFonctions || hasUtilisateurs) {
    const userIds = new Set();
    if (hasFonctions) {
      const placeholders = destination_fonctions.map(() => '?').join(',');
      const rows = await query(`SELECT id FROM utilisateurs WHERE fonction IN (${placeholders}) AND etat > 0`, destination_fonctions);
      rows.forEach(r => { if (r && r.id) userIds.add(parseInt(r.id, 10)); });
    }
    if (hasUtilisateurs) {
      const ids = destination_utilisateurs
        .map((id) => {
          if (typeof id === 'string' && id.startsWith('{') && id.endsWith('}')) {
            const fieldPath = id.slice(1, -1);
            const resolvedValue = getFieldValue(fieldPath, eventData);
            const parsed = parseInt(resolvedValue, 10);
            return !isNaN(parsed) && parsed > 0 ? parsed : null;
          }
          const parsed = parseInt(id, 10);
          return !isNaN(parsed) && parsed > 0 ? parsed : null;
        })
        .filter((id) => id !== null);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const rows = await query(`SELECT id FROM utilisateurs WHERE id IN (${placeholders}) AND etat > 0`, ids);
        rows.forEach(r => { if (r && r.id) userIds.add(parseInt(r.id, 10)); });
      }
    }
    const recipientIds = Array.from(userIds);
    if (recipientIds.length === 0) {
      console.warn('[WORKFLOW] Aucun utilisateur actif trouvé pour les fonctions/utilisateurs sélectionnés');
      return { success: true, message: 'Aucun destinataire actif', count: 0 };
    }
    console.log(`[WORKFLOW] ${recipientIds.length} destinataire(s) (fonctions/utilisateurs)`);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let createdCount = 0;
    let skippedCount = 0;
    for (const uid of recipientIds) {
      const insertResult = await insertNotification(query, finalType, finalFicheId, finalMessage, uid, now, idExpediteur, showExpediteur, metadataJson);
      if (insertResult && insertResult.skipped) skippedCount += 1;
      else createdCount += 1;
    }
    return {
      success: true,
      message: `${createdCount} notification(s) créée(s), ${skippedCount} ignorée(s) (doublons)`,
      count: createdCount,
      skipped: skippedCount
    };
  }
  
  // Déterminer le destinataire (mode admins ou rôle sur la fiche)
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
    // finalType, finalMessage, finalFicheId déjà définis plus haut
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
    
    let createdCount = 0;
    let skippedCount = 0;
    for (const admin of validAdmins) {
      const insertResult = await insertNotification(
        query,
        finalType,
        finalFicheId,
        finalMessage,
        admin.id,
        now,
        idExpediteur,
        showExpediteur,
        metadataJson
      );
      if (insertResult && insertResult.skipped) skippedCount += 1;
      else createdCount += 1;
    }
    console.log(`[WORKFLOW] ✅ ${createdCount} notification(s) admin créée(s), ${skippedCount} doublon(s) ignorée(s)`);
    return {
      success: true,
      message: `${createdCount} notification(s) créée(s) pour les administrateurs`,
      count: createdCount,
      skipped: skippedCount
    };
  }
  
  // Gérer les destinations spécifiques
  if (destination === 'id_confirmateur' && eventData.fiche?.id_confirmateur) {
    destId = eventData.fiche.id_confirmateur;
    console.log(`[WORKFLOW] Destination résolue depuis id_confirmateur:`, destId);
  } else if (destination === 'id_confirmateur_2' && eventData.fiche?.id_confirmateur_2) {
    destId = eventData.fiche.id_confirmateur_2;
    console.log(`[WORKFLOW] Destination résolue depuis id_confirmateur_2:`, destId);
  } else if (destination === 'id_confirmateur_3' && eventData.fiche?.id_confirmateur_3) {
    destId = eventData.fiche.id_confirmateur_3;
    console.log(`[WORKFLOW] Destination résolue depuis id_confirmateur_3:`, destId);
  } else if (destination === 'id_agent' && eventData.fiche?.id_agent) {
    destId = eventData.fiche.id_agent;
    console.log(`[WORKFLOW] Destination résolue depuis id_agent:`, destId);
  } else if (destination === 'id_insert' && eventData.fiche?.id_insert) {
    destId = eventData.fiche.id_insert;
    console.log(`[WORKFLOW] Destination résolue depuis id_insert (agent créateur):`, destId);
  } else if (destination === 'id_commercial' && eventData.fiche?.id_commercial) {
    destId = eventData.fiche.id_commercial;
    console.log(`[WORKFLOW] Destination résolue depuis id_commercial:`, destId);
  } else if (destination === 'id_commercial_2' && eventData.fiche?.id_commercial_2) {
    destId = eventData.fiche.id_commercial_2;
    console.log(`[WORKFLOW] Destination résolue depuis id_commercial_2:`, destId);
  } else if (destination === 'id_qualite' && eventData.fiche?.id_qualite) {
    destId = eventData.fiche.id_qualite;
    console.log(`[WORKFLOW] Destination résolue depuis id_qualite (agent qualité):`, destId);
  } else if (destination === 'id_superviseur_qualif_agent' && eventData.fiche?.id_superviseur_qualif_agent) {
    destId = eventData.fiche.id_superviseur_qualif_agent;
    console.log(`[WORKFLOW] Destination résolue depuis id_superviseur_qualif_agent (superviseur qualif de l'agent de la fiche):`, destId);
  } else if (destination === 'remarque_destinataire' && eventData.remarque?.id_destinataire) {
    destId = eventData.remarque.id_destinataire;
    console.log('[WORKFLOW] Destination résolue depuis remarque_destinataire:', destId);
  } else if (destination === 'remarque_expediteur' && eventData.remarque?.id_expediteur) {
    destId = eventData.remarque.id_expediteur;
    console.log('[WORKFLOW] Destination résolue depuis remarque_expediteur:', destId);
  } else if (destination === 'message_destinataire' && eventData.message?.id_destinataire) {
    destId = eventData.message.id_destinataire;
    console.log('[WORKFLOW] Destination résolue depuis message_destinataire:', destId);
  } else if (destination === 'message_expediteur' && eventData.message?.id_expediteur) {
    destId = eventData.message.id_expediteur;
    console.log('[WORKFLOW] Destination résolue depuis message_expediteur:', destId);
  } else if (destination === 'alerte_ko_agent' && eventData.alerte_ko?.id_agent) {
    destId = eventData.alerte_ko.id_agent;
    console.log('[WORKFLOW] Destination résolue depuis alerte_ko_agent:', destId);
  } else if (destination === 'decalage_expediteur' && eventData.decalage?.expediteur) {
    destId = eventData.decalage.expediteur;
    console.log('[WORKFLOW] Destination résolue depuis decalage_expediteur:', destId);
  } else if (destination === 'decalage_destination' && eventData.decalage?.destination) {
    destId = eventData.decalage.destination;
    console.log('[WORKFLOW] Destination résolue depuis decalage_destination (confirmateur):', destId);
  } else if (destination === 'demande_insertion_agent' && eventData.demande_insertion?.id_agent) {
    destId = eventData.demande_insertion.id_agent;
    console.log('[WORKFLOW] Destination résolue depuis demande_insertion_agent:', destId);
  } else if (destination === 'demande_insertion_superviseur' && eventData.demande_insertion?.id_superviseur) {
    destId = eventData.demande_insertion.id_superviseur;
    console.log('[WORKFLOW] Destination résolue depuis demande_insertion_superviseur:', destId);
  } else if (destination === 'demande_insertion_rp_qualif' && eventData.demande_insertion?.id_rp_qualif) {
    destId = eventData.demande_insertion.id_rp_qualif;
    console.log('[WORKFLOW] Destination résolue depuis demande_insertion_rp_qualif:', destId);
  } else if (destination === 'demande_insertion_traitant' && eventData.demande_insertion?.id_traitant) {
    destId = eventData.demande_insertion.id_traitant;
    console.log('[WORKFLOW] Destination résolue depuis demande_insertion_traitant:', destId);
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
  
  // Validation finale AVANT insertion pour éviter les notifications NULL (finalType, finalMessage, finalFicheId déjà définis plus haut)
  const finalDestId = destId;
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
  
  console.log(`[WORKFLOW] Valeurs finales pour insertion:`, {
    type: finalType,
    id_fiche: finalFicheId,
    message: finalMessage?.substring(0, 50) + '...',
    destination: finalDestId,
    date_creation: now
  });

  const singleInsertResult = await insertNotification(query, finalType, finalFicheId, finalMessage, finalDestId, now, idExpediteur, showExpediteur, metadataJson);
  let notificationId = null;
  if (singleInsertResult && singleInsertResult.skipped) {
    notificationId = singleInsertResult.id || null;
    console.log(`[WORKFLOW] ⏭️ Notification ignorée (doublon même fiche/jour), ID existant=${notificationId}`);
    console.log(`[WORKFLOW] ========== executeNotificationAction FIN ==========`);
    return {
      success: true,
      message: 'Notification ignorée (doublon même fiche/jour)',
      notification_id: notificationId,
      skipped: true
    };
  } else {
    const insertResult = await queryOne('SELECT LAST_INSERT_ID() as id');
    notificationId = insertResult?.id || insertResult?.LAST_INSERT_ID?.();
  }

  console.log(`[WORKFLOW] ✅ Notification créée avec succès - ID=${notificationId}`);
  console.log(`[WORKFLOW] ========== executeNotificationAction FIN ==========`);
  
  return { success: true, message: 'Notification créée', notification_id: notificationId };
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

  // Passer les données de la fiche pour les variables Octopush
  // La colonne s'appelle 'civ' et non 'civilite'
  const civ = fiche.civ || fiche.civilite || '';
  const ficheData = {
    nom: fiche.nom || '',
    prenom: fiche.prenom || '',
    civilite: civ,
    first_name: fiche.prenom || '',
    last_name: fiche.nom || '',
    param3: civ
  };
  const result = await sendSMSViaProvider(provider, tel, processedMessage, 'RAPPEL', ficheData);
  
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
 * Action : Message système
 */
async function executeSystemMessageAction(config, eventData) {
  console.log(`[WORKFLOW] ========== executeSystemMessageAction DÉBUT ==========`);
  console.log(`[WORKFLOW] Config reçue:`, JSON.stringify(config, null, 2));
  
  const { query } = require('../../config/database');
  const { titre, message, type = 'info', priorite = 1, date_debut, date_fin, actif = 1, afficher_une_seule_fois = 0, cibles_fonctions, cibles_utilisateurs, afficher_expediteur } = config;

  // Pré-calcule fiche.id_superviseur_qualif_agent pour les cibles_utilisateurs dynamiques.
  await enrichSuperviseurQualifAgent(eventData);
  const showExpediteurMsg = afficher_expediteur !== false ? 1 : 0;
  
  // Validation
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new Error('Le message est requis pour un message système');
  }
  
  // Remplacer les variables dans le message et le titre
  const processedMessage = replaceVariables(message, eventData);
  const processedTitre = titre ? replaceVariables(titre, eventData) : null;
  
  // Traiter cibles_utilisateurs : remplacer les variables dynamiques par les IDs réels
  let processedCiblesUtilisateurs = cibles_utilisateurs;
  if (processedCiblesUtilisateurs && Array.isArray(processedCiblesUtilisateurs)) {
    processedCiblesUtilisateurs = processedCiblesUtilisateurs.map(userId => {
      // Si c'est une variable (chaîne commençant par {), la remplacer
      if (typeof userId === 'string' && userId.startsWith('{') && userId.endsWith('}')) {
        const fieldPath = userId.slice(1, -1); // Enlever les accolades
        const resolvedValue = getFieldValue(fieldPath, eventData);
        if (resolvedValue && !isNaN(parseInt(resolvedValue))) {
          return parseInt(resolvedValue);
        }
        // Si la variable ne peut pas être résolue, retourner null (sera filtré)
        return null;
      }
      // Sinon, retourner tel quel (ID numérique)
      return userId;
    }).filter(id => id !== null && id !== undefined); // Filtrer les valeurs nulles
  }
  
  // Vérifier qu'au moins un critère de ciblage est défini (après traitement des variables)
  if ((!cibles_fonctions || (Array.isArray(cibles_fonctions) && cibles_fonctions.length === 0)) &&
      (!processedCiblesUtilisateurs || (Array.isArray(processedCiblesUtilisateurs) && processedCiblesUtilisateurs.length === 0))) {
    throw new Error('Au moins un critère de ciblage doit être sélectionné (fonctions ou utilisateurs)');
  }
  
  // Convertir les tableaux en JSON
  const ciblesFonctionsJson = (cibles_fonctions && Array.isArray(cibles_fonctions) && cibles_fonctions.length > 0) 
    ? JSON.stringify(cibles_fonctions) 
    : null;
  const ciblesUtilisateursJson = (processedCiblesUtilisateurs && Array.isArray(processedCiblesUtilisateurs) && processedCiblesUtilisateurs.length > 0) 
    ? JSON.stringify(processedCiblesUtilisateurs) 
    : null;
  
  // Traitement des dates
  let processedDateDebut = null;
  let processedDateFin = null;
  
  if (date_debut) {
    const dateDebutValue = replaceVariables(date_debut, eventData);
    processedDateDebut = dateDebutValue || null;
  }
  
  if (date_fin) {
    const dateFinValue = replaceVariables(date_fin, eventData);
    processedDateFin = dateFinValue || null;
  }
  
  const result = await query(
    `INSERT INTO system_messages 
      (titre, message, type, priorite, date_debut, date_fin, actif, afficher_une_seule_fois, 
       cibles_fonctions, cibles_utilisateurs, id_createur, afficher_expediteur)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      processedTitre,
      processedMessage,
      type,
      priorite,
      processedDateDebut,
      processedDateFin,
      actif,
      afficher_une_seule_fois,
      ciblesFonctionsJson,
      ciblesUtilisateursJson,
      eventData.user?.id || null,
      showExpediteurMsg
    ]
  );
  
  console.log(`[WORKFLOW] ✅ Message système créé avec succès - ID=${result.insertId}`);
  console.log(`[WORKFLOW] ========== executeSystemMessageAction FIN ==========`);
  
  return { success: true, message: 'Message système créé', system_message_id: result.insertId };
}

/**
 * Résout une variable pour l'action SQL (date/datetime spéciaux + champs eventData)
 */
function getSQLVariableValue(key, eventData) {
  const k = key.toUpperCase().replace(/\s+/g, '_');
  const now = new Date();
  if (k === 'NOW' || k === 'CURRENT_DATE' || k === 'DATE_NOW') {
    return now.toISOString().slice(0, 10);
  }
  if (k === 'NOW_DATETIME' || k === 'CURRENT_DATETIME' || k === 'DATETIME_NOW') {
    return now.toISOString().slice(0, 19).replace('T', ' ');
  }
  return getFieldValue(key, eventData);
}

/**
 * Action : Exécuter une requête SQL
 * Les variables {fiche.id}, {fiche.id_confirmateur}, {NOW}, {NOW_DATETIME}, etc. sont remplacées par des paramètres pour éviter l'injection SQL.
 */
async function executeSQLAction(config, eventData) {
  const { query: dbQuery, queryOne } = require('../../config/database');
  const { sql: sqlTemplate } = config;

  if (!sqlTemplate || typeof sqlTemplate !== 'string' || sqlTemplate.trim() === '') {
    throw new Error('La requête SQL est requise pour l\'action execute_sql');
  }

  eventData = await ensureFicheOnEventData(eventData);

  const sqlTrimmed = sqlTemplate.trim();
  const regex = /\{([^}]+)\}/g;
  const parts = [];
  const params = [];
  const resolvedVars = [];
  let lastIndex = 0;
  let m;

  while ((m = regex.exec(sqlTrimmed)) !== null) {
    parts.push(sqlTrimmed.slice(lastIndex, m.index));
    const varName = m[1].trim();
    const value = getSQLVariableValue(varName, eventData);
    const param = value !== null && value !== undefined ? value : null;
    params.push(param);
    resolvedVars.push({ var: varName, value: param });
    lastIndex = regex.lastIndex;
  }
  parts.push(sqlTrimmed.slice(lastIndex));

  const sql = parts.join('?');

  if (!sql || sql.trim() === '') {
    throw new Error('Requête SQL vide après remplacement des variables');
  }

  console.log('[WORKFLOW] execute_sql - Requête exécutée:', sql);
  console.log('[WORKFLOW] execute_sql - Variables résolues:', JSON.stringify(resolvedVars));
  console.log('[WORKFLOW] execute_sql - Paramètres:', JSON.stringify(params));
  console.log('[WORKFLOW] execute_sql - Contexte fiche:', {
    has_fiche: !!eventData.fiche,
    fiche_id: eventData.fiche_id,
    fiche_dot_id: eventData.fiche?.id
  });

  const nullVars = resolvedVars.filter((v) => v.value === null || v.value === undefined);
  if (nullVars.length > 0) {
    const names = nullVars.map((v) => v.var).join(', ');
    console.error(`[WORKFLOW] execute_sql - variable(s) null: ${names}`);
    // Empêcher UPDATE/DELETE avec un ID fiche manquant (ex. WHERE id = {fiche_id})
    const isWrite = /^\s*(UPDATE|DELETE|INSERT)\b/i.test(sqlTrimmed);
    const touchesFicheId = nullVars.some((v) =>
      /^(fiche_id|id_fiche|fiche\.id)$/i.test(String(v.var).trim())
    );
    if (isWrite && touchesFicheId) {
      throw new Error(
        `execute_sql annulé: variable(s) fiche ID null (${names}). Utilisez {fiche.id} ou {fiche_id} avec une fiche présente.`
      );
    }
  }

  const result = await dbQuery(sql, params);
  const isArray = Array.isArray(result);
  const affectedRows = isArray ? result.length : (result?.affectedRows ?? 0);
  const insertId = isArray ? null : (result?.insertId ?? null);

  return {
    success: true,
    message: 'Requête exécutée',
    affectedRows: typeof affectedRows === 'number' ? affectedRows : 0,
    insertId: insertId || undefined
  };
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

  if (!field || typeof field !== 'string') {
    return null;
  }

  const trimmed = field.trim();

  // Alias historiques / PHP : {fiche_id}, {id_fiche} → même valeur que fiche.id
  if (trimmed === 'fiche_id' || trimmed === 'id_fiche') {
    const id = resolveFicheIdFromEvent(eventData);
    console.log(`[WORKFLOW] getFieldValue - alias ${trimmed} →`, id);
    return id;
  }

  // Support pour notation pointée (ex: fiche.id_etat_final)
  const parts = trimmed.split('.');
  console.log(`[WORKFLOW] getFieldValue - Parties du champ:`, parts);

  let value = eventData;
  console.log(`[WORKFLOW] getFieldValue - Valeur initiale (eventData):`, {
    has_fiche: !!eventData?.fiche,
    fiche_id: eventData?.fiche_id ?? eventData?.fiche?.id,
    has_user: !!eventData?.user,
    user_id: eventData?.user?.id,
    has_changes: !!eventData?.changes
  });

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log(`[WORKFLOW] getFieldValue - Partie ${i + 1}/${parts.length}:`, part);
    console.log(`[WORKFLOW] getFieldValue - Valeur actuelle:`, value, `(type: ${typeof value})`);

    if (value && typeof value === 'object' && part in value) {
      value = value[part];
      console.log(`[WORKFLOW] getFieldValue - Valeur après accès à "${part}":`, value, `(type: ${typeof value})`);
    } else {
      // Fallback: fiche.id si fiche_id racine existe mais objet fiche absent/incomplet
      if (i === 0 && part === 'fiche' && resolveFicheIdFromEvent(eventData) != null && parts[1] === 'id') {
        const id = resolveFicheIdFromEvent(eventData);
        console.log(`[WORKFLOW] getFieldValue - fallback fiche.id via fiche_id →`, id);
        return id;
      }
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
function formatTemplateValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function replaceVariables(template, eventData) {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = getFieldValue(key, eventData);
    const formatted = formatTemplateValue(value);
    return formatted !== null ? formatted : match;
  });
}

module.exports = {
  executeWorkflow,
  executeWorkflowActions,
  executeAction
};

