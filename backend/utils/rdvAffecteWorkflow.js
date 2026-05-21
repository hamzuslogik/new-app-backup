const { queryOne } = require('../config/database');
const { executeWorkflow } = require('../services/workflow/workflow-executor');

function normCommercialId(value) {
  if (value == null || value === '' || value === undefined) return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function hasDateRdv(dateRdv) {
  if (dateRdv == null || dateRdv === '' || dateRdv === '0000-00-00 00:00:00') return false;
  return true;
}

async function loadCommercialPseudo(id) {
  if (!id) return null;
  const u = await queryOne('SELECT id, pseudo, nom, prenom FROM utilisateurs WHERE id = ?', [id]);
  if (!u) return null;
  const parts = [u.prenom, u.nom].map((x) => (x != null ? String(x).trim() : '')).filter(Boolean);
  return (u.pseudo && String(u.pseudo).trim()) || parts.join(' ') || String(id);
}

async function loadFicheEnriched(ficheId) {
  return queryOne(
    `SELECT f.*,
      u1.pseudo AS commercial_pseudo,
      u2.pseudo AS commercial_2_pseudo
     FROM fiches f
     LEFT JOIN utilisateurs u1 ON f.id_commercial = u1.id
     LEFT JOIN utilisateurs u2 ON f.id_commercial_2 = u2.id
     WHERE f.id = ?`,
    [ficheId]
  );
}

function slotField(slot) {
  return slot === 'secondaire' ? 'id_commercial_2' : 'id_commercial';
}

/**
 * Affectation ou désaffectation commercial sur une fiche avec date RDV.
 */
async function fireRdvCommercialChange({ ficheId, oldFiche, newFiche, user, slot = 'principal', source = 'unknown' }) {
  const field = slotField(slot);
  const oldId = normCommercialId(oldFiche?.[field]);
  const newId = normCommercialId(newFiche?.[field]);

  if (oldId === newId) return;

  const dateRdv = newFiche?.date_rdv_time ?? oldFiche?.date_rdv_time;
  if (!hasDateRdv(dateRdv)) return;

  const fiche = await loadFicheEnriched(ficheId);
  if (!fiche) return;

  const oldPseudo = oldId ? await loadCommercialPseudo(oldId) : null;
  const newPseudo = newId ? await loadCommercialPseudo(newId) : null;

  const basePayload = {
    fiche,
    user,
    commercial_slot: slot,
    affectation_source: source,
    old_id_commercial: oldId,
    new_id_commercial: newId,
    old_commercial_pseudo: oldPseudo,
    new_commercial_pseudo: newPseudo,
    date_rdv_time: fiche.date_rdv_time,
  };

  if (oldId && !newId) {
    await executeWorkflow('rdv_desaffecte', basePayload).catch((err) => {
      console.error('[WORKFLOW] Erreur rdv_desaffecte:', err);
    });
    return;
  }

  if (newId) {
    await executeWorkflow('rdv_affecte', basePayload).catch((err) => {
      console.error('[WORKFLOW] Erreur rdv_affecte:', err);
    });
  }
}

/** @deprecated alias — utilise fireRdvCommercialChange */
async function fireRdvAffecte(params) {
  return fireRdvCommercialChange(params);
}

/**
 * Compare ancienne / nouvelle fiche (PUT, patch champ, etc.) — affectation et désaffectation.
 */
async function triggerRdvCommercialFromFicheChange(oldFiche, newFiche, user, source = 'fiche_update') {
  if (!oldFiche && !newFiche) return;
  const ficheId = newFiche?.id ?? oldFiche?.id;
  if (!ficheId) return;

  let newRow = newFiche;
  if (!newRow || newRow.id_commercial === undefined) {
    newRow = await loadFicheEnriched(ficheId);
  }
  if (!newRow) return;

  const old = oldFiche || {};
  await fireRdvCommercialChange({ ficheId, oldFiche: old, newFiche: newRow, user, slot: 'principal', source });
  await fireRdvCommercialChange({ ficheId, oldFiche: old, newFiche: newRow, user, slot: 'secondaire', source });
}

/** Alias rétrocompat */
async function triggerRdvAffecteFromFicheChange(oldFiche, newFiche, user, source = 'fiche_update') {
  return triggerRdvCommercialFromFicheChange(oldFiche, newFiche, user, source);
}

/** Après POST /affectations/affecter */
async function triggerRdvAffecteAfterAffectation(ficheId, ancienCommercial, newCommercialId, user) {
  const fiche = await loadFicheEnriched(ficheId);
  if (!fiche) return;
  const oldFiche = { ...fiche, id_commercial: ancienCommercial || 0 };
  const newFiche = { ...fiche, id_commercial: newCommercialId };
  await fireRdvCommercialChange({ ficheId, oldFiche, newFiche, user, slot: 'principal', source: 'affectation' });
}

/** Après POST /affectations/desaffecter */
async function triggerRdvDesaffecteAfterDesaffectation(ficheId, ancienCommercial, ancienCommercial2, user) {
  const fiche = await loadFicheEnriched(ficheId);
  if (!fiche) return;

  const oldFiche = {
    ...fiche,
    id_commercial: ancienCommercial || 0,
    id_commercial_2: ancienCommercial2 ?? null,
  };
  const newFiche = { ...fiche, id_commercial: 0, id_commercial_2: null };

  if (normCommercialId(ancienCommercial)) {
    await fireRdvCommercialChange({ ficheId, oldFiche, newFiche, user, slot: 'principal', source: 'affectation' });
  }
  if (normCommercialId(ancienCommercial2)) {
    await fireRdvCommercialChange({ ficheId, oldFiche, newFiche, user, slot: 'secondaire', source: 'affectation' });
  }
}

module.exports = {
  triggerRdvCommercialFromFicheChange,
  triggerRdvAffecteFromFicheChange,
  triggerRdvAffecteAfterAffectation,
  triggerRdvDesaffecteAfterDesaffectation,
};
