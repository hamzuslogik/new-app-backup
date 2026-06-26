import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyForceDesktopViewport,
  applyMobileNativeViewport,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';

const MOBILE_NATIVE_VIEWPORT_PATHS = new Set(['/login']);

const ForceDesktopViewport = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (isTouchMobileDevice() && MOBILE_NATIVE_VIEWPORT_PATHS.has(pathname)) {
      applyMobileNativeViewport();
      return undefined;
    }
    if (pathname === '/planning-hebdo-ios') {
      delete document.documentElement.dataset.desktopViewport;
      if (document.body) delete document.body.dataset.desktopViewport;
      applyMobileNativeViewport();
      return undefined;
    }
    if (
      isTouchMobileDevice() &&
      (pathname === '/dashboard' ||
        pathname === '/planning-commercial' ||
        pathname === '/rdv-vue')
    ) {
      return undefined;
    }
    applyForceDesktopViewport();
    return undefined;
  }, [pathname]);

  return null;
};

export default ForceDesktopViewport;
