/**
 * Helpers d’URL pour le menu admin (Dashboard / Signatures / Affectation).
 */

export const isAdminSession = (user) => [1, 7].includes(Number(user?.fonction));

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
      date_champ: 'date_modif_time',
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
        time_debut: '00:00:00',
      }),
    signesSemaine: `/signatures${qs({ date_debut: weekStart, date_fin: today, date_champ: 'date_rdv_time' })}`,
    signesMois: `/signatures${qs({ date_debut: monthStart, date_fin: today, date_champ: 'date_rdv_time' })}`,
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
