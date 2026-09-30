/**
 * Badge / étoile « R2 placé » dans le planning :
 * - si is_r2 est renseigné (nouvelles fiches) → OUI / NON selon ce champ
 * - sinon (anciennes fiches) → historique : honoré à suivre entre RDV,
 *   sans SIGNER / REFUSER, avec commercial 2
 */

const ETAT_CONFIRMER = 7;
const ETAT_HONORE = 9;
const ETATS_SIGNER = [13, 16, 38, 44, 45];
const ETATS_REFUSER = [12, 25];

/** @returns {0|1|null} */
function normalizeIsR2Field(v) {
  if (v === 1 || v === '1' || v === true) return 1;
  if (v === 0 || v === '0' || v === false) return 0;
  return null;
}

function parseHistoEtatIds(histo) {
  if (!histo) return [];
  if (Array.isArray(histo)) {
    return histo
      .map((item) => Number(item?.id_etat != null ? item.id_etat : item))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  const seenHistoRow = new Set();
  const ids = [];
  String(histo)
    .split(',')
    .forEach((part) => {
      const trimmed = String(part).trim();
      if (!trimmed) return;
      if (trimmed.includes(':')) {
        const [histoId, etatId] = trimmed.split(':');
        if (seenHistoRow.has(histoId)) return;
        seenHistoRow.add(histoId);
        const n = Number(etatId);
        if (Number.isFinite(n) && n > 0) ids.push(n);
        return;
      }
      const n = Number(trimmed);
      if (Number.isFinite(n) && n > 0) ids.push(n);
    });
  return ids;
}

function etatsBetweenLastAndNewRdv(ids) {
  const confirmIdxs = [];
  ids.forEach((id, i) => {
    if (id === ETAT_CONFIRMER) confirmIdxs.push(i);
  });
  if (confirmIdxs.length >= 2) {
    const end = confirmIdxs[confirmIdxs.length - 1];
    const start = confirmIdxs[confirmIdxs.length - 2] + 1;
    return ids.slice(start, end);
  }
  if (confirmIdxs.length === 1) {
    return ids.slice(confirmIdxs[0] + 1);
  }
  return ids.slice();
}

function isR2FromHistoIds(histoIds) {
  const ids = parseHistoEtatIds(histoIds);
  if (!ids.length) return false;
  const windowIds = etatsBetweenLastAndNewRdv(ids);
  if (!windowIds.length) return false;
  const hasHonore = windowIds.some((id) => id === ETAT_HONORE);
  if (!hasHonore) return false;
  const hasSignerOrRefuser = windowIds.some(
    (id) => ETATS_SIGNER.includes(id) || ETATS_REFUSER.includes(id)
  );
  return !hasSignerOrRefuser;
}

export function ficheHasR2Placed(obj) {
  if (!obj) return false;

  // Nouvelles fiches : champ is_r2 prioritaire
  const isR2Field = normalizeIsR2Field(obj.is_r2);
  if (isR2Field !== null) return isR2Field === 1;

  // Anciennes fiches : logique historique (commercial 2 + honoré à suivre)
  if (!(obj.id_commercial_2 != null && Number(obj.id_commercial_2) > 0)) return false;

  const histo = obj.id_etat_histo || obj.historique;
  if (histo) return isR2FromHistoIds(histo);

  if (Array.isArray(obj.etats_list) && obj.etats_list.includes('R2')) return true;
  if (typeof obj.etat_check === 'string' && obj.etat_check.split(',').map((s) => s.trim()).includes('R2')) {
    return true;
  }
  return false;
}
