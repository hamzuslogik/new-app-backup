import { useEffect } from 'react';

const ZOOM_THRESHOLD = 1.02;
const EDGE_EPS = 3;

export function isFicheModalVisuallyZoomed() {
  const vv = window.visualViewport;
  return Boolean(vv && vv.scale > ZOOM_THRESHOLD);
}

/**
 * iOS Safari : scroll fiable dans le modal après pinch-zoom.
 * - Zone de scroll dédiée (.fiche-detail-modal-scroll)
 * - Variables CSS liées au visualViewport
 * - Assistance tactile du scroll quand la page est zoomée
 */
export function useFicheDetailModalIosScroll(overlayRef, scrollRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const vv = window.visualViewport;
    if (!vv) return undefined;

    let rafId = 0;
    let lastY = 0;
    let touchCleanup = () => {};

    const getScrollEl = () => scrollRef?.current;

    const syncViewport = () => {
      const overlay = overlayRef?.current;
      const scrollEl = getScrollEl();
      if (!overlay || !scrollEl) return;

      const scale = vv.scale;
      const zoomed = scale > ZOOM_THRESHOLD;

      overlay.classList.toggle('fiche-detail-modal-vv-zoomed', zoomed);

      if (zoomed) {
        const h = Math.round(vv.height);
        const w = Math.round(vv.width);
        overlay.style.setProperty('--modal-vv-h', `${h}px`);
        overlay.style.setProperty('--modal-vv-w', `${w}px`);
        overlay.style.setProperty('--modal-vv-scale', String(scale));

        const inner = scrollEl.firstElementChild;
        const contentH = inner?.scrollHeight || scrollEl.scrollHeight;
        const extra = Math.max(0, Math.round(contentH * (scale - 1) * 0.5));
        scrollEl.style.paddingBottom = `${24 + extra}px`;
      } else {
        overlay.style.removeProperty('--modal-vv-h');
        overlay.style.removeProperty('--modal-vv-w');
        overlay.style.removeProperty('--modal-vv-scale');
        scrollEl.style.paddingBottom = '';
      }
    };

    const scheduleSync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncViewport);
    };

    const bindTouchScroll = () => {
      const scrollEl = getScrollEl();
      if (!scrollEl) {
        rafId = requestAnimationFrame(bindTouchScroll);
        return;
      }

      const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        lastY = e.touches[0].clientY;
      };

      const onTouchMove = (e) => {
        if (!isFicheModalVisuallyZoomed() || e.touches.length !== 1) return;

        const y = e.touches[0].clientY;
        const dy = y - lastY;
        lastY = y;

        if (Math.abs(dy) < 1) return;

        const maxTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
        if (maxTop <= EDGE_EPS) return;

        const next = Math.min(maxTop, Math.max(0, scrollEl.scrollTop - dy));
        if (next !== scrollEl.scrollTop) {
          scrollEl.scrollTop = next;
        }
        e.preventDefault();
      };

      scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
      scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });

      touchCleanup = () => {
        scrollEl.removeEventListener('touchstart', onTouchStart);
        scrollEl.removeEventListener('touchmove', onTouchMove);
      };
    };

    const bind = () => {
      if (!overlayRef?.current || !getScrollEl()) {
        rafId = requestAnimationFrame(bind);
        return;
      }
      scheduleSync();
      bindTouchScroll();
    };

    vv.addEventListener('resize', scheduleSync);
    vv.addEventListener('scroll', scheduleSync);
    bind();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleSync)
        : null;
    if (resizeObserver && getScrollEl()) {
      resizeObserver.observe(getScrollEl());
    }

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', scheduleSync);
      vv.removeEventListener('scroll', scheduleSync);
      resizeObserver?.disconnect();
      touchCleanup();

      const overlay = overlayRef?.current;
      const scrollEl = getScrollEl();
      if (overlay) {
        overlay.classList.remove('fiche-detail-modal-vv-zoomed');
        overlay.style.removeProperty('--modal-vv-h');
        overlay.style.removeProperty('--modal-vv-w');
        overlay.style.removeProperty('--modal-vv-scale');
      }
      if (scrollEl) {
        scrollEl.style.paddingBottom = '';
      }
    };
  }, [overlayRef, scrollRef, enabled]);
}

export default useFicheDetailModalIosScroll;
