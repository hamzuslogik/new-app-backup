/** Sessions autorisées à exporter les résultats de recherche du Dashboard. */
export const DASHBOARD_EXPORT_USER_IDS = new Set([3981, 2814]);

export function canExportDashboardResults(user) {
  return DASHBOARD_EXPORT_USER_IDS.has(Number(user?.id));
}

export const DASHBOARD_EXPORT_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'cp', label: 'CP' },
  { key: 'date_rdv', label: 'Date RDV' },
  { key: 'etat', label: 'État' },
  { key: 'confirmateur', label: 'Confirmateur' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'centre', label: 'Centre' },
  { key: 'installateur', label: 'Installateur' },
  { key: 'produit', label: 'Produit' },
];

/**
 * @param {Array} fiches
 * @param {{ formatRdvDateTime?: Function, getEtatDisplay?: Function, getCommercial?: Function, getConfirmateur?: Function, getCentre?: Function, getProduit?: Function }} helpers
 */
export function buildDashboardExportRows(fiches, helpers = {}) {
  const {
    formatRdvDateTime = () => '',
    getEtatDisplay = (f) => f?.etat_titre || f?.etat_libelle || '',
    getCommercial = (f) => f?.commercial_pseudo || '',
    getConfirmateur = (f) => f?.confirmateur_pseudo || '',
    getCentre = (f) => f?.centre_titre || '',
    getProduit = (f) => (f?.produit != null && f.produit !== '' ? String(f.produit) : ''),
  } = helpers;

  return (fiches || []).map((fiche) => ({
    id: fiche.id || fiche.id_fiche || '',
    nom: fiche.nom || fiche.Nom || '',
    prenom: fiche.prenom || fiche.Prenom || '',
    telephone: fiche.tel || fiche.Tel || '',
    cp: fiche.cp || fiche.CP || '',
    date_rdv: fiche.date_rdv_time ? formatRdvDateTime(fiche.date_rdv_time) : '',
    etat: getEtatDisplay(fiche) || '',
    confirmateur: getConfirmateur(fiche) || '',
    commercial: getCommercial(fiche) || '',
    centre: getCentre(fiche) || '',
    installateur: fiche.installateur_nom || '',
    produit: getProduit(fiche) || '',
  }));
}
