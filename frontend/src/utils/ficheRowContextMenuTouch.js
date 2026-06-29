import { useCallback, useEffect, useRef } from 'react';

const LONG_PRESS_MS = 520;
const MOVE_THRESHOLD_PX = 12;

/**
 * iOS Safari : pas d'événement contextmenu au clic droit tactile.
 * Appui long sur la ligne → menu contextuel fiche.
 */
export function useFicheRowContextMenuTouch(openFicheContextMenu) {
  const timerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const longPressOpenedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const bindFicheRowContextMenu = useCallback(
    (fiche, { enabled = true } = {}) => {
      if (!enabled) {
        return {};
      }

      return {
        onContextMenu: (e) => {
          if (longPressOpenedRef.current) {
            e.preventDefault();
            longPressOpenedRef.current = false;
            return;
          }
          openFicheContextMenu(e, fiche);
        },
        onTouchStart: (e) => {
          if (e.touches.length !== 1) return;
          if (e.target.closest?.('.btn-detail, button, a, input, select, textarea')) return;
          longPressOpenedRef.current = false;
          touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
          clearTimer();
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            longPressOpenedRef.current = true;
            openFicheContextMenu(
              {
                preventDefault: () => {},
                stopPropagation: () => {},
                clientX: touchStartRef.current.x,
                clientY: touchStartRef.current.y,
              },
              fiche
            );
            if (typeof navigator.vibrate === 'function') {
              navigator.vibrate(12);
            }
          }, LONG_PRESS_MS);
        },
        onTouchMove: (e) => {
          if (timerRef.current == null || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - touchStartRef.current.x;
          const dy = e.touches[0].clientY - touchStartRef.current.y;
          if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
            clearTimer();
          }
        },
        onTouchEnd: clearTimer,
        onTouchCancel: clearTimer,
      };
    },
    [clearTimer, openFicheContextMenu]
  );

  return { bindFicheRowContextMenu };
}

/** Fermeture menu : éviter click (iOS) qui referme immédiatement le menu. */
export function useFicheContextMenuDismiss(ficheContextMenu, setFicheContextMenu, menuSelector = '.dashboard-fiche-context-menu') {
  useEffect(() => {
    if (!ficheContextMenu) return undefined;

    const dismiss = (ev) => {
      if (ficheContextMenu.openedAt && Date.now() - ficheContextMenu.openedAt < 400) return;
      if (ev.target.closest?.(menuSelector)) return;
      setFicheContextMenu(null);
    };

    const onKey = (ev) => {
      if (ev.key === 'Escape') setFicheContextMenu(null);
    };

    document.addEventListener('mousedown', dismiss);
    document.addEventListener('touchstart', dismiss, { passive: true });
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, [ficheContextMenu, menuSelector, setFicheContextMenu]);
}
