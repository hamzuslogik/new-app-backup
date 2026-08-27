/**
 * Filtres communs Production Qualif (onglets Statistiques et Fiches).
 * Exclut archive = 1 (poubelle), inclut archive NULL ou 0.
 */

function getTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveProductionQualifDateRange(query) {
  const { date_debut, date_fin, time_debut, time_fin } = query || {};
  let start =
    typeof date_debut === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date_debut)
      ? date_debut.slice(0, 10)
      : getTodayLocal();
  let end =
    typeof date_fin === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date_fin)
      ? date_fin.slice(0, 10)
      : getTodayLocal();
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const timeDebut =
    time_debut && /^\d{2}:\d{2}/.test(String(time_debut))
      ? `${String(time_debut).slice(0, 5)}:00`
      : '00:00:00';
  const timeFin =
    time_fin && /^\d{2}:\d{2}/.test(String(time_fin))
      ? `${String(time_fin).slice(0, 5)}:00`
      : '23:59:59';
  return {
    start,
    end,
    timeDebut,
    timeFin,
    startDateTime: `${start} ${timeDebut}`,
    endDateTime: `${end} ${timeFin}`,
  };
}

const PRODUCTION_QUALIF_FICHE_FILTERS = [
  'f.active = 1',
  '(f.archive = 0 OR f.archive IS NULL)',
  'f.date_insert_time IS NOT NULL',
  "f.date_insert_time != ''",
];

function mapFiltersForAlias(filters, alias) {
  return filters.map((c) => c.replace(/\bf\./g, `${alias}.`));
}

/** Conditions SQL + params pour comptage/liste production qualif. */
function buildProductionQualifFicheConditions(agentIds, startDateTime, endDateTime, alias = 'f') {
  const filters = mapFiltersForAlias(PRODUCTION_QUALIF_FICHE_FILTERS, alias);
  return {
    sql: [
      `${alias}.id_agent IN (${agentIds.map(() => '?').join(',')})`,
      ...filters,
      `${alias}.date_insert_time >= ?`,
      `${alias}.date_insert_time <= ?`,
    ].join(' AND '),
    params: [...agentIds, startDateTime, endDateTime],
  };
}

/** Filtres de base (sans dates) pour construire une clause WHERE fiche.* */
function getProductionQualifBaseFilterSql(alias = 'fiche') {
  return mapFiltersForAlias(PRODUCTION_QUALIF_FICHE_FILTERS, alias);
}

function isProductionQualifContext(query) {
  const v = query?.production_qualif;
  return v === '1' || v === 1 || v === true || v === 'true';
}

module.exports = {
  PRODUCTION_QUALIF_FICHE_FILTERS,
  resolveProductionQualifDateRange,
  buildProductionQualifFicheConditions,
  getProductionQualifBaseFilterSql,
  isProductionQualifContext,
};
