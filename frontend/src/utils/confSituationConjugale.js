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
 * Applique les règles d'affichage : vide les champs masqués.
 * @returns {object} patch partiel pour confFormData / rdvFormData
 */
export function clearHiddenConfProfessionFields(formData) {
  const sit = formData?.situation_conjugale;
  const avec = formData?.conf_rdv_avec;
  const patch = {};
  if (!showConfProfessionMrFields(sit, avec)) {
    patch.conf_profession_monsieur = '';
    patch.conf_type_contrat_mr = '';
  }
  if (!showConfProfessionMmeFields(sit, avec)) {
    patch.conf_profession_madame = '';
    patch.conf_type_contrat_madame = '';
  }
  return patch;
}
