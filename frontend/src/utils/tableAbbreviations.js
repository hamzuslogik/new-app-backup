/**
 * Abréviations affichage tableaux fiches (centre / état) — une seule ligne.
 * Centres : pas de colonne abbreviation en BDD → dérivation depuis le titre.
 * États : priorité à etats.abbreviation (BDD).
 */

const PRODUCT_SUFFIXES = new Set(['PAC', 'PV', 'HC', 'ISO']);

const DROP_PREFIXES = new Set(['CALL', 'LEAD', 'LEADS']);

/** Mots fréquents dans les titres centres → forme courte lisible */
const CENTRE_WORD_ABBR = {
  CONSULTING: 'Cons',
  PEPINIERE: 'Pep',
  SERVICES: 'Svc',
  SOLUTION: 'Sol',
  ENERGIE: 'Ener',
  ENERGY: 'Egy',
  DATACENTER: 'DC',
  INSTALL: 'Inst',
  FRANCE: 'Fr',
  ANCIEN: 'Anc',
  FICHES: 'Fich',
  ROBOT: 'Rob',
  MEDIA: 'Med',
  GROUPE: 'Grp',
  LIMITLESS: 'Lmtless',
  PERFECTLINE: 'Perfect',
  PROVOICE: 'Provoice',
  REVOICE: 'Revoice',
  PHOCEEN: 'Phoceen',
  OPTIMUM: 'Opt',
  LOGICALL: 'Logicall',
  SCALE: 'Scale',
  NECTOM: 'Nectom',
  HARDOR09: 'Hardor09',
  WISSAL: 'Wissal',
  REDALA: 'Redala',
  REYNES: 'Reynes',
  ASTON: 'Aston',
  BASSEL: 'Bassel',
  KOMTEL: 'Komtel',
  SOLARITE: 'Solarite',
  DATACENTER_PRO: 'DC Pro',
  SIGNE: 'Signé',
  'SIGNÉ': 'Signé',
  RENOVE: 'Renov',
  RENOVES: 'Renov',
  BLUE: 'Blue',
  LOOP: 'Loop',
  MYLOOP: 'MyLoop',
  VOICE: 'Voice',
  PRO: 'Pro',
  GOLDEN: 'Golden',
  GMA: 'GMA',
  G2S: 'G2S',
  JWS: 'JWS',
  CASA: 'Casa',
  SKYNET: 'Skynet',
  LAURENT: 'Laurent',
  JEREMY: 'Jeremy',
  GARY: 'Gary',
  FY: 'FY',
  YOHAI: 'Yohai',
  SPIN8: 'Spin8',
  MDL: 'MDL',
  ADM: 'ADM',
  STP: 'STP',
  DATA: 'Data',
  IA: 'IA',
  ISO: 'ISO',
  HY770: 'HY770',
  T2F: 'T2F',
  DPM: 'DPM',
  AGENCE26: 'Ag26',
  '2R': '2R',
  '2D': '2D',
  SOS: 'SOS',
  JOB: 'Job',
  TH: 'TH',
  CMI: 'CMI',
  LEH: 'LEH',
  CERTI: 'Certi',
  BATI: 'Bati',
  MHG: 'MHG',
  MS: 'MS',
  HAROLD: 'Harold',
  AD: 'AD',
  CEDRIC: 'Cedric',
};

const SOUS_ETAT_ABBR = {
  COMPLETE: 'COMP',
  COMPLET: 'COMP',
  INCOMPLETE: 'INCOMP',
  INCOMPLET: 'INCOMP',
  EN_COURS: 'EN CRS',
  'EN COURS': 'EN CRS',
};

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function capitalizeToken(token) {
  const s = String(token || '');
  if (!s) return '';
  if (/^[A-Z0-9]+$/.test(s) && s.length <= 4) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function abbreviateCentreToken(token) {
  const key = normalizeKey(token).replace(/\s+/g, '_');
  if (CENTRE_WORD_ABBR[key]) return CENTRE_WORD_ABBR[key];
  if (token.length <= 9) return capitalizeToken(token);
  return `${capitalizeToken(token.slice(0, 7))}.`;
}

/**
 * Abrège un titre de centre pour l’affichage tableau (nowrap).
 * Ex. Call_GOLDEN_CONSULTING_PAC → Golden Cons PAC
 */
export function abbreviateCentreName(titre) {
  if (titre == null || titre === '') return '';
  const raw = String(titre).trim();
  if (!raw) return '';

  const parts = raw.split(/[_\s]+/).filter(Boolean);
  if (parts.length === 0) return raw;

  let product = '';
  const last = normalizeKey(parts[parts.length - 1]);
  if (PRODUCT_SUFFIXES.has(last)) {
    product = last;
    parts.pop();
  }

  while (parts.length && DROP_PREFIXES.has(normalizeKey(parts[0]))) {
    parts.shift();
  }

  // MY + LOOP (+ CALL déjà retiré) → MyLoop
  if (
    parts.length >= 2 &&
    normalizeKey(parts[0]) === 'MY' &&
    normalizeKey(parts[1]) === 'LOOP'
  ) {
    parts.splice(0, 2, 'MyLoop');
  }

  // VOICE + PRO → VoicePro
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (normalizeKey(parts[i]) === 'VOICE' && normalizeKey(parts[i + 1]) === 'PRO') {
      parts.splice(i, 2, 'VoicePro');
      break;
    }
  }

  const words = parts.map(abbreviateCentreToken).filter(Boolean);
  const label = [words.join(' '), product].filter(Boolean).join(' ').trim();
  return label || raw;
}

