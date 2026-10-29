/**
 * Horodatage user_activity : heure Europe/Paris (même référentiel que MySQL session +01:00/+02:00).
 * - Avant : nowUtcMysqlString() via toISOString() → UTC affiché tel quel = 1 h / 2 h de moins.
 * - Écriture / lecture idle : mur Paris, comparaisons via timestamp UTC réel.
 */

const ACTIVITY_TZ = 'Europe/Paris';

function pad(n) {
  return String(n).padStart(2, '0');
}

function partsInTimeZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // en-GB peut rendre l'heure « 24 » à minuit
  const hour = map.hour === '24' ? '00' : map.hour;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: map.minute,
    second: map.second
  };
}

/** Chaîne MySQL DATETIME en heure Europe/Paris (mur). */
function nowUtcMysqlString() {
  const p = partsInTimeZone(new Date(), ACTIVITY_TZ);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Interprète un DATETIME « naïf » (stocké en heure Paris) → ms UTC.
 * Compatible aussi avec d'anciennes valeurs déjà écrites en UTC (écart max ~1–2 h sur l'idle).
 */
function lastActivityToUtcMs(value) {
  if (value == null || value === '') return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  const s = String(value).trim();
  if (!s) return NaN;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    const t = new Date(s).getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const sec = Number(m[6]);
  const targetAsUtc = Date.UTC(y, mo - 1, d, h, mi, sec);
  // Ajuste jusqu'à ce que l'affichage Paris de l'instant = composants cibles
  let utcMs = targetAsUtc;
  for (let i = 0; i < 3; i++) {
    const p = partsInTimeZone(new Date(utcMs), ACTIVITY_TZ);
    const shownAsUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second)
    );
    utcMs += targetAsUtc - shownAsUtc;
  }
  return utcMs;
}

module.exports = {
  nowUtcMysqlString,
  lastActivityToUtcMs,
  ACTIVITY_TZ
};
