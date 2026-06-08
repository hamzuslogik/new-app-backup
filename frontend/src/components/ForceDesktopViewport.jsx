import { useLayoutEffect } from 'react';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

const ForceDesktopViewport = () => {
  useLayoutEffect(() => {
    applyForceDesktopViewport();
  }, []);

  return null;
};

export default ForceDesktopViewport;
