/**
 * Scroll horizontal au niveau de la page, pas des conteneurs tableaux.
 * Barre fixe en bas : pilote scrollLeft du vrai scrollport horizontal.
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
  '#root',
].join(',');

const BAR_ID = 'fiche-global-hscroll-bar';
const SPACER_ID = 'fiche-global-hscroll-spacer';
const MARK = 'data-page-hscroll';

let syncing = false;
let lastSpacerWidth = -1;
let lastNeedsScroll = null;
let activeScrollRoot = null;

function getDocumentRoots() {
  return [document.scrollingElement, document.documentElement, document.body].filter(
    (el, i, arr) => el && arr.indexOf(el) === i
  );
}

function getCandidateScrollRoots() {
  const extras = [
    document.querySelector('.content-wrapper'),
    document.querySelector('.main-content'),
    document.querySelector('.app'),
    document.getElementById('root'),
  ].filter(Boolean);
  return [...getDocumentRoots(), ...extras].filter(
    (el, i, arr) => el && arr.indexOf(el) === i
  );
}

function getScrollLeft(el) {
  if (!el) return window.scrollX || 0;
  if (el === document.documentElement || el === document.body || el === document.scrollingElement) {
    return window.scrollX || el.scrollLeft || document.documentElement.scrollLeft || 0;
  }
  return el.scrollLeft || 0;
}

function setScrollLeft(el, x) {
  const left = Math.max(0, x);
  const y = window.scrollY || document.documentElement.scrollTop || 0;

  if (
    !el ||
    el === document.documentElement ||
    el === document.body ||
    el === document.scrollingElement
  ) {
    document.documentElement.scrollLeft = left;
    if (document.body) document.body.scrollLeft = left;
    window.scrollTo(left, y);
    return;
  }

  el.scrollLeft = left;
}

function measureContentWidth() {
  let max = 0;
  document.querySelectorAll(TABLE_SCROLL_SELECTOR).forEach((container) => {
    if (!(container instanceof HTMLElement)) return;
    max = Math.max(max, container.scrollWidth || 0, container.offsetWidth || 0);
    container.querySelectorAll('table').forEach((table) => {
      max = Math.max(max, table.scrollWidth || 0, table.offsetWidth || 0);
    });
  });
  max = Math.max(
    max,
    document.documentElement?.scrollWidth || 0,
    document.body?.scrollWidth || 0
  );
  return max;
}

function applyContainerNoScroll(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('box-sizing', 'border-box', 'important');
  el.style.setProperty('width', 'auto', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '0', 'important');
  el.style.setProperty('overflow', 'visible', 'important');
  el.setAttribute(MARK, '1');
}

function applyTableWidthStyles(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('width', 'max-content', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '100%', 'important');
  el.setAttribute(MARK, 'tbl');
}

function applyLayoutPageScroll(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('overflow', 'visible', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.setAttribute(MARK, 'layout');
}

function ensurePageScrollRoot() {
  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) return;

  const contentWidth = measureContentWidth();
  const viewport = window.innerWidth || html.clientWidth || 0;

  // Garantit que la page (html) peut réellement scroller horizontalement
  if (contentWidth > viewport + 2) {
    const currentMin = parseFloat(html.style.minWidth) || 0;
    if (Math.abs(currentMin - contentWidth) > 2) {
      html.style.setProperty('min-width', `${contentWidth}px`, 'important');
      body.style.setProperty('min-width', `${contentWidth}px`, 'important');
    }
  }

  html.style.setProperty('overflow-x', 'scroll', 'important');
  html.style.setProperty('overflow-y', 'auto', 'important');
  body.style.setProperty('overflow-x', 'visible', 'important');
  body.style.setProperty('overflow-y', 'visible', 'important');
  html.setAttribute(MARK, 'root');
  body.setAttribute(MARK, 'root');
}

function pickActiveScrollRoot() {
  const candidates = getCandidateScrollRoots();
  let best = document.scrollingElement || document.documentElement;
  let bestOverflow = -1;

  candidates.forEach((el) => {
    if (!(el instanceof Element)) return;
    const overflow = (el.scrollWidth || 0) - (el.clientWidth || 0);
    if (overflow > bestOverflow) {
      bestOverflow = overflow;
      best = el;
    }
  });

  // Préférer le document si lui aussi overflow (comportement attendu "page")
  const doc = document.scrollingElement || document.documentElement;
  const docOverflow = (doc?.scrollWidth || 0) - (doc?.clientWidth || 0);
  if (docOverflow > 2) return doc;

  return bestOverflow > 2 ? best : doc;
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
      const root = activeScrollRoot || pickActiveScrollRoot();
      const target = bar.scrollLeft;
      const current = getScrollLeft(root);
      if (Math.abs(current - target) < 1) return;
      syncing = true;
      setScrollLeft(root, target);
      // Si le document n'a pas bougé, forcer aussi window + html
      if (Math.abs(getScrollLeft(root) - target) > 1) {
        setScrollLeft(document.documentElement, target);
        getCandidateScrollRoots().forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 2) el.scrollLeft = target;
        });
      }
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
  activeScrollRoot = null;
}

function updateGlobalStickyBar() {
  ensurePageScrollRoot();
  const { bar, spacer } = ensureGlobalBar();
  if (!spacer) {
    hideBar(bar);
    return;
  }

  const root = pickActiveScrollRoot();
  activeScrollRoot = root;

  const scrollWidth = Math.max(
    root.scrollWidth || 0,
    measureContentWidth(),
    document.documentElement?.scrollWidth || 0,
    document.body?.scrollWidth || 0
  );
  const clientWidth = root.clientWidth || window.innerWidth || 0;
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
    const target = getScrollLeft(root);
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

  const onPageScroll = () => {
    if (syncing) return;
    const bar = document.getElementById(BAR_ID);
    if (!bar || !bar.classList.contains('fiche-global-hscroll-bar--visible')) return;
    const root = activeScrollRoot || pickActiveScrollRoot();
    const target = getScrollLeft(root);
    if (Math.abs(bar.scrollLeft - target) < 1) return;
    syncing = true;
    bar.scrollLeft = target;
    syncing = false;
  };

  window.addEventListener('scroll', onPageScroll, { passive: true });
  document.addEventListener('scroll', onPageScroll, { passive: true, capture: true });

  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 300);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
    window.removeEventListener('scroll', onPageScroll);
    document.removeEventListener('scroll', onPageScroll, true);
    document.getElementById(BAR_ID)?.remove();
    lastSpacerWidth = -1;
    lastNeedsScroll = null;
    activeScrollRoot = null;
  };
}

export { enforceTableHorizontalScroll };
