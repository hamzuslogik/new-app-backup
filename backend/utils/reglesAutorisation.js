const { query } = require('../config/database');

/**
 * Normalise une date fiche (datetime, date string ou timestamp unix) en YYYY-MM-DD.
 */
function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (/^\d{10,13}$/.test(s)) {
    const ms = s.length === 13 ? parseInt(s, 10) : parseInt(s, 10) * 1000;
    const dt = new Date(ms);
    if (!Number.isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function dateInRange(dateOnly, debut, fin) {
  if (!debut && !fin) return true;
  if (!dateOnly) return false;
  if (debut && dateOnly < debut) return false;
  if (fin && dateOnly > fin) return false;
  return true;
}

function ruleMatchesFiche(rule, centreIds, existingFiche) {
  if (!rule.actif || rule.actif === 0 || rule.actif === '0') return false;

  if (rule.id_etat_final != null && rule.id_etat_final !== '') {
    if (Number(existingFiche.id_etat_final) !== Number(rule.id_etat_final)) return false;
  }

  if (centreIds.length > 0) {
    const ficheCentre = existingFiche.id_centre != null ? Number(existingFiche.id_centre) : null;
    if (!ficheCentre || !centreIds.includes(ficheCentre)) return false;
  }

  const insertDate = toDateOnly(existingFiche.date_insert_time);
  if (!dateInRange(insertDate, rule.date_insert_debut, rule.date_insert_fin)) return false;

  const appelDate =
    toDateOnly(existingFiche.date_appel_time) || toDateOnly(existingFiche.date_appel);
  if (!dateInRange(appelDate, rule.date_appel_debut, rule.date_appel_fin)) return false;

  return true;
}

/**
 * Charge les règles actives avec leurs centres et retourne la première qui correspond (priorité décroissante).
 */
async function findMatchingAutorisationRule(existingFiche) {
  let rules;
  try {
    rules = await query(
      `SELECT r.* FROM regles_autorisation r
       WHERE r.actif = 1
       ORDER BY r.priorite DESC, r.id ASC`
    );
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[regles_autorisation] Table absente — exécutez create-regles-autorisation-table.sql');
      return null;
    }
    throw err;
  }

  if (!rules || rules.length === 0) return null;

  let centresByRule = {};
  try {
    const rows = await query(
      'SELECT id_regle, id_centre FROM regles_autorisation_centres'
    );
    for (const row of rows || []) {
      const rid = Number(row.id_regle);
      if (!centresByRule[rid]) centresByRule[rid] = [];
      centresByRule[rid].push(Number(row.id_centre));
    }
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }

  for (const rule of rules) {
    const centreIds = centresByRule[rule.id] || [];
    if (ruleMatchesFiche(rule, centreIds, existingFiche)) {
      return { ...rule, centre_ids: centreIds };
    }
  }
  return null;
}

module.exports = {
  findMatchingAutorisationRule,
  toDateOnly,
  dateInRange,
  ruleMatchesFiche,
};
