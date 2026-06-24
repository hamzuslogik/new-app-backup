import { useCallback, useEffect, useRef } from 'react';

const MIN_ZOOM = 0.9;
const MAX_ZOOM = 1.65;
const DEFAULT_ZOOM = 1;
const BASE_WIDTH_PCT = 88;
const BASE_HEIGHT_PCT = 82;

function touchDistance(touches) {
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyPinchVars(contentEl, zoom) {
  if (!contentEl) return;
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const widthPct = clamp(BASE_WIDTH_PCT / z, 52, 96);
  const heightPct = clamp(BASE_HEIGHT_PCT / z, 48, 90);
  contentEl.style.setProperty('--fiche-modal-zoom', String(Number(z.toFixed(3))));
  contentEl.style.setProperty('--fiche-modal-width-pct', `${Number(widthPct.toFixed(2))}%`);
  contentEl.style.setProperty('--fiche-modal-height-pct', `${Number(heightPct.toFixed(2))}%`);
}

function resetPinchVars(contentEl) {
  if (!contentEl) return;
  contentEl.style.removeProperty('--fiche-modal-zoom');
  contentEl.style.removeProperty('--fiche-modal-width-pct');
  contentEl.style.removeProperty('--fiche-modal-height-pct');
}

/**
 * Pinch 2 doigts : zoom in → contenu plus grand, conteneur plus petit (H + L).
 * Zoom out → l'inverse. Marges overlay conservées.
 */
export function useFicheDetailModalPinchZoom(overlayRef, contentRef, enabled = false) {
  const zoomRef = useRef(DEFAULT_ZOOM);
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: DEFAULT_ZOOM });

  const applyZoom = useCallback((zoom) => {
    zoomRef.current = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    applyPinchVars(contentRef.current, zoomRef.current);
  }, [contentRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const overlay = overlayRef?.current;
    const content = contentRef?.current;
    if (!overlay || !content) return undefined;

    applyZoom(DEFAULT_ZOOM);

    const onTouchStart = (e) => {
      if (e.touches.length !== 2) {
        pinchRef.current = { active: false, startDist: 0, startZoom: zoomRef.current };
        return;
      }
      pinchRef.current = {
        active: true,
        startDist: touchDistance(e.touches),
        startZoom: zoomRef.current,
      };
    };

    const onTouchMove = (e) => {
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      const startDist = pinchRef.current.startDist;
      if (startDist < 20) return;

      const ratio = touchDistance(e.touches) / startDist;
      applyZoom(pinchRef.current.startZoom * ratio);
      e.preventDefault();
    };

    const onTouchEnd = () => {
      pinchRef.current = { active: false, startDist: 0, startZoom: zoomRef.current };
    };

    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });
    overlay.addEventListener('touchend', onTouchEnd, { passive: true });
    overlay.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      overlay.removeEventListener('touchstart', onTouchStart);
      overlay.removeEventListener('touchmove', onTouchMove);
      overlay.removeEventListener('touchend', onTouchEnd);
      overlay.removeEventListener('touchcancel', onTouchEnd);
      resetPinchVars(content);
      zoomRef.current = DEFAULT_ZOOM;
    };
  }, [enabled, overlayRef, contentRef, applyZoom]);
}

export default useFicheDetailModalPinchZoom;
