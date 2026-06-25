import { resolveSignerProduitKind } from '../components/SignerProduitFormFields';

export function filterSignerSousEtats(sousEtats) {
  return (sousEtats || []).filter((se) => {
    const titre = (se?.titre || '').toString().trim().toUpperCase();
    return titre === 'COMPLETE' || titre === 'IMCOMPLETE' || titre === 'INCOMPLETE';
  });
}

function isUnset(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/**
 * Valide tous les champs du formulaire compte rendu Signer (états 13, 44, 45).
 * Commercial 2 reste facultatif.
 */
export function validateSignerCompteRenduForm({
  etatFormData,
  produits,
  sousEtats = [],
  requireCommercial = false,
  extraFields = {},
  sousEtatsMode = 'signer-filter',
}) {
  const data = { ...etatFormData, ...extraFields };
  const missing = [];
  const requireField = (condition, label) => {
    if (condition) missing.push(label);
  };

  const kind = resolveSignerProduitKind(data.produit, produits);
  const relevantSousEtats =
    sousEtatsMode === 'any' ? (sousEtats || []) : filterSignerSousEtats(sousEtats);

  requireField(isUnset(data.pseudo), 'Pseudo');
  requireField(isUnset(data.produit), 'Signature pour');

  if (relevantSousEtats.length > 0) {
    requireField(isUnset(data.id_sous_etat), 'Sous État');
  }

  if (requireCommercial) {
    requireField(isUnset(data.id_commercial), 'Commercial');
  }

  if (!kind) {
    if (!isUnset(data.produit)) {
      requireField(true, 'Signature pour (PAC ou PV valide)');
    }
    return { valid: missing.length === 0, missing };
  }

  requireField(isUnset(data.ph3_attente), 'Financement');

  if (kind === 'pac') {
    requireField(isUnset(data.ph3_pac), 'Pac');
    requireField(isUnset(data.ph3_rr_model), 'Marque Pac');
    requireField(isUnset(data.ph3_puissance), 'Puissance');
    requireField(isUnset(data.ph3_ballon), 'Ballon');
    requireField(isUnset(data.ph3_marque_ballon), 'Marque ballon');
    requireField(isUnset(data.ph3_alimentation), 'Alimentation');
    requireField(isUnset(data.ph3_type), 'Type');
  } else if (kind === 'pv') {
    requireField(isUnset(data.ph3_rr_model), 'Marque PV');
    requireField(isUnset(data.ph3_puissance_pv), 'Puissance');
  }

  requireField(isUnset(data.ph3_prix), 'Prix');
  requireField(isUnset(data.credit_immobilier), 'Crédit immobilier');
  requireField(isUnset(data.credit_autre), 'Autre crédit');
  requireField(isUnset(data.ph3_installateur), 'Installateur');
  requireField(isUnset(data.conf_consommations), 'Consommation annuelle ancien système');
  requireField(isUnset(data.valeur_mensualite), 'Partie à financer du client');
  requireField(isUnset(data.ph3_bonus_30), 'Bonus annoncé');
  requireField(isUnset(data.ph3_mensualite), 'Mensualité du crédit');
  requireField(isUnset(data.nbr_annee_finance), 'Nombre de mois du crédit');
  requireField(
    isUnset(data.date_sign_date) || isUnset(data.date_sign_time),
    'Date et heure signature'
  );

  return { valid: missing.length === 0, missing };
}

export function alertSignerCompteRenduValidation(missing) {
  alert(`Veuillez renseigner tous les champs obligatoires :\n\n• ${missing.join('\n• ')}`);
}
