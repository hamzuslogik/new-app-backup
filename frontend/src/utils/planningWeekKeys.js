/**
 * Numérotation de semaine alignée sur backend/planning.routes.js (UTC, même formule que le planning).
 */
export function utcPlanningWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function planningWeekKey(year, week) {
  return `${year}-${String(week).padStart(2, '0')}`;
}

export function parsePlanningWeekKey(key) {
  const m = String(key || '').trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), week: parseInt(m[2], 10) };
}

/** Navigation identique à l’onglet Planning (FicheDetail) */
export function prevPlanningWeek(year, week) {
  if (week <= 1) return { year: year - 1, week: 52 };
  return { year, week: week - 1 };
}

export function nextPlanningWeek(year, week) {
  if (week >= 52) return { year: year + 1, week: 1 };
  return { year, week: week + 1 };
}

/** Lundi de la semaine (algorithme identique backend getMondayOfWeek) */
export function getMondayOfPlanningWeek(year, week) {
  const simple = new Date(year, 0, 4);
  const jan4Day = simple.getDay() || 7;
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1));
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return targetMonday;
}

/**
 * Liste de clés YYYY-WW du plus ancien au plus récent (inclus ref).
 * @param {number} past - nombre de semaines avant la ref
 * @param {number} future - après la ref
 */
export function enumeratePlanningWeekKeys(refYear, refWeek, past = 5, future = 28) {
  let y = refYear;
  let w = refWeek;
  for (let i = 0; i < past; i += 1) {
    const p = prevPlanningWeek(y, w);
    y = p.year;
    w = p.week;
  }
  const keys = [];
  for (let i = 0; i < past + future + 1; i += 1) {
    keys.push(planningWeekKey(y, w));
    const n = nextPlanningWeek(y, w);
    y = n.year;
    w = n.week;
  }
  return keys;
}

export function labelForPlanningWeekKey(key) {
  const parsed = parsePlanningWeekKey(key);
  if (!parsed) return key;
  const { year, week } = parsed;
  const monday = getMondayOfPlanningWeek(year, week);
  const fri = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
  const fmt = (d) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `S${String(week).padStart(2, '0')} ${year} (${fmt(monday)} → ${fmt(fri)})`;
}
