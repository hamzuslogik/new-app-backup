import { useEffect, useLayoutEffect, useRef } from 'react';

const BASE_WIDTH_PCT = 88;
const BASE_HEIGHT_PCT = 82;
/** Plancher bas : le conteneur continue de rétrécir jusqu’à ~×3,4 du zoom initial */
const MIN_WIDTH_PCT = 26;
const MAX_WIDTH_PCT = 96;
const MIN_HEIGHT_PCT = 24;
const MAX_HEIGHT_PCT = 90;
const ZOOM_IN_THRESHOLD = 1.02;
const PAN_THRESHOLD_PX = 2;
const MAX_CENTER_SHIFT_PX = 600;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisualViewport() {
  return window.visualViewport || null;
}

function shouldSyncViewportCenter(vv, baseScale) {
  if (!vv) return false;
  const scale = vv.scale || 1;
  const base = baseScale > 0 ? baseScale : scale;
  const zoomedIn = scale > base * ZOOM_IN_THRESHOLD;
  const panned =
    Math.abs(vv.offsetLeft || 0) > PAN_THRESHOLD_PX ||
    Math.abs(vv.offsetTop || 0) > PAN_THRESHOLD_PX;
  return zoomedIn || panned;
}

/**
 * Décale le conteneur (pas l'overlay) pour le recentrer dans le viewport visible.
 * L'overlay garde inset:0 — évite la disparition du modal sur iOS.
 */
function applyContentVisualViewportCenter(content, baseScale) {
  if (!content) return;

  const vv = getVisualViewport();
  if (!vv || !shouldSyncViewportCenter(vv, baseScale)) {
    content.style.removeProperty('transform');
    return;
  }

  const visualCenterX = (vv.offsetLeft || 0) + vv.width / 2;
  const visualCenterY = (vv.offsetTop || 0) + vv.height / 2;
  const layoutCenterX = window.innerWidth / 2;
  const layoutCenterY = window.innerHeight / 2;

  const dx = clamp(visualCenterX - layoutCenterX, -MAX_CENTER_SHIFT_PX, MAX_CENTER_SHIFT_PX);
  const dy = clamp(visualCenterY - layoutCenterY, -MAX_CENTER_SHIFT_PX, MAX_CENTER_SHIFT_PX);

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    content.style.removeProperty('transform');
    return;
  }

  content.style.setProperty('transform', `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`);
}

function applyModalContentSize(content, baseScale) {
  if (!content) return;

  const vv = getVisualViewport();
  const scale = vv?.scale || 1;
  const base = baseScale > 0 ? baseScale : scale;
  const zoomFactor = scale / base;

  const widthPct = clamp(BASE_WIDTH_PCT / zoomFactor, MIN_WIDTH_PCT, MAX_WIDTH_PCT);
  const heightPct = clamp(BASE_HEIGHT_PCT / zoomFactor, MIN_HEIGHT_PCT, MAX_HEIGHT_PCT);

  content.style.setProperty('--fiche-modal-width-pct', `${Number(widthPct.toFixed(2))}%`);
  content.style.setProperty('--fiche-modal-height-pct', `${Number(heightPct.toFixed(2))}%`);
}

function resetModalContentStyles(content) {
  if (!content) return;
  content.style.removeProperty('--fiche-modal-width-pct');
  content.style.removeProperty('--fiche-modal-height-pct');
  content.style.removeProperty('transform');
}

function applyViewportSync(content, baseScale) {
  applyModalContentSize(content, baseScale);
  applyContentVisualViewportCenter(content, baseScale);
}

/**
 * Pinch Safari natif : zoom page réel + conteneur qui rétrécit et se recentre au zoom in.
 */
export function useFicheDetailModalVisualViewport(overlayRef, contentRef, enabled = false) {
  const baseScaleRef = useRef(1);

  useLayoutEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let retryId = 0;

    const run = () => {
      if (cancelled) return;
      const content = contentRef?.current;
      if (!content) {
        retryId = requestAnimationFrame(run);
        return;
      }
      const vv = getVisualViewport();
      baseScaleRef.current = vv?.scale || 1;
      applyViewportSync(content, baseScaleRef.current);
    };

    run();

    return () => {
      cancelled = true;
      if (retryId) cancelAnimationFrame(retryId);
    };
  }, [enabled, contentRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    const content = contentRef?.current;
    if (!content) return undefined;

    const vv = getVisualViewport();
    baseScaleRef.current = vv?.scale || 1;

    let rafId = 0;
    const sync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = contentRef?.current;
        if (!el) return;
        applyViewportSync(el, baseScaleRef.current);
      });
    };

    sync();

    if (vv) {
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
    }
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
      }
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      resetModalContentStyles(content);
      baseScaleRef.current = 1;
    };
  }, [enabled, contentRef]);
}

export default useFicheDetailModalVisualViewport;
