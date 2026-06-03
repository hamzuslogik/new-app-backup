import { useEffect } from 'react';

const EDGE_EPS = 2;

function isIOSTouchDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function getVerticalScrollRoot() {
  const wrapper = document.querySelector('.content-wrapper');
  if (wrapper && wrapper.scrollHeight > wrapper.clientHeight + EDGE_EPS) {
    return wrapper;
  }
  return document.scrollingElement || document.documentElement;
}

function getHorizontalScrollRoot() {
  return document.scrollingElement || document.documentElement;
}

function preventBounceAtEdge(root, dx, dy) {
  const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
  const maxLeft = Math.max(0, root.scrollWidth - root.clientWidth);
  const st = root.scrollTop;
  const sl = root.scrollLeft;

  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    if (maxLeft <= EDGE_EPS) return false;
    const goingLeft = dx > 0;
    const goingRight = dx < 0;
    const atLeft = sl <= EDGE_EPS;
    const atRight = sl >= maxLeft - EDGE_EPS;
    return (goingLeft && atLeft) || (goingRight && atRight);
  }

  if (maxTop <= EDGE_EPS) return false;
  const pullingDown = dy > 0;
  const pullingUp = dy < 0;
  const atTop = st <= EDGE_EPS;
  const atBottom = st >= maxTop - EDGE_EPS;
  return (pullingDown && atTop) || (pullingUp && atBottom);
}

/**
 * iOS Safari : supprime le rebond (rubber-band) en haut/bas/gauche/droite
 * des zones scrollables de la page Planning commercial.
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
      const root = horizontal ? getHorizontalScrollRoot() : getVerticalScrollRoot();

      if (preventBounceAtEdge(root, dx, dy)) {
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
