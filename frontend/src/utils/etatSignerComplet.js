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

export function isSignerCompletBySousEtat(fiche, etats = [], sousEtats = []) {
  const etatId = Number(getEtatId(fiche));
  const etatTitle = normalizeLabel(getEtatTitle(fiche, etats));
  const sousEtatTitle = normalizeLabel(getSousEtatTitle(fiche, sousEtats));
  const isBaseSigner = etatId === 13 || etatTitle === 'signer';
  const isSousEtatComplet = sousEtatTitle === 'complet' || sousEtatTitle === 'signer complet';

  return isBaseSigner && isSousEtatComplet;
}

export function getSignerCompletEtat(etats = []) {
  return (
    etats.find((e) => normalizeLabel(e?.titre) === 'signer complet') ||
    etats.find((e) => Number(e?.id) === 45) ||
    null
  );
}

export function getEffectiveEtatTitle(fiche, etats = [], sousEtats = []) {
  if (isSignerCompletBySousEtat(fiche, etats, sousEtats)) {
    return 'Signer Complet';
  }
  return getEtatTitle(fiche, etats);
}

export function getEffectiveEtatColor(fiche, etats = [], sousEtats = [], fallbackColor = '#cccccc') {
  if (isSignerCompletBySousEtat(fiche, etats, sousEtats)) {
    return getSignerCompletEtat(etats)?.color || fallbackColor;
  }

  const explicitColor = fiche?.etat_color || fiche?.etat_final_color;
  if (explicitColor) return explicitColor;

  const etatId = getEtatId(fiche);
  return etats.find((e) => Number(e.id) === Number(etatId))?.color || fallbackColor;
}
