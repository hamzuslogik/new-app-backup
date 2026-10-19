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
 * @deprecated préférer fichesHistoAnyActionByConfirmateur* pour RE/RP/BO/admin
 *   (ne pas exiger que ce soit la dernière action globale).
 */
function fichesHistoLastInRangeIdsSql(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  return fichesHistoAnyActionByConfirmateurIdsSql(
    startDatetime,
    endDatetime,
    userId,
    includeMultiSlot
  );
}

function fichesHistoLastInRangeJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  return fichesHistoAnyActionByConfirmateurJoin(
    startDatetime,
    endDatetime,
    userId,
    includeMultiSlot
  );
}

/**
 * Toutes les fiches où le confirmateur a au moins un changement d'état (ligne fiches_histo)
 * dans la plage — même si un autre confirmateur a touché la fiche avant ou après.
 * (RE / RP / backoffice / admin — « Mes actions sur la fiche »)
 */
function fichesHistoAnyActionByConfirmateurIdsSql(
  startDatetime,
  endDatetime,
  userId,
  includeMultiSlot = false
) {
  const slotWhere = confirmateurSlotMatch('', includeMultiSlot);
  const tailParams = confirmateurSlotParams(userId, includeMultiSlot);

  const sql = `SELECT DISTINCT id_fiche
    FROM fiches_histo
    WHERE date_creation >= ? AND date_creation <= ?
      AND ${slotWhere}`;

  return {
    sql,
    params: [startDatetime, endDatetime, ...tailParams],
  };
}

function fichesHistoAnyActionByConfirmateurJoin(
  startDatetime,
  endDatetime,
  userId,
  includeMultiSlot = false
) {
  const ids = fichesHistoAnyActionByConfirmateurIdsSql(
    startDatetime,
    endDatetime,
    userId,
    includeMultiSlot
  );
  return {
    joinSql: `INNER JOIN (${ids.sql}) histo_ids ON fiche.id = histo_ids.id_fiche`,
    params: ids.params,
    idsSubquerySql: ids.sql,
    idsSubqueryParams: ids.params,
  };
}

/**
 * Dernière ligne fiches_histo DU confirmateur dans la plage (MAX(id) parmi ses actions),
 * même si un autre confirmateur a touché la fiche avant ou après.
 * Expose id_etat / id_sous_etat / commentaire pour l'affichage Dashboard.
 */
function fichesHistoConfirmateurActionLineSql(
  startDatetime,
  endDatetime,
  userId,
  includeMultiSlot = false
) {
  const slotWhere = confirmateurSlotMatch('h', includeMultiSlot);
  const headParams = confirmateurSlotParams(userId, includeMultiSlot);

  const sql = `SELECT
      fh.id_fiche,
      fh.id AS histo_action_id,
      fh.id_etat AS histo_action_id_etat,
      fh.id_sous_etat AS histo_action_id_sous_etat,
      fh.date_creation AS histo_action_date,
      fh.conf_commentaire_produit AS histo_action_commentaire,
      fh.id_confirmateur AS histo_action_id_confirmateur
    FROM fiches_histo fh
    INNER JOIN (
      SELECT h.id_fiche, MAX(h.id) AS max_id
      FROM fiches_histo h
      WHERE ${slotWhere}
        AND h.date_creation >= ? AND h.date_creation <= ?
      GROUP BY h.id_fiche
    ) pick ON fh.id = pick.max_id`;

  return {
    sql,
    params: [...headParams, startDatetime, endDatetime],
  };
}

function fichesHistoConfirmateurActionLineJoin(
  startDatetime,
  endDatetime,
  userId,
  includeMultiSlot = false
) {
  const line = fichesHistoConfirmateurActionLineSql(
    startDatetime,
    endDatetime,
    userId,
    includeMultiSlot
  );
  const idsSql = `SELECT id_fiche FROM (${line.sql}) histo_action_ids`;
  return {
    joinSql: `INNER JOIN (${line.sql}) histo_action ON fiche.id = histo_action.id_fiche`,
    params: line.params,
    idsSubquerySql: idsSql,
    idsSubqueryParams: line.params,
    exposesActionLine: true,
  };
}

module.exports = {
  confirmateurDerniereLigneHistoJoin,
  fichesHistoLastInRangeJoin,
  fichesHistoAnyActionByConfirmateurJoin,
  fichesHistoConfirmateurActionLineJoin,
  confirmateurDerniereLigneHistoIdsSql,
  fichesHistoLastInRangeIdsSql,
  fichesHistoAnyActionByConfirmateurIdsSql,
  fichesHistoConfirmateurActionLineSql,
};
