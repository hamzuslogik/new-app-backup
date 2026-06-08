import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

export const LOGIN_PATH = '/login';

export function isLoginPath(pathname = '') {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === LOGIN_PATH || path.endsWith(LOGIN_PATH);
}

function isTouchMobile() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function replaceViewportMeta(content) {
  document.querySelectorAll('meta[name="viewport"]').forEach((el) => el.remove());
  const viewport = document.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', content);
  document.head.appendChild(viewport);
}

function notifyViewportChange() {
  window.dispatchEvent(new Event('resize'));
}

function resetScrollPosition() {
  window.scrollTo(0, 0);
  const root = document.scrollingElement || document.documentElement;
  if (root) {
    root.scrollLeft = 0;
    root.scrollTop = 0;
  }
  if (document.body) {
    document.body.scrollLeft = 0;
    document.body.scrollTop = 0;
  }
}

function clearDocumentScrollStyles() {
  const props = ['minWidth', 'width', 'maxWidth', 'overflow', 'overflowX', 'overflowY'];
  for (const prop of props) {
    document.documentElement.style[prop] = '';
    if (document.body) document.body.style[prop] = '';
  }
}

/**
 * Échelle initiale pour voir toute la largeur desktop à l'écran (pas de zoom avant).
 * Sur PC : 1. Sur mobile : largeur écran / 1400.
 */
function getDesktopInitialScale(layoutWidth = DESKTOP_VIEWPORT_WIDTH) {
  const screenW =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    window.screen?.width ||
    layoutWidth;

  if (screenW >= layoutWidth) return 1;

  return Math.min(1, Math.max(0.15, screenW / layoutWidth));
}

function buildDesktopViewportContent(width = DESKTOP_VIEWPORT_WIDTH) {
  const scale = getDesktopInitialScale(width);
  const scaleStr = Number(scale.toFixed(4));
  return `width=${width}, initial-scale=${scaleStr}, minimum-scale=0.15, maximum-scale=5, user-scalable=yes, viewport-fit=cover`;
}

/** iOS / Android : réinitialise le zoom visuel avant le passage en layout desktop */
function resetTouchZoomBeforeDesktop() {
  if (!isTouchMobile()) return;
  replaceViewportMeta(
    'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );
  void document.documentElement.offsetHeight;
  if (document.body) void document.body.offsetHeight;
}

/** Viewport mobile natif — page de connexion iOS / Android */
export function applyMobileViewport() {
  replaceViewportMeta(
    'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentScrollStyles();

  document.documentElement.classList.add('login-page');
  if (document.body) document.body.classList.add('login-page');

  resetScrollPosition();
  notifyViewportChange();
}

/** Layout desktop 1400px — vue d'ensemble à l'écran dès le chargement (iOS / Android) */
export function applyForceDesktopViewport(width = DESKTOP_VIEWPORT_WIDTH) {
  if (document.documentElement.classList.contains('login-page')) {
    resetTouchZoomBeforeDesktop();
  }

  replaceViewportMeta(buildDesktopViewportContent(width));

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

  resetScrollPosition();

  requestAnimationFrame(() => {
    resetScrollPosition();
    notifyViewportChange();
  });
}

export function applyViewportForPath(pathname) {
  if (isLoginPath(pathname)) {
    applyMobileViewport();
  } else {
    applyForceDesktopViewport();
  }
}
