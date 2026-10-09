/**
 * Règles de fermeture automatique des créneaux planning par département.
 * Aligné sur backend/utils/planningSlotPolicy.js
 */

const SLOT_HOURS = ['09:00:00', '11:00:00', '13:00:00', '16:00:00', '18:00:00', '19:30:00'];

const GROUP_A = new Set(['69', '42', '01', '38', '73', '74', '33', '24']);
const GROUP_B = new Set(['77', '78', '91', '92', '93', '94', '95', '76', '27']);
const GROUP_C = new Set(['60', '80', '59', '62', '67', '68', '90', '54', '55', '57']);

/** Admin (1, 7), Confirmateur (6), Backoffice (11), RP (13), RE (14). Confirmateur : warning + code à retaper. */
export const POLICY_CLOSED_CREATE_ALLOWED_FONCTIONS = new Set([1, 6, 7, 11, 13, 14]);

export function normalizeDep(dep) {
  if (dep == null || dep === '') return '';
  const digits = String(dep).trim().replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(0, 2).padStart(2, '0');
}

export function normalizeSlotHour(hour) {
  if (hour == null || hour === '') return '';
  const s = String(hour).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  const m = s.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]}:${m[2]}:${m[3] || '00'}`;
  return s.slice(0, 8);
}

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

export function isPolicyClosedSlot(dep, dateStr, hour) {
  const depNorm = normalizeDep(dep);
  if (!depNorm) return false;
  const slotHour = normalizeSlotHour(hour);
  if (!SLOT_HOURS.includes(slotHour)) return false;
  const weekday = getWeekdayFromDateStr(dateStr);
  if (weekday == null) return false;

  if (GROUP_A.has(depNorm)) {
    if (weekday === 1 && slotHour === '09:00:00') return true;
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '14:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  if (GROUP_B.has(depNorm)) {
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '18:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  if (GROUP_C.has(depNorm)) {
    if (weekday === 4 && slotHourAtOrAfter(slotHour, '16:00:00')) return true;
    if (weekday === 5) return true;
    return false;
  }

  return false;
}

export function canCreateRdvOnPolicyClosedSlot(fonction) {
  return POLICY_CLOSED_CREATE_ALLOWED_FONCTIONS.has(Number(fonction));
}
