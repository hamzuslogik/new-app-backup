const { query, queryOne } = require('../config/database');
const { findMatchingAutorisationRule } = require('./reglesAutorisation');
const { approveInsertionFromDonnees, encodeFicheId } = require('./demandeInsertionApprove');
const { executeWorkflow } = require('../services/workflow/workflow-executor');
const { toMysqlLocalDateTime } = require('./mysqlLocalDateTime');
const {
  logReglesAutorisation,
  logReglesAutorisationError,
  snapshotFicheForLog,
} = require('./reglesAutorisationLogger');

function buildPartenaireMeta(req) {
  if (Number(req.user?.fonction) !== 9) return null;
  const pseudo =
    req.user.pseudo ||
    `${req.user.nom || ''} ${req.user.prenom || ''}`.trim() ||
    `ID ${req.user.id}`;
  return {
    source: 'partenaire',
    id_partenaire: req.user.id,
    partenaire_pseudo: pseudo,
    partenaire_nom: req.user.nom || null,
    partenaire_prenom: req.user.prenom || null,
  };
}

/**
 * Doublon téléphone : consulte regles_autorisation puis accepte directement ou crée EN_ATTENTE.
 * Partenaire (fonction 9) : toujours demande EN_ATTENTE avec origine partenaire explicite.
 */
