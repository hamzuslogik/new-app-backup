/**
 * Force une barre de défilement horizontale sous les tableaux fiches.
 * Les CSS de pages (importés après fiches-table.css) écrasaient overflow / max-width.
 */

const TABLE_SCROLL_SELECTOR = [
  '.fiches-table-container',
  '.confirmateurs-table-container',
  '.cq-table-container',
  '.fiches-table-wrapper',
].join(',');

const TABLE_INNER_SELECTOR = [
  '.fiches-table-container > .fiches-table',
  '.fiches-table-container > table',
  '.confirmateurs-table-container > .confirmateurs-table',
  '.confirmateurs-table-container > table',
  '.cq-table-container > .cq-table',
  '.cq-table-container > table',
  '.fiches-table-wrapper > table',
].join(',');

function applyContainerScrollStyles(el) {
  if (!(el instanceof HTMLElement)) return;

  el.style.setProperty('display', 'block', 'important');
  el.style.setProperty('box-sizing', 'border-box', 'important');
  el.style.setProperty('width', '100%', 'important');
  el.style.setProperty('max-width', '100%', 'important');
  el.style.setProperty('min-width', '0', 'important');
  el.style.setProperty('overflow-x', 'scroll', 'important');
  el.style.setProperty('overflow-y', 'visible', 'important');
  el.style.setProperty('-webkit-overflow-scrolling', 'touch');
  el.style.setProperty('scrollbar-gutter', 'stable');
  el.style.setProperty('scrollbar-width', 'auto');
  el.style.setProperty('scrollbar-color', '#4b5563 #d1d5db');
}

function applyTableWidthStyles(el) {
  if (!(el instanceof HTMLElement)) return;

  el.style.setProperty('width', 'max-content', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('min-width', '100%', 'important');
}

function enforceTableHorizontalScroll(root = document) {
  root.querySelectorAll?.(TABLE_SCROLL_SELECTOR)?.forEach(applyContainerScrollStyles);
  root.querySelectorAll?.(TABLE_INNER_SELECTOR)?.forEach(applyTableWidthStyles);
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
      if (m.type === 'attributes' && m.attributeName === 'class') {
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
      attributes: true,
      attributeFilter: ['class'],
    });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  window.addEventListener('resize', schedule);
  window.addEventListener('viewport-layout-change', schedule);

  // Re-appliquer après chargement des CSS de pages (imports async / navigation)
  window.setTimeout(schedule, 0);
  window.setTimeout(schedule, 250);
  window.setTimeout(schedule, 1000);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('viewport-layout-change', schedule);
  };
}

export { enforceTableHorizontalScroll };
