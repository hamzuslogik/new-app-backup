const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne, transaction } = require('../config/database');
const { executeWorkflow } = require('../services/workflow/workflow-executor');

/** `or` = au moins une ligne de déclencheur (même type) matche ; `and` = toutes doivent matcher */
function normalizeCombineTriggers(v) {
  if (v === true || v === 1 || v === '1') return 'and';
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (s === 'and' || s === 'true') return 'and';
  return 'or';
}

async function ensureWorkflowCombineTriggersColumn() {
  try {
    const col = await queryOne(
      `SELECT 1 AS ok FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = SCHEMA() AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'combine_triggers'`
    );
    if (!col) {
      await query(
        `ALTER TABLE workflows ADD COLUMN combine_triggers VARCHAR(8) NOT NULL DEFAULT 'or'`
      );
      console.log('[WORKFLOWS] Colonne combine_triggers ajoutée sur workflows');
    }
  } catch (e) {
    console.warn('[WORKFLOWS] ensureWorkflowCombineTriggersColumn:', e.message);
  }
}

ensureWorkflowCombineTriggersColumn();

// =====================================================
// WORKFLOWS
// =====================================================

// Récupérer tous les workflows
router.get('/', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const workflows = await query(`
      SELECT
        w.*,
        u.pseudo as created_by_pseudo,
        (SELECT COUNT(*) FROM workflow_triggers wt WHERE wt.id_workflow = w.id) AS triggers_count,
        (SELECT COUNT(*) FROM workflow_actions wa WHERE wa.id_workflow = w.id) AS actions_count
      FROM workflows w
      LEFT JOIN utilisateurs u ON w.created_by = u.id
      ORDER BY w.priorite ASC, w.date_creation DESC
    `);
    
    // Pour chaque workflow, récupérer les triggers et actions
    for (const workflow of workflows) {
      const triggers = await query(
        'SELECT * FROM workflow_triggers WHERE id_workflow = ? ORDER BY id ASC',
        [workflow.id]
      );
      workflow.triggers = triggers.map(t => ({
        ...t,
        config: t.config ? JSON.parse(t.config) : null,
        conditions: t.conditions ? JSON.parse(t.conditions) : null
      }));

      const actions = await query(
        'SELECT * FROM workflow_actions WHERE id_workflow = ? ORDER BY ordre ASC, id ASC',
        [workflow.id]
      );
      workflow.actions = actions.map(a => ({
        ...a,
        config: a.config ? JSON.parse(a.config) : null,
        conditions: a.conditions ? JSON.parse(a.conditions) : null
      }));
    }

    res.json({ success: true, data: workflows });
  } catch (error) {
    console.error('Erreur lors de la récupération des workflows:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Récupérer un workflow par ID
router.get('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await queryOne(
      'SELECT * FROM workflows WHERE id = ?',
      [id]
    );

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow non trouvé' });
    }

    const triggers = await query(
      'SELECT * FROM workflow_triggers WHERE id_workflow = ? ORDER BY id ASC',
      [id]
    );
    workflow.triggers = triggers.map(t => ({
      ...t,
      config: t.config ? JSON.parse(t.config) : null,
      conditions: t.conditions ? JSON.parse(t.conditions) : null
    }));

    const actions = await query(
      'SELECT * FROM workflow_actions WHERE id_workflow = ? ORDER BY ordre ASC, id ASC',
      [id]
    );
    workflow.actions = actions.map(a => ({
      ...a,
      config: a.config ? JSON.parse(a.config) : null,
      conditions: a.conditions ? JSON.parse(a.conditions) : null
    }));

    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Erreur lors de la récupération du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Créer un workflow
router.post('/', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { nom, description, actif, priorite, triggers, actions } = req.body;
    const combine_triggers = req.body.combine_triggers ?? req.body.combineTriggers;

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins un déclencheur est requis' });
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins une action est requise' });
    }

    const result = await transaction(async (connection) => {
      // Créer le workflow
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const combine = normalizeCombineTriggers(combine_triggers);
      const [workflowResult] = await connection.execute(
        'INSERT INTO workflows (nom, description, actif, priorite, combine_triggers, created_by, date_creation) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nom, description || null, actif !== undefined ? actif : 1, priorite || 0, combine, req.user.id, now]
      );
      const workflowId = workflowResult.insertId;

      // Créer les déclencheurs
      for (const trigger of triggers) {
        await connection.execute(
          'INSERT INTO workflow_triggers (id_workflow, type, config, conditions) VALUES (?, ?, ?, ?)',
          [
            workflowId,
            trigger.type,
            trigger.config ? JSON.stringify(trigger.config) : null,
            trigger.conditions ? JSON.stringify(trigger.conditions) : null
          ]
        );
      }

      // Créer les actions
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        await connection.execute(
          'INSERT INTO workflow_actions (id_workflow, ordre, type, config, conditions, delay_seconds) VALUES (?, ?, ?, ?, ?, ?)',
          [
            workflowId,
            action.ordre !== undefined ? action.ordre : i,
            action.type,
            JSON.stringify(action.config || {}),
            action.conditions ? JSON.stringify(action.conditions) : null,
            action.delay_seconds || 0
          ]
        );
      }

      return workflowId;
    });

    res.status(201).json({
      success: true,
      message: 'Workflow créé avec succès',
      data: { id: result }
    });
  } catch (error) {
    console.error('Erreur lors de la création du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour un workflow
router.put('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, actif, priorite, triggers, actions } = req.body;
    const combine_triggers = req.body.combine_triggers ?? req.body.combineTriggers;

    const workflow = await queryOne('SELECT * FROM workflows WHERE id = ?', [id]);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow non trouvé' });
    }

    await transaction(async (connection) => {
      // Mettre à jour le workflow
      if (nom !== undefined || description !== undefined || actif !== undefined || priorite !== undefined || combine_triggers !== undefined) {
        const updates = [];
        const values = [];
        if (nom !== undefined) { updates.push('nom = ?'); values.push(nom); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (actif !== undefined) { updates.push('actif = ?'); values.push(actif); }
        if (priorite !== undefined) { updates.push('priorite = ?'); values.push(priorite); }
        if (combine_triggers !== undefined) {
          updates.push('combine_triggers = ?');
          values.push(normalizeCombineTriggers(combine_triggers));
        }
        // Mettre à jour date_modif
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        updates.push('date_modif = ?');
        values.push(now);
        values.push(id);
        await connection.execute(
          `UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Si triggers ou actions sont fournis, les remplacer
      if (triggers !== undefined || actions !== undefined) {
        // Supprimer les anciens triggers et actions
        await connection.execute('DELETE FROM workflow_triggers WHERE id_workflow = ?', [id]);
        await connection.execute('DELETE FROM workflow_actions WHERE id_workflow = ?', [id]);

        // Créer les nouveaux triggers
        if (triggers && Array.isArray(triggers)) {
          for (const trigger of triggers) {
            await connection.execute(
              'INSERT INTO workflow_triggers (id_workflow, type, config, conditions) VALUES (?, ?, ?, ?)',
              [
                id,
                trigger.type,
                trigger.config ? JSON.stringify(trigger.config) : null,
                trigger.conditions ? JSON.stringify(trigger.conditions) : null
              ]
            );
          }
        }

        // Créer les nouvelles actions
        if (actions && Array.isArray(actions)) {
          for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            await connection.execute(
              'INSERT INTO workflow_actions (id_workflow, ordre, type, config, conditions, delay_seconds) VALUES (?, ?, ?, ?, ?, ?)',
              [
                id,
                action.ordre !== undefined ? action.ordre : i,
                action.type,
                JSON.stringify(action.config || {}),
                action.conditions ? JSON.stringify(action.conditions) : null,
                action.delay_seconds || 0
              ]
            );
          }
        }
      }
    });

    res.json({ success: true, message: 'Workflow mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un workflow
router.delete('/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await queryOne('SELECT * FROM workflows WHERE id = ?', [id]);
    
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow non trouvé' });
    }

    await query('DELETE FROM workflows WHERE id = ?', [id]);
    res.json({ success: true, message: 'Workflow supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Activer/Désactiver un workflow
router.patch('/:id/toggle', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await queryOne('SELECT * FROM workflows WHERE id = ?', [id]);
    
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow non trouvé' });
    }

    const newActif = workflow.actif === 1 ? 0 : 1;
    await query('UPDATE workflows SET actif = ? WHERE id = ?', [newActif, id]);

    res.json({
      success: true,
      message: `Workflow ${newActif === 1 ? 'activé' : 'désactivé'} avec succès`,
      data: { actif: newActif }
    });
  } catch (error) {
    console.error('Erreur lors de la modification du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Tester un workflow
router.post('/:id/test', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { test_data } = req.body; // Données de test (fiche, etc.)

    const workflow = await queryOne('SELECT * FROM workflows WHERE id = ?', [id]);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow non trouvé' });
    }

    // Récupérer triggers et actions
    const triggers = await query(
      'SELECT * FROM workflow_triggers WHERE id_workflow = ?',
      [id]
    );
    const actions = await query(
      'SELECT * FROM workflow_actions WHERE id_workflow = ? ORDER BY ordre ASC',
      [id]
    );

    // Simuler l'exécution (sans vraiment exécuter)
    const result = {
      workflow_id: id,
      workflow_nom: workflow.nom,
      triggers_matched: [],
      actions_to_execute: [],
      simulation: true
    };

    // Vérifier les triggers
    for (const trigger of triggers) {
      const config = trigger.config ? JSON.parse(trigger.config) : null;
      const conditions = trigger.conditions ? JSON.parse(trigger.conditions) : null;
      result.triggers_matched.push({
        type: trigger.type,
        config,
        conditions,
        would_match: true // Simplifié pour le test
      });
    }

    // Lister les actions
    for (const action of actions) {
      const config = action.config ? JSON.parse(action.config) : null;
      result.actions_to_execute.push({
        ordre: action.ordre,
        type: action.type,
        config,
        delay_seconds: action.delay_seconds
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur lors du test du workflow:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Récupérer l'historique d'exécution
router.get('/:id/executions', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const executions = await query(`
      SELECT 
        e.*,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        u.pseudo as user_pseudo
      FROM workflow_executions e
      LEFT JOIN fiches f ON e.id_fiche = f.id
      LEFT JOIN utilisateurs u ON e.id_user = u.id
      WHERE e.id_workflow = ?
      ORDER BY e.started_at DESC
      LIMIT ? OFFSET ?
    `, [id, parseInt(limit), parseInt(offset)]);

    const total = await queryOne(
      'SELECT COUNT(*) as count FROM workflow_executions WHERE id_workflow = ?',
      [id]
    );

    res.json({
      success: true,
      data: executions.map(e => ({
        ...e,
        trigger_data: e.trigger_data ? JSON.parse(e.trigger_data) : null
      })),
      pagination: {
        total: total.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;

