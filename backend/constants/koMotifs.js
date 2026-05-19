/** Motifs KO (liste fixe — ne pas confondre avec l'état final id 54). */
const KO_MOTIFS = [
  'CONSOMMATION MAUVAISE VÉRIFICATION',
  'TITRE DE PROPRIÉTÉ MAUVAISE VÉRIFICATION',
  'ÂGE MODE DE CHAUFFAGE',
  'SURFACE CHAUFFÉE',
  'TYPE DE CONTRAT',
  'REVENU MAUVAISE VÉRIFICATION',
  'MAUVAISE VÉRIFICATION 20M²',
  'SURFACE JARDIN',
  'ÂGE CLIENT VÉRIFICATION NON EFFECTUÉE',
  'INTÉRÊT',
  'TRAITEMENT',
  'ZONE MAUVAISE VÉRIFICATION',
  'ÂGE DES PANNEAUX EXISTANTS',
  "TAUX D'ENDETTEMENT NON VÉRIFIÉ",
  'CLIENT NON SÉRIEUX',
  'DÉMÉNAGEMENT',
  'VERROUILLAGE',
  'KO ACCORD',
  'COORDONNÉES NON VÉRIFIÉES',
  'VÉRIFICATION REVENU',
  "DOMAINE D'ACTIVITÉ",
];

function normalizeKoMotif(value) {
  return String(value || '').trim();
}

function isValidKoMotif(value) {
  const v = normalizeKoMotif(value);
  return v.length > 0 && KO_MOTIFS.includes(v);
}

function buildCommentaireQualiteFromKo(motif_ko, commentaire_complement) {
  const motif = normalizeKoMotif(motif_ko);
  const complement = commentaire_complement != null ? String(commentaire_complement).trim() : '';
  if (!motif) return complement || null;
  if (!complement) return motif;
  return `${motif}\n\n${complement}`;
}

module.exports = {
  KO_MOTIFS,
  isValidKoMotif,
  normalizeKoMotif,
  buildCommentaireQualiteFromKo,
};
