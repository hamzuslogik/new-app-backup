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
const ETATS_REFUSER = new Set([12, 25]);

/**
 * Normalise is_r2 → 0 | 1 | null
 * Accepte : 0/1, '0'/'1', true/false, 'OUI'/'NON', Buffer mysql
 */
function normalizeIsR2Field(v) {
  if (v == null || v === '') return null;
  if (Buffer.isBuffer(v)) {
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

function titreIsRefuser(titre) {
  return normalizeTitre(titre).includes('REFUSER');
}

function isHonoreId(id, etatsMap) {
  if (Number(id) === ETAT_HONORE) return true;
  if (etatsMap && titreIsHonore(etatsMap[id])) return true;
  return false;
}

function isRefuserId(id, etatsMap) {
  if (ETATS_REFUSER.has(Number(id))) return true;
  if (etatsMap && titreIsRefuser(etatsMap[id])) return true;
  return false;
}

/**
 * R2 histo : au moins 2 CONFIRMER, un HONORÉ À SUIVRE entre les deux derniers,
 * et aucun REFUSER entre cet honoré et le dernier CONFIRMER.
 * SIGNER est ignoré.
 */
function isR2FromHistoIds(ids, etatsMap = null) {
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

  let lastHonoreInBetween = -1;
  between.forEach((id, i) => {
    if (isHonoreId(id, etatsMap)) lastHonoreInBetween = i;
  });
  if (lastHonoreInBetween < 0) return false;

  const afterHonore = between.slice(lastHonoreInBetween + 1);
  return !afterHonore.some((id) => isRefuserId(id, etatsMap));
}

function ficheHasR2Placed(obj, etatsMap = null) {
  if (!obj) return false;

  // Nouvelles fiches : champ is_r2 prioritaire (si mentionné)
  const isR2Field = normalizeIsR2Field(obj.is_r2);
  if (isR2Field !== null) return isR2Field === 1;

  // Anciennes fiches : commercial 2 + enchaînement CONFIRMER → HAS → CONFIRMER
  if (!(obj.id_commercial_2 != null && Number(obj.id_commercial_2) > 0)) return false;

  const ids = parseHistoEtatIds(obj.id_etat_histo);
  if (!ids.length) return false;

  return isR2FromHistoIds(ids, etatsMap);
}

module.exports = {
  ficheHasR2Placed,
  parseHistoEtatIds,
  normalizeIsR2Field,
};
