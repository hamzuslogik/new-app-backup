import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

/** Force le viewport desktop ; pas de nettoyage (config globale dans main.jsx). */
const useForceDesktopViewport = (_pageClassName, width = DESKTOP_VIEWPORT_WIDTH) => {
  useEffect(() => {
    applyForceDesktopViewport(width);
  }, [width]);
};

export default useForceDesktopViewport;
