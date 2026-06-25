import { useEffect, useLayoutEffect, useRef } from 'react';

const BASE_WIDTH_PCT = 88;
const BASE_HEIGHT_PCT = 82;
/** Plancher bas : le conteneur continue de rétrécir jusqu’à ~×3,4 du zoom initial */
const MIN_WIDTH_PCT = 26;
const MAX_WIDTH_PCT = 96;
const MIN_HEIGHT_PCT = 24;
const MAX_HEIGHT_PCT = 90;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisualViewport() {
  return window.visualViewport || null;
}

/** Cadre overlay = viewport visible (pinch Safari) pour garder le modal centré à l'écran. */
function applyOverlayViewportFrame(overlay) {
  if (!overlay) return;

  const vv = getVisualViewport();
  if (!vv) return;

  const top = Number(vv.offsetTop) || 0;
  const left = Number(vv.offsetLeft) || 0;
  const width = Number(vv.width) || window.innerWidth;
  const height = Number(vv.height) || window.innerHeight;

  overlay.style.setProperty('top', `${top}px`);
  overlay.style.setProperty('left', `${left}px`);
  overlay.style.setProperty('width', `${width}px`);
  overlay.style.setProperty('height', `${height}px`);
  overlay.style.setProperty('right', 'auto');
  overlay.style.setProperty('bottom', 'auto');
}

function resetOverlayViewportFrame(overlay) {
  if (!overlay) return;
  ['top', 'left', 'width', 'height', 'right', 'bottom'].forEach((prop) => {
    overlay.style.removeProperty(prop);
  });
}

/** Ajuste la taille du conteneur — l'overlay suit le viewport visible via applyOverlayViewportFrame. */
function applyModalContentSize(content, baseScale) {
  if (!content) return;

  const vv = getVisualViewport();
  const scale = vv?.scale || 1;
  const base = baseScale > 0 ? baseScale : scale;
  const zoomFactor = scale / base;

  const widthPct = clamp(BASE_WIDTH_PCT / zoomFactor, MIN_WIDTH_PCT, MAX_WIDTH_PCT);
  const heightPct = clamp(BASE_HEIGHT_PCT / zoomFactor, MIN_HEIGHT_PCT, MAX_HEIGHT_PCT);

  content.style.setProperty('--fiche-modal-width-pct', `${Number(widthPct.toFixed(2))}%`);
  content.style.setProperty('--fiche-modal-height-pct', `${Number(heightPct.toFixed(2))}%`);
}

function resetModalContentSize(content) {
  if (!content) return;
  content.style.removeProperty('--fiche-modal-width-pct');
  content.style.removeProperty('--fiche-modal-height-pct');
}

/**
 * Pinch Safari natif (visualViewport) : zoom page réel + overlay calé sur l'écran visible + conteneur qui rétrécit.
 */
export function useFicheDetailModalVisualViewport(overlayRef, contentRef, enabled = false) {
  const baseScaleRef = useRef(1);

  const applySync = (overlay, content) => {
    if (overlay) applyOverlayViewportFrame(overlay);
    if (content) applyModalContentSize(content, baseScaleRef.current);
  };

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const overlay = overlayRef?.current;
    const content = contentRef?.current;
    if (!overlay || !content) return undefined;
    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;
    applySync(overlay, content);
    return undefined;
  }, [enabled, overlayRef, contentRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const overlay = overlayRef?.current;
    const content = contentRef?.current;
    if (!overlay || !content) return undefined;

    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;

    let rafId = 0;
    const sync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applySync(overlay, content);
      });
    };

    sync();

    if (vv) {
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
    }
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
      }
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      resetOverlayViewportFrame(overlay);
      resetModalContentSize(content);
      baseScaleRef.current = 1;
    };
  }, [enabled, overlayRef, contentRef]);
}

export default useFicheDetailModalVisualViewport;
