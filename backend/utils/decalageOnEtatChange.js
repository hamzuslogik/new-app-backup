const { query } = require('../config/database');

const ID_ETAT_CONFIRMER = 7;

/**
 * Quand une fiche quitte l'état CONFIRMER (7), supprimer les demandes de décalage liées.
 * @param {number|string} idFiche
 * @param {number|string|null|undefined} oldEtatId
 * @param {number|string|null|undefined} newEtatId
 * @returns {Promise<{ deleted: number }>}
 */
async function deleteDecalagesWhenLeavingConfirmer(idFiche, oldEtatId, newEtatId) {
  const oldEt = Number(oldEtatId);
  const newEt = Number(newEtatId);
  if (oldEt !== ID_ETAT_CONFIRMER || !Number.isFinite(newEt) || newEt === ID_ETAT_CONFIRMER) {
    return { deleted: 0 };
  }
  const id = parseInt(idFiche, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { deleted: 0 };
  }
  try {
    const result = await query('DELETE FROM decalages WHERE id_fiche = ?', [id]);
    const deleted = Number(result?.affectedRows) || 0;
    if (deleted > 0) {
      console.log(
        `[decalage] ${deleted} demande(s) supprimée(s) (fiche ${id} quitte CONFIRMER → état ${newEt})`
      );
    }
    return { deleted };
  } catch (err) {
    console.error(
      `[decalage] Échec suppression décalages fiche ${id} (sortie CONFIRMER):`,
      err?.message || err
    );
    return { deleted: 0 };
  }
}

module.exports = {
  ID_ETAT_CONFIRMER,
  deleteDecalagesWhenLeavingConfirmer,
};
