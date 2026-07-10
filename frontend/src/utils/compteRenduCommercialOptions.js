/**
 * Libellés « compte rendu » vus par le commercial → états réels en base (id_etat_final).
 * Aucun nouvel état en BDD : uniquement la traduction côté interface.
 */
export const COMPTE_RENDU_COMMERCIAL_OPTIONS = [
  { key: 'signer', label: 'Signé', etatId: 13 },
  {
    key: 'honore_veut_reflechir',
    label: 'Honoré veut réfléchir',
    etatId: 9,
    legacyKeys: ['deballé_réfléchir'],
  },
  {
    key: 'honore_pas_interesse',
    label: 'Honoré pas intéressé',
    etatId: 12,
    legacyKeys: ['deballé_sans_suite'],
  },
  {
    key: 'honore_infinancable',
    label: 'Honoré infinançable',
    etatId: 34,
    legacyKeys: ['infinançable'],
  },
  {
    key: 'honore_infaisabilite_technique',
    label: 'Honoré infaisabilité technique',
    etatId: 35,
    legacyKeys: ['infaisabilité_technique'],
  },
  {
    key: 'porte',
    label: 'Porte',
    etatId: 8,
    annulerReproSimple: true,
  },
  {
    key: 'telephone_imprevu_annuler',
    label: 'Téléphone: Imprévu/Annuler',
    etatId: 8,
    annulerReproSimple: true,
  },
  {
    key: 'nrp',
    label: 'NRP',
    etatId: 8,
    annulerReproSimple: true,
  },
  {
    key: 'rdv_valide_non_faisable',
    label: 'RDV validé non faisable',
    etatId: 8,
    annulerReproSimple: true,
  },
];

export function resolveOptionKey(rawKey) {
  if (!rawKey) return '';
  const direct = COMPTE_RENDU_COMMERCIAL_OPTIONS.find((o) => o.key === rawKey);
  if (direct) return direct.key;
  const legacy = COMPTE_RENDU_COMMERCIAL_OPTIONS.find((o) =>
    (o.legacyKeys || []).includes(rawKey)
  );
  if (legacy) return legacy.key;
  if (rawKey === 'porte_imprevu_nrp') return 'porte';
  return rawKey;
}

export function getCompteRenduOptionByKey(optionKey) {
  return COMPTE_RENDU_COMMERCIAL_OPTIONS.find((o) => o.key === resolveOptionKey(optionKey)) || null;
}

export function getCompteRenduOptionLabel(optionKey, etatId = null) {
  const opt = getCompteRenduOptionByKey(optionKey);
  if (opt) return opt.label;
  if ([13, 44, 45].includes(Number(etatId))) return 'Signé';
  const byEtat = COMPTE_RENDU_COMMERCIAL_OPTIONS.find((o) => o.etatId === Number(etatId) && !o.annulerReproSimple);
  if (byEtat) return byEtat.label;
  if (Number(etatId) === 8) return 'Porte';
  return null;
}

/** Options « Annuler à reprogrammer » : le commercial ne saisit que le commentaire. */
export function isCommercialAnnulerReproSimpleOption(optionKey) {
  const key = resolveOptionKey(optionKey);
  if (key === 'porte_imprevu_nrp') return true;
  const opt = getCompteRenduOptionByKey(key);
  return !!(opt && opt.annulerReproSimple);
}

export function resolveCompteRenduOptionFromCr(cr) {
  const mods = cr?.modifications || {};
  const stored =
    mods.compte_rendu_option != null && String(mods.compte_rendu_option) !== ''
      ? mods.compte_rendu_option
      : null;
  if (stored) return resolveOptionKey(stored);

  const etatId = Number(cr?.id_etat_final);
  if ([13, 44, 45].includes(etatId)) return 'signer';
  const fixed = COMPTE_RENDU_COMMERCIAL_OPTIONS.find(
    (o) => o.etatId === etatId && !o.annulerReproSimple
  );
  if (fixed) return fixed.key;
  if (etatId === 8) return 'porte';
  return '';
}

export function buildEtatFormPatchForCompteRenduOption(optionKey, { ficheData, splitDateTimeForInput }) {
  const opt = getCompteRenduOptionByKey(optionKey);
  if (!opt) return { selectedEtat: null, patch: {} };

  if (opt.key === 'signer') {
    const { date: dateStr, time: timeStr } = splitDateTimeForInput(ficheData?.date_rdv_time);
    return {
      selectedEtat: opt.etatId,
      patch: {
        date_sign_date: dateStr,
        date_sign_time: timeStr,
        produit: ficheData?.produit ? String(ficheData.produit) : '',
        id_commercial: ficheData?.id_commercial ? String(ficheData.id_commercial) : '',
        id_sous_etat: '',
      },
    };
  }

  if (opt.etatId === 9) {
    return { selectedEtat: opt.etatId, patch: { conf_commentaire_produit: '' } };
  }

  if (opt.etatId === 12 || opt.etatId === 34) {
    return { selectedEtat: opt.etatId, patch: { conf_commentaire_produit: '', motif_qualif: '' } };
  }

  if (opt.etatId === 35) {
    return { selectedEtat: opt.etatId, patch: { conf_commentaire_produit: '' } };
  }

  if (opt.annulerReproSimple) {
    return {
      selectedEtat: 8,
      patch: {
        conf_rdv_date: '',
        conf_rdv_time: '',
        id_sous_etat: '',
        conf_rdv_avec: '',
        conf_commentaire_produit: '',
      },
    };
  }

  return { selectedEtat: opt.etatId, patch: {} };
}

export function applyCompteRenduOptionChange(
  optionKey,
  { etatFormData, ficheData, splitDateTimeForInput, setSelectedEtat, setEtatFormData }
) {
  if (!optionKey) {
    setSelectedEtat(null);
    return;
  }
  const { selectedEtat, patch } = buildEtatFormPatchForCompteRenduOption(optionKey, {
    ficheData,
    splitDateTimeForInput,
  });
  setSelectedEtat(selectedEtat);

  // Conserver le compte rendu déjà saisi lors d'un changement d'option / d'état
  const preservedComment = String(
    etatFormData?.conf_commentaire_produit || etatFormData?.motif_qualif || ''
  ).trim();
  const nextPatch = { ...patch };
  if (preservedComment) {
    if (
      Object.prototype.hasOwnProperty.call(nextPatch, 'conf_commentaire_produit') &&
      !String(nextPatch.conf_commentaire_produit || '').trim()
    ) {
      nextPatch.conf_commentaire_produit = preservedComment;
    }
    if (
      Object.prototype.hasOwnProperty.call(nextPatch, 'motif_qualif') &&
      !String(nextPatch.motif_qualif || '').trim()
    ) {
      nextPatch.motif_qualif = preservedComment;
    }
    if (!Object.prototype.hasOwnProperty.call(nextPatch, 'conf_commentaire_produit')) {
      nextPatch.conf_commentaire_produit = preservedComment;
    }
  }

  setEtatFormData({ ...etatFormData, ...nextPatch });
}
