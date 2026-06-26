/**
 * Vérifie si l'heure actuelle est avant la date/heure du RDV (comparaison en heure locale, sans fuseau).
 */
export function parseRdvDateTimeLocal(dateRdvTime) {
  if (dateRdvTime == null || String(dateRdvTime).trim() === '') return null;
  const match = String(dateRdvTime)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, h, min, sec] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(sec || 0));
}

export function isBeforeRdvDateTime(dateRdvTime, now = new Date()) {
  const rdv = parseRdvDateTimeLocal(dateRdvTime);
  if (!rdv) return false;
  return now.getTime() < rdv.getTime();
}

export function generateFourDigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function normalizeFourDigitInput(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 4);
}
