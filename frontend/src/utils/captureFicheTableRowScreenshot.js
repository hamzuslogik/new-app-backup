import { toPng } from 'html-to-image';

/**
 * Capture la ligne de tableau fiche entière (toutes colonnes) en PNG téléchargeable.
 * Inclut l’en-tête pour identifier les colonnes.
 */
export async function captureFicheTableRowScreenshot(hash, options = {}) {
  if (!hash || typeof document === 'undefined') {
    throw new Error('Hash fiche manquant');
  }

  const safeHash = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(hash)) : String(hash);
  const tr = document.querySelector(`tr[data-fiche-hash="${safeHash}"]`);
  if (!(tr instanceof HTMLTableRowElement)) {
    throw new Error('Ligne introuvable dans le tableau');
  }

  const sourceTable = tr.closest('table');
  if (!(sourceTable instanceof HTMLTableElement)) {
    throw new Error('Tableau introuvable');
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    'z-index:-1',
    'pointer-events:none',
    'opacity:1',
    'background:#ffffff',
    'padding:8px',
  ].join(';');

  // Conserver les classes page pour les styles CSS (état, etc.)
  const pageShell = document.createElement('div');
  if (document.body?.className) pageShell.className = document.body.className;
  const dash = document.querySelector('.dashboard');
  if (dash?.className) {
    const inner = document.createElement('div');
    inner.className = dash.className;
    pageShell.appendChild(inner);
    host.appendChild(pageShell);
  } else {
    host.appendChild(pageShell);
  }

  const mountParent = pageShell.querySelector('.dashboard') || pageShell;

  const cloneTable = sourceTable.cloneNode(false);
  cloneTable.className = sourceTable.className;
  cloneTable.style.width = 'max-content';
  cloneTable.style.maxWidth = 'none';
  cloneTable.style.minWidth = '0';
  cloneTable.style.borderCollapse =
    window.getComputedStyle(sourceTable).borderCollapse || 'collapse';

  const colgroup = sourceTable.querySelector('colgroup');
  if (colgroup) cloneTable.appendChild(colgroup.cloneNode(true));

  if (sourceTable.tHead) {
    cloneTable.appendChild(sourceTable.tHead.cloneNode(true));
  }

  const tbody = document.createElement('tbody');
  const clonedTr = tr.cloneNode(true);
  tbody.appendChild(clonedTr);
  cloneTable.appendChild(tbody);
  mountParent.appendChild(cloneTable);
  document.body.appendChild(host);

  // Largeur = ligne complète (y compris hors viewport)
  const fullWidth = Math.max(
    tr.scrollWidth || 0,
    sourceTable.scrollWidth || 0,
    clonedTr.scrollWidth || 0,
    800
  );
  cloneTable.style.width = `${fullWidth}px`;
  cloneTable.style.minWidth = `${fullWidth}px`;

  try {
    const dataUrl = await toPng(cloneTable, {
      cacheBust: true,
      pixelRatio: Math.min(2, window.devicePixelRatio || 2),
      backgroundColor: '#ffffff',
      skipFonts: false,
    });

    const fiche = options.fiche || {};
    const label = [fiche.nom, fiche.prenom].filter(Boolean).join('_') || String(hash).slice(0, 12);
    const safeName = String(label)
      .replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 60);
    const fileName = options.fileName || `fiche_${safeName}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    return dataUrl;
  } finally {
    host.remove();
  }
}
