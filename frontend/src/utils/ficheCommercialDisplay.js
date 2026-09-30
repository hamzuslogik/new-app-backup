/**
 * Affichage colonne Commercial (listes fiches).
 * En recherche signatures (date_sign_time / tout signer) : priorité au commercial
 * historisé au moment de la signature (id_commercial_signature / pseudo).
 */
export function isSignatureSearchContext(filters = {}) {
  const dateChamp = String(filters?.date_champ || '').trim();
  const etat = String(filters?.id_etat_final ?? '').trim();
  return (
    dateChamp === 'date_sign_time' ||
    etat === 't_s' ||
    filters?.sgn_week === 1 ||
    filters?.sgn_week === '1' ||
    filters?.sgn_month === 1 ||
    filters?.sgn_month === '1'
  );
}

export function formatFicheCommercialDisplay(fiche, getUserName, filters = {}) {
  const resolveName = typeof getUserName === 'function' ? getUserName : () => '';
  const preferSignature = isSignatureSearchContext(filters);

  const sign1 =
    (fiche?.commercial_signature_pseudo && String(fiche.commercial_signature_pseudo).trim()) ||
    (fiche?.id_commercial_signature != null && Number(fiche.id_commercial_signature) > 0
      ? resolveName(fiche.id_commercial_signature)
      : '') ||
    '';
  const sign2 =
    (fiche?.commercial_2_signature_pseudo && String(fiche.commercial_2_signature_pseudo).trim()) ||
    (fiche?.id_commercial_2_signature != null && Number(fiche.id_commercial_2_signature) > 0
      ? resolveName(fiche.id_commercial_2_signature)
      : '') ||
    '';

  const current1 = resolveName(fiche?.id_commercial) || '';
  const current2 = resolveName(fiche?.id_commercial_2) || '';

  const c1 = preferSignature ? sign1 || current1 : current1 || sign1;
  const c2 = preferSignature ? sign2 || current2 : current2 || sign2;

  const id1 = preferSignature
    ? Number(fiche?.id_commercial_signature || fiche?.id_commercial) || null
    : Number(fiche?.id_commercial || fiche?.id_commercial_signature) || null;
  const id2 = preferSignature
    ? Number(fiche?.id_commercial_2_signature || fiche?.id_commercial_2) || null
    : Number(fiche?.id_commercial_2 || fiche?.id_commercial_2_signature) || null;

  const sameUser = id1 != null && id2 != null && id1 > 0 && id2 > 0 && id1 === id2;
  if (sameUser) return c1 || '';
  if (c1 && c2) return `${c1} | ${c2}`;
  if (!c1 && c2) return `| ${c2}`;
  if (c1 && !c2) return c1;
  return '';
}
