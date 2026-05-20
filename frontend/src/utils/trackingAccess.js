/** Utilisateurs exclus de la page liste /tracking (pas du bouton Compte rendu). */
export const TRACKING_BLOCKED_USER_IDS = [3896];

/** Tracking réservé à la session backoffice uniquement. */
export const TRACKING_FONCTION_BACKOFFICE = 11;

export function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

export function isBackofficeFonction(user) {
  return Number(user?.fonction) === TRACKING_FONCTION_BACKOFFICE;
}

/** Page liste /tracking + sidebar (backoffice, sauf utilisateurs exclus). */
export function canAccessTrackingPage(user) {
  if (!user || !isBackofficeFonction(user) || isTrackingBlockedUser(user)) return false;
  return true;
}

export function showTrackingInSidebar(user) {
  return canAccessTrackingPage(user);
}

/** Bouton / modal sur Compte rendu : tous les utilisateurs fonction 11. */
export function canManageTrackingFromCompteRendu(user) {
  return !!user && isBackofficeFonction(user);
}
