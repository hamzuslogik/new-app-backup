/**
 * Couple / Célibataire sur formulaire CONFIRMER → fiches.situation_conjugale
 * Options stockées : COUPLE | CELIBATAIRE
 */

export function normalizeSituationConjugaleForm(value) {
  const s = String(value || '').trim().toUpperCase();
  if (!s) return '';
  if (s.startsWith('CELIB')) return 'CELIBATAIRE';
  if (
    s === 'COUPLE' ||
    s === 'MARIE' ||
    s === 'CONCUBINAGE' ||
    s === 'PAXE' ||
    s === 'PACSE'
  ) {
    return 'COUPLE';
  }
  return '';
}

/** Afficher Profession / Type contrat MR */
export function showConfProfessionMrFields(situationConjugale, confRdvAvec) {
  const sit = String(situationConjugale || '').toUpperCase();
  const avec = String(confRdvAvec || '').toUpperCase();
  if (sit === 'COUPLE') return true;
  if (sit === 'CELIBATAIRE') return avec === 'MR' || avec === 'AUTRE';
  return false;
}

/** Afficher Profession / Type contrat MME */
export function showConfProfessionMmeFields(situationConjugale, confRdvAvec) {
  const sit = String(situationConjugale || '').toUpperCase();
  const avec = String(confRdvAvec || '').toUpperCase();
  if (sit === 'COUPLE') return true;
  if (sit === 'CELIBATAIRE') return avec === 'MME' || avec === 'AUTRE';
  return false;
}

/**
 * Ancien comportement : vidait les champs masqués dans le state formulaire,
 * ce qui les envoyait ensuite en null et écrasait la BDD.
 * On conserve les valeurs en mémoire ; l'affichage reste conditionnel et
 * le submit n'inclut plus les champs masqués.
 * @returns {object} patch partiel (toujours vide — compat appels existants)
 */
export function clearHiddenConfProfessionFields(_formData) {
  return {};
}

/** Valeur métier utilisable (ignore null / '' / '0' issus d'anciens snapshots int). */
export function hasProfessionOrContratValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== '' && s !== '0';
}

/** Première valeur non vide parmi les candidats (conf_* puis base). */
export function pickProfessionOrContratValue(...candidates) {
  for (const v of candidates) {
    if (hasProfessionOrContratValue(v)) return v;
  }
  return null;
}
