/**
 * Règles de fermeture automatique des créneaux planning par département.
 * Créneaux concernés : noirs (comme is_closed).
 * Création RDV : admin / confirmateur / backoffice / RE / RP (confirmateur via warning + code).
 */

const SLOT_HOURS = ['09:00:00', '11:00:00', '13:00:00', '16:00:00', '18:00:00', '19:30:00'];

/** Groupe A : 69, 42, 01, 38, 73, 74, 33, 24 */
const GROUP_A = new Set(['69', '42', '01', '38', '73', '74', '33', '24']);
/** Groupe B : 77, 78, 91, 92, 93, 94, 95, 76, 27 */
const GROUP_B = new Set(['77', '78', '91', '92', '93', '94', '95', '76', '27']);
/** Groupe C : 60, 80, 59, 62, 67, 68, 90, 54, 55, 57 */
const GROUP_C = new Set(['60', '80', '59', '62', '67', '68', '90', '54', '55', '57']);

/** Fonctions autorisées à créer un RDV dans un créneau fermé par politique (avec code / allow_unavailable). */
const POLICY_CLOSED_CREATE_ALLOWED_FONCTIONS = new Set([1, 6, 7, 11, 13, 14]);

function normalizeDep(dep) {
  if (dep == null || dep === '') return '';
  const digits = String(dep).trim().replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(0, 2).padStart(2, '0');
}

function normalizeSlotHour(hour) {
  if (hour == null || hour === '') return '';
  const s = String(hour).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  // TIME / Date-like
  const m = s.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]}:${m[2]}:${m[3] || '00'}`;
  return s.slice(0, 8);
}

/**
 * Jour de semaine local depuis YYYY-MM-DD (1=lundi … 5=vendredi, 0=dimanche, 6=samedi).
 */
function getWeekdayFromDateStr(dateStr) {
  const raw = String(dateStr || '').trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function slotHourAtOrAfter(slotHour, thresholdHour) {
  return normalizeSlotHour(slotHour) >= normalizeSlotHour(thresholdHour);
}

/**
 * @returns {boolean} true si le créneau est fermé par la politique départementale
 */
function isPolicyClosedSlot(dep, dateStr, hour) {
  const depNorm = normalizeDep(dep);
  if (!depNorm) return false;
  const slotHour = normalizeSlotHour(hour);
  if (!SLOT_HOURS.includes(slotHour)) return false;
  const weekday = getWeekdayFromDateStr(dateStr); // 0=dim … 5=ven
  if (weekday == null) return false;

  if (GROUP_A.has(depNorm)) {
    // Lundi 9H ; jeudi après 14h ; vendredi tous créneaux
    if (weekday === 1 && slotHour === '09:00:00') return true;
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '14:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  if (GROUP_B.has(depNorm)) {
    // Jeudi après 18h ; vendredi fermé
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '18:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  if (GROUP_C.has(depNorm)) {
    // Jeudi après 16h ; vendredi fermé
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '16:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  return false;
}

function canCreateRdvOnPolicyClosedSlot(fonction) {
  return POLICY_CLOSED_CREATE_ALLOWED_FONCTIONS.has(Number(fonction));
}

module.exports = {
  isPolicyClosedSlot,
  canCreateRdvOnPolicyClosedSlot,
  normalizeDep,
  normalizeSlotHour,
  POLICY_CLOSED_CREATE_ALLOWED_FONCTIONS,
  GROUP_A,
  GROUP_B,
  GROUP_C
};
