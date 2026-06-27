/**
 * Construit une URL d'exemple pour le modal détail fiche (documentation paramètres).
 * @param {string} origin - ex. https://crm.example.com
 * @param {string} identifiant - hash ou téléphone
 * @param {'page'|'overlay_auto'|'overlay_locked'} mode
 */
export function buildFicheModalExampleUrl(origin, identifiant, mode) {
  const base = String(origin || '').replace(/\/$/, '');
  const id = encodeURIComponent(String(identifiant || '{identifiant}'));
  const path = `${base}/fiches/${id}`;
  if (mode === 'page') return path;
  if (mode === 'overlay_locked') return `${path}?overlay=1&close=0`;
  return `${path}?overlay=auto`;
}

export function ficheModalQueryForMode(mode) {
  if (mode === 'overlay_locked') return 'overlay=1&close=0';
  if (mode === 'overlay_auto') return 'overlay=auto';
  return '';
}
