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

/** Retourne l'heure locale HH:mm. */
export function getNowTimeLocal() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine date YYYY-MM-DD + heure HH:mm pour input datetime-local. */
export function toDateTimeLocalValue(dateStr, timeStr = '00:00') {
  if (!dateStr) return '';
  const date = String(dateStr).slice(0, 10);
  const time = timeStr && /^\d{2}:\d{2}/.test(String(timeStr))
    ? String(timeStr).slice(0, 5)
    : '00:00';
  return `${date}T${time}`;
}

/** Extrait date et heure depuis une valeur datetime-local. */
export function splitDateTimeLocalValue(value) {
  if (!value || typeof value !== 'string') {
    return { date: '', time: '00:00' };
  }
  const [date, time] = value.split('T');
  return {
    date: date || '',
    time: time ? time.slice(0, 5) : '00:00',
  };
}

/** Formate une datetime MySQL / ISO pour affichage fr-FR avec heure. */
export function formatDateTimeFr(value) {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Retourne le dernier jour du mois en cours en YYYY-MM-DD (heure locale).
 */
export function getLastDayOfMonthLocal() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toLocalDateString(last);
}
