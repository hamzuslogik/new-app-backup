const TRACKING_BLOCKED_USER_IDS = [3896];
const FONCTION_BACKOFFICE = 11;

function isTrackingBlockedUser(user) {
  if (!user?.id) return false;
  return TRACKING_BLOCKED_USER_IDS.includes(Number(user.id));
}

function canAccessTrackingPage(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  return Number(user.fonction) === FONCTION_BACKOFFICE;
}

function canManageTrackingFromCompteRendu(user) {
  if (!user || isTrackingBlockedUser(user)) return false;
  const f = Number(user.fonction);
  return f === FONCTION_BACKOFFICE || [1, 7, 13].includes(f);
}

module.exports = {
  TRACKING_BLOCKED_USER_IDS,
  isTrackingBlockedUser,
  canAccessTrackingPage,
  canManageTrackingFromCompteRendu,
};
