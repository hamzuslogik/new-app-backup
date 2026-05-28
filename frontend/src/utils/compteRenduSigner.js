/** États « Signer » (phase 3) — champs PAC, finance, date de signature, etc. */
export const ETATS_COMPTE_RENDU_SIGNER = [13, 44, 45];

/**
 * États possibles pour un compte rendu commercial (aligné FicheDetail + porte ouverte).
 * Filtre page Compte rendu : Signer, Honoré à suivre, Refuser, etc.
 */
export const ETATS_COMPTE_RENDU_FILTER_IDS = [
  8, // Porte / Imprévu / NRP → ANNULER À REPROGRAMMER
  9, // Déballé veut réfléchir → CLIENT HONORÉ À SUIVRE
  12, // Déballé sans suite → REFUSER
  13, // Signer
  16, // SIGNER RETRACTER
  34, // Infinançable → HHC FINANCEMENT À VÉRIFIER
  35, // Infaisabilité technique → HHC TECHNIQUE
  38, // SIGNER RETRACTER 2 FOIS
  44, // SIGNER PM
  45 // SIGNER COMPLET
];

/** Liste des états CR pour un filtre UI, dans l'ordre métier. */
export const getEtatsCompteRenduFilter = (etatsList) => {
  const idSet = new Set(ETATS_COMPTE_RENDU_FILTER_IDS.map(Number));
  const order = new Map(ETATS_COMPTE_RENDU_FILTER_IDS.map((id, index) => [id, index]));
  return (etatsList || [])
    .filter((e) => idSet.has(Number(e.id)))
    .sort((a, b) => (order.get(Number(a.id)) ?? 999) - (order.get(Number(b.id)) ?? 999));
};

export const isCompteRenduSignerEtat = (crOrIdEtat) => {
  const id =
    crOrIdEtat != null && typeof crOrIdEtat === 'object'
      ? crOrIdEtat.id_etat_final
      : crOrIdEtat;
  return ETATS_COMPTE_RENDU_SIGNER.includes(Number(id));
};

/** Clés dans `modifications` réservées aux CR Signer (à masquer si l’état n’est pas Signer) */
export const SIGNATURE_ONLY_MODIFICATION_KEYS = new Set([
  'produit',
  'date_sign_time',
  'id_commercial',
  'id_commercial_2',
  'pseudo',
  'conf_consommations',
  'valeur_mensualite'
]);
