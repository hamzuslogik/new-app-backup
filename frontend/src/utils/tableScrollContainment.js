const TABLE_CONTAINER_SELECTOR = '.fiches-table-container, .confirmateurs-table-container';

function getTableScrollContainer(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(TABLE_CONTAINER_SELECTOR);
}

function hasHorizontalOverflow(container) {
  return container.scrollWidth > container.clientWidth + 1;
}

/**
 * Molette verticale → défilement horizontal quand le curseur est sur un tableau scrollable.
 */
function onTableWheel(e) {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

  const container = getTableScrollContainer(e.target);
  if (!container || !hasHorizontalOverflow(container)) return;

  const maxScroll = container.scrollWidth - container.clientWidth;
  const next = Math.max(0, Math.min(maxScroll, container.scrollLeft + e.deltaY));
  if (Math.abs(next - container.scrollLeft) < 0.5) return;

  container.scrollLeft = next;
  e.preventDefault();
}

export function initTableScrollContainment() {
  document.addEventListener('wheel', onTableWheel, { passive: false, capture: true });

  return () => {
    document.removeEventListener('wheel', onTableWheel, { capture: true });
  };
}
