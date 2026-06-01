import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

/** Garantit le viewport desktop pour toute la session React (routes login incluses). */
const ForceDesktopViewport = () => {
  useEffect(() => {
    applyForceDesktopViewport(DESKTOP_VIEWPORT_WIDTH);
    if (!document.body.dataset.desktopViewport) {
      document.body.dataset.desktopViewport = String(DESKTOP_VIEWPORT_WIDTH);
    }
  }, []);

  return null;
};

export default ForceDesktopViewport;
