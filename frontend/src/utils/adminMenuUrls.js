/**
 * Helpers d’URL pour le menu admin (Dashboard / Signatures / Affectation).
 */

export const isAdminSession = (user) => [1, 7].includes(Number(user?.fonction));

/**
 * Badge HAS (« Honoré à suivre » dans l’historique) :
 * Backoffice (11), RP Confirmation (13), RE Confirmation (14).
 * (Admin 1/7 l’a déjà via le layout colonnes badges.)
 */
export const isHonoreASuivreBadgeSession = (user) =>
  [11, 13, 14].includes(Number(user?.fonction));

/**
 * Sessions pouvant afficher les colonnes badges (CS, RF, HAS, SIG, R2…)
 * comme l’admin, avec bouton afficher/cacher : Qualité Confirmation (4),
 * Confirmateur (6), Backoffice (11), RP Confirmation (13), RE Confirmation (14).
 */
export const canToggleFicheBadgeColumns = (user) =>
  [4, 6, 11, 13, 14].includes(Number(user?.fonction));

/**
 * Sessions avec sélecteur « Colonnes » (afficher / cacher chaque colonne) :
 * Backoffice (11), RP Confirmation (13), RE Confirmation (14).
 */
export const canCustomizeFicheTableColumns = (user) =>
  [11, 13, 14].includes(Number(user?.fonction));

const FICHE_BADGES_VISIBLE_KEY = 'fiche_badges_columns_visible';
const FICHE_TABLE_COLUMNS_KEY = 'fiche_table_columns_visible_v1';

