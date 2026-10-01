/**
 * Scroll horizontal au niveau de la page (html/body), pas des conteneurs tableaux.
 * Barre fixe en bas de l’écran synchronisée avec window.scrollX.
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

let syncing = false;

function getPageScrollEl() {
  return document.scrollingElement || document.documentElement;
}

function applyContainerNoScroll(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('box-sizing', 'border-box', 'important');
  el.style.setProperty('width', '100%', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '0', 'important');
  el.style.setProperty('overflow-x', 'visible', 'important');
  el.style.setProperty('overflow-y', 'visible', 'important');
  el.style.setProperty('scrollbar-width', 'none', 'important');
  el.style.setProperty('-ms-overflow-style', 'none');
}

function applyTableWidthStyles(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('width', 'max-content', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '100%', 'important');
}

function applyLayoutPageScroll(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('overflow-x', 'visible', 'important');
  el.style.setProperty('overflow-y', 'visible', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '0', 'important');
}

function ensurePageScrollRoot() {
  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) return;

  html.style.setProperty('overflow-x', 'auto', 'important');
  html.style.setProperty('overflow-y', 'auto', 'important');
  body.style.setProperty('overflow-x', 'auto', 'important');
  body.style.setProperty('overflow-y', 'auto', 'important');
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
      syncing = true;
      window.scrollTo(bar.scrollLeft, window.scrollY || 0);
      syncing = false;
    },
    { passive: true }
  );

  return { bar, spacer };
}

function hideBar(bar) {
  if (!bar) return;
  bar.classList.remove('fiche-global-hscroll-bar--visible');
  bar.style.display = 'none';
}

function updateGlobalStickyBar() {
  ensurePageScrollRoot();
  const { bar, spacer } = ensureGlobalBar();
  const page = getPageScrollEl();
  if (!page) {
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

  bar.style.display = 'block';
  bar.style.left = '0px';
  bar.style.width = '100%';
  bar.classList.add('fiche-global-hscroll-bar--visible');

  spacer.style.width = `${scrollWidth}px`;
  spacer.style.height = '1px';

  if (!syncing) {
    syncing = true;
    bar.scrollLeft = window.scrollX || page.scrollLeft || 0;
    syncing = false;
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

  const observer = new MutationObserver(() => schedule());

  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
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
      syncing = true;
      bar.scrollLeft = window.scrollX || 0;
      syncing = false;
    },
    { passive: true }
  );

  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 250);
  window.setTimeout(schedule, 1000);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
    document.getElementById(BAR_ID)?.remove();
  };
}

export { enforceTableHorizontalScroll };
