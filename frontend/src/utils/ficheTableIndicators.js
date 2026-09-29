import { ficheHasR2Placed } from './ficheR2Placed';

const PRESENCE_SEUL = [
  'MME SEULE SANS MR',
  'MME SEUL SANS MR',
  'MR SEUL SANS MME',
  'NON',
];

/**
 * Indicateurs badges admin (SIG / CS / R2 / HAS / RF / ANN).
 */
export function getFicheTableIndicators(histoString, fiche = {}, etatsData = null) {
  const r2Placed = ficheHasR2Placed(fiche);
  const presenceCouple = String(fiche?.conf_presence_couple || '').toUpperCase().trim();
  const hasRdvSeul =
    PRESENCE_SEUL.includes(presenceCouple) ||
    String(fiche?.conf_rdv_avec || '').toUpperCase().trim() === 'SEUL';

  const histoArray = String(histoString || '')
    .split(',')
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  let hasAnnuler = false;
  let hasRefuser = false;
  let hasSigner = false;
  let hasHonoreASuivre = histoArray.includes(9) || Number(fiche?.id_etat_final) === 9;

  if ((!histoArray.length && !histoString) || !etatsData) {
    return {
      r2: r2Placed,
      rf: false,
      an: false,
      cs: hasRdvSeul,
      sg: false,
      has: hasHonoreASuivre,
    };
  }

  histoArray.forEach((etatId) => {
    const etat = etatsData.find((e) => Number(e.id) === etatId);
    if (etat && etat.titre) {
      const titre = String(etat.titre).toUpperCase();
      if (titre.includes('RDV ANNULER')) hasAnnuler = true;
      if (titre.includes('REFUSER')) hasRefuser = true;
      if ([13, 16, 38, 44, 45].includes(etatId) || titre.includes('SIGNER')) hasSigner = true;
      if (etatId === 9 || (titre.includes('HONOR') && titre.includes('SUIVRE'))) {
        hasHonoreASuivre = true;
      }
    } else if ([13, 16, 38, 44, 45].includes(etatId)) {
      hasSigner = true;
    } else if (etatId === 9) {
      hasHonoreASuivre = true;
    }
  });

  return {
    r2: r2Placed,
    rf: hasRefuser,
    an: hasAnnuler,
    cs: hasRdvSeul,
    sg: hasSigner,
    has: hasHonoreASuivre,
  };
}

/** True si la fiche a une demande de décalage (tous états). */
export function ficheHasDecalageRequest(fiche) {
  const etatIdRaw = fiche?.decale_id_etat;
  const etatId = Number(etatIdRaw);
  return Boolean(
    fiche?.decale_date_prevu ||
      fiche?.decale_date_nouvelle ||
      (fiche?.etat_dec && String(fiche.etat_dec).trim() !== '') ||
      (etatIdRaw != null && etatIdRaw !== '' && Number.isFinite(etatId))
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
  let text = fiche?.etat_dec || 'En cours';

  if (etatId === 6 || titre.includes('ANNUL')) {
    status = 'cancelled';
    text = fiche?.etat_dec || 'Annulée';
  } else if (etatId === 2 || titre.includes('ACCEPT') || titre.includes('VALID')) {
    status = 'accepted';
    text = 'Acceptée';
  } else if (etatId === 3 || etatId === 4 || titre.includes('REFUS')) {
    status = 'refused';
    text = 'Refusée';
  } else if (!fiche?.etat_dec) {
    text = 'En cours';
  }

  return { status, text };
}
