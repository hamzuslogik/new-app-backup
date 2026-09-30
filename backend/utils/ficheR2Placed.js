/**
 * Badge / étoile « R2 placé » dans le planning :
 * - si is_r2 est renseigné (nouvelles fiches) → OUI / NON selon ce champ
 * - sinon (anciennes fiches) → historique : honoré à suivre entre RDV,
 *   sans SIGNER / REFUSER, avec commercial 2
 */

const ETAT_CONFIRMER = 7;
const ETAT_HONORE = 9;
const ETATS_SIGNER = new Set([13, 16, 38, 44, 45]);
const ETATS_REFUSER = new Set([12, 25]);

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

function normalizeTitre(titre) {
  return String(titre || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function titreIsHonore(titre) {
  const t = normalizeTitre(titre);
  return t.includes('HONORE') && t.includes('SUIVRE');
}

function titreBlocksR2(titre) {
  const t = normalizeTitre(titre);
  if (!t) return false;
  return t.includes('REFUSER') || t.includes('SIGNER');
}

function ficheHasR2Placed(obj, etatsMap = null) {
  if (!obj) return false;

  // Nouvelles fiches : champ is_r2 prioritaire
  const isR2Field = normalizeIsR2Field(obj.is_r2);
  if (isR2Field !== null) return isR2Field === 1;

  // Anciennes fiches : logique historique (commercial 2 + honoré à suivre)
  if (!(obj.id_commercial_2 != null && Number(obj.id_commercial_2) > 0)) return false;

  const ids = parseHistoEtatIds(obj.id_etat_histo);
  if (!ids.length) return false;

  const windowIds = etatsBetweenLastAndNewRdv(ids);
  if (!windowIds.length) return false;

  let hasHonore = windowIds.some((id) => id === ETAT_HONORE);
  let hasBlocker = windowIds.some((id) => ETATS_SIGNER.has(id) || ETATS_REFUSER.has(id));

  if (etatsMap) {
    windowIds.forEach((id) => {
      const titre = etatsMap[id];
      if (titreIsHonore(titre)) hasHonore = true;
      if (titreBlocksR2(titre)) hasBlocker = true;
    });
  }

  return hasHonore && !hasBlocker;
}

module.exports = {
  ficheHasR2Placed,
  parseHistoEtatIds
};
