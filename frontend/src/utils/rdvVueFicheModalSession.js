const RDV_VUE_PENDING_FICHE_MODAL_KEY = 'rdv-vue:pendingFicheModal';

export function stashPendingRdvVueFicheModal(state) {
  if (!state?.hash) return;
  try {
    sessionStorage.setItem(RDV_VUE_PENDING_FICHE_MODAL_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function readPendingRdvVueFicheModal() {
  try {
    const raw = sessionStorage.getItem(RDV_VUE_PENDING_FICHE_MODAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingRdvVueFicheModal() {
  try {
    sessionStorage.removeItem(RDV_VUE_PENDING_FICHE_MODAL_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePendingRdvVueFicheModal(fromUrlState) {
  if (fromUrlState?.hash) {
    stashPendingRdvVueFicheModal(fromUrlState);
    return fromUrlState;
  }
  return readPendingRdvVueFicheModal();
}
