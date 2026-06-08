import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

export const LOGIN_PATH = '/login';

export function isLoginPath(pathname = '') {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === LOGIN_PATH || path.endsWith(LOGIN_PATH);
}

function clearDocumentScrollStyles() {
  const props = ['minWidth', 'width', 'maxWidth', 'overflow', 'overflowX', 'overflowY'];
  for (const prop of props) {
    document.documentElement.style[prop] = '';
    if (document.body) document.body.style[prop] = '';
  }
}

/** Viewport mobile natif — page de connexion iOS / Android */
export function applyMobileViewport() {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentScrollStyles();

  document.documentElement.classList.add('login-page');
  if (document.body) document.body.classList.add('login-page');
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
    `width=${width}, initial-scale=1, minimum-scale=0.25, maximum-scale=5, user-scalable=yes, viewport-fit=cover`
  );

  document.documentElement.dataset.desktopViewport = String(width);
  if (document.body) {
    document.body.dataset.desktopViewport = String(width);
  }

  document.documentElement.classList.remove('login-page');
  if (document.body) document.body.classList.remove('login-page');

  document.documentElement.style.minWidth = `${width}px`;
  document.documentElement.style.width = 'auto';
  document.documentElement.style.maxWidth = 'none';
  document.documentElement.style.overflow = 'auto';
  if (document.body) {
    document.body.style.minWidth = `${width}px`;
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflow = 'auto';
  }
}

export function applyViewportForPath(pathname) {
  if (isLoginPath(pathname)) {
    applyMobileViewport();
  } else {
    applyForceDesktopViewport();
  }
}
