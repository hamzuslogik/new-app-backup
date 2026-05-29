/**
 * Filtre Dashboard aligné sur les cellules de la page Statistiques (drill-down).
 */

const ALLOWED_DATE_FIELDS = new Set([
  'date_insert_time',
  'date_modif_time',
  'date_rdv_time',
]);

const ALLOWED_ENTITY_FIELDS = new Set([
  'id_centre',
  'id_confirmateur',
  'id_commercial',
  'id_agent',
]);

const KPI_METRIC_ETAT = {
  honore_a_suivre: 9,
  rdv_refuse: 12,
  signatures: 13,
};

const { buildCommercialCrFicheIdsSubquery } = require('./commercialCrSql');

function qTrim(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function parseEtatIds(raw) {
  if (!qTrim(raw)) return [];
  return String(raw)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseStatsDrillQuery(query) {
  if (query.stats_drill !== '1' && query.stats_drill !== 1) return null;

  const source = String(query.stats_drill_source || 'fiches').trim();
  const dateField = String(query.stats_drill_date_field || 'date_modif_time').trim();

  if (!ALLOWED_DATE_FIELDS.has(dateField) && source === 'fiches') {
    return { error: 'Champ date drill non autorisé' };
  }

  const entityField = String(query.stats_drill_entity || '').trim();
  const entityId = qTrim(query.stats_drill_entity_id)
    ? parseInt(query.stats_drill_entity_id, 10)
    : null;

  if (entityField && !ALLOWED_ENTITY_FIELDS.has(entityField)) {
    return { error: 'Entité drill non autorisée' };
  }

  let etatIds = parseEtatIds(query.stats_drill_etat_ids);
  const singleEtat = qTrim(query.stats_drill_etat)
    ? parseInt(query.stats_drill_etat, 10)
    : null;
  if (singleEtat && !etatIds.length) etatIds = [singleEtat];

  const kpiMetric = String(query.stats_drill_kpi_metric || '').trim();
  if (source === 'commercial_cr' && kpiMetric && KPI_METRIC_ETAT[kpiMetric]) {
    etatIds = [KPI_METRIC_ETAT[kpiMetric]];
  }

  const normalizedSource =
    source === 'commercial_cr'
      ? 'commercial_cr'
      : source === 'confirmateur_histo'
        ? 'confirmateur_histo'
        : 'fiches';

  return {
    source: normalizedSource,
    dateField,
    dateDebut: qTrim(query.date_debut) ? String(query.date_debut).trim() : null,
    dateFin: qTrim(query.date_fin) ? String(query.date_fin).trim() : null,
    entityField: entityField || null,
    entityId: Number.isFinite(entityId) ? entityId : null,
    etatIds,
    produit: qTrim(query.produit) ? parseInt(query.produit, 10) : null,
    koOnly: query.ko === '1' || query.ko === 1,
    kpiMetric: kpiMetric || null,
  };
}

function isStatsDrillNarrowing(query) {
  return query.stats_drill === '1' || query.stats_drill === 1;
}

/**
 * Ajoute les conditions SQL pour le drill stats sur la liste fiches.
 * @returns {{ ok: boolean, error?: string }}
 */
function applyStatsDrillWhere(drill, whereConditions, params) {
  if (!drill || drill.error) {
    return { ok: false, error: drill?.error || 'Drill invalide' };
  }

  const startDt = drill.dateDebut ? `${drill.dateDebut} 00:00:00` : null;
  const endDt = drill.dateFin ? `${drill.dateFin} 23:59:59` : null;

  if (drill.source === 'commercial_cr') {
    if (!startDt || !endDt) {
      return { ok: false, error: 'Période requise pour le drill commercial' };
    }

    const commercialId =
      drill.entityField === 'id_commercial' && drill.entityId ? drill.entityId : null;
    const sub = buildCommercialCrFicheIdsSubquery({
      dateField: drill.dateField || 'date_rdv_time',
      startDt,
      endDt,
      etatIds: drill.etatIds,
      commercialId,
    });

    whereConditions.push('fiche.active = 1');
    whereConditions.push('(fiche.archive = 0 OR fiche.archive IS NULL)');
    whereConditions.push(`fiche.id IN (${sub.sql})`);
    params.push(...sub.params);

    if (drill.produit === 1 || drill.produit === 2) {
      whereConditions.push('fiche.produit = ?');
      params.push(drill.produit);
    }

    return { ok: true };
  }

  if (drill.source === 'confirmateur_histo') {
    if (!startDt || !endDt) {
      return { ok: false, error: 'Période requise pour le drill confirmateur' };
    }

    const existsParts = [
      `EXISTS (
        SELECT 1 FROM fiches_histo fh
        INNER JOIN (
          SELECT id_fiche, MAX(id) AS max_id
          FROM fiches_histo
          WHERE date_creation >= ? AND date_creation <= ?
          GROUP BY id_fiche
        ) histo_last ON fh.id_fiche = histo_last.id_fiche AND fh.id = histo_last.max_id
        WHERE fh.id_fiche = fiche.id
        AND fh.date_creation >= ? AND fh.date_creation <= ?
        AND fh.id_confirmateur IS NOT NULL AND fh.id_confirmateur > 0
        AND fh.id_etat IS NOT NULL`,
    ];
    const existsParams = [startDt, endDt, startDt, endDt];

    if (drill.etatIds.length) {
      existsParts.push(` AND fh.id_etat IN (${drill.etatIds.map(() => '?').join(',')})`);
      existsParams.push(...drill.etatIds);
    }

    if (drill.entityField === 'id_confirmateur' && drill.entityId) {
      existsParts.push(' AND fh.id_confirmateur = ?');
      existsParams.push(drill.entityId);
    }

    existsParts.push(')');

    whereConditions.push('(fiche.archive = 0 OR fiche.archive IS NULL)');
    whereConditions.push('fiche.active = 1');
    whereConditions.push('(fiche.ko = 0 OR fiche.ko IS NULL)');
    whereConditions.push(existsParts.join(''));
    params.push(...existsParams);

    if (drill.produit === 1 || drill.produit === 2) {
      whereConditions.push('fiche.produit = ?');
      params.push(drill.produit);
    }

    return { ok: true };
  }

  // Source fiches (centre, agent, stat KO)
  whereConditions.push('(fiche.archive = 0 OR fiche.archive IS NULL)');
  whereConditions.push('fiche.active = 1');

  if (drill.koOnly) {
    whereConditions.push('fiche.ko = 1');
  } else {
    whereConditions.push('(fiche.ko = 0 OR fiche.ko IS NULL)');
  }

  if (startDt && endDt && drill.dateField) {
    whereConditions.push(`fiche.\`${drill.dateField}\` >= ?`);
    whereConditions.push(`fiche.\`${drill.dateField}\` <= ?`);
    params.push(startDt, endDt);
  }

  if (drill.etatIds.length === 1) {
    whereConditions.push('fiche.id_etat_final = ?');
    params.push(drill.etatIds[0]);
  } else if (drill.etatIds.length > 1) {
    whereConditions.push(
      `fiche.id_etat_final IN (${drill.etatIds.map(() => '?').join(',')})`
    );
    params.push(...drill.etatIds);
  }

  if (drill.entityField && drill.entityId) {
    whereConditions.push(`fiche.\`${drill.entityField}\` = ?`);
    params.push(drill.entityId);
  }

  if (drill.produit === 1 || drill.produit === 2) {
    whereConditions.push('fiche.produit = ?');
    params.push(drill.produit);
  }

  return { ok: true };
}

module.exports = {
  parseStatsDrillQuery,
  isStatsDrillNarrowing,
  applyStatsDrillWhere,
  KPI_METRIC_ETAT,
};