async function handleDuplicateFicheWithAutorisation({
  existingFiche,
  ficheData,
  req,
}) {
  const isPartenaire = Number(req.user?.fonction) === 9;
  const partenaireMeta = buildPartenaireMeta(req);
  const agentId = isPartenaire
    ? req.user.id
    : ficheData.id_agent || req.user.id;
  const newIdCentre =
    ficheData.id_centre != null && ficheData.id_centre !== ''
      ? Number(ficheData.id_centre)
      : req.user.centre != null
        ? Number(req.user.centre)
        : null;

  // Enrichir les données stockées pour tracer l'origine partenaire
  const donneesStockees = { ...ficheData };
  if (isPartenaire) {
    donneesStockees.id_agent = req.user.id;
    donneesStockees.id_insert = req.user.id;
    donneesStockees.id_etat_final = 1;
    donneesStockees._meta = partenaireMeta;
  }

  logReglesAutorisation('Doublon detecte — debut traitement', {
    source: 'POST /fiches',
    user_id: req.user?.id,
    user_pseudo: req.user?.pseudo,
    is_partenaire: isPartenaire,
    agent_id: agentId,
    tel_nouveau: ficheData.tel,
    fiche_existante: snapshotFicheForLog(existingFiche),
    id_centre_nouveau: Number.isFinite(newIdCentre) ? newIdCentre : null,
  });

  // Partenaire : jamais d'auto-approbation — demande manuelle avec origine visible
  const matchedRule = isPartenaire
    ? null
    : await findMatchingAutorisationRule(existingFiche, {
        newIdCentre: Number.isFinite(newIdCentre) ? newIdCentre : null,
      });

  if (matchedRule) {
    logReglesAutorisation('AUTO-APPROBATION — regle appliquee', {
      regle_id: matchedRule.id,
      regle_libelle: matchedRule.libelle,
      id_fiche_existante: existingFiche.id,
    });

    const now = toMysqlLocalDateTime();
    const commentaireAuto = `Acceptation automatique — règle #${matchedRule.id} : ${matchedRule.libelle}`;

    const { insertId, hash, donneesFiche: donneesApres } = await approveInsertionFromDonnees({
      donneesFiche: donneesStockees,
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
      [agentId, existingFiche.id, JSON.stringify(donneesStockees), now, now, commentaireAuto]
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

  // Demande déjà en attente pour le même demandeur + même fiche existante
  const pendingSame = await queryOne(
    `SELECT id FROM demandes_insertion
     WHERE id_agent = ? AND id_fiche_existante = ? AND statut = 'EN_ATTENTE'
     ORDER BY date_demande DESC LIMIT 1`,
    [agentId, existingFiche.id]
  );
  if (pendingSame) {
    const msg = isPartenaire
      ? `Une demande d'insertion est déjà en attente pour ce numéro (partenaire : ${partenaireMeta.partenaire_pseudo}).`
      : "Une demande d'insertion est déjà en attente pour ce numéro de téléphone.";
    return {
      action: 'demande_existing',
      statusCode: 200,
      body: {
        success: true,
        message: msg,
        data: {
          demandeId: pendingSame.id,
          existingFicheId: existingFiche.id,
          demandeCreated: true,
          demandeAlreadyPending: true,
          fromPartenaire: isPartenaire,
          partenairePseudo: partenaireMeta?.partenaire_pseudo || null,
        },
      },
    };
  }

  logReglesAutorisation('EN_ATTENTE — aucune regle applicable, creation demande', {
    id_fiche_existante: existingFiche.id,
    agent_id: agentId,
    is_partenaire: isPartenaire,
  });

  const agentInfo = await queryOne(`SELECT pseudo, nom, prenom, fonction FROM utilisateurs WHERE id = ?`, [
    agentId,
  ]);
  const now = toMysqlLocalDateTime();
  const partenairePseudo =
    partenaireMeta?.partenaire_pseudo || agentInfo?.pseudo || null;

  const demandeResult = await query(
    `INSERT INTO demandes_insertion 
     (id_agent, id_fiche_existante, donnees_fiche, date_demande, statut)
     VALUES (?, ?, ?, ?, 'EN_ATTENTE')`,
    [agentId, existingFiche.id, JSON.stringify(donneesStockees), now]
  );

  logReglesAutorisation('EN_ATTENTE — demande creee', {
    demande_id: demandeResult.insertId,
    id_fiche_existante: existingFiche.id,
    is_partenaire: isPartenaire,
    partenaire_pseudo: partenairePseudo,
  });

  const ficheExistanteInfo = await queryOne(
    `SELECT nom, prenom, tel, hash FROM fiches WHERE id = ?`,
    [existingFiche.id]
  );

  const idInsert =
    Number(donneesStockees.id_insert) > 0
      ? Number(donneesStockees.id_insert)
      : Number(req.user?.id) || agentId;

  const workflowPayload = {
    user: req.user,
    fiche: {
      id: existingFiche.id,
      hash: ficheExistanteInfo?.hash || encodeFicheId(existingFiche.id),
      nom: ficheExistanteInfo?.nom || null,
      prenom: ficheExistanteInfo?.prenom || null,
      tel: ficheExistanteInfo?.tel || null,
      id_agent: agentId,
      id_insert: idInsert,
      id_centre: Number.isFinite(newIdCentre) ? newIdCentre : null,
    },
    demande_insertion: {
      id: demandeResult.insertId,
      id_fiche_existante: existingFiche.id,
      id_agent: agentId,
      id_insert: idInsert,
      agent_pseudo: agentInfo?.pseudo || null,
      from_partenaire: isPartenaire,
      partenaire_pseudo: partenairePseudo,
      donnees_fiche: donneesStockees,
      date_demande: now,
    },
  };

  executeWorkflow('demande_insertion_created', workflowPayload).catch((wfError) => {
    logReglesAutorisationError('Workflow demande_insertion_created', wfError);
  });

  // Déclencheur dédié modal d'insertion (CreateFicheModal / partenaire)
  executeWorkflow('demande_insertion_modal', workflowPayload).catch((wfError) => {
    logReglesAutorisationError('Workflow demande_insertion_modal', wfError);
  });

  const message = isPartenaire
    ? `Une fiche existe déjà avec ce numéro. Demande d'insertion créée (partenaire : ${partenairePseudo}).`
    : "Une fiche existe déjà avec ce numéro de téléphone. Une demande d'insertion a été créée.";

  return {
    action: 'demande_created',
    statusCode: 200,
    body: {
      success: true,
      message,
      data: {
        demandeId: demandeResult.insertId,
        existingFicheId: existingFiche.id,
        demandeCreated: true,
        fromPartenaire: isPartenaire,
        partenairePseudo,
      },
    },
  };
}

module.exports = { handleDuplicateFicheWithAutorisation };
