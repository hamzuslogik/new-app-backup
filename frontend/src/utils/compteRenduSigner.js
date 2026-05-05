/** États « Signer » (phase 3) — champs PAC, finance, date de signature, etc. */
export const ETATS_COMPTE_RENDU_SIGNER = [13, 44, 45];

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
