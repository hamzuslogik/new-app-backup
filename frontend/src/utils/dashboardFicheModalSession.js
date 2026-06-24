const DASHBOARD_PENDING_FICHE_MODAL_KEY = 'dashboard:pendingFicheModal';

export function stashPendingDashboardFicheModal(state) {
  if (!state?.hash) return;
  try {
    sessionStorage.setItem(DASHBOARD_PENDING_FICHE_MODAL_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function readPendingDashboardFicheModal() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_PENDING_FICHE_MODAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingDashboardFicheModal() {
  try {
    sessionStorage.removeItem(DASHBOARD_PENDING_FICHE_MODAL_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePendingDashboardFicheModal(fromUrlState) {
  if (fromUrlState?.hash) {
    stashPendingDashboardFicheModal(fromUrlState);
    return fromUrlState;
  }
  return readPendingDashboardFicheModal();
}
