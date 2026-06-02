import { useEffect } from 'react';

const ZOOM_THRESHOLD = 1.02;

/**
 * iOS Safari : après pinch-zoom, aligne le modal sur le visualViewport
 * pour que le scroll vertical atteigne bien le bas du contenu.
 */
export function useModalVisualViewport(overlayRef, contentRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const vv = window.visualViewport;
    if (!vv) return undefined;

    let rafId = 0;

    const resetStyles = (overlay, content) => {
      if (overlay) {
        overlay.style.top = '';
        overlay.style.left = '';
        overlay.style.right = '';
        overlay.style.bottom = '';
        overlay.style.width = '';
        overlay.style.height = '';
      }
      if (content) {
        content.style.paddingBottom = '';
      }
    };

    const apply = () => {
      const overlay = overlayRef?.current;
      const content = contentRef?.current;
      if (!overlay) return;

      const scale = vv.scale;
      if (scale <= ZOOM_THRESHOLD) {
        resetStyles(overlay, content);
        return;
      }

      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;

      if (content) {
        const extra = Math.round(vv.height * (scale - 1) * 0.85);
        content.style.paddingBottom = `${20 + extra}px`;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    };

    const bind = () => {
      if (!overlayRef?.current) {
        rafId = requestAnimationFrame(bind);
        return;
      }
      schedule();
    };

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    bind();

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      resetStyles(overlayRef?.current, contentRef?.current);
    };
  }, [overlayRef, contentRef, enabled]);
}

export function isVisuallyZoomed() {
  const vv = window.visualViewport;
  return Boolean(vv && vv.scale > ZOOM_THRESHOLD);
}

export default useModalVisualViewport;
