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

/** Ajuste uniquement la taille du conteneur — l'overlay reste plein écran (inset: 0). */
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
 * Pinch Safari natif (visualViewport) : zoom page réel + conteneur modal qui rétrécit.
 */
export function useFicheDetailModalVisualViewport(overlayRef, contentRef, enabled = false) {
  const baseScaleRef = useRef(1);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const content = contentRef?.current;
    if (!content) return undefined;
    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;
    applyModalContentSize(content, baseScaleRef.current);
    return undefined;
  }, [enabled, contentRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const content = contentRef?.current;
    if (!content) return undefined;

    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;

    let rafId = 0;
    const sync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applyModalContentSize(content, baseScaleRef.current);
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
      resetModalContentSize(content);
      baseScaleRef.current = 1;
    };
  }, [enabled, contentRef]);
}

export default useFicheDetailModalVisualViewport;
