import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

function applyLayoutMinWidth(width = DESKTOP_VIEWPORT_WIDTH) {
  document.documentElement.style.minWidth = `${width}px`;
  document.documentElement.style.width = 'auto';
  document.documentElement.style.maxWidth = 'none';
  document.documentElement.style.overflowX = 'auto';
  if (document.body) {
    document.body.style.minWidth = `${width}px`;
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'auto';
  }
}

/** iPhone : pas de zoom initial — largeur device + défilement horizontal via min-width CSS */
export function applyDeviceWidthViewport(layoutMinWidth = DESKTOP_VIEWPORT_WIDTH) {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, viewport-fit=cover'
  );

  document.documentElement.dataset.desktopViewport = 'device';
  if (document.body) {
    document.body.dataset.desktopViewport = 'device';
  }

  applyLayoutMinWidth(layoutMinWidth);
}

export function applyForceDesktopViewport(width = DESKTOP_VIEWPORT_WIDTH) {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    `width=${width}, viewport-fit=cover`
  );

  document.documentElement.dataset.desktopViewport = String(width);
  if (document.body) {
    document.body.dataset.desktopViewport = String(width);
  }

  applyLayoutMinWidth(width);
}
