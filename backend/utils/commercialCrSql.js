/**
 * Filtres SQL partagés : stats commercial + drill Dashboard (compte_rendu_pending approuvés).
 */

function commercialCrApprovedBaseSql(excludeEtatIds = [], ficheAlias = 'f') {
  const f = ficheAlias;
  const excludeEtatsSql = excludeEtatIds.length
    ? ` AND cr.id_etat_final NOT IN (${excludeEtatIds.map(() => '?').join(',')})`
    : '';
  return {
    sql: `cr.statut = 'approved'
      AND cr.id_commercial IS NOT NULL AND cr.id_commercial > 0
      AND cr.id_etat_final IS NOT NULL
      AND (${f}.archive = 0 OR ${f}.archive IS NULL)
      AND ${f}.active = 1
      AND (${f}.ko = 0 OR ${f}.ko IS NULL)${excludeEtatsSql}`,
    excludeParams: excludeEtatIds,
  };
}

function commercialCrDateFilterParts(dateField) {
  if (dateField === 'date_rdv_time') {
    return {
      sql: `f.date_rdv_time IS NOT NULL
        AND f.date_rdv_time != ''
        AND f.date_rdv_time >= ? AND f.date_rdv_time <= ?`,
      paramsOrder: 'fiche_dates',
    };
  }
  return {
    sql: `COALESCE(cr.date_modif, cr.date_creation, cr.date_approbation) IS NOT NULL
      AND COALESCE(cr.date_modif, cr.date_creation, cr.date_approbation) >= ?
      AND COALESCE(cr.date_modif, cr.date_creation, cr.date_approbation) <= ?`,
    paramsOrder: 'cr_dates',
  };
}

/**
 * Sous-requête SELECT DISTINCT id_fiche pour drill Dashboard (évite EXISTS corrélé lourd).
 */
function buildCommercialCrFicheIdsSubquery(options = {}) {
  const {
    dateField = 'date_rdv_time',
    startDt,
    endDt,
    etatIds = [],
    commercialId = null,
    excludeEtatIds = [],
    ficheExtraSql = '',
  } = options;

  const base = commercialCrApprovedBaseSql([], 'f');
  const dateParts = commercialCrDateFilterParts(dateField);
  const excludeEtatsSql = excludeEtatIds.length
    ? ` AND cr.id_etat_final NOT IN (${excludeEtatIds.map(() => '?').join(',')})`
    : '';

  const parts = [
    `SELECT DISTINCT cr.id_fiche
    FROM compte_rendu_pending cr
    INNER JOIN fiches f ON f.id = cr.id_fiche
    INNER JOIN utilisateurs u_cr ON u_cr.id = cr.id_commercial AND u_cr.fonction = 5 AND u_cr.etat > 0
    WHERE ${base.sql}
      AND ${dateParts.sql}${excludeEtatsSql}`,
  ];
  const params = [startDt, endDt, ...excludeEtatIds];

  if (etatIds.length) {
    parts.push(` AND cr.id_etat_final IN (${etatIds.map(() => '?').join(',')})`);
    params.push(...etatIds);
  }
  if (commercialId) {
    parts.push(' AND cr.id_commercial = ?');
    params.push(commercialId);
  }
  if (ficheExtraSql) {
    parts.push(ficheExtraSql);
  }

  return { sql: parts.join(''), params };
}

module.exports = {
  commercialCrApprovedBaseSql,
  commercialCrDateFilterParts,
  buildCommercialCrFicheIdsSubquery,
};
