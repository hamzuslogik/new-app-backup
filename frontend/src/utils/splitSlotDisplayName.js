/**
 * Sépare le libellé court du créneau (ex. « 9H ») du texte entre parenthèses
 * pour affichage sur deux lignes (détail plus petit).
 */
export function splitSlotDisplayName(name) {
  if (!name || typeof name !== 'string') {
    return { main: String(name ?? ''), sub: null };
  }
  const open = name.indexOf('(');
  if (open === -1) {
    return { main: name.trim(), sub: null };
  }
  const main = name.slice(0, open).trim();
  const sub = name.slice(open).trim();
  return { main, sub: sub || null };
}
