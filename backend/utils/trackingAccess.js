const TRACKING_BLOCKED_USER_IDS = [3896];
const TRACKING_ALLOWED_FUNCTIONS = [1, 7, 13];

function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function hasTrackingAllowedFunction(user) {
  if (!user?.fonction) return false;
  return TRACKING_ALLOWED_FUNCTIONS.includes(Number(user.fonction));
}

function canAccessTrackingPage(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return hasTrackingAllowedFunction(user);
}

function canManageTrackingFromCompteRendu(user) {
  return canAccessTrackingPage(user);
}

module.exports = {
  TRACKING_BLOCKED_USER_IDS,
  TRACKING_ALLOWED_FUNCTIONS,
  isTrackingBlockedUser,
  canAccessTrackingPage,
  canManageTrackingFromCompteRendu,
};
