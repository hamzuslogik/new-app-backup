import { toPng } from 'html-to-image';

function nextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function copyCellBoxStyles(srcCell, dstCell) {
  if (!(srcCell instanceof HTMLElement) || !(dstCell instanceof HTMLElement)) return;
  const cs = window.getComputedStyle(srcCell);
  const h = Math.ceil(srcCell.getBoundingClientRect().height || srcCell.offsetHeight || 0);
  dstCell.style.boxSizing = 'border-box';
  dstCell.style.padding = cs.padding;
  dstCell.style.paddingTop = cs.paddingTop;
  dstCell.style.paddingBottom = cs.paddingBottom;
  dstCell.style.paddingLeft = cs.paddingLeft;
  dstCell.style.paddingRight = cs.paddingRight;
  dstCell.style.fontSize = cs.fontSize;
  dstCell.style.fontWeight = cs.fontWeight;
  dstCell.style.fontFamily = cs.fontFamily;
  dstCell.style.lineHeight = cs.lineHeight === 'normal' ? '1.25' : cs.lineHeight;
  dstCell.style.letterSpacing = cs.letterSpacing;
  dstCell.style.textAlign = cs.textAlign;
  dstCell.style.verticalAlign = 'middle';
  dstCell.style.whiteSpace = 'nowrap';
  dstCell.style.border = cs.border;
  dstCell.style.borderBottom = cs.borderBottom;
  dstCell.style.color = cs.color;
  dstCell.style.backgroundColor = cs.backgroundColor;
  if (h > 0) {
    dstCell.style.height = `${h}px`;
    dstCell.style.minHeight = `${h}px`;
  }
}

/** Recadre les bandes blanches / transparentes autour de l’image. */
function trimCanvasWhitespace(dataUrl, { padding = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const isBlank = (i) => {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 8) return true;
        // presque blanc
        return r > 248 && g > 248 && b > 248;
      };

      let top = 0;
      let bottom = height - 1;
      let left = 0;
      let right = width - 1;
      let found = false;

      outerTop: for (; top < height; top += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!isBlank((top * width + x) * 4)) {
            found = true;
            break outerTop;
          }
        }
      }
      if (!found) {
        resolve(dataUrl);
        return;
      }
      outerBottom: for (; bottom >= top; bottom -= 1) {
        for (let x = 0; x < width; x += 1) {
          if (!isBlank((bottom * width + x) * 4)) break outerBottom;
        }
      }
      outerLeft: for (; left < width; left += 1) {
        for (let y = top; y <= bottom; y += 1) {
          if (!isBlank((y * width + left) * 4)) break outerLeft;
        }
      }
      outerRight: for (; right >= left; right -= 1) {
        for (let y = top; y <= bottom; y += 1) {
          if (!isBlank((y * width + right) * 4)) break outerRight;
        }
      }

      const t = Math.max(0, top - padding);
      const b = Math.min(height - 1, bottom + padding);
      const l = Math.max(0, left - padding);
      const r = Math.min(width - 1, right + padding);
      const w = r - l + 1;
      const h = b - t + 1;
      if (w <= 0 || h <= 0 || (w === width && h === height && t === 0 && l === 0)) {
        resolve(dataUrl);
        return;
      }

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const octx = out.getContext('2d');
      if (!octx) {
        resolve(dataUrl);
        return;
      }
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, w, h);
      octx.drawImage(canvas, l, t, w, h, 0, 0, w, h);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Recadrage impossible'));
    img.src = dataUrl;
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
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:-1',
    'pointer-events:none',
    'margin:0',
    'padding:0',
    'border:0',
    'background:#ffffff',
    'overflow:visible',
  ].join(';');

  const cloneTable = document.createElement('table');
  cloneTable.className = 'fiches-table fiche-row-capture-table';
  cloneTable.style.cssText = [
    'margin:0',
    'padding:0',
    'border-collapse:collapse',
    'border-spacing:0',
    'background:#ffffff',
    'width:max-content',
    'max-width:none',
    'table-layout:auto',
  ].join(';');

  // En-tête
  if (sourceTable.tHead) {
    const thead = document.createElement('thead');
    const srcHeadRow = sourceTable.tHead.rows[0];
    if (srcHeadRow) {
      const headTr = document.createElement('tr');
      const headBg =
        window.getComputedStyle(srcHeadRow.cells[0] || srcHeadRow).backgroundColor || '#444444';
      Array.from(srcHeadRow.cells).forEach((srcTh) => {
        const th = document.createElement('th');
        th.textContent = (srcTh.textContent || '').replace(/\s+/g, ' ').trim();
        copyCellBoxStyles(srcTh, th);
        th.style.backgroundColor = window.getComputedStyle(srcTh).backgroundColor || headBg;
        th.style.color = window.getComputedStyle(srcTh).color || '#ffffff';
        th.style.fontWeight = '700';
        headTr.appendChild(th);
      });
      thead.appendChild(headTr);
    }
    cloneTable.appendChild(thead);
  }

  // Ligne données — dimensions reprises de la ligne live
  const tbody = document.createElement('tbody');
  const clonedTr = document.createElement('tr');
  const rowBg = tr.style.backgroundColor || window.getComputedStyle(tr).backgroundColor || '#ffffff';
  const rowHeight = Math.ceil(tr.getBoundingClientRect().height || tr.offsetHeight || 36);

  Array.from(tr.cells).forEach((srcTd) => {
    const td = document.createElement('td');
    // Conserver le contenu visuel (texte + badges simples)
    td.innerHTML = srcTd.innerHTML;
    copyCellBoxStyles(srcTd, td);
    td.style.backgroundColor = rowBg;
    td.style.color = window.getComputedStyle(srcTd).color || '#111111';
    // Garantir hauteur complète (évite coupe bas)
    const cellH = Math.max(
      rowHeight,
      Math.ceil(srcTd.getBoundingClientRect().height || 0),
      36
    );
    td.style.height = `${cellH}px`;
    td.style.minHeight = `${cellH}px`;
    td.style.paddingTop = '8px';
    td.style.paddingBottom = '8px';
    clonedTr.appendChild(td);
  });

  clonedTr.style.backgroundColor = rowBg;
  clonedTr.style.height = `${Math.max(rowHeight, 40)}px`;
  tbody.appendChild(clonedTr);
  cloneTable.appendChild(tbody);
  host.appendChild(cloneTable);
  document.body.appendChild(host);

  // Largeur réelle
  const fullWidth = Math.max(
    Math.ceil(tr.scrollWidth || 0),
    Math.ceil(sourceTable.scrollWidth || 0),
    Array.from(tr.cells).reduce((sum, c) => sum + Math.ceil(c.getBoundingClientRect().width || 0), 0),
    600
  );
  cloneTable.style.width = `${fullWidth}px`;
  cloneTable.style.minWidth = `${fullWidth}px`;

  // Désactiver animations / forcer visibilité sur le clone
  cloneTable.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.animation = 'none';
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.transform = 'none';
  });

  await nextFrame();

  const captureW = Math.ceil(cloneTable.scrollWidth || cloneTable.offsetWidth || fullWidth);
  const captureH = Math.ceil(cloneTable.scrollHeight || cloneTable.offsetHeight || rowHeight + 40);

  try {
    let dataUrl = await toPng(cloneTable, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: captureW,
      height: captureH,
      style: {
        margin: '0',
        padding: '0',
        transform: 'none',
        background: '#ffffff',
      },
    });

    dataUrl = await trimCanvasWhitespace(dataUrl, { padding: 2 });

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
