const EPS = 2;

export function isIOSTouchDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Pinch-zoom actif : laisser Safari gérer le scroll nativement. */
function isViewportZoomed() {
  return Boolean(window.visualViewport && window.visualViewport.scale > 1.01);
}

function isDocumentScrollRoot(el) {
  return (
    el === document.documentElement ||
    el === document.body ||
    el === document.scrollingElement
  );
}

function isScrollable(el) {
  if (!(el instanceof Element)) return false;

  if (isDocumentScrollRoot(el)) {
    return (
      el.scrollHeight > el.clientHeight + EPS ||
      el.scrollWidth > el.clientWidth + EPS
    );
  }

  const style = window.getComputedStyle(el);
  const canY =
    (style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight + EPS;
  const canX =
    (style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowX === 'overlay') &&
    el.scrollWidth > el.clientWidth + EPS;
  return canY || canX;
}

/** Du plus interne au plus externe, jusqu’à boundary inclus. */
function collectScrollChain(from, boundary) {
  const chain = [];
  let el = from instanceof Element ? from : null;

  while (el && el !== boundary && el !== document.documentElement) {
    if (isScrollable(el)) chain.push(el);
    el = el.parentElement;
  }

  if (boundary instanceof Element && isScrollable(boundary) && !chain.includes(boundary)) {
    chain.push(boundary);
  }

  return chain;
}

function canConsumeScroll(el, dx, dy) {
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    if (max <= EPS) return false;
    const atLeft = el.scrollLeft <= EPS;
    const atRight = el.scrollLeft >= max - EPS;
    if (dx > 0 && atLeft) return false;
    if (dx < 0 && atRight) return false;
    return true;
  }

  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  if (max <= EPS) return false;
  const atTop = el.scrollTop <= EPS;
  const atBottom = el.scrollTop >= max - EPS;
  if (dy > 0 && atTop) return false;
  if (dy < 0 && atBottom) return false;
  return true;
}

function applyScrollDelta(el, dx, dy) {
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    if (max <= EPS) return false;
    const next = Math.max(0, Math.min(max, el.scrollLeft - dx));
    if (Math.abs(next - el.scrollLeft) < 0.5) return false;
    el.scrollLeft = next;
    return true;
  }

  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  if (max <= EPS) return false;
  const next = Math.max(0, Math.min(max, el.scrollTop - dy));
  if (Math.abs(next - el.scrollTop) < 0.5) return false;
  el.scrollTop = next;
  return true;
}

/**
 * iOS : pas de rebond élastique sur la couche courante ; scroll parent si bord atteint.
 */
function processScrollChainTouch(e, chain, dx, dy) {
  if (!chain.length) return;

  for (let i = 0; i < chain.length; i += 1) {
    if (canConsumeScroll(chain[i], dx, dy)) {
      if (i === 0) return;
      if (applyScrollDelta(chain[i], dx, dy)) e.preventDefault();
      return;
    }
  }

  for (let i = chain.length - 1; i >= 1; i -= 1) {
    if (applyScrollDelta(chain[i], dx, dy)) {
      e.preventDefault();
      return;
    }
  }
}

function createTouchChainHandler(getChain, options = {}) {
  const { containsCheck } = options;
  const state = { lastX: 0, lastY: 0 };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    state.lastX = e.touches[0].clientX;
    state.lastY = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    if (isViewportZoomed()) return;
    if (containsCheck && !containsCheck(e.target)) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.lastX = x;
    state.lastY = y;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const chain = getChain(e.target);
    if (!chain.length) return;

    processScrollChainTouch(e, chain, dx, dy);
  };

  return { onTouchStart, onTouchMove };
}

/**
 * Modal détail fiche : tableau → panneau → overlay (sans rebond sur les couches internes).
 */
export function attachIosNestedScrollChain(boundaryEl) {
  if (!isIOSTouchDevice() || !(boundaryEl instanceof HTMLElement)) {
    return () => {};
  }

  const { onTouchStart, onTouchMove } = createTouchChainHandler(
    (target) => collectScrollChain(target, boundaryEl),
    {
      containsCheck: (target) => boundaryEl.contains(target),
    }
  );

  boundaryEl.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  boundaryEl.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

  return () => {
    boundaryEl.removeEventListener('touchstart', onTouchStart, { capture: true });
    boundaryEl.removeEventListener('touchmove', onTouchMove, { capture: true });
  };
}

function appendPageScrollRoots(chain) {
  const result = [...chain];
  const wrapper = document.querySelector('.content-wrapper');
  if (wrapper && isScrollable(wrapper) && !result.includes(wrapper)) {
    result.push(wrapper);
  }

  const pageRoot = document.scrollingElement || document.documentElement;
  if (pageRoot && isScrollable(pageRoot) && !result.includes(pageRoot)) {
    result.push(pageRoot);
  }
  if (document.body && isScrollable(document.body) && !result.includes(document.body)) {
    result.push(document.body);
  }

  return result;
}

function buildMainScrollChain(target) {
  return appendPageScrollRoots(collectScrollChain(target, document.documentElement));
}

function touchIsInMainContent(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('.sidebar')) return false;
  if (target.closest('.fiche-detail-modal-overlay')) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return false;
  return Boolean(target.closest('.main-content'));
}

/**
 * iOS Safari : scroll imbriqué dans la zone main (tableau → page).
 * Safari ne propage pas toujours le touch scroll vers html/body avec viewport desktop forcé.
 */
function processMainScrollTouch(e, chain, dx, dy) {
  if (!chain.length) return;

  for (let i = 0; i < chain.length; i += 1) {
    if (canConsumeScroll(chain[i], dx, dy)) {
      if (i === 0 && isDocumentScrollRoot(chain[i])) {
        if (applyScrollDelta(chain[i], dx, dy)) e.preventDefault();
        return;
      }
      if (i === 0) return;
      if (applyScrollDelta(chain[i], dx, dy)) e.preventDefault();
      return;
    }
  }

  for (let i = 1; i < chain.length; i += 1) {
    if (applyScrollDelta(chain[i], dx, dy)) {
      e.preventDefault();
      return;
    }
  }
}

export function initMainContentIosScrollChain() {
  if (!isIOSTouchDevice()) return () => {};

  const state = { lastX: 0, lastY: 0 };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    state.lastX = e.touches[0].clientX;
    state.lastY = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    if (isViewportZoomed()) return;
    if (!touchIsInMainContent(e.target)) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.lastX = x;
    state.lastY = y;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const chain = buildMainScrollChain(e.target);
    if (!chain.length) return;

    processMainScrollTouch(e, chain, dx, dy);
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

  return () => {
    document.removeEventListener('touchstart', onTouchStart, { capture: true });
    document.removeEventListener('touchmove', onTouchMove, { capture: true });
  };
}

/** @deprecated Utiliser initMainContentIosScrollChain */
export function initDashboardIosScrollChain() {
  return initMainContentIosScrollChain();
}
