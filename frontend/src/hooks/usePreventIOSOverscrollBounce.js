import { useEffect } from 'react';

const EDGE_EPS = 2;
const MIN_OVERSCROLL_PX = 4;
const ZOOM_THRESHOLD = 1.02;

function isIOSTouchDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isPageZoomed() {
  const vv = window.visualViewport;
  return Boolean(vv && vv.scale > ZOOM_THRESHOLD);
}

function getDocumentScrollRoot() {
  return document.scrollingElement || document.documentElement;
}

function getVerticalScrollRoot() {
  const wrapper = document.querySelector('.content-wrapper');
  if (wrapper && wrapper.scrollHeight > wrapper.clientHeight + EDGE_EPS) {
    return wrapper;
  }
  return getDocumentScrollRoot();
}

function getHorizontalScrollRoot() {
  return getDocumentScrollRoot();
}

function getScrollRoot(horizontal) {
  if (isPageZoomed()) {
    return getDocumentScrollRoot();
  }
  return horizontal ? getHorizontalScrollRoot() : getVerticalScrollRoot();
}

/**
 * Bloque uniquement le rebond : le geste ne peut plus faire avancer le scroll.
 */
function shouldBlockBounce(root, dx, dy) {
  const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const maxLeft = Math.max(0, root.scrollWidth - root.clientWidth);
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    if (maxLeft <= EDGE_EPS || Math.abs(dx) < MIN_OVERSCROLL_PX) return false;
    const nextLeft = Math.min(maxLeft, Math.max(0, root.scrollLeft - dx));
    return nextLeft === root.scrollLeft;
  }

  if (maxTop <= EDGE_EPS || Math.abs(dy) < MIN_OVERSCROLL_PX) return false;
  const nextTop = Math.min(maxTop, Math.max(0, root.scrollTop - dy));
  return nextTop === root.scrollTop;
}

/**
 * iOS Safari : pas de rebond élastique aux limites, scroll normal conservé (y compris après zoom).
 */
export function usePreventIOSOverscrollBounce(enabled = true) {
  useEffect(() => {
    if (!enabled || !isIOSTouchDevice()) return undefined;

    let lastX = 0;
    let lastY = 0;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const root = getScrollRoot(horizontal);

      if (shouldBlockBounce(root, dx, dy)) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { passive: true, capture: true });
      document.removeEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    };
  }, [enabled]);
}

export default usePreventIOSOverscrollBounce;
