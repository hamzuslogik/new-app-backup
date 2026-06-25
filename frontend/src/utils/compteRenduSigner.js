/** États « Signer » (phase 3) — champs PAC, finance, date de signature, etc. */
export const ETATS_COMPTE_RENDU_SIGNER = [13, 44, 45];

/**
 * États possibles pour un compte rendu commercial (aligné FicheDetail + porte ouverte).
 * Filtre page Compte rendu : Signer, Honoré à suivre, Refuser, etc.
 */
export const ETATS_COMPTE_RENDU_FILTER_IDS = [
  8, // Porte, Téléphone, NRP, RDV non faisable → ANNULER À REPROGRAMMER
  9, // Honoré veut réfléchir → CLIENT HONORÉ À SUIVRE
  12, // Honoré pas intéressé → REFUSER
  13, // Signé
  34, // Honoré infinançable → HHC FINANCEMENT À VÉRIFIER
  35 // Honoré infaisabilité technique → HHC TECHNIQUE
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
