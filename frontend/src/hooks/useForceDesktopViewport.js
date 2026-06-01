import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

/**
 * Force l'affichage desktop sur mobile (viewport 1400px + data-desktop-viewport).
 * Le nettoyage au démontage est désactivé : le viewport global est géré par main.jsx / ForceDesktopViewport.
 */
const useForceDesktopViewport = (_pageClassName, width = DESKTOP_VIEWPORT_WIDTH) => {
  useEffect(() => {
    applyForceDesktopViewport(width);
  }, [width]);
};

export default useForceDesktopViewport;
