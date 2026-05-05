function parseMods(mods) {
  if (!mods) return {};
  if (typeof mods === 'string') {
    try {
      return JSON.parse(mods) || {};
    } catch {
      return {};
    }
  }
  return typeof mods === 'object' ? mods : {};
}

function formatDateTimeFr(dateStr, timeStr) {
  if (!dateStr) return '';
  const tm = (timeStr && String(timeStr).trim()) ? String(timeStr).trim().substring(0, 5) : '';
  if (!tm) {
    const d = new Date(`${dateStr}T12:00:00`);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR');
  }
  const [hh, mm] = tm.split(':').map((x) => parseInt(x, 10) || 0);
  const d = new Date(
    `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
  );
  if (Number.isNaN(d.getTime())) return `${dateStr} ${tm}`;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Annuler à reprogrammer (8) : conf_rdv_date / conf_rdv_time dans modifications.
 * Honoré à suivre (9) : date_rdv_time dans modifications (datetime).
 *
 * @returns {{ label: string, text: string } | null}
 */
export function getDateRappelAffichage(cr) {
  const id = Number(cr?.id_etat_final);
  const mods = parseMods(cr?.modifications);
  if (id === 8) {
    const d =
      mods.conf_rdv_date != null && String(mods.conf_rdv_date) !== ''
        ? mods.conf_rdv_date
        : cr?.conf_rdv_date;
    let tm =
      mods.conf_rdv_time != null && String(mods.conf_rdv_time) !== ''
        ? mods.conf_rdv_time
        : cr?.conf_rdv_time;
    if (tm && String(tm).length >= 5) tm = String(tm).substring(0, 5);
    if ((d == null || String(d) === '') && (tm == null || String(tm) === '')) return null;
    const text = formatDateTimeFr(d || '', tm || '');
    return text ? { label: 'Date de rappel', text } : null;
  }
  if (id === 9) {
    const raw = mods.date_rdv_time || cr?.date_rdv_time;
    if (raw == null || String(raw) === '') return null;
    const normalized = String(raw).replace('T', ' ').trim();
    const m = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?/);
    const text = m
      ? formatDateTimeFr(m[1], m[2])
      : (() => {
          const dt = new Date(raw);
          return Number.isNaN(dt.getTime())
            ? String(raw)
            : dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        })();
    return { label: 'Date de rappel', text };
  }
  return null;
}
