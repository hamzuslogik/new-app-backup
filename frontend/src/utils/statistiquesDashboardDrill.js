const ENTITY_FIELD_BY_TAB = {
  centre: 'id_centre',
  agent: 'id_agent',
  confirmateur: 'id_confirmateur',
  commercial: 'id_commercial',
  statko: 'id_agent',
};

function toQuery(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  return sp.toString();
}

/**
 * Construit l’URL Dashboard pour une cellule de statistiques.
 */
export function buildDashboardDrillUrl({
  activeTab,
  statType,
  filters,
  row,
  etatId,
  etatIds,
  tauxColumn,
  etats,
  kpiMetric,
  isTotalRow,
}) {
  const base = {
    fiche_search: '1',
    page: '1',
    limit: '999999',
    stats_drill: '1',
    date_debut: filters.date_debut || '',
    date_fin: filters.date_fin || '',
  };

  if (filters.produit === '1' || filters.produit === '2') {
    base.produit = filters.produit;
  }

  if (activeTab === 'confirmateur' && filters.id_centre) {
    base.id_centre = filters.id_centre;
  }

  if (activeTab === 'statko') {
    base.ko = '1';
  }

  if (activeTab === 'kpi-commerciaux' || activeTab === 'commercial') {
    base.stats_drill_source = 'commercial_cr';
    const dateField =
      activeTab === 'commercial' && filters.date === 'date_modif_time'
        ? 'date_modif_time'
        : 'date_rdv_time';
    base.stats_drill_date_field = dateField;

    if (kpiMetric) {
      base.stats_drill_kpi_metric = kpiMetric;
    } else if (etatId != null && etatId !== '') {
      base.stats_drill_etat = String(etatId);
    } else if (etatIds?.length) {
      base.stats_drill_etat_ids = etatIds.join(',');
    }

    if (!isTotalRow && row?.id_commercial != null) {
      base.stats_drill_entity = 'id_commercial';
      base.stats_drill_entity_id = String(row.id_commercial ?? row.id);
    } else if (!isTotalRow && row?.id != null) {
      base.stats_drill_entity = 'id_commercial';
      base.stats_drill_entity_id = String(row.id);
    }

    return `/dashboard?${toQuery(base)}`;
  }

  if (activeTab === 'confirmateur') {
    base.stats_drill_source = 'confirmateur_histo';
    base.date_champ = 'fiches_histo';

    const entityField = ENTITY_FIELD_BY_TAB.confirmateur;
    if (!isTotalRow && entityField && (row?.id != null || row?.id === 0)) {
      base.stats_drill_entity = entityField;
      base.stats_drill_entity_id = String(row.id);
      base[entityField] = String(row.id);
    }

    if (statType === 'taux' && tauxColumn) {
      const tauxMap = { positive: 1, negative: -1, neutre: 0 };
      const target = tauxMap[tauxColumn];
      const ids = (etats || [])
        .filter((e) => Number(e.taux) === target)
        .map((e) => e.id);
      if (ids.length) base.stats_drill_etat_ids = ids.join(',');
      if (ids.length === 1) base.stats_drill_etat = String(ids[0]);
    } else if (etatIds?.length) {
      base.stats_drill_etat_ids = etatIds.join(',');
      if (etatIds.length === 1) base.stats_drill_etat = String(etatIds[0]);
    } else if (etatId != null && etatId !== '') {
      base.stats_drill_etat = String(etatId);
    }

    return `/dashboard?${toQuery(base)}`;
  }

  // Fiches classiques
  base.stats_drill_source = 'fiches';
  const dateField =
    activeTab === 'agent' ? 'date_insert_time' : filters.date || 'date_modif_time';
  base.stats_drill_date_field = dateField;
  base.date_champ = dateField;

  const entityField = ENTITY_FIELD_BY_TAB[activeTab];
  if (!isTotalRow && entityField && (row?.id != null || row?.id === 0)) {
    base.stats_drill_entity = entityField;
    base.stats_drill_entity_id = String(row.id);
    base[entityField] = String(row.id);
  }

  if (statType === 'taux' && tauxColumn) {
    const tauxMap = { positive: 1, negative: -1, neutre: 0 };
    const target = tauxMap[tauxColumn];
    const ids = (etats || [])
      .filter((e) => Number(e.taux) === target)
      .map((e) => e.id);
    if (ids.length) base.stats_drill_etat_ids = ids.join(',');
    if (ids.length === 1) {
      base.stats_drill_etat = String(ids[0]);
      base.id_etat_final = String(ids[0]);
    }
  } else if (etatIds?.length) {
    base.stats_drill_etat_ids = etatIds.join(',');
    if (etatIds.length === 1) {
      base.stats_drill_etat = String(etatIds[0]);
      base.id_etat_final = String(etatIds[0]);
    }
  } else if (etatId != null && etatId !== '') {
    base.stats_drill_etat = String(etatId);
    base.id_etat_final = String(etatId);
  }

  return `/dashboard?${toQuery(base)}`;
}

export function openDashboardDrill(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function isDrillableStatCell(statType, cellKind) {
  if (['barres', 'camembert'].includes(statType)) return false;
  if (cellKind === 'numero' || cellKind === 'header') return false;
  if (cellKind === 'taux_pct' && statType === 'taux') return false;
  return true;
}
