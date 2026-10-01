import { toPng } from 'html-to-image';

function nextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function forceVisibleTree(root) {
  if (!(root instanceof Element)) return;
  root.style.setProperty('animation', 'none', 'important');
  root.style.setProperty('transition', 'none', 'important');
  root.style.setProperty('opacity', '1', 'important');
  root.style.setProperty('transform', 'none', 'important');
  root.style.setProperty('visibility', 'visible', 'important');
  root.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.setProperty('animation', 'none', 'important');
    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
  });
}

/**
 * Capture la ligne de tableau fiche entière (toutes colonnes) en PNG.
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
  host.className = 'fiche-row-capture-host';
  host.setAttribute('aria-hidden', 'true');
  // Dans le viewport (pas left:-99999) : html-to-image rate sinon le rendu
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:2147483000',
    'pointer-events:none',
    'background:#ffffff',
    'padding:12px',
    'box-sizing:border-box',
    'max-width:none',
    'overflow:visible',
  ].join(';');

  const styleReset = document.createElement('style');
  styleReset.textContent = `
    .fiche-row-capture-host table,
    .fiche-row-capture-host thead,
    .fiche-row-capture-host tbody,
    .fiche-row-capture-host tr,
    .fiche-row-capture-host th,
    .fiche-row-capture-host td,
    .fiche-row-capture-host td * {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .fiche-row-capture-host table {
      display: table !important;
      width: max-content !important;
      max-width: none !important;
      border-collapse: collapse !important;
      background: #fff !important;
      transform: none !important;
    }
    .fiche-row-capture-host thead { display: table-header-group !important; }
    .fiche-row-capture-host tbody { display: table-row-group !important; }
    .fiche-row-capture-host tr { display: table-row !important; transform: none !important; }
    .fiche-row-capture-host th,
    .fiche-row-capture-host td {
      display: table-cell !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      transform: none !important;
    }
  `;
  host.appendChild(styleReset);

  // Hors écran mais toujours « layouté » (évite le flash + bug capture)
  host.style.transform = 'translate(-12000px, 0)';

  const cloneTable = sourceTable.cloneNode(false);
  cloneTable.className = sourceTable.className || 'fiches-table';

  if (sourceTable.tHead) {
    cloneTable.appendChild(sourceTable.tHead.cloneNode(true));
  }

  const tbody = document.createElement('tbody');
  const clonedTr = tr.cloneNode(true);
  // Copier le fond inline (couleur état) au cas où
  const bg = tr.style.backgroundColor || window.getComputedStyle(tr).backgroundColor;
  if (bg) {
    clonedTr.style.backgroundColor = bg;
    clonedTr.querySelectorAll('td').forEach((td) => {
      if (!td.style.backgroundColor) td.style.backgroundColor = bg;
    });
  }
  tbody.appendChild(clonedTr);
  cloneTable.appendChild(tbody);
  host.appendChild(cloneTable);
  document.body.appendChild(host);

  forceVisibleTree(cloneTable);

  const fullWidth = Math.max(
    tr.scrollWidth || 0,
    sourceTable.scrollWidth || 0,
    Array.from(tr.cells).reduce((sum, cell) => sum + (cell.offsetWidth || 0), 0),
    600
  );
  cloneTable.style.width = `${fullWidth}px`;
  cloneTable.style.minWidth = `${fullWidth}px`;

  await nextFrame();

  // Si la ligne a encore une hauteur nulle, forcer une hauteur mini
  if ((clonedTr.offsetHeight || 0) < 2) {
    clonedTr.style.height = '40px';
    Array.from(clonedTr.cells).forEach((td) => {
      td.style.minHeight = '32px';
      td.style.padding = '6px 8px';
    });
    await nextFrame();
  }

  try {
    const dataUrl = await toPng(cloneTable, {
      cacheBust: true,
      pixelRatio: Math.min(2, window.devicePixelRatio || 2),
      backgroundColor: '#ffffff',
      // ignorer les nœuds encore à opacity 0 (filet de sécurité)
      filter: (node) => {
        if (!(node instanceof Element)) return true;
        if (node.tagName === 'STYLE') return false;
        return true;
      },
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
