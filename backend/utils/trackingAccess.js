const TRACKING_BLOCKED_USER_IDS = [3896];
const TRACKING_FONCTION_BACKOFFICE = 11;

function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function isBackofficeTrackingUser(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return Number(user.fonction) === TRACKING_FONCTION_BACKOFFICE;
}

function canAccessTrackingPage(user) {
  return isBackofficeTrackingUser(user);
}

function canManageTrackingFromCompteRendu(user) {
  return isBackofficeTrackingUser(user);
}

module.exports = {
  TRACKING_BLOCKED_USER_IDS,
  TRACKING_FONCTION_BACKOFFICE,
  isTrackingBlockedUser,
  canAccessTrackingPage,
  canManageTrackingFromCompteRendu,
};
