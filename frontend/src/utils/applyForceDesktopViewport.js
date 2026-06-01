import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

/**
 * Applique le viewport desktop (meta width fixe + data-attribute + styles min-width).
 * Appelé au démarrage (main.jsx) et via le hook useForceDesktopViewport.
 */
export function applyForceDesktopViewport(width = DESKTOP_VIEWPORT_WIDTH) {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', `width=${width}`);

  document.documentElement.dataset.desktopViewport = String(width);
  if (document.body) {
    document.body.dataset.desktopViewport = String(width);
  }

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
