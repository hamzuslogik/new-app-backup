/** Utilisateurs exclus du module tracking (liste, sidebar, modal). */
export const TRACKING_BLOCKED_USER_IDS = [3896];

/** Fonctions autorisées (admin + RP confirmation) — pas le backoffice (11). */
export const TRACKING_ALLOWED_FUNCTIONS = [1, 7, 13];

export function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function hasTrackingAllowedFunction(user) {
  if (!user?.fonction) return false;
  return TRACKING_ALLOWED_FUNCTIONS.includes(Number(user.fonction));
}

/** Page liste /tracking + entrée sidebar. */
export function canAccessTrackingPage(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return hasTrackingAllowedFunction(user);
}

export function showTrackingInSidebar(user) {
  return canAccessTrackingPage(user);
}

/** Bouton / modal tracking sur Compte rendu. */
export function canManageTrackingFromCompteRendu(user) {
  return canAccessTrackingPage(user);
}
