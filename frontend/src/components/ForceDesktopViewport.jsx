import { useEffect } from 'react';
import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';
import { applyForceDesktopViewport } from '../utils/applyForceDesktopViewport';

const ForceDesktopViewport = () => {
  useEffect(() => {
    applyForceDesktopViewport(DESKTOP_VIEWPORT_WIDTH);
  }, []);

  return null;
};

export default ForceDesktopViewport;
