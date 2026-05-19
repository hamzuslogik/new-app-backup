const { query } = require('../config/database');
const { ensureReglesAutorisationSchema } = require('./ensureReglesAutorisationSchema');

const VALID_OPERATEURS = ['<', '>', '<=', '>='];
const VALID_UNITES = ['jour', 'mois', 'annee'];

/**
 * Parse une date fiche en objet Date (datetime, YYYY-MM-DD ou timestamp unix).
 */
function parseFicheDatetime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value).trim();
  if (/^\d{10,13}$/.test(s)) {
    const ms = s.length === 13 ? parseInt(s, 10) : parseInt(s, 10) * 1000;
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const dt = new Date(iso[1] + 'T00:00:00');
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Âge écoulé depuis la date fiche jusqu'à aujourd'hui, dans l'unité demandée.
 */
function getAgeInUnit(ficheDate, unite) {
  const d = parseFicheDatetime(ficheDate);
  if (!d) return null;
  const now = new Date();
  const u = String(unite || '').toLowerCase();

  if (u === 'jour' || u === 'jours') {
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((startNow - startD) / (24 * 60 * 60 * 1000));
  }

  if (u === 'mois') {
    let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (now.getDate() < d.getDate()) months -= 1;
    return months;
  }

  if (u === 'annee' || u === 'annees' || u === 'année' || u === 'années') {
    let years = now.getFullYear() - d.getFullYear();
    if (
      now.getMonth() < d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
    ) {
      years -= 1;
    }
    return years;
  }

  return null;
}

/**
 * Critère relatif : ex. operateur "<", valeur 3, unite "mois"
 * → la fiche doit avoir une date d'âge < 3 mois par rapport à aujourd'hui.
 */
function matchesRelativeDateCriterion(ficheDateValue, operateur, valeur, unite) {
  if (!operateur || valeur == null || valeur === '' || !unite) return true;

  const age = getAgeInUnit(ficheDateValue, unite);
  if (age == null) return false;

  const v = Number(valeur);
  if (!Number.isFinite(v)) return false;

  switch (operateur) {
    case '<':
      return age < v;
    case '<=':
      return age <= v;
    case '>':
      return age > v;
    case '>=':
      return age >= v;
    default:
      return false;
  }
}

function normalizeUnite(unite) {
  if (unite == null || unite === '') return null;
  const u = String(unite).toLowerCase().trim();
  if (u === 'jours') return 'jour';
  if (u === 'années' || u === 'annee' || u === 'années') return 'annee';
  if (VALID_UNITES.includes(u)) return u;
  return null;
}

function parseDateCritereFields(body, prefix) {
  const operateur = body[`${prefix}_operateur`];
  const valeur = body[`${prefix}_valeur`];
  const unite = normalizeUnite(body[`${prefix}_unite`]);

  if (!operateur && (valeur == null || valeur === '') && !unite) {
    return { operateur: null, valeur: null, unite: null };
  }

  if (!VALID_OPERATEURS.includes(operateur)) {
    return { error: `Opérateur ${prefix} invalide (<, >, <=, >=)` };
  }
  const v = parseInt(valeur, 10);
  if (!Number.isFinite(v) || v < 0) {
    return { error: `Valeur ${prefix} invalide (entier ≥ 0)` };
  }
  if (!unite) {
    return { error: `Unité ${prefix} invalide (jour, mois, annee)` };
  }

  return { operateur, valeur: v, unite };
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

  const insertDate = existingFiche.date_insert_time || existingFiche.date_insert;
  if (
    !matchesRelativeDateCriterion(
      insertDate,
      rule.date_insert_operateur,
      rule.date_insert_valeur,
      rule.date_insert_unite
    )
  ) {
    return false;
  }

  const appelDate = existingFiche.date_appel_time || existingFiche.date_appel;
  if (
    !matchesRelativeDateCriterion(
      appelDate,
      rule.date_appel_operateur,
      rule.date_appel_valeur,
      rule.date_appel_unite
    )
  ) {
    return false;
  }

  return true;
}

async function findMatchingAutorisationRule(existingFiche) {
  await ensureReglesAutorisationSchema();

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
    const rows = await query('SELECT id_regle, id_centre FROM regles_autorisation_centres');
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
  parseFicheDatetime,
  getAgeInUnit,
  matchesRelativeDateCriterion,
  parseDateCritereFields,
  normalizeUnite,
  VALID_OPERATEURS,
  VALID_UNITES,
};
