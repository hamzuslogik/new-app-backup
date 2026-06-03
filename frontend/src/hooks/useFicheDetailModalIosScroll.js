import { useEffect } from 'react';

const ZOOM_THRESHOLD = 1.02;
const BANNER_PX = 72;
const CHROME_PX = 36;

export function isFicheModalVisuallyZoomed() {
  const vv = window.visualViewport;
  return Boolean(vv && vv.scale > ZOOM_THRESHOLD);
}

/**
 * iOS Safari : scroll fiable dans le modal (dont section Compte rendu en bas).
 */
export function useFicheDetailModalIosScroll(overlayRef, scrollRef, contentRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const vv = window.visualViewport;
    if (!vv) return undefined;

    let rafId = 0;
    let lastY = 0;
    let touchCleanup = () => {};

    const getScrollEl = () => scrollRef?.current;
    const getContentEl = () => contentRef?.current;

    const syncViewport = () => {
      const overlay = overlayRef?.current;
      const scrollEl = getScrollEl();
      const contentEl = getContentEl();
      if (!overlay || !scrollEl) return;

      const scale = vv.scale;
      const zoomed = scale > ZOOM_THRESHOLD;
      const vvH = Math.round(vv.height);

      overlay.classList.toggle('fiche-detail-modal-vv-zoomed', zoomed);

      if (zoomed) {
        overlay.style.setProperty('--modal-vv-h', `${vvH}px`);
        overlay.style.setProperty('--modal-vv-w', `${Math.round(vv.width)}px`);
        overlay.style.setProperty('--modal-vv-scale', String(scale));
        const scrollMax = Math.max(120, vvH - BANNER_PX - CHROME_PX);
        overlay.style.setProperty('--modal-scroll-max-h', `${scrollMax}px`);
        if (contentEl) {
          contentEl.style.height = `${vvH}px`;
          contentEl.style.maxHeight = `${vvH}px`;
        }
      } else {
        overlay.style.removeProperty('--modal-vv-h');
        overlay.style.removeProperty('--modal-vv-w');
        overlay.style.removeProperty('--modal-vv-scale');
        overlay.style.removeProperty('--modal-scroll-max-h');
        if (contentEl) {
          contentEl.style.height = '';
          contentEl.style.maxHeight = '';
        }
      }

      const inner = scrollEl.firstElementChild;
      const contentH = inner?.scrollHeight || scrollEl.scrollHeight;
      const extra = zoomed
        ? Math.max(80, Math.round(contentH * (scale - 1)))
        : 48;
      scrollEl.style.paddingBottom = `${extra}px`;
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
        if (maxTop <= 3) return;

        scrollEl.scrollTop = Math.min(maxTop, Math.max(0, scrollEl.scrollTop - dy));
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
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleSync) : null;
    const scrollEl = getScrollEl();
    if (resizeObserver && scrollEl) {
      resizeObserver.observe(scrollEl);
      if (scrollEl.firstElementChild) {
        resizeObserver.observe(scrollEl.firstElementChild);
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', scheduleSync);
      vv.removeEventListener('scroll', scheduleSync);
      resizeObserver?.disconnect();
      touchCleanup();

      const overlay = overlayRef?.current;
      const scrollElCleanup = getScrollEl();
      const contentEl = getContentEl();
      if (overlay) {
        overlay.classList.remove('fiche-detail-modal-vv-zoomed');
        overlay.style.removeProperty('--modal-vv-h');
        overlay.style.removeProperty('--modal-vv-w');
        overlay.style.removeProperty('--modal-vv-scale');
        overlay.style.removeProperty('--modal-scroll-max-h');
      }
      if (scrollElCleanup) {
        scrollElCleanup.style.paddingBottom = '';
      }
      if (contentEl) {
        contentEl.style.height = '';
        contentEl.style.maxHeight = '';
      }
    };
  }, [overlayRef, scrollRef, contentRef, enabled]);
}

export default useFicheDetailModalIosScroll;
