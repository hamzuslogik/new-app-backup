/**
 * Horodatage user_activity : convention UTC partout.
 * - Écriture : nowUtcMysqlString() = même référence que toISOString() (UTC).
 * - Lecture SQL : préférer DATE_FORMAT(..., '%Y-%m-%d %H:%i:%s') pour obtenir une chaîne
 *   et éviter que mysql2 interprète le DATETIME dans le fuseau local du process Node.
 * - Comparaisons idle / présence : lastActivityToUtcMs() interprète ces chaînes en UTC.
 */

/** Chaîne MySQL DATETIME en UTC (alignée sur toISOString(), sans fuseau ambigu). */
function nowUtcMysqlString() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Convertit last_activity (Date mysql2, ou chaîne SQL) en timestamp UTC ms.
 * Les valeurs DATETIME sans TZ en base sont traitées comme UTC (convention du projet).
 */
function lastActivityToUtcMs(value) {
  if (value == null || value === '') return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  const s = String(value).trim();
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/.test(s)) {
    const norm = s.replace(' ', 'T').slice(0, 19);
    return new Date(`${norm}Z`).getTime();
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? NaN : t;
}

module.exports = {
  nowUtcMysqlString,
  lastActivityToUtcMs
};
