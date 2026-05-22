const { query } = require('../config/database');

/** Score unitaire selon le nombre de confirmateurs sur une même signature (fiche + date). */
function signatureScoreForCount(confirmateurCount) {
  const n = Number(confirmateurCount) || 0;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 0.5;
  return 0.33;
}

const MAX_CONFIRMATEURS_PAR_SIGNATURE = 3;

/**
 * Met à jour `ajoute` pour toutes les lignes signature d'un même événement
 * (même fiche + même date_heure de signature).
 */
async function redistributeSignatureScoresForFicheEvent(idFiche, dateHeure) {
  const idFicheNum = parseInt(idFiche, 10);
  if (!idFicheNum) return { count: 0, score: 0 };

  let rows;
  if (dateHeure != null && dateHeure !== '') {
    rows = await query(
      'SELECT id FROM signature WHERE id_fiche = ? AND date_heure = ?',
      [idFicheNum, dateHeure]
    );
  } else {
    rows = await query(
      'SELECT id FROM signature WHERE id_fiche = ? AND (date_heure IS NULL OR date_heure = "")',
      [idFicheNum]
    );
  }

  const n = rows?.length || 0;
  const score = signatureScoreForCount(n);

  if (n === 0) {
    return { count: 0, score: 0 };
  }

  if (dateHeure != null && dateHeure !== '') {
    await query('UPDATE signature SET ajoute = ? WHERE id_fiche = ? AND date_heure = ?', [
      score,
      idFicheNum,
      dateHeure,
    ]);
  } else {
    await query(
      'UPDATE signature SET ajoute = ? WHERE id_fiche = ? AND (date_heure IS NULL OR date_heure = "")',
      [score, idFicheNum]
    );
  }

  return { count: n, score };
}

module.exports = {
  signatureScoreForCount,
  MAX_CONFIRMATEURS_PAR_SIGNATURE,
  redistributeSignatureScoresForFicheEvent,
};
