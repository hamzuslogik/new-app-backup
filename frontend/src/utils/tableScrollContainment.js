/**
 * Scroll horizontal au niveau de la page (html/body), pas des conteneurs tableaux.
 * Barre fixe en bas synchronisée avec window.scrollX (sans boucle de reflow).
 */

const TABLE_SCROLL_SELECTOR = [
  '.fiches-table-container',
  '.confirmateurs-table-container',
  '.cq-table-container',
  '.fiches-table-wrapper',
].join(',');

const LAYOUT_OVERFLOW_SELECTOR = [
  '.app',
  '.main-content',
  '.content-wrapper',
].join(',');

const BAR_ID = 'fiche-global-hscroll-bar';
const SPACER_ID = 'fiche-global-hscroll-spacer';
const MARK = 'data-page-hscroll';

let syncing = false;
let lastSpacerWidth = -1;
let lastNeedsScroll = null;

function getPageScrollEl() {
  return document.scrollingElement || document.documentElement;
}

function applyContainerNoScroll(el) {
  if (!(el instanceof HTMLElement) || el.getAttribute(MARK) === '1') return;
  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('box-sizing', 'border-box', 'important');
  el.style.setProperty('width', 'auto', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '0', 'important');
  el.style.setProperty('overflow', 'visible', 'important');
  el.setAttribute(MARK, '1');
}

function applyTableWidthStyles(el) {
  if (!(el instanceof HTMLElement) || el.getAttribute(MARK) === 'tbl') return;
  el.style.setProperty('width', 'max-content', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '100%', 'important');
  el.setAttribute(MARK, 'tbl');
}

function applyLayoutPageScroll(el) {
  if (!(el instanceof HTMLElement) || el.getAttribute(MARK) === 'layout') return;
  // Les deux axes en visible : sinon overflow-y:auto force overflow-x:auto (scroll imbriqué)
  el.style.setProperty('overflow', 'visible', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.setAttribute(MARK, 'layout');
}

function ensurePageScrollRoot() {
  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) return;
  if (html.getAttribute(MARK) === 'root') return;

  // Un seul scrollport document : html scroll, body ne crée pas de 2e barre
  html.style.setProperty('overflow-x', 'auto', 'important');
  html.style.setProperty('overflow-y', 'auto', 'important');
  body.style.setProperty('overflow-x', 'visible', 'important');
  body.style.setProperty('overflow-y', 'visible', 'important');
  html.setAttribute(MARK, 'root');
  body.setAttribute(MARK, 'root');
}

function ensureGlobalBar() {
  let bar = document.getElementById(BAR_ID);
  if (bar) {
    return {
      bar,
      spacer: document.getElementById(SPACER_ID),
    };
  }

  bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.className = 'fiche-global-hscroll-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.setAttribute('role', 'presentation');

  const spacer = document.createElement('div');
  spacer.id = SPACER_ID;
  spacer.className = 'fiche-global-hscroll-spacer';
  bar.appendChild(spacer);
  document.body.appendChild(bar);

  bar.addEventListener(
    'scroll',
    () => {
      if (syncing) return;
      const target = bar.scrollLeft;
      const current = window.scrollX || 0;
      if (Math.abs(current - target) < 1) return;
      syncing = true;
      window.scrollTo(target, window.scrollY || 0);
      syncing = false;
    },
    { passive: true }
  );

  return { bar, spacer };
}

function hideBar(bar) {
  if (!bar) return;
  if (lastNeedsScroll === false) return;
  lastNeedsScroll = false;
  bar.classList.remove('fiche-global-hscroll-bar--visible');
  bar.style.display = 'none';
  lastSpacerWidth = -1;
}

function updateGlobalStickyBar() {
  ensurePageScrollRoot();
  const { bar, spacer } = ensureGlobalBar();
  const page = getPageScrollEl();
  if (!page || !spacer) {
    hideBar(bar);
    return;
  }

  const scrollWidth = Math.max(
    page.scrollWidth || 0,
    document.documentElement?.scrollWidth || 0,
    document.body?.scrollWidth || 0
  );
  const clientWidth = page.clientWidth || window.innerWidth || 0;
  const needsScroll = scrollWidth > clientWidth + 2;

  if (!needsScroll) {
    hideBar(bar);
    return;
  }

  if (lastNeedsScroll !== true) {
    bar.style.display = 'block';
    bar.style.left = '0px';
    bar.style.width = '100%';
    bar.classList.add('fiche-global-hscroll-bar--visible');
    lastNeedsScroll = true;
  }

  if (Math.abs(scrollWidth - lastSpacerWidth) > 1) {
    spacer.style.width = `${scrollWidth}px`;
    spacer.style.height = '1px';
    lastSpacerWidth = scrollWidth;
  }

  if (!syncing) {
    const target = window.scrollX || page.scrollLeft || 0;
    if (Math.abs(bar.scrollLeft - target) > 1) {
      syncing = true;
      bar.scrollLeft = target;
      syncing = false;
    }
  }
}

function enforceTableHorizontalScroll(root = document) {
  root.querySelectorAll?.(LAYOUT_OVERFLOW_SELECTOR)?.forEach(applyLayoutPageScroll);
  root.querySelectorAll?.(TABLE_SCROLL_SELECTOR)?.forEach((el) => {
    applyContainerNoScroll(el);
    el.querySelectorAll?.('table')?.forEach(applyTableWidthStyles);
  });
  updateGlobalStickyBar();
}

export function initTableScrollContainment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let scheduled = false;
  const run = () => {
    scheduled = false;
    enforceTableHorizontalScroll(document);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(run);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  // Ne pas observer style/class : évite la boucle apply → mutation → apply
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes?.length || m.removedNodes?.length)) {
        schedule();
        return;
      }
    }
  });

  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  window.addEventListener('resize', schedule);
  window.addEventListener('viewport-layout-change', schedule);
  window.addEventListener(
    'scroll',
    () => {
      if (syncing) return;
      const bar = document.getElementById(BAR_ID);
      if (!bar || !bar.classList.contains('fiche-global-hscroll-bar--visible')) return;
      const target = window.scrollX || 0;
      if (Math.abs(bar.scrollLeft - target) < 1) return;
      syncing = true;
      bar.scrollLeft = target;
      syncing = false;
    },
    { passive: true }
  );

  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 300);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
    document.getElementById(BAR_ID)?.remove();
    lastSpacerWidth = -1;
    lastNeedsScroll = null;
  };
}

export { enforceTableHorizontalScroll };
