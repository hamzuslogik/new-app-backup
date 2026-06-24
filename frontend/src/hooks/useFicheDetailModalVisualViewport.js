import { useEffect, useLayoutEffect, useRef } from 'react';

const BASE_WIDTH_PCT = 88;
const BASE_HEIGHT_PCT = 82;
const MIN_WIDTH_PCT = 52;
const MAX_WIDTH_PCT = 96;
const MIN_HEIGHT_PCT = 48;
const MAX_HEIGHT_PCT = 90;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisualViewport() {
  return window.visualViewport || null;
}

function applyModalLayout(overlay, content, baseScale) {
  const vv = getVisualViewport();
  if (!vv || !overlay || !content) return;
  if (vv.width < 80 || vv.height < 80) return;

  const scale = vv.scale || 1;
  const base = baseScale > 0 ? baseScale : scale;
  const zoomFactor = scale / base;

  const widthPct = clamp(BASE_WIDTH_PCT / zoomFactor, MIN_WIDTH_PCT, MAX_WIDTH_PCT);
  const heightPct = clamp(BASE_HEIGHT_PCT / zoomFactor, MIN_HEIGHT_PCT, MAX_HEIGHT_PCT);

  overlay.style.top = `${vv.offsetTop}px`;
  overlay.style.left = `${vv.offsetLeft}px`;
  overlay.style.width = `${vv.width}px`;
  overlay.style.height = `${vv.height}px`;
  overlay.style.right = 'auto';
  overlay.style.bottom = 'auto';

  content.style.setProperty('--fiche-modal-width-pct', `${Number(widthPct.toFixed(2))}%`);
  content.style.setProperty('--fiche-modal-height-pct', `${Number(heightPct.toFixed(2))}%`);
}

function resetModalLayout(overlay, content) {
  if (overlay) {
    overlay.style.removeProperty('top');
    overlay.style.removeProperty('left');
    overlay.style.removeProperty('width');
    overlay.style.removeProperty('height');
    overlay.style.removeProperty('right');
    overlay.style.removeProperty('bottom');
  }
  if (content) {
    content.style.removeProperty('--fiche-modal-width-pct');
    content.style.removeProperty('--fiche-modal-height-pct');
  }
}

/**
 * Pinch Safari natif (visualViewport) : zoom page réel + conteneur modal qui rétrécit.
 */
export function useFicheDetailModalVisualViewport(overlayRef, contentRef, enabled = false) {
  const baseScaleRef = useRef(1);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const overlay = overlayRef?.current;
    const content = contentRef?.current;
    if (!overlay || !content) return undefined;
    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;
    applyModalLayout(overlay, content, baseScaleRef.current);
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
        applyModalLayout(overlay, content, baseScaleRef.current);
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
      resetModalLayout(overlay, content);
      baseScaleRef.current = 1;
    };
  }, [enabled, overlayRef, contentRef]);
}

export default useFicheDetailModalVisualViewport;
