import { useEffect } from 'react';
import { isVisuallyZoomed } from './useModalVisualViewport';

const EDGE_EPS = 2;

/**
 * iOS Safari : supprime le rebond élastique en haut/bas d'un conteneur scrollable.
 */
export function usePreventOverscrollBounce(scrollRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let cleanup = () => {};

    const bind = () => {
      const el = scrollRef?.current;
      if (!el) {
        rafId = requestAnimationFrame(bind);
        return;
      }

      let lastY = 0;

      const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        lastY = e.touches[0].clientY;
      };

      const onTouchMove = (e) => {
        if (e.touches.length !== 1) return;
        if (isVisuallyZoomed()) return;

        const y = e.touches[0].clientY;
        const dy = y - lastY;
        lastY = y;

        if (Math.abs(dy) < 1) return;

        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        if (maxTop <= EDGE_EPS) return;

        const atTop = el.scrollTop <= EDGE_EPS;
        const atBottom = el.scrollTop >= maxTop - EDGE_EPS;
        const pullingDown = dy > 0;
        const pullingUp = dy < 0;

        if ((atTop && pullingDown) || (atBottom && pullingUp)) {
          e.preventDefault();
        }
      };

      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });

      cleanup = () => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
      };
    };

    bind();

    return () => {
      cancelAnimationFrame(rafId);
      cleanup();
    };
  }, [scrollRef, enabled]);
}

export default usePreventOverscrollBounce;
