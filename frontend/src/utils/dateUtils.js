/**
 * Utilitaires de dates en heure locale (évite le décalage UTC qui peut donner
 * le 31 du mois précédent au lieu du 1er du mois).
 * Pour les stats du mois : toujours commencer au 1er du mois (pas le 31 du mois précédent).
 */

/**
 * Formate une date en YYYY-MM-DD en heure locale.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Retourne le 1er du mois en cours en YYYY-MM-DD (heure locale).
 */
export function getFirstOfMonthLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Retourne la date du jour en YYYY-MM-DD (heure locale).
 */
export function getTodayLocal() {
  return toLocalDateString(new Date());
}

/**
 * Retourne le dernier jour du mois en cours en YYYY-MM-DD (heure locale).
 */
export function getLastDayOfMonthLocal() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toLocalDateString(last);
}
