/**
 * Jointures Dashboard « Mes actions sur la fiche » (date_champ = fiches_histo).
 * Évite NOT EXISTS corrélé : candidats par confirmateur + plage, puis MAX(id) global par fiche.
 */

function confirmateurSlotParams(userId, includeMultiSlot) {
  return includeMultiSlot ? [userId, userId, userId] : [userId];
}

function confirmateurSlotMatch(alias, includeMultiSlot) {
  const p = alias ? `${alias}.` : '';
  return includeMultiSlot
    ? `(${p}id_confirmateur = ? OR ${p}id_confirmateur_2 = ? OR ${p}id_confirmateur_3 = ?)`
    : `${p}id_confirmateur = ?`;
}

/**
 * Confirmateur : dernière ligne globale de la fiche = action du user dans la plage.
 */
function confirmateurDerniereLigneHistoJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const confMatch = confirmateurSlotMatch('fh', includeMultiSlot);
  const candidateMatch = confirmateurSlotMatch('', includeMultiSlot);
  const headParams = confirmateurSlotParams(userId, includeMultiSlot);
  return {
    joinSql: `INNER JOIN (
    SELECT fh.id_fiche
    FROM fiches_histo fh
    INNER JOIN (
      SELECT h.id_fiche, MAX(h.id) AS max_id
      FROM fiches_histo h
      INNER JOIN (
        SELECT DISTINCT id_fiche
        FROM fiches_histo
        WHERE ${candidateMatch}
          AND date_creation >= ? AND date_creation <= ?
      ) c ON h.id_fiche = c.id_fiche
      GROUP BY h.id_fiche
    ) g ON fh.id_fiche = g.id_fiche AND fh.id = g.max_id
    WHERE ${confMatch}
      AND fh.date_creation >= ? AND fh.date_creation <= ?
  ) histo_conf_last ON fiche.id = histo_conf_last.id_fiche`,
    params: [
      ...headParams,
      startDatetime,
      endDatetime,
      ...headParams,
      startDatetime,
      endDatetime,
    ],
  };
}

/**
 * Dernière ligne dont date_creation est dans la plage, filtrée par auteur confirmateur.
 */
function fichesHistoLastInRangeJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const confClause = confirmateurSlotMatch('fh', includeMultiSlot);
  const tailParams = confirmateurSlotParams(userId, includeMultiSlot);
  return {
    joinSql: `INNER JOIN (
    SELECT fh.id_fiche
    FROM fiches_histo fh
    INNER JOIN (
      SELECT id_fiche, MAX(id) AS max_id
      FROM fiches_histo
      WHERE date_creation >= ? AND date_creation <= ?
      GROUP BY id_fiche
    ) histo_last_in_range ON fh.id_fiche = histo_last_in_range.id_fiche AND fh.id = histo_last_in_range.max_id
    WHERE ${confClause}
  ) histo_ids ON fiche.id = histo_ids.id_fiche`,
    params: [startDatetime, endDatetime, ...tailParams],
  };
}

module.exports = {
  confirmateurDerniereLigneHistoJoin,
  fichesHistoLastInRangeJoin,
};
