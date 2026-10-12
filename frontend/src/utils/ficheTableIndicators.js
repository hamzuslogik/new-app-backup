import { ficheHasR2Placed } from './ficheR2Placed';
import { formatRdvDateTime, formatRdvTimeOnly } from './formatRdvDateTime';

const PRESENCE_SEUL = [
  'MME SEULE SANS MR',
  'MME SEUL SANS MR',
  'MR SEUL SANS MME',
  'NON',
];

/** Uniquement ANNULER (5) et RDV ANNULER (11) — pas REPROGRAMMER ni « 2 FOIS » */
const ETATS_ANNULER_IDS = new Set([5, 11]);

function normalizeTitreEtat(titre) {
  return String(titre || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titreIsAnnuler(titre) {
  const t = normalizeTitreEtat(titre);
  return t === 'ANNULER' || t === 'RDV ANNULER';
}

/** Parse id_etat_histo : "7,8,11" ou "12:7,15:8" (id_histo:id_etat). */
function parseHistoEtatIds(histoString) {
  if (!histoString) return [];
  const ids = [];
  String(histoString)
    .split(',')
    .forEach((part) => {
      const trimmed = String(part).trim();
      if (!trimmed) return;
      let etatId;
      if (trimmed.includes(':')) {
        const [, etatPart] = trimmed.split(':');
        etatId = Number(etatPart);
      } else {
        etatId = Number(trimmed);
      }
      if (Number.isFinite(etatId) && etatId > 0) ids.push(etatId);
    });
  return ids;
}

/**
 * Indicateurs badges admin (SIG / CS / R2 / HAS / RF / ANN).
 */
export function getFicheTableIndicators(histoString, fiche = {}, etatsData = null) {
  const r2Placed = ficheHasR2Placed(fiche);
  const presenceCouple = String(fiche?.conf_presence_couple || '').toUpperCase().trim();
  const hasRdvSeul =
    PRESENCE_SEUL.includes(presenceCouple) ||
    String(fiche?.conf_rdv_avec || '').toUpperCase().trim() === 'SEUL';

  const histoArray = parseHistoEtatIds(histoString);

  let hasAnnuler = false;
  let hasRefuser = false;
  let hasSigner = false;
  let hasHonoreASuivre = histoArray.includes(9) || Number(fiche?.id_etat_final) === 9;

  const markAnnulerFromEtatId = (etatId) => {
    const n = Number(etatId);
    if (ETATS_ANNULER_IDS.has(n)) {
      hasAnnuler = true;
      return;
    }
    const etat = Array.isArray(etatsData)
      ? etatsData.find((e) => Number(e.id) === n)
      : null;
    if (etat && titreIsAnnuler(etat.titre || etat.abbreviation)) {
      hasAnnuler = true;
    }
  };

  histoArray.forEach((etatId) => {
    markAnnulerFromEtatId(etatId);
    if ([13, 16, 38, 44, 45].includes(etatId)) hasSigner = true;
    if (etatId === 9) hasHonoreASuivre = true;

    const etat = Array.isArray(etatsData)
      ? etatsData.find((e) => Number(e.id) === etatId)
      : null;
    if (etat) {
      if (titreIsAnnuler(etat.titre) || titreIsAnnuler(etat.abbreviation)) hasAnnuler = true;
      const titre = String(etat.titre || '').toUpperCase();
      if (titre.includes('REFUSER')) hasRefuser = true;
      if (titre.includes('SIGNER')) hasSigner = true;
      if (titre.includes('HONOR') && titre.includes('SUIVRE')) hasHonoreASuivre = true;
    }
  });

  // État actuel (même sans historique)
  const currentEtatId = Number(fiche?.id_etat_final);
  if (Number.isFinite(currentEtatId) && currentEtatId > 0) {
    markAnnulerFromEtatId(currentEtatId);
  }

  return {
    r2: r2Placed,
    rf: hasRefuser,
    an: hasAnnuler,
    cs: hasRdvSeul,
    sg: hasSigner,
    has: hasHonoreASuivre,
  };
}

function normalizeDecalageDateTime(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().replace('T', ' ');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ ](\d{1,2}):(\d{2})/);
  if (!m) return s;
  return `${m[1]} ${String(m[2]).padStart(2, '0')}:${m[3]}`;
}

/** Demande sans nouvelle heure (vide ou identique au RDV prévu). */
export function isDecalageSansHeureFiche(fiche) {
  if (!fiche?.decale_date_nouvelle) return true;
  const a = normalizeDecalageDateTime(fiche.decale_date_nouvelle);
  const b = normalizeDecalageDateTime(fiche.decale_date_prevu);
  return Boolean(a && b && a === b);
}

