/** Utilisateurs exclus du module tracking (liste, sidebar, modal). */
export const TRACKING_BLOCKED_USER_IDS = [3896];

/** Tracking réservé à la session backoffice uniquement. */
export const TRACKING_FONCTION_BACKOFFICE = 11;

export function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function isBackofficeTrackingUser(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return Number(user.fonction) === TRACKING_FONCTION_BACKOFFICE;
}

/** Page liste /tracking + entrée sidebar. */
export function canAccessTrackingPage(user) {
  return isBackofficeTrackingUser(user);
}

export function showTrackingInSidebar(user) {
  return canAccessTrackingPage(user);
}

/** Bouton / modal tracking sur Compte rendu (tous statuts CR). */
export function canManageTrackingFromCompteRendu(user) {
  return isBackofficeTrackingUser(user);
}
