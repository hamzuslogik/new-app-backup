/**
 * Format datetime for display without timezone conversion.
 * The value is shown as stored (e.g. "2026-02-15 14:00:00" → "15/02/2026 14:00").
 * Use for date_rdv_time and any RDV-related datetimes so display is independent of the user's machine timezone.
 */
export function formatRdvDateTime(datetimeStr) {
  if (datetimeStr == null || datetimeStr === '') return '-';
  const s = String(datetimeStr).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return s;
  const [, y, m, d, h, min] = match;
  return `${d}/${m}/${y} ${h.padStart(2, '0')}:${min}`;
}

/** Date only (no time), timezone-independent. */
export function formatRdvDateOnly(datetimeStr) {
  if (datetimeStr == null || datetimeStr === '') return '-';
  const s = String(datetimeStr).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return s;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Time only (HH:mm), timezone-independent. */
export function formatRdvTimeOnly(datetimeStr) {
  if (datetimeStr == null || datetimeStr === '') return '';
  const s = String(datetimeStr).trim();
  const match = s.match(/[T\s](\d{1,2}):(\d{2})/);
  if (!match) return '';
  const [, h, min] = match;
  return `${h.padStart(2, '0')}:${min}`;
}
