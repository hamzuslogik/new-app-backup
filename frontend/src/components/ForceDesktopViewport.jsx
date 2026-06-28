import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyForceDesktopViewport,
  applyLoginDesktopViewport,
  applyMobileNativeViewport,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';

const MOBILE_NATIVE_VIEWPORT_PATHS = new Set(['/login']);

function setLoginPageClass(active) {
  if (active) {
    document.documentElement.classList.add('login-page');
    document.body.classList.add('login-page');
  } else {
    document.documentElement.classList.remove('login-page');
    document.body.classList.remove('login-page');
  }
}

const ForceDesktopViewport = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const isLogin = pathname === '/login';
    setLoginPageClass(isLogin);

    if (isLogin) {
      if (isTouchMobileDevice()) {
        applyMobileNativeViewport();
      } else {
        applyLoginDesktopViewport();
      }
      return undefined;
    }

    if (
      isTouchMobileDevice() &&
      (pathname === '/dashboard' ||
        pathname === '/planning-commercial' ||
        pathname === '/rdv-vue' ||
        pathname === '/planning-hebdomadaire' ||
        pathname === '/planning-hebdo-ios')
    ) {
      return undefined;
    }
    applyForceDesktopViewport();
    return undefined;
  }, [pathname]);

  return null;
};

export default ForceDesktopViewport;