/**
 * Abrège un under-état (COMPLETE → COMP, etc.).
 */
export function abbreviateSousEtatTitle(titre) {
  if (!titre) return '';
  const key = normalizeKey(titre).replace(/\s+/g, ' ');
  if (SOUS_ETAT_ABBR[key]) return SOUS_ETAT_ABBR[key];
  if (SOUS_ETAT_ABBR[key.replace(/ /g, '_')]) return SOUS_ETAT_ABBR[key.replace(/ /g, '_')];
  if (titre.length <= 8) return String(titre).trim().toUpperCase();
  return `${String(titre).trim().slice(0, 6).toUpperCase()}.`;
}

function getEtatId(fiche) {
  return fiche?.id_etat_final ?? fiche?.fiche_id_etat_final ?? fiche?.id_etat ?? null;
}

function findEtat(fiche, etats = []) {
  const etatId = getEtatId(fiche);
  return etats.find((e) => Number(e.id) === Number(etatId)) || null;
}

/**
 * Libellé état court pour tableaux : abbreviation BDD (+ sous-état abrégé si Signer).
 */
export function getEtatTableAbbr(fiche, etats = [], sousEtats = [], options = {}) {
  const { includeSousEtat = true } = options;
  const etat = findEtat(fiche, etats);
  const fromFicheAbbr = fiche?.etat_abbreviation || fiche?.etat_final_abbreviation || '';
  const abbr = String(etat?.abbreviation || fromFicheAbbr || '').trim();
  const titre = String(etat?.titre || fiche?.etat_titre || fiche?.etat_final_titre || '').trim();
  let base = abbr || titre;
  if (!base) return '';

  if (!includeSousEtat) return base;

  const etatId = Number(getEtatId(fiche));
  const isSigner =
    [13, 16, 38, 44, 45].includes(etatId) ||
    normalizeKey(titre).includes('SIGNER');
  if (!isSigner) return base;

  const sousId = fiche?.id_sous_etat ?? fiche?.fiche_id_sous_etat ?? null;
  const sousTitre =
    fiche?.sous_etat_titre ||
    sousEtats.find((s) => Number(s.id) === Number(sousId))?.titre ||
    '';
  const sousAbbr = abbreviateSousEtatTitle(sousTitre);
  if (!sousAbbr) return base;
  return `${base} - ${sousAbbr}`;
}

/** Titre complet centre (tooltip) */
export function getCentreFullName(centreOrTitre) {
  if (centreOrTitre == null) return '';
  if (typeof centreOrTitre === 'string') return centreOrTitre.trim();
  return String(centreOrTitre?.titre || centreOrTitre?.centre_titre || centreOrTitre?.centre_nom || '').trim();
}

/** Abrégé centre depuis objet centre, id + liste, ou titre brut */
export function getCentreTableAbbr(centreOrTitre, centresList) {
  if (centreOrTitre == null || centreOrTitre === '') return '';
  if (typeof centreOrTitre === 'number' || (typeof centreOrTitre === 'string' && /^\d+$/.test(centreOrTitre))) {
    const found = (centresList || []).find((c) => Number(c.id) === Number(centreOrTitre));
    return abbreviateCentreName(found?.titre || '');
  }
  if (typeof centreOrTitre === 'object') {
    return abbreviateCentreName(getCentreFullName(centreOrTitre));
  }
  return abbreviateCentreName(centreOrTitre);
}