/**
 * Message admin type « ADMIN : 14-15-16-13h30-13h » → première heure demandée (« 14 »).
 * Préfixe ADMIN retiré ; séparateur « - ».
 */
export function extractAdminDecalageFirstRequestedHour(message) {
  if (message == null || String(message).trim() === '') return null;
  let s = String(message).trim();
  if (!/^ADMIN\s*:/i.test(s)) return null;
  s = s.replace(/^ADMIN\s*:\s*/i, '').trim();
  if (!s) return null;
  const first = s.split('-')[0].trim();
  return first || null;
}

/** True si la fiche a une demande de décalage (tous états). */
export function ficheHasDecalageRequest(fiche) {
  const etatIdRaw = fiche?.decale_id_etat;
  const etatId = Number(etatIdRaw);
  return Boolean(
    fiche?.decale_date_prevu ||
      fiche?.decale_date_nouvelle ||
      (fiche?.etat_dec && String(fiche.etat_dec).trim() !== '') ||
      (etatIdRaw != null && etatIdRaw !== '' && Number.isFinite(etatId)) ||
      (fiche?.decale_message && String(fiche.decale_message).trim() !== '')
  );
}

/**
 * Libellé affichable pour « nouvelle heure » / message admin sans heure.
 * Admin sans heure : 1ʳᵉ heure du message (ex. « 14 » depuis « ADMIN : 14-15-… »).
 */
export function getDecalageNouvelleHeureDisplay(ficheOrDecalage) {
  if (!ficheOrDecalage) return null;

  const dateNouvelle =
    ficheOrDecalage.decale_date_nouvelle ?? ficheOrDecalage.date_nouvelle ?? null;
  const datePrevu =
    ficheOrDecalage.decale_date_prevu ?? ficheOrDecalage.date_prevu ?? null;
  const message =
    ficheOrDecalage.decale_message ?? ficheOrDecalage.message ?? null;

  const sansHeure =
    !dateNouvelle ||
    (normalizeDecalageDateTime(dateNouvelle) &&
      normalizeDecalageDateTime(datePrevu) &&
      normalizeDecalageDateTime(dateNouvelle) === normalizeDecalageDateTime(datePrevu));

  if (sansHeure) {
    const firstHour = extractAdminDecalageFirstRequestedHour(message);
    if (firstHour) return firstHour;
    return null;
  }

  return formatRdvDateTime(dateNouvelle) || null;
}

/**
 * Heure demandée au décalage (tableaux) :
 * — nouvelle heure réelle → HH:mm
 * — admin sans heure → 1ʳᵉ heure du message (ex. « 14 »)
 */
function getDecalageHeureDemandeeTable(fiche) {
  if (!fiche) return '—';
  if (isDecalageSansHeureFiche(fiche)) {
    return extractAdminDecalageFirstRequestedHour(fiche.decale_message) || '—';
  }
  return (
    formatRdvTimeOnly(fiche.decale_date_nouvelle) ||
    formatRdvDateTime(fiche.decale_date_nouvelle) ||
    '—'
  );
}

/** Libellé / statut décalage pour affichage (tous états). */
export function getDecalageDisplayInfo(fiche) {
  if (!ficheHasDecalageRequest(fiche)) return null;

  const etatId = Number(fiche?.decale_id_etat);
  const titre = String(fiche?.etat_dec || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let status = 'pending';
  let statusLabel = 'En cours';

  if (etatId === 6 || titre.includes('ANNUL')) {
    status = 'cancelled';
    statusLabel = 'Annulée';
  } else if (etatId === 2 || titre.includes('ACCEPT') || titre.includes('VALID')) {
    status = 'accepted';
    statusLabel = 'Acceptée';
  } else if (etatId === 3 || etatId === 4 || titre.includes('REFUS')) {
    status = 'refused';
    statusLabel = 'Refusée';
  }

  const heurePrevu =
    formatRdvTimeOnly(fiche.decale_date_prevu) ||
    formatRdvDateTime(fiche.decale_date_prevu) ||
    '—';
  const heureDemandee = getDecalageHeureDemandeeTable(fiche);

  // Ex. « En cours : 14:00 -> 15:30 » ou « En cours : 14:00 -> 14 » (admin sans heure)
  const text = `${statusLabel} : ${heurePrevu} -> ${heureDemandee}`;

  return { status, text };
}
