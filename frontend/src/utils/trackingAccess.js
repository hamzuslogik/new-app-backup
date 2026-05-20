/** Utilisateurs exclus du module tracking (liste + modal). */
export const TRACKING_BLOCKED_USER_IDS = [3896];

/** Session backoffice = fonction 11. */
export function isBackofficeFonction(fonction) {
  return Number(fonction) === 11;
}

export function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

/** Page liste /tracking : URL directe uniquement, pas de menu latéral. */
export function canAccessTrackingPage(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return isBackofficeFonction(user.fonction);
}

/** Jamais affiché dans la sidebar (accès par URL pour le backoffice autorisé). */
export function showTrackingInSidebar() {
  return false;
}

/** Modal tracking depuis Compte rendu (backoffice hors utilisateurs bloqués + rôles approbateurs). */
export function canManageTrackingFromCompteRendu(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  const f = Number(user.fonction);
  return f === 11 || [1, 7, 13].includes(f);
}
