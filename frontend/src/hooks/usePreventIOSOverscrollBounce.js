import { useEffect } from 'react';

const PAGE_CLASS = 'planning-commercial-page';

function isIOSTouchDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isPlanningCommercialActive() {
  return (
    document.body.classList.contains(PAGE_CLASS) ||
    document.documentElement.classList.contains(PAGE_CLASS)
  );
}

/**
 * @returns {false|null|true}
 *   false = cet élément peut encore scroller dans cette direction
 *   true  = rebond à bloquer sur cet élément
 *   null  = pas scrollable sur cet axe, remonter au parent
 */
function overscrollOnElement(el, dx, dy) {
  const style = window.getComputedStyle(el);
  const horizontal = Math.abs(dx) > Math.abs(dy);

  const canScrollY =
    (style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight + 1;

  const canScrollX =
    (style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowX === 'overlay') &&
    el.scrollWidth > el.clientWidth + 1;

  if (horizontal && canScrollX) {
    const atLeft = el.scrollLeft <= 0;
    const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    if (dx > 0 && atLeft) return true;
    if (dx < 0 && atRight) return true;
    return false;
  }

  if (!horizontal && canScrollY) {
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (dy > 0 && atTop) return true;
    if (dy < 0 && atBottom) return true;
    return false;
  }

  return null;
}

function shouldPreventOverscroll(target, dx, dy) {
  let el = target instanceof Element ? target : null;

  while (el && el !== document.documentElement) {
    const result = overscrollOnElement(el, dx, dy);
    if (result === false) return false;
    if (result === true) return true;
    el = el.parentElement;
  }

  const roots = [
    document.scrollingElement,
    document.documentElement,
    document.body,
  ].filter(Boolean);

  for (const root of roots) {
    const result = overscrollOnElement(root, dx, dy);
    if (result === false) return false;
    if (result === true) return true;
  }

  return false;
}

/**
 * iOS Safari — Planning commercial : anti-rebond, scroll + zoom inchangés.
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
      if (!isPlanningCommercialActive() || e.touches.length !== 1) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      if (shouldPreventOverscroll(e.target, dx, dy)) {
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
