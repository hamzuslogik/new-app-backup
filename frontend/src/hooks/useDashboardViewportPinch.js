import { useEffect, useRef } from 'react';

const PINCH_OUT_RATIO = 1.15;
const PINCH_IN_RATIO = 0.85;

function touchDistance(touches) {
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

function touchIsOnDashboard(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('.fiche-detail-modal-overlay')) return false;
  return Boolean(target.closest('.dashboard'));
}

/**
 * Pinch 2 doigts sur le dashboard : écartement → vue tableau desktop,
 * rapprochement → vue mobile. Ne dépend pas du zoom Safari (évite l’UI onglets).
 */
export function useDashboardViewportPinch(enabled, { onPinchOut, onPinchIn }) {
  const stateRef = useRef({ startDist: 0, active: false });

  useEffect(() => {
    if (!enabled) return undefined;

    const onTouchStart = (e) => {
      if (e.touches.length !== 2 || !touchIsOnDashboard(e.target)) {
        stateRef.current = { startDist: 0, active: false };
        return;
      }
      stateRef.current = { startDist: touchDistance(e.touches), active: true };
    };

    const onTouchMove = (e) => {
      if (!stateRef.current.active || e.touches.length !== 2) return;
      if (!touchIsOnDashboard(e.target)) return;

      const start = stateRef.current.startDist;
      const dist = touchDistance(e.touches);
      if (start < 24) return;

      if (dist > start * PINCH_OUT_RATIO) {
        stateRef.current.active = false;
        onPinchOut?.();
        e.preventDefault();
      } else if (dist < start * PINCH_IN_RATIO) {
        stateRef.current.active = false;
        onPinchIn?.();
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      stateRef.current = { startDist: 0, active: false };
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
      document.removeEventListener('touchend', onTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, [enabled, onPinchIn, onPinchOut]);
}
