const { query, queryOne } = require('../config/database');

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
 * Date planning (RDV) à recopier sur une nouvelle ligne signature :
 * ligne source → autre ligne du même événement → date_rdv_time de la fiche.
 */
async function resolveSignatureDatePlanning(signatureRow) {
  if (!signatureRow) return null;
  if (signatureRow.date_planning != null && signatureRow.date_planning !== '') {
    return signatureRow.date_planning;
  }

  const idFiche = signatureRow.id_fiche;
  const eventDateHeure = signatureRow.date_heure ?? null;
  if (idFiche && eventDateHeure) {
    const sibling = await queryOne(
      `SELECT date_planning FROM signature
       WHERE id_fiche = ? AND date_heure = ? AND date_planning IS NOT NULL
       LIMIT 1`,
      [idFiche, eventDateHeure]
    );
    if (sibling?.date_planning) return sibling.date_planning;
  }

  if (idFiche) {
    const fiche = await queryOne('SELECT date_rdv_time FROM fiches WHERE id = ?', [idFiche]);
    return fiche?.date_rdv_time ?? null;
  }

  return null;
}

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
  resolveSignatureDatePlanning,
  redistributeSignatureScoresForFicheEvent,
};
