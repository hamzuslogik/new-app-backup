const { query } = require('../config/database');
const { buildCommentaireQualiteFromKo, isValidKoMotif, normalizeKoMotif } = require('../constants/koMotifs');

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

module.exports = {
  insertFicheKoRecord,
  buildCommentaireQualiteFromKo,
  isValidKoMotif,
  normalizeKoMotif,
};
