import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import {
  applyDeviceWidthViewport,
  applyForceDesktopViewport,
} from '../utils/applyForceDesktopViewport';

/**
 * @param {string} [pageClassName]
 * @param {number | { width?: number, viewportMode?: 'fixed' | 'device' }} [widthOrOptions]
 */
const useForceDesktopViewport = (pageClassName, widthOrOptions = DESKTOP_VIEWPORT_WIDTH) => {
  const options =
    typeof widthOrOptions === 'number'
      ? { width: widthOrOptions, viewportMode: 'fixed' }
      : { width: DESKTOP_VIEWPORT_WIDTH, viewportMode: 'fixed', ...widthOrOptions };

  const { width, viewportMode } = options;

  useEffect(() => {
    if (viewportMode === 'device') {
      applyDeviceWidthViewport(width);
    } else {
      applyForceDesktopViewport(width);
    }

    if (!pageClassName) return undefined;

    document.documentElement.classList.add(pageClassName);
    document.body.classList.add(pageClassName);

    return () => {
      document.documentElement.classList.remove(pageClassName);
      document.body.classList.remove(pageClassName);
      applyForceDesktopViewport(width);
    };
  }, [pageClassName, width, viewportMode]);
};

export default useForceDesktopViewport;
