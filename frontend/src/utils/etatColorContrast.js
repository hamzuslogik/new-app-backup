export function normalizeHex(hex) {
  const raw = String(hex || '#cccccc').trim();
  if (!raw.startsWith('#')) return `#${raw}`;
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return raw;
}

/** Texte noir sur fond clair, blanc sur fond sombre. */
export function getEtatContrastColor(bgHex) {
  const hex = normalizeHex(bgHex).replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#ffffff';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#000000' : '#ffffff';
}

/** className pour ligne tableau colorée par état (texte clair/sombre). */
export function getFicheRowByEtatClassName(bgHex, extraClass = '') {
  const fg = getEtatContrastColor(bgHex);
  const tone = fg === '#ffffff' ? 'fiche-row-by-etat--dark' : 'fiche-row-by-etat--light';
  return ['fiche-row-by-etat', tone, extraClass].filter(Boolean).join(' ');
}

export function getEtatStatCellStyle(etat) {
  return getEtatStatCellProps(etat).style;
}

/** className + style pour cellules stats (surcharge theme-improvements color !important) */
export function getEtatStatCellProps(etat) {
  const bg = etat?.color || '#cccccc';
  const fg = getEtatContrastColor(bg);
  const tone = fg === '#ffffff' ? 'dark' : 'light';
  return {
    className: `stats-etat-cell stats-etat-cell--${tone}`,
    style: {
      '--stats-etat-bg': bg,
      backgroundColor: bg,
      color: fg,
      fontWeight: 800,
    },
  };
}
