/**
 * Badge / étoile « R2 placé » dans le planning :
 * - is_r2 = 1 (OUI) → nouveau RDV marqué R2 → R2 direct
 * - is_r2 = 0 / NULL → on vérifie l’historique :
 *   HAS puis plus tard CONFIRMER, sans REFUSER entre les deux
 *   (autres états entre HAS et CONFIRMER autorisés ; SIGNER OK).
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

export function parseHistoEtatIds(histo) {
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
  if (ETATS_REFUSER.includes(Number(id))) return true;
  if (etatsMap && titreIsRefuser(etatsMap[id])) return true;
  return false;
}

/**
 * R2 histo : il existe un HAS suivi plus loin d’un CONFIRMER
 * sans aucun REFUSER entre les deux (autres états OK).
 */
function isR2FromHistoIds(histoIds, etatsMap = null) {
  const ids = parseHistoEtatIds(histoIds);
  if (!ids.length) return false;

  for (let i = 0; i < ids.length; i++) {
    if (!isHonoreId(ids[i], etatsMap)) continue;
    for (let j = i + 1; j < ids.length; j++) {
      if (isRefuserId(ids[j], etatsMap)) break;
      if (Number(ids[j]) === ETAT_CONFIRMER) return true;
    }
  }
  return false;
}

export function ficheHasR2Placed(obj, etatsMap = null) {
  if (!obj) return false;

  // is_r2 = 1 → nouveau RDV créé en R2 → direct
  const isR2Field = normalizeIsR2Field(obj.is_r2);
  if (isR2Field === 1) return true;

  // is_r2 = 0 ou NULL → vérifier l’historique (HAS → CONFIRMER sans REFUSER)
  const histo = obj.id_etat_histo || obj.historique;
  if (histo && isR2FromHistoIds(histo, etatsMap)) return true;

  if (Array.isArray(obj.etats_list) && obj.etats_list.includes('R2')) return true;
  if (typeof obj.etat_check === 'string' && obj.etat_check.split(',').map((s) => s.trim()).includes('R2')) {
    return true;
  }
  return false;
}
