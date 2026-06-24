import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { isMobileNativeExtranetPage } from './applyForceDesktopViewport';

const ZOOM_THRESHOLD = 1.01;
let rafId = 0;

function isTouchMobile() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function getVisualViewport() {
  return window.visualViewport || null;
}

function isZoomed() {
  const vv = getVisualViewport();
  return Boolean(vv && vv.scale > ZOOM_THRESHOLD);
}

function applyZoomedDocumentStyles(zoomed) {
  const html = document.documentElement;
  const body = document.body;
  if (!html) return;

  if (zoomed) {
    html.classList.add('viewport-zoomed');
    html.style.overflow = '';
    html.style.overflowX = '';
    html.style.overflowY = '';
    if (body) {
      body.style.overflow = '';
      body.style.overflowX = '';
      body.style.overflowY = '';
    }
  } else {
    html.classList.remove('viewport-zoomed');
    html.style.overflow = '';
    html.style.overflowX = '';
    html.style.overflowY = '';
    if (body) {
      body.style.overflow = '';
      body.style.overflowX = '';
      body.style.overflowY = '';
    }
    if (!isMobileNativeExtranetPage()) {
      html.style.minWidth = `${DESKTOP_VIEWPORT_WIDTH}px`;
      html.style.width = 'auto';
      if (body) {
        body.style.minWidth = `${DESKTOP_VIEWPORT_WIDTH}px`;
        body.style.width = 'auto';
      }
    } else {
      html.style.minWidth = '';
      html.style.width = '';
      if (body) {
        body.style.minWidth = '';
        body.style.width = '';
      }
    }
  }
}

/**
 * iOS / Android : après pinch-zoom, le pan horizontal du visual viewport
 * ne met plus à jour window.scrollX. On synchronise uniquement l'axe X.
 */
function syncHorizontalScrollFromVisualViewport() {
  const vv = getVisualViewport();
  if (!vv || !isZoomed()) return;

  const left = Math.max(0, vv.pageLeft ?? vv.offsetLeft ?? 0);

  if (Math.abs(window.scrollX - left) > 0.5) {
    window.scrollTo(left, window.scrollY);
  }
}

function scheduleSync() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    applyZoomedDocumentStyles(isZoomed());
    syncHorizontalScrollFromVisualViewport();
  });
}

/**
 * Après pinch-zoom : CSS + sync horizontal uniquement.
 * Le vertical et les gestes verticaux restent 100 % natifs.
 */
export function initViewportZoomScrollFix() {
  if (!isTouchMobile() || !getVisualViewport()) return () => {};

  const vv = getVisualViewport();

  const onViewportChange = () => scheduleSync();
  const onOrientationChange = () => scheduleSync();

  vv.addEventListener('resize', onViewportChange);
  vv.addEventListener('scroll', onViewportChange);
  window.addEventListener('orientationchange', onOrientationChange);

  scheduleSync();

  let panLastX = 0;
  let panLastY = 0;
  let panActive = false;

  const shouldPanDocument = (target) => {
    if (!(target instanceof Element)) return true;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return false;
    if (target.closest('.fiche-detail-modal-content')) return false;
    if (isZoomed() && target.closest('.fiche-detail-modal-overlay--viewport-sync')) return true;
    if (target.closest('.fiche-detail-modal-overlay')) return false;
    return true;
  };

  const onTouchStart = (e) => {
    if (!isZoomed() || e.touches.length !== 1) {
      panActive = false;
      return;
    }
    panLastX = e.touches[0].clientX;
    panLastY = e.touches[0].clientY;
    panActive = shouldPanDocument(e.target);
  };

  const onTouchMove = (e) => {
    if (!panActive || !isZoomed() || e.touches.length !== 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - panLastX;
    const dy = y - panLastY;
    panLastX = x;
    panLastY = y;

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    // Vertical : scroll natif (ne pas intercepter)
    if (Math.abs(dy) >= Math.abs(dx)) return;

    const scrollEl = document.scrollingElement || document.documentElement;
    const maxScrollX = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    const nextX = Math.max(0, Math.min(maxScrollX, window.scrollX - dx));
    if (Math.abs(nextX - window.scrollX) > 0.5) {
      window.scrollTo(nextX, window.scrollY);
    }
    e.preventDefault();
  };

  const onTouchEnd = () => {
    panActive = false;
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    vv.removeEventListener('resize', onViewportChange);
    vv.removeEventListener('scroll', onViewportChange);
    window.removeEventListener('orientationchange', onOrientationChange);
    document.removeEventListener('touchstart', onTouchStart, { capture: true });
    document.removeEventListener('touchmove', onTouchMove, { capture: true });
    document.removeEventListener('touchend', onTouchEnd, { capture: true });
    document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    applyZoomedDocumentStyles(false);
  };
}
