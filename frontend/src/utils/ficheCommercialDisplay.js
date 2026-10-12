/**
 * Affichage colonne Commercial (listes fiches).
 * Libellé = pseudo (API commercial_pseudo / utilisateurs).
 * En recherche signatures : priorité au commercial historisé à la signature.
 * R2 : le 2e libellé après « | » vient de id_commercial_r1 (plus de commercial 2 à la création RDV).
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

function isFicheR2(fiche) {
  const v = fiche?.is_r2;
  return v === 1 || v === '1' || v === true || String(v || '').toUpperCase() === 'OUI';
}

/** 2e commercial affiché : id_commercial_2 si présent, sinon id_commercial_r1 si R2. */
export function resolveSecondaryCommercialId(fiche) {
  if (fiche?.id_commercial_2 != null && Number(fiche.id_commercial_2) > 0) {
    return Number(fiche.id_commercial_2);
  }
  if (isFicheR2(fiche) && fiche?.id_commercial_r1 != null && Number(fiche.id_commercial_r1) > 0) {
    return Number(fiche.id_commercial_r1);
  }
  return null;
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

  // commercial_pseudo API = pseudo côté backend ; sinon résolution users
  const current1 =
    (fiche?.commercial_pseudo && String(fiche.commercial_pseudo).trim()) ||
    resolveName(fiche?.id_commercial) ||
    '';

  const secondaryId = resolveSecondaryCommercialId(fiche);
  const current2 =
    (fiche?.commercial_2_pseudo && String(fiche.commercial_2_pseudo).trim()) ||
    (fiche?.commercial_r1_pseudo && isFicheR2(fiche)
      ? String(fiche.commercial_r1_pseudo).trim()
      : '') ||
    (secondaryId ? resolveName(secondaryId) : '') ||
    '';

  const c1 = preferSignature ? sign1 || current1 : current1 || sign1;
  const c2 = preferSignature ? sign2 || current2 : current2 || sign2;

  const id1 = preferSignature
    ? Number(fiche?.id_commercial_signature || fiche?.id_commercial) || null
    : Number(fiche?.id_commercial || fiche?.id_commercial_signature) || null;
  const id2 = preferSignature
    ? Number(fiche?.id_commercial_2_signature || secondaryId) || null
    : Number(secondaryId || fiche?.id_commercial_2_signature) || null;

  const sameUser = id1 != null && id2 != null && id1 > 0 && id2 > 0 && id1 === id2;
  if (sameUser) return c1 || '';
  if (c1 && c2) return `${c1} | ${c2}`;
  if (!c1 && c2) return `| ${c2}`;
  if (c1 && !c2) return c1;
  return '';
}
