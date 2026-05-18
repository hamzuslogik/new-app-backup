const { query, queryOne } = require('../config/database');

/**
 * Met à jour ou crée une ligne dans affectations pour une fiche.
 * @param {number} ficheId
 * @param {number|null} commercialId - null ou 0 = désaffecté
 * @param {string} dateModifTime - datetime MySQL
 * @param {string|null} [dateRdvTime] - date/heure RDV (fiches.date_rdv_time) ; si omis, lu sur la fiche
 */
async function syncAffectationRecord(ficheId, commercialId, dateModifTime, dateRdvTime) {
  const idFiche = parseInt(ficheId, 10);
  if (!idFiche) return;

  const idCommercial =
    commercialId != null && Number(commercialId) > 0 ? parseInt(commercialId, 10) : 0;

  let rdvTime = dateRdvTime !== undefined ? dateRdvTime : undefined;
  if (idCommercial > 0 && rdvTime === undefined) {
    const ficheRow = await queryOne('SELECT date_rdv_time FROM fiches WHERE id = ?', [idFiche]);
    const raw = ficheRow?.date_rdv_time;
    rdvTime = raw != null && String(raw).trim() !== '' ? raw : null;
  } else if (idCommercial <= 0) {
    rdvTime = null;
  }

  const existing = await queryOne('SELECT id FROM affectations WHERE id_fiche = ?', [idFiche]);

  if (existing) {
    await query(
      `UPDATE affectations
       SET id_commercial = ?,
           date_rdv_time = ?,
           date_modif = UNIX_TIMESTAMP(),
           date_modif_time = ?
       WHERE id = ?`,
      [idCommercial, rdvTime ?? null, dateModifTime, existing.id]
    );
    return;
  }

  if (idCommercial > 0) {
    await query(
      `INSERT INTO affectations (id_fiche, id_commercial, date_rdv_time, date_modif, date_modif_time)
       VALUES (?, ?, ?, UNIX_TIMESTAMP(), ?)`,
      [idFiche, idCommercial, rdvTime ?? null, dateModifTime]
    );
  }
}

module.exports = { syncAffectationRecord };
