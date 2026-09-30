/**
 * Validation création / confirmation RDV (état CONFIRMER).
 * Tous les champs sont obligatoires sauf :
 * - Profession MR / MME
 * - Type de contrat MR / MME
 * - Commercial 2
 * - Confirmateur 2 / 3 (ajout facultatif)
 */

function isUnset(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function resolveProduitKind(produit, produits) {
  const id = Number(produit);
  if (id === 1) return 'pac';
  if (id === 2) return 'pv';
  const found = (produits || []).find((p) => String(p.id) === String(produit));
  const nom = String(found?.nom || '').toUpperCase();
  if (nom.includes('PAC')) return 'pac';
  if (nom.includes('PV')) return 'pv';
  return null;
}

/**
 * @param {object} opts
 * @param {object} opts.formData - rdvFormData ou confFormData
 * @param {array} [opts.produits]
 * @param {boolean} [opts.requireConfirmateur=true]
 * @param {'create'|'confirm'} [opts.mode='create']
 */
export function validateCreateRdvForm({
  formData,
  produits = [],
  requireConfirmateur = true,
  mode = 'create',
}) {
  const data = formData || {};
  const missing = [];
  const requireField = (condition, label) => {
    if (condition) missing.push(label);
  };

  if (mode === 'confirm') {
    requireField(isUnset(data.conf_rdv_date), 'Date RDV');
    requireField(isUnset(data.conf_rdv_time), 'Heure RDV');
  } else {
    requireField(isUnset(data.date_rdv_time), 'Date et heure du RDV');
  }

  requireField(isUnset(data.produit), 'Produit');
  if (requireConfirmateur) {
    requireField(isUnset(data.id_confirmateur), 'Confirmateur');
  }

  requireField(isUnset(data.is_r2), 'R2');
  if (String(data.is_r2 || '').toUpperCase() === 'OUI') {
    requireField(isUnset(data.date_r1), 'Date R1');
    requireField(isUnset(data.id_commercial_r1), 'Commercial R1');
    requireField(isUnset(data.commentaire_r1), 'Commentaire R1');
  }

  requireField(isUnset(data.conf_rdv_avec), 'RDV pris avec');
  requireField(isUnset(data.conf_appel_tunisie_avec), 'Appel en Tunisie avec');

  const dejaEtude = data.conf_deja_etude || data.conf_deja_fait_etude;
  requireField(isUnset(dejaEtude), 'A déjà fait une étude');
  if (String(dejaEtude || '').toUpperCase() === 'OUI') {
    requireField(isUnset(data.conf_details_etude), 'Détails étude');
  }

  requireField(isUnset(data.conf_presence_couple), 'Présence du couple ou célibataire');
  requireField(isUnset(data.conf_rdv_annule_precedent), 'RDV déjà annulé précédemment');
  requireField(isUnset(data.conf_revenu), 'Revenu');
  requireField(isUnset(data.conf_credit), 'Crédit');
  requireField(isUnset(data.conf_mode_chauffage), 'Mode de chauffage');
  requireField(isUnset(data.conf_consommation_electricite), 'Consommations électrique');
  requireField(isUnset(data.conf_consommation_chauffage), 'Consommations chauffage');
  requireField(isUnset(data.conf_commentaire_produit), 'Commentaire Confirmation');

  const kind = resolveProduitKind(data.produit, produits);
  if (kind === 'pac') {
    requireField(isUnset(data.surface_chauffee), 'Surface chauffée');
    requireField(isUnset(data.consommation_chauffage), 'Consommation chauffage (PAC)');
    requireField(isUnset(data.annee_systeme_chauffage), 'Année système chauffage');
  } else if (kind === 'pv') {
    requireField(isUnset(data.conf_orientation_toiture), 'Orientation toiture');
    requireField(isUnset(data.conf_zones_ombres), 'Zones ombres');
    requireField(isUnset(data.conf_site_classe), 'Proche d\'un site classé');
  }

  return { valid: missing.length === 0, missing };
}

export function alertCreateRdvValidation(missing) {
  alert(`Veuillez renseigner tous les champs obligatoires :\n\n• ${missing.join('\n• ')}`);
}
