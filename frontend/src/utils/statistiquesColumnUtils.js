/** Somme numérique d'une colonne état (lignes + ligne total implicite). */
export function getEtatColumnTotal(data, etatId, globalTotal) {
  if (!data?.length) return 0;
  return data.reduce((sum, item) => sum + (Number(item.stats?.[etatId]) || 0), 0);
}

export function isEtatColumnAllZeros(data, etatId) {
  return getEtatColumnTotal(data, etatId) === 0;
}

/**
 * États visibles : exclut colonnes à 0 et colonnes masquées manuellement.
 * @param {object} prefs - { hideZeroColumns?: boolean, hidden?: Record<string, boolean> }
 */
export function getVisibleEtats(etats, data, prefs = {}) {
  const hideZero = prefs.hideZeroColumns !== false;
  const hidden = prefs.hidden || {};
  return (etats || []).filter((etat) => {
    const id = String(etat.id);
    if (hidden[id] === true) return false;
    if (hideZero && isEtatColumnAllZeros(data, etat.id)) return false;
    return true;
  });
}

/** Colonnes fixes mode TAUX */
export const TAUX_FIXED_COLUMNS = [
  { id: 'neutre', label: 'NEUTRE', getValue: (item) => item.totals?.neutre ?? 0 },
  { id: 'positive', label: 'POSITIVE', getValue: (item) => item.totals?.positive ?? 0 },
  { id: 'negative', label: 'NEGATIVE', getValue: (item) => item.totals?.negative ?? 0 },
];

export function getVisibleTauxColumns(data, prefs = {}) {
  const hideZero = prefs.hideZeroColumns !== false;
  const hidden = prefs.hidden || {};
  return TAUX_FIXED_COLUMNS.filter((col) => {
    if (hidden[col.id] === true) return false;
    if (!hideZero) return true;
    const sum = (data || []).reduce((s, item) => s + (Number(col.getValue(item)) || 0), 0);
    return sum > 0;
  });
}

export function getStatsViewKey(activeTab, statType) {
  if (activeTab === 'kpi-commerciaux') return 'kpi-commerciaux';
  return `${activeTab}-${statType}`;
}

export const DEFAULT_COLUMN_PREFS = { hideZeroColumns: true, hidden: {} };
