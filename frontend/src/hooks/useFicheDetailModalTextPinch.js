import { useCallback, useEffect, useRef } from 'react';

const MIN_SCALE = 0.9;
const MAX_SCALE = 1.6;
const DEFAULT_SCALE = 1;

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

function applyTextScale(zoomInnerEl, scale) {
  if (!zoomInnerEl) return;
  const s = clamp(scale, MIN_SCALE, MAX_SCALE);
  zoomInnerEl.style.setProperty('--fiche-modal-text-scale', String(Number(s.toFixed(3))));
}

function resetTextScale(zoomInnerEl) {
  if (!zoomInnerEl) return;
  zoomInnerEl.style.removeProperty('--fiche-modal-text-scale');
}

/**
 * Pinch 2 doigts sur le modal : agrandit / réduit le texte et le contenu
 * sans changer la taille du conteneur.
 */
export function useFicheDetailModalTextPinch(overlayRef, zoomInnerRef, enabled = false) {
  const scaleRef = useRef(DEFAULT_SCALE);
  const pinchRef = useRef({ active: false, startDist: 0, startScale: DEFAULT_SCALE });

  const applyScale = useCallback((scale) => {
    scaleRef.current = clamp(scale, MIN_SCALE, MAX_SCALE);
    applyTextScale(zoomInnerRef.current, scaleRef.current);
  }, [zoomInnerRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const overlay = overlayRef?.current;
    const zoomInner = zoomInnerRef?.current;
    if (!overlay || !zoomInner) return undefined;

    applyScale(DEFAULT_SCALE);

    const onTouchStart = (e) => {
      if (e.touches.length !== 2) {
        pinchRef.current = { active: false, startDist: 0, startScale: scaleRef.current };
        return;
      }
      pinchRef.current = {
        active: true,
        startDist: touchDistance(e.touches),
        startScale: scaleRef.current,
      };
    };

    const onTouchMove = (e) => {
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      const startDist = pinchRef.current.startDist;
      if (startDist < 20) return;

      const ratio = touchDistance(e.touches) / startDist;
      applyScale(pinchRef.current.startScale * ratio);
      e.preventDefault();
    };

    const onTouchEnd = () => {
      pinchRef.current = { active: false, startDist: 0, startScale: scaleRef.current };
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
      resetTextScale(zoomInner);
      scaleRef.current = DEFAULT_SCALE;
    };
  }, [enabled, overlayRef, zoomInnerRef, applyScale]);
}

export default useFicheDetailModalTextPinch;
