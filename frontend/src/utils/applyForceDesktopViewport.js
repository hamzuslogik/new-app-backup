import { DESKTOP_VIEWPORT_WIDTH } from '../config/viewport';

function isTouchMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function clearDocumentLayoutStyles() {
  document.documentElement.style.minWidth = '';
  document.documentElement.style.width = '';
  document.documentElement.style.maxWidth = '';
  document.documentElement.style.overflow = '';
  if (document.body) {
    document.body.style.minWidth = '';
    document.body.style.width = '';
    document.body.style.maxWidth = '';
    document.body.style.overflow = '';
  }
}

export { isTouchMobileDevice };

export function isMobileNativeExtranetPage() {
  return (
    isTouchMobileDevice() &&
    (document.body?.classList.contains('dashboard-page--mobile-native') ||
      document.body?.classList.contains('planning-commercial-page--mobile-native') ||
      document.body?.classList.contains('rdv-vue-page--mobile-native')) &&
    !document.documentElement.dataset.desktopViewport
  );
}

export const DASHBOARD_TABLE_DESKTOP_VIEW_CLASS = 'dashboard-page--table-desktop-view';

export function isDashboardTableDesktopView() {
  return document.body?.classList.contains(DASHBOARD_TABLE_DESKTOP_VIEW_CLASS);
}

