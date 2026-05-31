const { query, queryOne } = require('../config/database');
const { buildCommentaireQualiteFromKo, isValidKoMotif, normalizeKoMotif } = require('../constants/koMotifs');

/**
 * Indique si la fiche possède déjà au moins une ligne dans fiches_ko.
 */
async function ficheKoRecordExists(id_fiche) {
  const idFiche = parseInt(id_fiche, 10);
  if (!idFiche) return false;

  try {
    const row = await queryOne('SELECT id FROM fiches_ko WHERE id_fiche = ? LIMIT 1', [idFiche]);
    return !!row;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw err;
  }
}

/**
 * Enregistre une ligne dans fiches_ko (ignore si table absente).
 */
async function insertFicheKoRecord({
  id_fiche,
  motif_ko,
  commentaire_qualite,
  commentaire_complement,
  id_qualite,
  id_agent,
  id_centre,
  id_etat_final_avant,
  id_etat_final_apres,
  source,
  date_ko,
}) {
  const idFiche = parseInt(id_fiche, 10);
  if (!idFiche) return null;

  const motif = normalizeKoMotif(motif_ko);
  const now = date_ko || new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    const result = await query(
      `INSERT INTO fiches_ko (
        id_fiche, motif_ko, commentaire_qualite, commentaire_complement,
        id_qualite, id_agent, id_centre,
        id_etat_final_avant, id_etat_final_apres, source, date_ko, date_modif_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idFiche,
        motif,
        commentaire_qualite ?? null,
        commentaire_complement ?? null,
        id_qualite ?? null,
        id_agent ?? null,
        id_centre ?? null,
        id_etat_final_avant ?? null,
        id_etat_final_apres ?? null,
        source ?? null,
        now,
        now,
      ]
    );
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[fiches_ko] Table absente — exécutez create-fiches-ko-table.sql');
      return null;
    }
    throw err;
  }
}

/**
 * Supprime l'historique fiches_ko lorsque la fiche n'est plus en KO (ko ≠ 1).
 */
async function clearFicheKoHistoryWhenKoRemoved(id_fiche) {
  return deleteFicheKoRecordsByFicheId(id_fiche);
}

/**
 * Supprime les enregistrements fiches_ko d'une fiche (annulation du KO).
 */
async function deleteFicheKoRecordsByFicheId(id_fiche) {
  const idFiche = parseInt(id_fiche, 10);
  if (!idFiche) return 0;

  try {
    const result = await query('DELETE FROM fiches_ko WHERE id_fiche = ?', [idFiche]);
    return result.affectedRows ?? 0;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[fiches_ko] Table absente — exécutez create-fiches-ko-table.sql');
      return 0;
    }
    throw err;
  }
}

module.exports = {
  ficheKoRecordExists,
  insertFicheKoRecord,
  clearFicheKoHistoryWhenKoRemoved,
  deleteFicheKoRecordsByFicheId,
  buildCommentaireQualiteFromKo,
  isValidKoMotif,
  normalizeKoMotif,
};
