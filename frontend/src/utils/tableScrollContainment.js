const TABLE_SCROLL_SELECTOR = [
  '.fiches-table-container',
  '.confirmateurs-table-container',
  '.planning-table-container',
  '.table-container-responsive',
  '[class*="-table-container"]',
].join(', ');

const SCROLL_EDGE_EPS = 2;

function isPageLinkedTableContainer(el) {
  return el?.classList?.contains('table-page-scroll');
}

function findTableScrollContainer(target) {
  if (!(target instanceof Element)) return null;
  const container = target.matches(TABLE_SCROLL_SELECTOR)
    ? target
    : target.closest(TABLE_SCROLL_SELECTOR);
  if (isPageLinkedTableContainer(container)) {
    return null;
  }
  return container;
}

function getScrollLimits(el) {
  return {
    maxLeft: Math.max(0, el.scrollWidth - el.clientWidth),
    maxTop: Math.max(0, el.scrollHeight - el.clientHeight),
  };
}

/**
 * iOS Safari : empêche le scroll de « continuer » sur la page quand on atteint
 * le bord d'un conteneur de tableau (horizontal ou vertical).
 */
export function initTableScrollContainment() {
  let lastX = 0;
  let lastY = 0;
  let activeContainer = null;

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        activeContainer = null;
        return;
      }
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      activeContainer = findTableScrollContainer(e.target);
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 1) return;
      if (document.body.classList.contains('planning-commercial-page')) return;

      const container = findTableScrollContainer(e.target) || activeContainer;
      if (!container) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const containerEl = container;
      const { maxLeft, maxTop } = getScrollLimits(containerEl);
      const sl = containerEl.scrollLeft;
      const st = containerEl.scrollTop;

      const atLeft = sl <= SCROLL_EDGE_EPS;
      const atRight = sl >= maxLeft - SCROLL_EDGE_EPS;
      const atTop = st <= SCROLL_EDGE_EPS;
      const atBottom = st >= maxTop - SCROLL_EDGE_EPS;

      const horizontal = Math.abs(dx) >= Math.abs(dy);

      if (horizontal) {
        const goingLeft = dx > 0;
        const goingRight = dx < 0;
        if (maxLeft > 0 && ((goingLeft && atLeft) || (goingRight && atRight))) {
          e.preventDefault();
          return;
        }
        if (maxLeft <= 0 && Math.abs(dx) > 3) {
          e.preventDefault();
        }
        return;
      }

      const goingUp = dy > 0;
      const goingDown = dy < 0;
      if (maxTop > 0 && ((goingUp && atTop) || (goingDown && atBottom))) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true }
  );

  document.addEventListener(
    'touchend',
    () => {
      activeContainer = null;
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'touchcancel',
    () => {
      activeContainer = null;
    },
    { passive: true, capture: true }
  );
}
