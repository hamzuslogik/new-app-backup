import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

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
    html.style.minWidth = `${DESKTOP_VIEWPORT_WIDTH}px`;
    html.style.width = 'auto';
    if (body) {
      body.style.minWidth = `${DESKTOP_VIEWPORT_WIDTH}px`;
      body.style.width = 'auto';
    }
  }
}

function scheduleSync() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    applyZoomedDocumentStyles(isZoomed());
  });
}

/**
 * Après pinch-zoom : classe CSS uniquement (pas de touch handlers ni sync scroll).
 * Le scroll reste 100 % natif pour éviter les saccades avec ou sans zoom.
 */
export function initViewportZoomScrollFix() {
  if (!isTouchMobile() || !getVisualViewport()) return () => {};

  const vv = getVisualViewport();

  const onViewportResize = () => scheduleSync();

  vv.addEventListener('resize', onViewportResize);
  window.addEventListener('orientationchange', onViewportResize);

  scheduleSync();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    vv.removeEventListener('resize', onViewportResize);
    window.removeEventListener('orientationchange', onViewportResize);
    applyZoomedDocumentStyles(false);
  };
}
