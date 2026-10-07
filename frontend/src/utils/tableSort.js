/**
 * Tri de tableaux (en-têtes cliquables) — utilitaire partagé pages Qualif.
 */

export function toggleSortConfig(prev, key) {
  if (!key) return { key: null, direction: 'asc' };
  if (prev?.key === key) {
    return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

function normalizeSortValue(value) {
  if (value == null) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const s = String(value).trim();
  if (s === '') return '';
  const asNum = Number(s.replace(',', '.').replace(/%$/, ''));
  if (s !== '' && Number.isFinite(asNum) && /^-?\d+([.,]\d+)?%?$/.test(s)) {
    return asNum;
  }
  const asDate = Date.parse(s.replace(' ', 'T'));
  if (!Number.isNaN(asDate) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    return asDate;
  }
  return s.toLowerCase();
}

export function compareSortValues(aVal, bVal, direction = 'asc') {
  const a = normalizeSortValue(aVal);
  const b = normalizeSortValue(bVal);
  let cmp = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
  }
  return direction === 'desc' ? -cmp : cmp;
}

/**
 * @param {Array} rows
 * @param {{ key: string|null, direction: 'asc'|'desc' }} sortConfig
 * @param {(row: any, key: string) => any} getValue
 */
export function sortRowsByConfig(rows, sortConfig, getValue) {
  if (!Array.isArray(rows) || !sortConfig?.key) return rows || [];
  const sorted = [...rows];
  sorted.sort((a, b) =>
    compareSortValues(getValue(a, sortConfig.key), getValue(b, sortConfig.key), sortConfig.direction)
  );
  return sorted;
}
