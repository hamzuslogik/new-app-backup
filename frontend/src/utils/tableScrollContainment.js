/**
 * Barre de défilement horizontale toujours visible en bas de l’écran
 * (sync avec le tableau fiches visible), sans modifier la structure React.
 */

const TABLE_SCROLL_SELECTOR = [
  '.fiches-table-container',
  '.confirmateurs-table-container',
  '.cq-table-container',
  '.fiches-table-wrapper',
].join(',');

const BAR_ID = 'fiche-global-hscroll-bar';
const SPACER_ID = 'fiche-global-hscroll-spacer';

let activeContainer = null;
let syncing = false;

function applyContainerScrollStyles(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('box-sizing', 'border-box', 'important');
  el.style.setProperty('width', '100%', 'important');
  el.style.setProperty('max-width', '100%', 'important');
  el.style.setProperty('min-width', '0', 'important');
  el.style.setProperty('overflow-x', 'auto', 'important');
  el.style.setProperty('overflow-y', 'visible', 'important');
  el.style.setProperty('-webkit-overflow-scrolling', 'touch');
  el.style.setProperty('scrollbar-width', 'none', 'important');
  el.style.setProperty('-ms-overflow-style', 'none');
}

function applyTableWidthStyles(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('width', 'max-content', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '100%', 'important');
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
      if (syncing || !activeContainer) return;
      syncing = true;
      activeContainer.scrollLeft = bar.scrollLeft;
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
  activeContainer = null;
}

function pickActiveContainer() {
  const containers = Array.from(document.querySelectorAll(TABLE_SCROLL_SELECTOR));
  let best = null;
  let bestScore = -1;

  containers.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const table = el.querySelector('table');
    if (table) applyTableWidthStyles(table);
    applyContainerScrollStyles(el);

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (rect.bottom <= 40 || rect.top >= vh - 20) return;

    const needsScroll = el.scrollWidth > el.clientWidth + 2;
    if (!needsScroll) return;

    // priorité au tableau le plus visible verticalement
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    if (visible > bestScore) {
      bestScore = visible;
      best = el;
    }
  });

  return best;
}

function bindContainerScroll(container) {
  if (!(container instanceof HTMLElement)) return;
  if (container.dataset.hscrollListen === '1') return;
  container.addEventListener(
    'scroll',
    () => {
      if (syncing || activeContainer !== container) return;
      const bar = document.getElementById(BAR_ID);
      if (!bar) return;
      syncing = true;
      bar.scrollLeft = container.scrollLeft;
      syncing = false;
    },
    { passive: true }
  );
  container.dataset.hscrollListen = '1';
}

function updateGlobalStickyBar() {
  const { bar, spacer } = ensureGlobalBar();
  const container = pickActiveContainer();

  if (!container) {
    hideBar(bar);
    return;
  }

  bindContainerScroll(container);
  activeContainer = container;

  const rect = container.getBoundingClientRect();
  const left = Math.max(0, Math.round(rect.left));
  const width = Math.max(0, Math.round(rect.width));

  bar.style.display = 'block';
  bar.style.left = `${left}px`;
  bar.style.width = `${width}px`;
  bar.classList.add('fiche-global-hscroll-bar--visible');

  spacer.style.width = `${container.scrollWidth}px`;
  spacer.style.height = '1px';

  if (!syncing) {
    syncing = true;
    bar.scrollLeft = container.scrollLeft;
    syncing = false;
  }
}

function enforceTableHorizontalScroll(root = document) {
  root.querySelectorAll?.(TABLE_SCROLL_SELECTOR)?.forEach((el) => {
    applyContainerScrollStyles(el);
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
      attributeFilter: ['class'],
    });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  window.addEventListener('resize', schedule);
  window.addEventListener('viewport-layout-change', schedule);
  window.addEventListener('scroll', schedule, { passive: true, capture: true });

  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 250);
  window.setTimeout(schedule, 1000);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
    window.removeEventListener('scroll', schedule, true);
    document.getElementById(BAR_ID)?.remove();
    activeContainer = null;
  };
}

export { enforceTableHorizontalScroll };