/** Préférence affichage badges (défaut : visibles). */
export function getFicheBadgesVisiblePref() {
  try {
    const v = localStorage.getItem(FICHE_BADGES_VISIBLE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (_) {
    /* ignore */
  }
  return true;
}

export function setFicheBadgesVisiblePref(visible) {
  try {
    localStorage.setItem(FICHE_BADGES_VISIBLE_KEY, visible ? '1' : '0');
  } catch (_) {
    /* ignore */
  }
}

/** Définitions colonnes tableau fiche (layout badges / standard). */
export const FICHE_TABLE_COLUMN_DEFS = {
  badge: [
    { key: 'nom', label: 'Nom', locked: true },
    { key: 'prenom', label: 'Prénom' },
    { key: 'tel', label: 'Téléphone' },
    { key: 'cp', label: 'CP' },
    { key: 'date_rdv', label: 'Date RDV' },
    { key: 'commercial', label: 'Commercial' },
    { key: 'valide', label: 'Validé' },
    { key: 'action', label: 'ACTION' },
    { key: 'sig', label: 'SIG' },
    { key: 'cs', label: 'CS' },
    { key: 'r2', label: 'R2' },
    { key: 'has', label: 'HAS' },
    { key: 'rf', label: 'RF' },
    { key: 'pdf', label: 'PDF' },
    { key: 'prod', label: 'PROD' },
    { key: 'centre', label: 'Centre' },
    { key: 'date_insert', label: 'Date Insertion' },
    { key: 'conf', label: 'Conf' },
    { key: 'etat', label: 'État' },
    { key: 'cq_etat', label: 'CQ État', group: 'cq' },
    { key: 'cq_dossier', label: 'CQ Dossier', group: 'cq' },
    { key: 'cq_obs', label: 'Observation', group: 'cq' },
    { key: 'decalage', label: 'Décalage', group: 'decalage' },
  ],
  standard: [
    { key: 'nom', label: 'Nom', locked: true },
    { key: 'prenom', label: 'Prénom' },
    { key: 'tel', label: 'Téléphone' },
    { key: 'cp', label: 'CP' },
    { key: 'date_insert', label: 'Date Insertion' },
    { key: 'date_rdv', label: 'Date RDV' },
    { key: 'etat', label: 'État' },
    { key: 'cq_etat', label: 'CQ État', group: 'cq' },
    { key: 'cq_dossier', label: 'CQ Dossier', group: 'cq' },
    { key: 'cq_obs', label: 'Observation', group: 'cq' },
    { key: 'conf', label: 'Confirmateur' },
    { key: 'commercial', label: 'Commercial' },
    { key: 'centre', label: 'Centre' },
    { key: 'prod', label: 'Produit' },
    { key: 'valide', label: 'Validé' },
    { key: 'sig', label: 'SIG', group: 'badges' },
    { key: 'cs', label: 'CS', group: 'badges' },
    { key: 'r2', label: 'R2', group: 'badges' },
    { key: 'has', label: 'HAS', group: 'badges' },
    { key: 'rf', label: 'RF', group: 'badges' },
    { key: 'action', label: 'Actions' },
    { key: 'decalage', label: 'État décalage' },
  ],
};

function defaultColumnVisibilityMap() {
  const map = {};
  [...FICHE_TABLE_COLUMN_DEFS.badge, ...FICHE_TABLE_COLUMN_DEFS.standard].forEach((col) => {
    map[col.key] = true;
  });
  return map;
}

/** Préférence colonnes visibles (défaut : toutes). */
export function getFicheTableColumnsPref() {
  const defaults = defaultColumnVisibilityMap();
  try {
    const raw = localStorage.getItem(FICHE_TABLE_COLUMNS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return { ...defaults, ...parsed };
  } catch (_) {
    return defaults;
  }
}

export function setFicheTableColumnsPref(visibilityMap) {
  try {
    localStorage.setItem(FICHE_TABLE_COLUMNS_KEY, JSON.stringify(visibilityMap || {}));
  } catch (_) {
    /* ignore */
  }
}

/** Session commercial (fonction 5). */
export const isCommercialSession = (user) => Number(user?.fonction) === 5;

/** Layout menu en haut (admin ou commercial) — pas de sidebar. */
export const usesTopNavLayout = (user) => isAdminSession(user) || isCommercialSession(user);

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toLocalISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysLocal(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Lundi de la semaine ISO locale (approx. semaine calendaire FR : lundi). */
export function startOfWeekLocal(d = new Date()) {
  const day = d.getDay() || 7;
  return addDaysLocal(d, -(day - 1));
}

export function startOfMonthLocal(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Dashboard avec critères de recherche. */
export function dashboardSearchUrl(extra = {}) {
  return `/dashboard${qs({ fiche_search: 1, ...extra })}`;
}

export function adminMenuUrls(now = new Date()) {
  const today = toLocalISODate(now);
  const yesterday = toLocalISODate(addDaysLocal(now, -1));
  const tomorrow = toLocalISODate(addDaysLocal(now, 1));
  const weekStart = toLocalISODate(startOfWeekLocal(now));
  const monthStart = toLocalISODate(startOfMonthLocal(now));

  return {
    dashboard: '/dashboard',
    planningHebdo: '/planning-hebdomadaire',
    affectationDep: '/affectation-dep',
    affectation: '/affectation',
    alertePlanning: '/alerte-planning',
    dep: (code) => `/affectation-dep${qs({ dp: code })}`,
    rdvPrisAujourdhui: dashboardSearchUrl({
      id_etat_final: 7,
      date_champ: 'date_confirmation',
      date_debut: today,
      date_fin: today,
      time_debut: '00:00:00',
      time_fin: '23:59:59',
    }),
    rdvAffilie: dashboardSearchUrl({
      id_etat_final: 7,
      rdv_affilie: 1,
      date_champ: 'date_rdv_time',
      date_debut: today,
      time_debut: '00:00:00',
    }),
    rdvNonAffilie: dashboardSearchUrl({
      id_etat_final: 7,
      rdv_non_affilie: 1,
      date_champ: 'date_rdv_time',
      date_debut: today,
      time_debut: '00:00:00',
    }),
    confirmesVeille: dashboardSearchUrl({ yesterday: 1 }),
    confirmesLendemain: dashboardSearchUrl({ tomorrow: 1 }),
    rdvVue: '/rdv-vue',
    compteRendu: '/compte-rendu',
    commercialRdvs: (id) =>
      dashboardSearchUrl({
        id_etat_final: 7,
        id_commercial: id,
        date_champ: 'date_rdv_time',
        date_debut: today,
        date_fin: today,
        time_debut: '00:00:00',
        time_fin: '23:59:59',
      }),
    signesSemaine: dashboardSearchUrl({
      id_etat_final: 't_s',
      date_champ: 'date_sign_time',
      date_debut: weekStart,
      date_fin: today,
      time_debut: '00:00:00',
      time_fin: '23:59:59',
    }),
    signesMois: dashboardSearchUrl({
      id_etat_final: 't_s',
      date_champ: 'date_sign_time',
      date_debut: monthStart,
      date_fin: today,
      time_debut: '00:00:00',
      time_fin: '23:59:59',
    }),
    cqSignatures: '/cq-signatures',
    decalages: '/decalages',
    rdvJourNonValides: dashboardSearchUrl({
      id_etat_final: 7,
      day_rdv: today,
      rdv_non_valid: 1,
    }),
    rdvJourValides: dashboardSearchUrl({
      id_etat_final: 7,
      day_rdv: today,
      rdv_valid: 1,
    }),
    rdvLendemainNonValides: dashboardSearchUrl({
      id_etat_final: 7,
      day_rdv: tomorrow,
      rdv_non_valid: 1,
    }),
    rdvLendemainValides: dashboardSearchUrl({
      id_etat_final: 7,
      day_rdv: tomorrow,
      rdv_valid: 1,
    }),
    statistiques: '/statistiques',
    gestion: '/management',
    monProfil: '/mon-profil',
    permissions: '/permissions',
    systemMessages: '/system-messages',
    envoyerMessage: '/messages?compose=1',
    // utilisé for labels / tests
    _dates: { today, yesterday, tomorrow, weekStart, monthStart },
  };
}

/** Lien avec query : actif seulement si le pathname et les params du lien matchent l’URL courante. */
export function isAdminMenuLinkActive(location, to) {
  const href = String(to || '');
  const qIndex = href.indexOf('?');
  const path = qIndex === -1 ? href : href.slice(0, qIndex);
  if (location.pathname !== path) return false;
  if (qIndex === -1) return true;
  const want = new URLSearchParams(href.slice(qIndex + 1));
  const have = new URLSearchParams(location.search);
  for (const [key, value] of want.entries()) {
    if (String(have.get(key) ?? '') !== String(value)) return false;
  }
  return true;
}
