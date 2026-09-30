/**
 * Badge / étoile « R2 placé » dans le planning :
 * - si is_r2 est renseigné (nouvelles fiches) → OUI / NON selon ce champ
 * - sinon (anciennes fiches) → commercial 2 + historique :
 *   CONFIRMER → HONORÉ À SUIVRE → … → CONFIRMER
 *   sans REFUSER entre l’honoré à suivre et le CONFIRMER suivant.
 *   SIGNER n’intervient pas (ex. SIGNER → CONFIRMER → HAS → CONFIRMER = R2).
 */

const ETAT_CONFIRMER = 7;
const ETAT_HONORE = 9;
const ETATS_REFUSER = [12, 25];

/**
 * Normalise is_r2 → 0 | 1 | null
 * Accepte : 0/1, '0'/'1', true/false, 'OUI'/'NON', Buffer mysql
 */
export function normalizeIsR2Field(v) {
  if (v == null || v === '') return null;
  // mysql TINYINT parfois en Buffer
  if (typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(v)) {
    v = v.length ? v[0] : null;
    if (v == null) return null;
  }
  if (typeof v === 'object' && v !== null && Array.isArray(v.data) && v.type === 'Buffer') {
    v = v.data.length ? v.data[0] : null;
    if (v == null) return null;
  }
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  const s = String(v).trim().toUpperCase();
  if (s === 'OUI' || s === '1' || s === 'TRUE' || s === 'YES') return 1;
  if (s === 'NON' || s === '0' || s === 'FALSE' || s === 'NO') return 0;
  const n = Number(v);
  if (n === 1) return 1;
  if (n === 0) return 0;
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

function isRefuserId(id) {
  return ETATS_REFUSER.includes(Number(id));
}

/**
 * R2 histo : au moins 2 CONFIRMER, un HONORÉ À SUIVRE entre les deux derniers,
 * et aucun REFUSER entre cet honoré et le dernier CONFIRMER.
 * SIGNER est ignoré.
 */
function isR2FromHistoIds(histoIds) {
  const ids = parseHistoEtatIds(histoIds);
  if (!ids.length) return false;

  const confirmIdxs = [];
  ids.forEach((id, i) => {
    if (id === ETAT_CONFIRMER) confirmIdxs.push(i);
  });
  if (confirmIdxs.length < 2) return false;

  const prevConfirmIdx = confirmIdxs[confirmIdxs.length - 2];
  const lastConfirmIdx = confirmIdxs[confirmIdxs.length - 1];
  const between = ids.slice(prevConfirmIdx + 1, lastConfirmIdx);
  if (!between.length) return false;

  // Dernier HONORÉ À SUIVRE dans la fenêtre entre les 2 CONFIRMER
  let lastHonoreInBetween = -1;
  between.forEach((id, i) => {
    if (id === ETAT_HONORE) lastHonoreInBetween = i;
  });
  if (lastHonoreInBetween < 0) return false;

  // Entre HONORÉ et le CONFIRMER suivant : pas de REFUSER (SIGNER OK)
  const afterHonore = between.slice(lastHonoreInBetween + 1);
  return !afterHonore.some((id) => isRefuserId(id));
}

export function ficheHasR2Placed(obj) {
  if (!obj) return false;

  // Nouvelles fiches : champ is_r2 prioritaire (si mentionné)
  const isR2Field = normalizeIsR2Field(obj.is_r2);
  if (isR2Field !== null) return isR2Field === 1;

  // Anciennes fiches : commercial 2 + enchaînement CONFIRMER → HAS → CONFIRMER
  if (!(obj.id_commercial_2 != null && Number(obj.id_commercial_2) > 0)) return false;

  const histo = obj.id_etat_histo || obj.historique;
  if (histo) return isR2FromHistoIds(histo);

  if (Array.isArray(obj.etats_list) && obj.etats_list.includes('R2')) return true;
  if (typeof obj.etat_check === 'string' && obj.etat_check.split(',').map((s) => s.trim()).includes('R2')) {
    return true;
  }
  return false;
}
