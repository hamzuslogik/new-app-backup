import { getFicheTableIndicators, getDecalageDisplayInfo } from './ficheTableIndicators';
import { cleanObservationCQ } from './cleanObservationCQ';

/** Sessions autorisées à exporter les résultats de recherche du Dashboard. */
export const DASHBOARD_EXPORT_USER_IDS = new Set([3981, 2814]);

export function canExportDashboardResults(user) {
  return DASHBOARD_EXPORT_USER_IDS.has(Number(user?.id));
}

const YES = 'Oui';
const NO = '';

/**
 * Colonnes d'export alignées sur le tableau affiché (sans Actions / PDF).
 * @param {{ layout?: 'standard'|'badge', includeCq?: boolean, includeBadges?: boolean, includeDecalage?: boolean, isColVisible?: (key: string) => boolean }} options
 */
export function getDashboardExportColumns(options = {}) {
  const {
    layout = 'standard',
    includeCq = false,
    includeBadges = false,
    includeDecalage = false,
    isColVisible = () => true,
  } = options;

  const cols = [];
  const add = (key, label, visibleKey = key) => {
    if (isColVisible(visibleKey)) cols.push({ key, label });
  };

  add('nom', 'Nom');
  add('prenom', 'Prénom');
  add('telephone', 'Téléphone', 'tel');
  add('cp', 'CP');

  if (layout === 'badge') {
    add('date_rdv', 'Date RDV');
    add('commercial', 'Commercial');
    if (includeCq) add('installateur', 'Installateur');
    add('valide', 'Validé');
    if (includeBadges) {
      add('sig', 'SIG');
      add('cs', 'CS');
      add('r2', 'R2');
      add('has', 'HAS');
      add('rf', 'RF');
    }
    add('produit', 'Produit', 'prod');
    add('centre', 'Centre');
    add('date_insert', 'Date Insertion');
    add('confirmateur', 'Confirmateur', 'conf');
    add('etat', 'État', 'etat');
    if (includeCq) {
      add('cq_etat', 'CQ État');
      add('cq_dossier', 'CQ Dossier');
      add('cq_obs', 'Observation');
    }
    if (includeDecalage) add('decalage', 'Décalage');
  } else {
    add('date_insert', 'Date Insertion');
    add('date_rdv', 'Date RDV');
    add('etat', 'État', 'etat');
    if (includeCq) {
      add('cq_etat', 'CQ État');
      add('cq_dossier', 'CQ Dossier');
      add('cq_obs', 'Observation');
    }
    add('confirmateur', 'Confirmateur', 'conf');
    add('commercial', 'Commercial');
    if (includeCq) add('installateur', 'Installateur');
    add('centre', 'Centre');
    add('produit', 'Produit', 'prod');
    add('valide', 'Validé');
    if (includeBadges) {
      add('sig', 'SIG');
      add('cs', 'CS');
      add('r2', 'R2');
      add('has', 'HAS');
      add('rf', 'RF');
    }
    if (includeDecalage) add('decalage', 'Décalage');
  }

  return cols;
}

/** @deprecated utiliser getDashboardExportColumns — conservé pour imports existants */
export const DASHBOARD_EXPORT_COLUMNS = getDashboardExportColumns({
  layout: 'standard',
  includeCq: true,
  includeBadges: true,
  includeDecalage: true,
});

/**
 * @param {Array} fiches
 * @param {object} helpers
 */
export function buildDashboardExportRows(fiches, helpers = {}) {
  const {
    formatRdvDateTime = () => '',
    formatDate = (v) => (v ? String(v) : ''),
    getEtatDisplay = (f) => f?.etat_titre || f?.etat_libelle || '',
    getCommercial = (f) => f?.commercial_pseudo || '',
    getConfirmateur = (f) => f?.confirmateur_pseudo || '',
    getCentre = (f) => f?.centre_titre || '',
    getProduit = (f) => (f?.produit != null && f.produit !== '' ? String(f.produit) : ''),
    getIndicators = (f) => getFicheTableIndicators(f?.id_etat_histo, f, helpers.etatsData || []),
    getDecalage = (f) => {
      const info = getDecalageDisplayInfo(f);
      if (!info || info.status === 'cancelled') return '';
      return info.text || '';
    },
    etatsData = [],
  } = helpers;

  return (fiches || []).map((fiche) => {
    const indicators = getIndicators(fiche, etatsData) || {};
    const etatParts = [];
    if (fiche?.current_state_from_compte_rendu === true) etatParts.push('<CR>');
    etatParts.push(getEtatDisplay(fiche) || '');
    if (
      fiche.rdv_urgent === 1 ||
      fiche.rdv_urgent === true ||
      fiche.qualification_code === 'RDV_URGENT'
    ) {
      etatParts.push('(RDV_URGENT)');
    }

    return {
      nom: fiche.nom || fiche.Nom || '',
      prenom: fiche.prenom || fiche.Prenom || '',
      telephone: fiche.tel || fiche.Tel || '',
      cp: fiche.cp || fiche.CP || '',
      date_insert: fiche.date_insert_time ? formatDate(fiche.date_insert_time) : '',
      date_rdv: fiche.date_rdv_time ? formatRdvDateTime(fiche.date_rdv_time) : '',
      etat: etatParts.filter(Boolean).join(' '),
      confirmateur: getConfirmateur(fiche) || '',
      commercial: getCommercial(fiche) || '',
      installateur: fiche.installeur || fiche.installateur_nom || '',
      centre: getCentre(fiche) || '',
      produit: getProduit(fiche) || '',
      valide: Number(fiche.valider) > 0 ? YES : NO,
      sig: indicators.sg ? YES : NO,
      cs: indicators.cs ? YES : NO,
      r2: indicators.r2 ? YES : NO,
      has: indicators.has ? YES : NO,
      rf: indicators.rf ? YES : NO,
      cq_etat: fiche.cqe || '',
      cq_dossier: fiche.cqd || '',
      cq_obs: cleanObservationCQ(fiche.observations_cq) || '',
      decalage: getDecalage(fiche) || '',
    };
  });
}
