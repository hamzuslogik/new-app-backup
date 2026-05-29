/**
 * Jointures Dashboard « Mes actions sur la fiche » (date_champ = fiches_histo).
 * Retourne aussi idsSubquerySql pour COUNT rapide sans scanner toute la table fiches.
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
 * IDs fiches : dernière ligne globale = action du confirmateur dans la plage.
 */
function confirmateurDerniereLigneHistoIdsSql(
  startDatetime,
  endDatetime,
  userId,
  includeMultiSlot = false
) {
  const confMatch = confirmateurSlotMatch('fh', includeMultiSlot);
  const candidateMatch = confirmateurSlotMatch('c', includeMultiSlot);
  const headParams = confirmateurSlotParams(userId, includeMultiSlot);

  const sql = `SELECT fh.id_fiche
    FROM (
      SELECT h.id_fiche, MAX(h.id) AS max_id
      FROM fiches_histo h
      INNER JOIN (
        SELECT DISTINCT id_fiche
        FROM fiches_histo c
        WHERE ${candidateMatch}
          AND c.date_creation >= ? AND c.date_creation <= ?
      ) cand ON h.id_fiche = cand.id_fiche
      GROUP BY h.id_fiche
    ) g
    INNER JOIN fiches_histo fh ON fh.id = g.max_id
    WHERE ${confMatch}
      AND fh.date_creation >= ? AND fh.date_creation <= ?`;

  const params = [
    ...headParams,
    startDatetime,
    endDatetime,
    ...headParams,
    startDatetime,
    endDatetime,
  ];

  return { sql, params };
}

function confirmateurDerniereLigneHistoJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const ids = confirmateurDerniereLigneHistoIdsSql(
    startDatetime,
    endDatetime,
    userId,
    includeMultiSlot
  );
  return {
    joinSql: `INNER JOIN (${ids.sql}) histo_conf_last ON fiche.id = histo_conf_last.id_fiche`,
    params: ids.params,
    idsSubquerySql: ids.sql,
    idsSubqueryParams: ids.params,
  };
}

/**
 * Dernière ligne dans la plage, auteur = confirmateur (filtre poussé dans l'agrégat).
 */
function fichesHistoLastInRangeIdsSql(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const slotWhere = confirmateurSlotMatch('', includeMultiSlot);
  const tailParams = confirmateurSlotParams(userId, includeMultiSlot);

  const sql = `SELECT t.id_fiche
    FROM (
      SELECT id_fiche, MAX(id) AS max_id
      FROM fiches_histo
      WHERE date_creation >= ? AND date_creation <= ?
        AND ${slotWhere}
      GROUP BY id_fiche
    ) t`;

  return {
    sql,
    params: [startDatetime, endDatetime, ...tailParams],
  };
}

function fichesHistoLastInRangeJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const ids = fichesHistoLastInRangeIdsSql(startDatetime, endDatetime, userId, includeMultiSlot);
  return {
    joinSql: `INNER JOIN (${ids.sql}) histo_ids ON fiche.id = histo_ids.id_fiche`,
    params: ids.params,
    idsSubquerySql: ids.sql,
    idsSubqueryParams: ids.params,
  };
}

module.exports = {
  confirmateurDerniereLigneHistoJoin,
  fichesHistoLastInRangeJoin,
  confirmateurDerniereLigneHistoIdsSql,
  fichesHistoLastInRangeIdsSql,
};
