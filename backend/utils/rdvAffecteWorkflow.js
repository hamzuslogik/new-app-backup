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

/**
 * Déclenche rdv_affecte si un commercial est affecté (nouveau ou changé) et que la fiche a une date RDV.
 */
async function fireRdvAffecte({ ficheId, oldFiche, newFiche, user, slot = 'principal', source = 'unknown' }) {
  const field = slot === 'secondaire' ? 'id_commercial_2' : 'id_commercial';
  const oldId = normCommercialId(oldFiche?.[field]);
  const newId = normCommercialId(newFiche?.[field]);

  if (!newId || newId === oldId) return;

  const dateRdv = newFiche?.date_rdv_time ?? oldFiche?.date_rdv_time;
  if (!hasDateRdv(dateRdv)) return;

  const fiche = await loadFicheEnriched(ficheId);
  if (!fiche) return;

  const oldPseudo = oldId ? await loadCommercialPseudo(oldId) : null;
  const newPseudo = await loadCommercialPseudo(newId);

  await executeWorkflow('rdv_affecte', {
    fiche,
    user,
    commercial_slot: slot,
    affectation_source: source,
    old_id_commercial: oldId,
    new_id_commercial: newId,
    old_commercial_pseudo: oldPseudo,
    new_commercial_pseudo: newPseudo,
    date_rdv_time: fiche.date_rdv_time,
  }).catch((err) => {
    console.error('[WORKFLOW] Erreur rdv_affecte:', err);
  });
}

/**
 * Compare ancienne / nouvelle fiche (PUT, patch champ, etc.).
 */
async function triggerRdvAffecteFromFicheChange(oldFiche, newFiche, user, source = 'fiche_update') {
  if (!oldFiche && !newFiche) return;
  const ficheId = newFiche?.id ?? oldFiche?.id;
  if (!ficheId) return;

  let newRow = newFiche;
  if (!newRow || newRow.id_commercial === undefined) {
    newRow = await loadFicheEnriched(ficheId);
  }
  if (!newRow) return;

  await fireRdvAffecte({ ficheId, oldFiche: oldFiche || {}, newFiche: newRow, user, slot: 'principal', source });
  await fireRdvAffecte({ ficheId, oldFiche: oldFiche || {}, newFiche: newRow, user, slot: 'secondaire', source });
}

/** Après POST /affectations/affecter */
async function triggerRdvAffecteAfterAffectation(ficheId, ancienCommercial, newCommercialId, user) {
  const fiche = await loadFicheEnriched(ficheId);
  if (!fiche) return;
  const oldFiche = { ...fiche, id_commercial: ancienCommercial || 0 };
  const newFiche = { ...fiche, id_commercial: newCommercialId };
  await fireRdvAffecte({ ficheId, oldFiche, newFiche, user, slot: 'principal', source: 'affectation' });
}

module.exports = {
  triggerRdvAffecteFromFicheChange,
  triggerRdvAffecteAfterAffectation,
};
