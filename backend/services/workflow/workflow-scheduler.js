const { query } = require('../../config/database');
const { executeWorkflow } = require('./workflow-executor');

/**
 * Service de planification des workflows (cron)
 * Vérifie périodiquement les workflows programmés et les exécute
 */

let schedulerInterval = null;
let isRunning = false;
const lastExecutionTimes = new Map(); // Pour éviter les exécutions multiples

/**
 * Parse une expression cron simple et vérifie si elle correspond à maintenant
 * Format supporté: minute hour day month weekday
 * Exemples:
 * - "0 * * * *" : toutes les heures à minute 0
 * - "0 9 * * *" : tous les jours à 9h00
 * - "0 9 * * 1" : tous les lundis à 9h00
 * - Pour toutes les 15 minutes: utiliser l'expression "*/15 * * * *"
 */
function shouldRunNow(cronExpression) {
  try {
    const now = new Date();
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      console.error('[WORKFLOW SCHEDULER] Expression cron invalide (doit avoir 5 parties):', cronExpression);
      return false;
    }
    
    const [minute, hour, day, month, weekday] = parts;
    
    // Vérifier chaque partie
    const checkPart = (value, current, max) => {
      if (value === '*') return true;
      
      // Gérer les intervalles (ex: */15 pour toutes les 15 minutes)
      if (value.startsWith('*/')) {
        const interval = parseInt(value.substring(2));
        if (isNaN(interval) || interval <= 0) return false;
        return current % interval === 0;
      }
      
      // Gérer les plages (ex: 0-5 pour 0 à 5)
      if (value.includes('-')) {
        const [start, end] = value.split('-').map(v => parseInt(v));
        if (isNaN(start) || isNaN(end)) return false;
        return current >= start && current <= end;
      }
      
      // Gérer les listes (ex: 1,3,5 pour 1, 3 ou 5)
      if (value.includes(',')) {
        const values = value.split(',').map(v => parseInt(v.trim()));
        return values.some(v => !isNaN(v) && v === current);
      }
      
      // Valeur unique
      const numValue = parseInt(value);
      return !isNaN(numValue) && numValue === current;
    };
    
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentWeekday = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Vérifier chaque partie de l'expression cron
    if (!checkPart(minute, currentMinute, 59)) return false;
    if (!checkPart(hour, currentHour, 23)) return false;
    if (!checkPart(day, currentDay, 31)) return false;
    if (!checkPart(month, currentMonth, 12)) return false;
    if (!checkPart(weekday, currentWeekday, 6)) return false;
    
    return true;
  } catch (error) {
    console.error('[WORKFLOW SCHEDULER] Erreur lors de la vérification de l\'expression cron:', error);
    return false;
  }
}

/**
 * Vérifie et exécute les workflows programmés
 */
async function checkAndExecuteScheduledWorkflows() {
  if (isRunning) {
    console.log('[WORKFLOW SCHEDULER] Vérification déjà en cours, ignorée');
    return;
  }
  
  isRunning = true;
  console.log('[WORKFLOW SCHEDULER] Début de la vérification des workflows programmés');
  
  try {
    // Récupérer tous les workflows actifs avec des triggers scheduled
    const workflows = await query(`
      SELECT DISTINCT w.*
      FROM workflows w
      INNER JOIN workflow_triggers wt ON w.id = wt.id_workflow
      WHERE w.actif = 1
      AND wt.type = 'scheduled'
      ORDER BY w.priorite ASC
    `);
    
    console.log(`[WORKFLOW SCHEDULER] ${workflows.length} workflow(s) programmé(s) trouvé(s)`);
    
    for (const workflow of workflows) {
      try {
        // Récupérer les triggers scheduled pour ce workflow
        const triggers = await query(
          'SELECT * FROM workflow_triggers WHERE id_workflow = ? AND type = ?',
          [workflow.id, 'scheduled']
        );
        
        for (const trigger of triggers) {
          const config = trigger.config ? JSON.parse(trigger.config) : {};
          const cronExpression = config.cron;
          
          if (!cronExpression) {
            console.log(`[WORKFLOW SCHEDULER] Workflow ${workflow.id}: pas d'expression cron définie`);
            continue;
          }
          
          // Vérifier si l'expression cron correspond à maintenant
          if (shouldRunNow(cronExpression)) {
            // Vérifier si on a déjà exécuté ce workflow récemment (éviter les doublons)
            const lastExecKey = `${workflow.id}_${trigger.id}`;
            const lastExecTime = lastExecutionTimes.get(lastExecKey);
            const now = Date.now();
            
            // Si exécuté il y a moins de 50 secondes, ignorer (évite les exécutions multiples dans la même minute)
            if (lastExecTime && (now - lastExecTime) < 50000) {
              console.log(`[WORKFLOW SCHEDULER] Workflow ${workflow.id} déjà exécuté récemment, ignoré`);
              continue;
            }
            
            console.log(`[WORKFLOW SCHEDULER] Exécution du workflow ${workflow.id} (${workflow.nom}) - Cron: ${cronExpression}`);
            
            // Marquer comme exécuté
            lastExecutionTimes.set(lastExecKey, now);
            
            // Nettoyer les anciennes entrées (garder seulement les 100 dernières)
            if (lastExecutionTimes.size > 100) {
              const entries = Array.from(lastExecutionTimes.entries());
              entries.sort((a, b) => b[1] - a[1]);
              lastExecutionTimes.clear();
              entries.slice(0, 100).forEach(([key, value]) => {
                lastExecutionTimes.set(key, value);
              });
            }
            
            // Exécuter le workflow avec des données d'événement minimales pour scheduled
            await executeWorkflow('scheduled', {
              workflow_id: workflow.id,
              workflow_nom: workflow.nom,
              cron_expression: cronExpression,
              scheduled_at: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`[WORKFLOW SCHEDULER] Erreur lors du traitement du workflow ${workflow.id}:`, error);
        // Continuer avec les autres workflows même en cas d'erreur
      }
    }
  } catch (error) {
    console.error('[WORKFLOW SCHEDULER] Erreur lors de la vérification des workflows programmés:', error);
  } finally {
    isRunning = false;
    console.log('[WORKFLOW SCHEDULER] Fin de la vérification des workflows programmés');
  }
}

/**
 * Démarre le planificateur de workflows
 * Vérifie toutes les minutes si des workflows doivent être exécutés
 */
function startScheduler() {
  if (schedulerInterval) {
    console.log('[WORKFLOW SCHEDULER] Le planificateur est déjà démarré');
    return;
  }
  
  console.log('[WORKFLOW SCHEDULER] Démarrage du planificateur de workflows');
  
  // Vérifier toutes les minutes
  schedulerInterval = setInterval(() => {
    checkAndExecuteScheduledWorkflows().catch(error => {
      console.error('[WORKFLOW SCHEDULER] Erreur dans le planificateur:', error);
    });
  }, 60000); // 60 secondes
  
  // Exécuter immédiatement au démarrage
  checkAndExecuteScheduledWorkflows().catch(error => {
    console.error('[WORKFLOW SCHEDULER] Erreur lors de la première vérification:', error);
  });
}

/**
 * Arrête le planificateur de workflows
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[WORKFLOW SCHEDULER] Planificateur arrêté');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  checkAndExecuteScheduledWorkflows
};