/** Vue mobile (device-width, zoom in par défaut) */
export function applyDashboardMobileView() {
  replaceViewportMeta(
    'width=device-width, initial-scale=1.0, minimum-scale=0.15, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.remove(DASHBOARD_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.remove(DASHBOARD_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

/** Vue tableau desktop (layout 1400px réduit à l’écran) — sans sidebar fixe */
export const DASHBOARD_FICHE_MODAL_SCALE_MULTIPLIER = 0.78;

export function applyDashboardTableDesktopView(width = DESKTOP_VIEWPORT_WIDTH, scaleMultiplier = 1) {
  const content = buildDesktopViewportContent(width, scaleMultiplier);
  if (isTouchMobileDevice()) {
    forceTouchViewportScaleReset(content);
  } else {
    replaceViewportMeta(content);
  }

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.add(DASHBOARD_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.add(DASHBOARD_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

/**
 * iOS : mode tableau 1400px avec zoom out pour voir la page + le modal d'un coup.
 */
export function applyDashboardTableDesktopViewForFicheModal(width = DESKTOP_VIEWPORT_WIDTH) {
  applyDashboardTableDesktopView(width, DASHBOARD_FICHE_MODAL_SCALE_MULTIPLIER);
}

export const PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS = 'planning-commercial-page--table-desktop-view';

export function isPlanningCommercialTableDesktopView() {
  return document.body?.classList.contains(PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS);
}

export function applyPlanningCommercialMobileView() {
  replaceViewportMeta(
    'width=device-width, initial-scale=1.0, minimum-scale=0.15, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.remove(PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.remove(PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

export function applyPlanningCommercialTableDesktopView(width = DESKTOP_VIEWPORT_WIDTH, scaleMultiplier = 1) {
  const content = buildDesktopViewportContent(width, scaleMultiplier);
  if (isTouchMobileDevice()) {
    forceTouchViewportScaleReset(content);
  } else {
    replaceViewportMeta(content);
  }

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.add(PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.add(PLANNING_COMMERCIAL_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

export function applyPlanningCommercialTableDesktopViewForFicheModal(width = DESKTOP_VIEWPORT_WIDTH) {
  applyPlanningCommercialTableDesktopView(width, DASHBOARD_FICHE_MODAL_SCALE_MULTIPLIER);
}

export const RDV_VUE_TABLE_DESKTOP_VIEW_CLASS = 'rdv-vue-page--table-desktop-view';

export function isRdvVueTableDesktopView() {
  return document.body?.classList.contains(RDV_VUE_TABLE_DESKTOP_VIEW_CLASS);
}

export function applyRdvVueMobileView() {
  replaceViewportMeta(
    'width=device-width, initial-scale=1.0, minimum-scale=0.15, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.remove(RDV_VUE_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.remove(RDV_VUE_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

export function applyRdvVueTableDesktopView(width = DESKTOP_VIEWPORT_WIDTH, scaleMultiplier = 1) {
  const content = buildDesktopViewportContent(width, scaleMultiplier);
  if (isTouchMobileDevice()) {
    forceTouchViewportScaleReset(content);
  } else {
    replaceViewportMeta(content);
  }

  delete document.documentElement.dataset.desktopViewport;
  if (document.body) delete document.body.dataset.desktopViewport;

  clearDocumentLayoutStyles();
  document.documentElement.classList.add(RDV_VUE_TABLE_DESKTOP_VIEW_CLASS);
  document.body?.classList.add(RDV_VUE_TABLE_DESKTOP_VIEW_CLASS);

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
      requestAnimationFrame(notifyViewportLayoutChange);
    });
  } else {
    notifyViewportLayoutChange();
  }
}

export function applyRdvVueTableDesktopViewForFicheModal(width = DESKTOP_VIEWPORT_WIDTH) {
  applyRdvVueTableDesktopView(width, DASHBOARD_FICHE_MODAL_SCALE_MULTIPLIER);
}

function notifyViewportLayoutChange() {
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('viewport-layout-change'));
}

function replaceViewportMeta(content) {
  const existing = document.querySelector('meta[name="viewport"]');
  if (isTouchMobileDevice() && existing) {
    existing.setAttribute('content', content);
    void document.documentElement.offsetHeight;
    existing.setAttribute('content', content);
    return;
  }

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

function getMobileScreenWidth() {
  const screenW = window.screen?.width;
  if (screenW && screenW > 0) return screenW;
  const vv = window.visualViewport;
  if (vv && vv.scale > 1.01) return Math.round(vv.width * vv.scale);
  return window.innerWidth || document.documentElement.clientWidth || DESKTOP_VIEWPORT_WIDTH;
}

function getDesktopInitialScale(layoutWidth = DESKTOP_VIEWPORT_WIDTH, scaleMultiplier = 1) {
  const screenW = getMobileScreenWidth();
  if (screenW >= layoutWidth) return 1;
  return Math.min(1, Math.max(0.15, (screenW / layoutWidth) * scaleMultiplier));
}

function buildDesktopViewportContent(width = DESKTOP_VIEWPORT_WIDTH, scaleMultiplier = 1) {
  const scale = getDesktopInitialScale(width, scaleMultiplier);
  const scaleStr = Number(scale.toFixed(4));
  return `width=${width}, initial-scale=${scaleStr}, minimum-scale=0.15, maximum-scale=5, user-scalable=yes, viewport-fit=cover`;
}

/** iOS : verrouiller puis réappliquer le viewport pour annuler un pinch-zoom Safari en cours. */
function forceTouchViewportScaleReset(content) {
  if (!isTouchMobileDevice()) return;

  const scaleMatch = content.match(/initial-scale=([\d.]+)/);
  const lockScale = scaleMatch?.[1] ?? '1';
  const lockContent = content
    .replace(/initial-scale=[^,]+/, `initial-scale=${lockScale}`)
    .replace(/minimum-scale=[^,]+/, `minimum-scale=${lockScale}`)
    .replace(/maximum-scale=[^,]+/, `maximum-scale=${lockScale}`)
    .replace(/user-scalable=[^,]+/, 'user-scalable=no');

  replaceViewportMeta(lockContent);
  void document.documentElement.offsetHeight;
  replaceViewportMeta(content);
  void document.documentElement.offsetHeight;

  document.documentElement.classList.remove('viewport-zoomed');
  document.body?.classList.remove('viewport-zoomed');
  resetScrollPosition();
}

/** Viewport natif mobile (device-width, zoom in par défaut) */
export function applyMobileNativeViewport() {
  applyDashboardMobileView();
}

/** Layout desktop 1400px — toute l'application, y compris la page de connexion */
export function applyForceDesktopViewport(width = DESKTOP_VIEWPORT_WIDTH) {
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

  if (isTouchMobileDevice()) {
    resetScrollPosition();
    requestAnimationFrame(() => {
      resetScrollPosition();
      notifyViewportLayoutChange();
    });
  } else {
    notifyViewportLayoutChange();
  }
}

/** Alias conservé pour main.jsx / ForceDesktopViewport */
export function applyViewportForPath(_pathname) {
  applyForceDesktopViewport();
}
