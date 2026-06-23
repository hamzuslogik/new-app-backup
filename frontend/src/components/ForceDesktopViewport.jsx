import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyForceDesktopViewport,
  applyDashboardMobileViewport,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';

const MOBILE_NATIVE_VIEWPORT_PATHS = new Set(['/dashboard']);

const ForceDesktopViewport = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (isTouchMobileDevice() && MOBILE_NATIVE_VIEWPORT_PATHS.has(pathname)) {
      applyDashboardMobileViewport();
      return undefined;
    }
    applyForceDesktopViewport();
    return undefined;
  }, [pathname]);

  return null;
};

export default ForceDesktopViewport;
