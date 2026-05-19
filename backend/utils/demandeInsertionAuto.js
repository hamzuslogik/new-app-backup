const { query, queryOne } = require('../config/database');
const { findMatchingAutorisationRule } = require('./reglesAutorisation');
const { approveInsertionFromDonnees, encodeFicheId } = require('./demandeInsertionApprove');
const { executeWorkflow } = require('../services/workflow/workflow-executor');
const {
  logReglesAutorisation,
  logReglesAutorisationError,
  snapshotFicheForLog,
} = require('./reglesAutorisationLogger');

/**
 * Doublon téléphone : consulte regles_autorisation puis accepte directement ou crée EN_ATTENTE.
 */
async function handleDuplicateFicheWithAutorisation({
  existingFiche,
  ficheData,
  req,
}) {
  const agentId = ficheData.id_agent || req.user.id;
  const newIdCentre =
    ficheData.id_centre != null && ficheData.id_centre !== ''
      ? Number(ficheData.id_centre)
      : req.user.centre != null
        ? Number(req.user.centre)
        : null;

  logReglesAutorisation('Doublon detecte — debut traitement', {
    source: 'POST /fiches',
    user_id: req.user?.id,
    user_pseudo: req.user?.pseudo,
    agent_id: agentId,
    tel_nouveau: ficheData.tel,
    fiche_existante: snapshotFicheForLog(existingFiche),
    id_centre_nouveau: Number.isFinite(newIdCentre) ? newIdCentre : null,
  });

  const matchedRule = await findMatchingAutorisationRule(existingFiche, {
    newIdCentre: Number.isFinite(newIdCentre) ? newIdCentre : null,
  });

  if (matchedRule) {
    logReglesAutorisation('AUTO-APPROBATION — regle appliquee', {
      regle_id: matchedRule.id,
      regle_libelle: matchedRule.libelle,
      id_fiche_existante: existingFiche.id,
    });

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const commentaireAuto = `Acceptation automatique — règle #${matchedRule.id} : ${matchedRule.libelle}`;

    const { insertId, hash, donneesFiche: donneesApres } = await approveInsertionFromDonnees({
      donneesFiche: ficheData,
      existingFicheId: existingFiche.id,
      id_agent: agentId,
      id_centre_fallback: req.user.centre || null,
      histoConfirmateurId: req.user.id,
      now,
    });

    logReglesAutorisation('AUTO-APPROBATION — nouvelle fiche inseree', {
      id_nouvelle_fiche: insertId,
      hash,
      id_fiche_archivee: existingFiche.id,
    });

    const demandeResult = await query(
      `INSERT INTO demandes_insertion 
       (id_agent, id_fiche_existante, donnees_fiche, date_demande, statut, date_traitement, id_traitant, commentaire)
       VALUES (?, ?, ?, ?, 'APPROUVEE', ?, NULL, ?)`,
      [agentId, existingFiche.id, JSON.stringify(ficheData), now, now, commentaireAuto]
    );

    logReglesAutorisation('AUTO-APPROBATION — demande tracee APPROUVEE', {
      demande_id: demandeResult.insertId,
    });

    executeWorkflow('demande_insertion_approved', {
      user: req.user,
      fiche: {
        id: insertId,
        hash,
        nom: donneesApres.nom || null,
        prenom: donneesApres.prenom || null,
        tel: donneesApres.tel || null,
        id_agent: donneesApres.id_agent || agentId,
        id_centre: donneesApres.id_centre || null,
        id_etat_final: donneesApres.id_etat_final || null,
      },
      demande_insertion: {
        id: demandeResult.insertId,
        id_fiche_existante: existingFiche.id,
        id_nouvelle_fiche: insertId,
        hash_nouvelle_fiche: hash,
        id_agent: agentId,
        commentaire: commentaireAuto,
        auto_regle_id: matchedRule.id,
        auto_regle_libelle: matchedRule.libelle,
        date_traitement: now,
      },
    }).catch((wfError) => {
      logReglesAutorisationError('Workflow demande_insertion_approved (auto)', wfError);
    });

    return {
      action: 'auto_approved',
      statusCode: 201,
      body: {
        success: true,
        message: `Fiche acceptée automatiquement (${matchedRule.libelle}).`,
        data: {
          id: insertId,
          hash,
          autoApproved: true,
          regleId: matchedRule.id,
          regleLibelle: matchedRule.libelle,
          existingFicheId: existingFiche.id,
          demandeId: demandeResult.insertId,
        },
      },
    };
  }

  logReglesAutorisation('EN_ATTENTE — aucune regle applicable, creation demande', {
    id_fiche_existante: existingFiche.id,
    agent_id: agentId,
  });

  const agentInfo = await queryOne(`SELECT pseudo FROM utilisateurs WHERE id = ?`, [agentId]);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const demandeResult = await query(
    `INSERT INTO demandes_insertion 
     (id_agent, id_fiche_existante, donnees_fiche, date_demande, statut)
     VALUES (?, ?, ?, ?, 'EN_ATTENTE')`,
    [agentId, existingFiche.id, JSON.stringify(ficheData), now]
  );

  logReglesAutorisation('EN_ATTENTE — demande creee', {
    demande_id: demandeResult.insertId,
    id_fiche_existante: existingFiche.id,
  });

  const ficheExistanteInfo = await queryOne(
    `SELECT nom, prenom, tel, hash FROM fiches WHERE id = ?`,
    [existingFiche.id]
  );

  executeWorkflow('demande_insertion_created', {
    user: req.user,
    fiche: {
      id: existingFiche.id,
      hash: ficheExistanteInfo?.hash || encodeFicheId(existingFiche.id),
      nom: ficheExistanteInfo?.nom || null,
      prenom: ficheExistanteInfo?.prenom || null,
      tel: ficheExistanteInfo?.tel || null,
    },
    demande_insertion: {
      id: demandeResult.insertId,
      id_fiche_existante: existingFiche.id,
      id_agent: agentId,
      agent_pseudo: agentInfo?.pseudo || null,
      donnees_fiche: ficheData,
      date_demande: now,
    },
  }).catch((wfError) => {
    logReglesAutorisationError('Workflow demande_insertion_created', wfError);
  });

  return {
    action: 'demande_created',
    statusCode: 200,
    body: {
      success: true,
      message:
        'Une fiche existe déjà avec ce numéro de téléphone. Une demande d\'insertion a été créée.',
      data: {
        demandeId: demandeResult.insertId,
        existingFicheId: existingFiche.id,
        demandeCreated: true,
      },
    },
  };
}

module.exports = { handleDuplicateFicheWithAutorisation };
