import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

/** Force le viewport desktop ; applique aussi la classe page sur html/body si fournie. */
const useForceDesktopViewport = (pageClassName, width = DESKTOP_VIEWPORT_WIDTH) => {
  useEffect(() => {
    applyForceDesktopViewport(width);

    if (!pageClassName) return undefined;

    document.documentElement.classList.add(pageClassName);
    document.body.classList.add(pageClassName);

    return () => {
      document.documentElement.classList.remove(pageClassName);
      document.body.classList.remove(pageClassName);
    };
  }, [pageClassName, width]);
};

export default useForceDesktopViewport;
