const crypto = require('crypto');
const { query } = require('../config/database');

const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

const FICHES_HISTO_CONF_COLUMNS = [
  'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur', 'conf_profession_madame',
  'conf_presence_couple', 'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
  'conf_consommation_electricite', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
  'conf_deja_fait_etude', 'conf_details_etude',
  'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
  'conf_type_contrat_mr', 'conf_type_contrat_madame',
];

const VALID_FICHE_COLUMNS = [
  'civ', 'nom', 'prenom', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville', 'etude', 'details_etude',
  'consommation_chauffage', 'surface_habitable', 'annee_systeme_chauffage', 'surface_chauffee',
  'proprietaire_maison', 'nb_pieces', 'nb_pans', 'age_maison', 'orientation_toiture', 'produit',
  'site_classe', 'zones_ombres',
  'nb_chemines', 'mode_chauffage', 'complement_chauffage', 'consommation_electricite', 'age_mr', 'age_madame',
  'revenu_foyer', 'credit_foyer', 'situation_conjugale', 'entretien', 'nb_enfants', 'profession_mr',
  'profession_madame', 'type_contrat_mr', 'type_contrat_madame', 'commentaire', 'id_agent', 'id_centre', 'id_insert', 'id_confirmateur',
  'id_confirmateur_2', 'id_confirmateur_3', 'id_qualite', 'id_qualif', 'id_commercial',
  'id_commercial_2', 'id_etat_final', 'id_sous_etat', 'date_appel', 'date_insert', 'date_insert_time', 'date_appel_time',
  'date_audit', 'date_confirmation', 'date_qualif', 'date_rdv', 'date_rdv_time',
  'date_affect', 'date_sign', 'date_sign_time', 'date_modif_time', 'archive', 'ko', 'hc',
  'active', 'valider', 'conf_commentaire_produit', 'conf_consommations',
  'conf_profession_monsieur', 'conf_profession_madame', 'conf_presence_couple',
  'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
  'conf_consommation_electricite', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
  'conf_deja_fait_etude', 'conf_details_etude',
  'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
  'conf_type_contrat_mr', 'conf_type_contrat_madame',
  'cq_etat', 'cq_dossier',
  'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
  'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
  'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
  'credit_immobilier', 'credit_autre', 'valeur_mensualite', 'pseudo',
];

function encodeFicheId(id) {
  if (!id) return null;
  const hmac = crypto.createHmac('sha256', HASH_SECRET);
  hmac.update(String(id));
  const hash = hmac.digest('hex');
  const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m];
  });
  return `${hash.substring(0, 16)}${encodedId}`;
}

function getConfFieldsForHisto(source = {}, fallback = {}) {
  const cols = [...FICHES_HISTO_CONF_COLUMNS];
  const vals = cols.map((key) => {
    const v =
      source[key] !== undefined && source[key] !== ''
        ? source[key]
        : fallback[key] !== undefined && fallback[key] !== ''
          ? fallback[key]
          : null;
    return v === '' ? null : v;
  });
  return { cols, vals };
}

function prepareDonneesFicheForInsert(donneesFiche, { id_agent, id_centre_fallback, now }) {
  const data = { ...donneesFiche };

  if (data.tel && !String(data.tel).startsWith('0')) {
    data.tel = '0' + data.tel;
  }
  if (!data.gsm1 || data.gsm1 === '0') {
    data.gsm1 = data.tel;
  }
  if (!data.gsm2 || data.gsm2 === '0') {
    data.gsm2 = data.tel;
  }

  data.date_insert_time = now;
  data.date_modif_time = now;
  data.date_insert = Math.floor(Date.now() / 1000);
  if (!data.id_agent) {
    data.id_agent = id_agent;
  }
  data.active = 1;
  data.archive = 0;
  data.ko = 0;
  data.hc = 0;
  data.valider = 0;
  if (!data.id_etat_final) {
    data.id_etat_final = 1;
  }
  if (!data.id_centre && id_centre_fallback) {
    data.id_centre = id_centre_fallback;
  }

  // id_insert réservé à l'import en masse
  delete data.id_insert;

  return data;
}

/**
 * Archive la fiche existante et insère la nouvelle fiche (équivalent approbation demande d'insertion).
 */
async function approveInsertionFromDonnees({
  donneesFiche,
  existingFicheId,
  id_agent,
  id_centre_fallback,
  histoConfirmateurId,
  now,
}) {
  const ts = now || new Date().toISOString().slice(0, 19).replace('T', ' ');

  await query(`UPDATE fiches SET archive = 1, date_modif_time = ? WHERE id = ?`, [
    ts,
    existingFicheId,
  ]);

  const data = prepareDonneesFicheForInsert(donneesFiche, {
    id_agent,
    id_centre_fallback,
    now: ts,
  });

  const fields = [];
  const values = [];
  const placeholders = [];

  for (const [key, value] of Object.entries(data)) {
    if (VALID_FICHE_COLUMNS.includes(key) && value !== undefined && value !== null && value !== '') {
      fields.push(key);
      values.push(value);
      placeholders.push('?');
    }
  }

  if (fields.length === 0) {
    throw new Error('Aucun champ valide à insérer');
  }

  const sql = `INSERT INTO fiches (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
  const result = await query(sql, values);
  const insertId = result.insertId;

  let hash = null;
  if (insertId) {
    hash = encodeFicheId(insertId);
    await query('UPDATE fiches SET hash = ? WHERE id = ?', [hash, insertId]);
  }

  const histoEtatId = data.id_etat_final || 1;
  const isEtat7 = parseInt(histoEtatId, 10) === 7;
  const { cols: confCols, vals: confVals } = isEtat7
    ? getConfFieldsForHisto(data, {})
    : { cols: [], vals: [] };
  let histoCols = [
    'id_fiche',
    'id_etat',
    'id_confirmateur',
    'id_sous_etat',
    'date_rdv_time',
    'date_creation',
    ...confCols,
  ];
  const dateRdvHisto = data.date_rdv_time || null;
  let histoValues = [
    insertId,
    histoEtatId,
    histoConfirmateurId ?? id_agent ?? null,
    data.id_sous_etat != null ? data.id_sous_etat : null,
    dateRdvHisto,
    ts,
    ...confVals,
  ];
  if (Object.prototype.hasOwnProperty.call(data, 'complement_chauffage')) {
    histoCols.push('complement_chauffage');
    histoValues.push(
      data.complement_chauffage === '' || data.complement_chauffage == null
        ? null
        : data.complement_chauffage
    );
  }
  const histoPlaceholders = histoCols.map(() => '?').join(', ');
  await query(
    `INSERT INTO fiches_histo (${histoCols.join(', ')}) VALUES (${histoPlaceholders})`,
    histoValues
  );

  return { insertId, hash, donneesFiche: data };
}

module.exports = {
  approveInsertionFromDonnees,
  prepareDonneesFicheForInsert,
  encodeFicheId,
};
