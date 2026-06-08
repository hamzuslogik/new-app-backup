import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyViewportForPath } from '../utils/applyForceDesktopViewport';

const ForceDesktopViewport = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    applyViewportForPath(pathname);
  }, [pathname]);

  return null;
};

export default ForceDesktopViewport;
