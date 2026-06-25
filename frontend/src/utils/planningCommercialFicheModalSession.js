const PLANNING_PENDING_FICHE_MODAL_KEY = 'planning-commercial:pendingFicheModal';

export function stashPendingPlanningCommercialFicheModal(state) {
  if (!state?.hash) return;
  try {
    sessionStorage.setItem(PLANNING_PENDING_FICHE_MODAL_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function readPendingPlanningCommercialFicheModal() {
  try {
    const raw = sessionStorage.getItem(PLANNING_PENDING_FICHE_MODAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingPlanningCommercialFicheModal() {
  try {
    sessionStorage.removeItem(PLANNING_PENDING_FICHE_MODAL_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePendingPlanningCommercialFicheModal(fromUrlState) {
  if (fromUrlState?.hash) {
    stashPendingPlanningCommercialFicheModal(fromUrlState);
    return fromUrlState;
  }
  return readPendingPlanningCommercialFicheModal();
}
