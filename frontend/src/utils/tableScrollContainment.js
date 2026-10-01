/**
 * Scroll horizontal UNIQUEMENT au niveau de la page (html).
 * Pas de barre custom, pas de scroll sur les conteneurs tableaux.
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

const MARK = 'data-page-hscroll';

function measureContentWidth() {
  let max = 0;
  document.querySelectorAll(TABLE_SCROLL_SELECTOR).forEach((container) => {
    if (!(container instanceof HTMLElement)) return;
    max = Math.max(max, container.scrollWidth || 0, container.offsetWidth || 0);
    container.querySelectorAll('table').forEach((table) => {
      max = Math.max(max, table.scrollWidth || 0, table.offsetWidth || 0);
    });
  });
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
  el.style.setProperty('scrollbar-width', 'none', 'important');
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

  if (contentWidth > viewport + 2) {
    const currentMin = parseFloat(html.style.minWidth) || 0;
    if (Math.abs(currentMin - contentWidth) > 2) {
      html.style.setProperty('min-width', `${contentWidth}px`, 'important');
      body.style.setProperty('min-width', `${contentWidth}px`, 'important');
    }
  }

  // Un seul scrollport : html. Body ne crée pas de 2e barre.
  html.style.setProperty('overflow-x', 'auto', 'important');
  html.style.setProperty('overflow-y', 'auto', 'important');
  body.style.setProperty('overflow-x', 'visible', 'important');
  body.style.setProperty('overflow-y', 'visible', 'important');

  html.classList.add('fiche-page-hscroll');
  body.classList.add('fiche-page-hscroll');
  html.setAttribute(MARK, 'root');
  body.setAttribute(MARK, 'root');
}

function removeLegacyGlobalBar() {
  document.getElementById('fiche-global-hscroll-bar')?.remove();
  document.getElementById('fiche-global-hscroll-spacer')?.remove();
  document.documentElement.classList.remove('fiche-page-hscroll--active');
  document.body?.classList.remove('fiche-page-hscroll--active');
}

function enforceTableHorizontalScroll(root = document) {
  removeLegacyGlobalBar();
  ensurePageScrollRoot();
  root.querySelectorAll?.(LAYOUT_OVERFLOW_SELECTOR)?.forEach(applyLayoutPageScroll);
  root.querySelectorAll?.(TABLE_SCROLL_SELECTOR)?.forEach((el) => {
    applyContainerNoScroll(el);
    el.querySelectorAll?.('table')?.forEach(applyTableWidthStyles);
  });
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

  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 300);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
    removeLegacyGlobalBar();
  };
}

export { enforceTableHorizontalScroll };
