import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyForceDesktopViewport,
  applyMobileNativeViewport,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';

const MOBILE_NATIVE_VIEWPORT_PATHS = new Set(['/login']);

const MOBILE_EXTRANET_PATHS = new Set(['/dashboard', '/planning-commercial', '/rdv-vue']);
const RDV_VUE_OPEN_FICHE_PARAM = 'openFiche';

const ForceDesktopViewport = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (isTouchMobileDevice() && MOBILE_NATIVE_VIEWPORT_PATHS.has(pathname)) {
      applyMobileNativeViewport();
      return undefined;
    }
    if (isTouchMobileDevice() && MOBILE_EXTRANET_PATHS.has(pathname)) {
      const openFiche = new URLSearchParams(window.location.search).get(RDV_VUE_OPEN_FICHE_PARAM);
      if (openFiche) {
        return undefined;
      }
      applyMobileNativeViewport();
      return undefined;
    }
    applyForceDesktopViewport();
    return undefined;
  }, [pathname]);

  return null;
};

export default ForceDesktopViewport;
