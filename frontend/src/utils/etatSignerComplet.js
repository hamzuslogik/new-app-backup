function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getEtatId(fiche) {
  return fiche?.id_etat_final ?? fiche?.fiche_id_etat_final ?? fiche?.id_etat ?? null;
}

function getEtatTitle(fiche, etats = []) {
  const fromFiche = fiche?.etat_titre || fiche?.etat_final_titre || '';
  if (fromFiche) return fromFiche;
  const etatId = getEtatId(fiche);
  return etats.find((e) => Number(e.id) === Number(etatId))?.titre || '';
}

function getSousEtatTitle(fiche, sousEtats = []) {
  const fromFiche = fiche?.sous_etat_titre || '';
  if (fromFiche) return fromFiche;
  const sousEtatId = fiche?.id_sous_etat ?? fiche?.fiche_id_sous_etat ?? null;
  return sousEtats.find((s) => Number(s.id) === Number(sousEtatId))?.titre || '';
}

/** États « Signer » (liste + variantes) — affichage état + sous-état dans la même colonne */
export const ETATS_SIGNER_IDS = [13, 16, 38, 44, 45];

export function isSignerEtat(fiche, etats = []) {
  const etatId = Number(getEtatId(fiche));
  if (ETATS_SIGNER_IDS.includes(etatId)) return true;
  const etatTitle = normalizeLabel(getEtatTitle(fiche, etats));
  return etatTitle.includes('signer');
}

/** Libellé colonne État : « SIGNER - COMPLETE » pour les états signer ayant un sous-état */
export function getEtatDisplayWithSousEtat(fiche, etats = [], sousEtats = []) {
  const baseTitle = (getEtatTitle(fiche, etats) || '').trim() || '-';
  if (!isSignerEtat(fiche, etats)) return baseTitle;
  const sousTitle = (getSousEtatTitle(fiche, sousEtats) || '').trim();
  if (!sousTitle) return baseTitle;
  return `${baseTitle} - ${sousTitle}`;
}

export function isSignerCompletBySousEtat(fiche, etats = [], sousEtats = []) {
  const etatId = Number(getEtatId(fiche));
  const etatTitle = normalizeLabel(getEtatTitle(fiche, etats));
  const sousEtatTitle = normalizeLabel(getSousEtatTitle(fiche, sousEtats));
  const isBaseSigner = etatId === 13 || etatTitle === 'signer';
  // Le titre du sous-état en BDD est "COMPLETE" (cf. insert_sous_etat_liste_fixee.sql),
  // mais on accepte aussi les variantes "COMPLET" et "SIGNER COMPLET".
  const isSousEtatComplet =
    sousEtatTitle === 'complet' ||
    sousEtatTitle === 'complete' ||
    sousEtatTitle === 'signer complet' ||
    sousEtatTitle === 'signer complete' ||
    sousEtatTitle.startsWith('complet'); // couvre "complet", "complete", "complétée", etc.

  return isBaseSigner && isSousEtatComplet;
}

export function getSignerCompletEtat(etats = []) {
  return (
    etats.find((e) => normalizeLabel(e?.titre) === 'signer complet') ||
    etats.find((e) => Number(e?.id) === 45) ||
    null
  );
}

function isAlreadySignerComplet(fiche, etats = []) {
  const etatId = Number(getEtatId(fiche));
  if (etatId === 45) return true;
  const etatTitle = normalizeLabel(getEtatTitle(fiche, etats));
  return etatTitle === 'signer complet';
}

export function getEffectiveEtatTitle(fiche, etats = [], sousEtats = []) {
  if (
    isAlreadySignerComplet(fiche, etats) ||
    isSignerCompletBySousEtat(fiche, etats, sousEtats)
  ) {
    return 'Signer Complet';
  }
  return getEtatTitle(fiche, etats);
}

export function getEffectiveEtatColor(fiche, etats = [], sousEtats = [], fallbackColor = '#cccccc') {
  if (isSignerCompletBySousEtat(fiche, etats, sousEtats)) {
    return (
      getSignerCompletEtat(etats)?.color ||
      fiche?.etat_color ||
      fiche?.etat_final_color ||
      fallbackColor
    );
  }

  const explicitColor = fiche?.etat_color || fiche?.etat_final_color;
  if (explicitColor) return explicitColor;

  const etatId = getEtatId(fiche);
  return etats.find((e) => Number(e.id) === Number(etatId))?.color || fallbackColor;
}
