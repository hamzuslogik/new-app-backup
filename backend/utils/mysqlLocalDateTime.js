/**
 * DATETIME MySQL en heure locale du process (pas UTC).
 * Ne pas utiliser toISOString() pour fiches.date_insert_time / date_modif_time.
 */
function pad(n) {
  return String(n).padStart(2, '0');
}

function toMysqlLocalDateTime(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    return toMysqlLocalDateTime(new Date());
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

module.exports = { toMysqlLocalDateTime };
