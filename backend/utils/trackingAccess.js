const TRACKING_BLOCKED_USER_IDS = [3896];
const TRACKING_FONCTION_BACKOFFICE = 11;

function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function isBackofficeFonction(user) {
  return Number(user?.fonction) === TRACKING_FONCTION_BACKOFFICE;
}

function canAccessTrackingPage(user) {
  if (!user || !isBackofficeFonction(user) || isTrackingBlockedUser(user)) return false;
  return true;
}

function canManageTrackingFromCompteRendu(user) {
  return !!user && isBackofficeFonction(user);
}

module.exports = {
  TRACKING_BLOCKED_USER_IDS,
  TRACKING_FONCTION_BACKOFFICE,
  isTrackingBlockedUser,
  canAccessTrackingPage,
  canManageTrackingFromCompteRendu,
};
