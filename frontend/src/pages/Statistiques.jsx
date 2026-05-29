import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaChartBar, FaSearch } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './Statistiques.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import { getEtatContrastColor, getEtatStatCellProps, normalizeHex } from '../utils/etatColorContrast';
import StatsResultsActions from '../components/statistiques/StatsResultsActions';
import {
  DEFAULT_COLUMN_PREFS,
  getStatsViewKey,
  getVisibleEtats,
  getVisibleTauxColumns,
  isEtatColumnAllZeros,
  TAUX_FIXED_COLUMNS,
} from '../utils/statistiquesColumnUtils';
import {
  buildKpiExport,
  buildStatsTableExport,
  printStatsArea,
  runStatsExport,
} from '../utils/statistiquesExport';
import {
  buildDashboardDrillUrl,
  openDashboardDrill,
  isDrillableStatCell,
} from '../utils/statistiquesDashboardDrill';

const KPI_CHART_FALLBACK_COLORS = [
  '#7030a0', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000',
  '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363',
];

function getCommercialChartColor(entry, index) {
  const raw = String(entry?.color || '').trim();
  if (raw) return normalizeHex(raw);
  return KPI_CHART_FALLBACK_COLORS[index % KPI_CHART_FALLBACK_COLORS.length];
}

const MONTH_LABELS = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
];

function formatKpiPeriodTitle(dateDebut, dateFin) {
  if (!dateDebut || !dateFin) return 'KPI COMMERCIAUX';
  if (dateDebut.slice(0, 7) === dateFin.slice(0, 7) && dateDebut.endsWith('-01')) {
    const [y, m] = dateDebut.split('-');
    const monthLabel = MONTH_LABELS[parseInt(m, 10) - 1] || m;
    return `MOIS DE ${monthLabel} ${y}`;
  }
  return `Période du ${dateDebut} au ${dateFin}`;
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

const FICHE_DATE_FILTER_VALUES = new Set(['date_insert_time', 'date_modif_time', 'date_rdv_time']);

const Statistiques = () => {
  useForceDesktopViewport('statistiques-page');
  const [activeTab, setActiveTab] = useState('centre'); // centre, confirmateur, commercial, kpi-commerciaux, agent, statko
  const [statType, setStatType] = useState('net'); // net, taux, repartition, part_total, barres, camembert
  const [columnPrefsByView, setColumnPrefsByView] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [columnFilterOpen, setColumnFilterOpen] = useState(false);
  const statsPrintRef = useRef(null);

  const [filters, setFilters] = useState({
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0],
    date: 'date_modif_time',
    produit: '',
    id_centre: '',
    id_confirmateur: '',
    id_commercial: '',
    id_agent: '',
  });

  const viewKey = getStatsViewKey(activeTab, statType);
  const columnPrefs = columnPrefsByView[viewKey] || DEFAULT_COLUMN_PREFS;

  const setColumnPrefs = useCallback(
    (next) => {
      setColumnPrefsByView((prev) => ({
        ...prev,
        [viewKey]: typeof next === 'function' ? next(prev[viewKey] || DEFAULT_COLUMN_PREFS) : next,
      }));
    },
    [viewKey]
  );

  useEffect(() => {
    setContextMenu(null);
    setColumnFilterOpen(false);
  }, [activeTab, statType]);

  const getDrillCellProps = useCallback(
    (drillOpts, etatsList) => {
      if (!isDrillableStatCell(statType, drillOpts.cellKind)) {
        return {};
      }
      return {
        className: 'stats-drillable-cell',
        title: 'Ouvrir les fiches correspondantes dans le Dashboard',
        onClick: (e) => {
          e.stopPropagation();
          const url = buildDashboardDrillUrl({
            activeTab,
            statType,
            filters,
            etats: etatsList,
            ...drillOpts,
          });
          openDashboardDrill(url);
        },
      };
    },
    [activeTab, statType, filters]
  );

  const mergeTdProps = useCallback(
    (baseProps, drillOpts, etatsList) => {
      const drill = getDrillCellProps(drillOpts, etatsList);
      if (!drill.onClick) return baseProps;
      return {
        ...baseProps,
        ...drill,
        className: [baseProps?.className, drill.className].filter(Boolean).join(' '),
        style: { ...(baseProps?.style || {}), ...(drill.style || {}) },
      };
    },
    [getDrillCellProps]
  );

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5 && u.etat > 0) || [];
  });

  const { data: agentsData } = useQuery('agents', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 3) || [];
  });

  // Construire les paramètres de requête selon l'onglet actif
  const getQueryParams = () => {
    let name_stat = 'CENTRE';
    let type_id = 'id_centre';
    let func_id = '';
    let id_filter = '';

    switch(activeTab) {
      case 'centre':
        name_stat = 'CENTRE';
        type_id = 'id_centre';
        id_filter = filters.id_centre;
        break;
      case 'confirmateur':
        name_stat = 'CONFIRMATEUR';
        type_id = 'id_confirmateur';
        func_id = '6';
        id_filter = filters.id_confirmateur;
        break;
      case 'commercial':
        name_stat = 'COMMERCIAL';
        type_id = 'id_commercial';
        func_id = '5';
        id_filter = filters.id_commercial;
        break;
      case 'agent':
        name_stat = 'AGENT';
        type_id = 'id_agent';
        func_id = '3';
        id_filter = filters.id_agent;
        break;
      case 'statko':
        name_stat = 'STAT_KO';
        type_id = 'id_agent';
        func_id = '3';
        id_filter = filters.id_agent;
        break;
    }

    const params = {
      name_stat,
      type_id,
      stat: statType,
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      date: activeTab === 'agent'
        ? 'date_insert_time'
        : activeTab === 'confirmateur'
          ? 'fiches_histo'
          : FICHE_DATE_FILTER_VALUES.has(filters.date)
            ? filters.date
            : 'date_modif_time',
      produit: filters.produit
    };

    if (func_id) params.func_id = func_id;
    if (id_filter) params[type_id] = id_filter;
    if (activeTab === 'statko') params.ko = 1;
    if (activeTab === 'confirmateur' && filters.id_centre) params.id_centre = filters.id_centre;

    return params;
  };

  // Récupérer les statistiques
  const { data: statsData, isLoading, refetch } = useQuery(
    ['statistiques', activeTab, statType, filters],
    async () => {
      const params = getQueryParams();
      // Backend n'accepte que 'net' ou 'taux' ; pour les autres formats on demande les chiffres bruts
      const apiStat = (statType === 'taux') ? 'taux' : 'net';
      const res = await api.get('/statistiques/all-stat', { params: { ...params, stat: apiStat } });
      return res.data.data;
    },
    { enabled: false } // Ne pas charger automatiquement
  );

  const { data: kpiCommerciauxData, isLoading: kpiCommerciauxLoading, refetch: refetchKpiCommerciaux } = useQuery(
    ['statistiques-kpi-commerciaux', filters.date_debut, filters.date_fin, filters.produit],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin,
      };
      if (filters.produit) params.produit = filters.produit;
      const res = await api.get('/statistiques/kpi-commerciaux', { params });
      return res.data.data;
    },
    { enabled: false }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'kpi-commerciaux') {
      refetchKpiCommerciaux();
    } else {
      refetch();
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Onglet AGENT : statistiques par date de saisie (insertion), pas par qualification
  useEffect(() => {
    if (activeTab === 'centre' || activeTab === 'statko') {
      setFilters((prev) =>
        FICHE_DATE_FILTER_VALUES.has(prev.date)
          ? prev
          : { ...prev, date: 'date_modif_time' }
      );
    }
    if (activeTab === 'agent') {
      setFilters(prev => (prev.date === 'date_insert_time' ? prev : { ...prev, date: 'date_insert_time' }));
    }
    if (activeTab === 'commercial') {
      setFilters((prev) => ({ ...prev, date: 'date_rdv_time' }));
    }
    if (activeTab === 'confirmateur') {
      setFilters((prev) => (prev.date === 'fiches_histo' ? prev : { ...prev, date: 'fiches_histo' }));
    }
    if (activeTab === 'kpi-commerciaux') {
      setFilters((prev) => ({
        ...prev,
        date_debut: prev.date_debut || getFirstOfMonthLocal(),
        date_fin: prev.date_fin || getTodayLocal(),
      }));
    }
  }, [activeTab]);

  const handleResultsContextMenu = (e) => {
    const hasStats = activeTab === 'kpi-commerciaux' ? kpiCommerciauxData?.rows?.length : statsData?.data?.length;
    if (!hasStats) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const toggleableColumns = useMemo(() => {
    if (activeTab === 'kpi-commerciaux' && kpiCommerciauxData?.rows) {
      const rows = kpiCommerciauxData.rows;
      const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
      return [
        { id: 'honore', label: 'Honoré à suivre', allZeros: sum('honore_a_suivre') === 0 },
        { id: 'refuse', label: 'RDV refusé', allZeros: sum('rdv_refuse') === 0 },
        { id: 'signatures', label: 'Signatures', allZeros: sum('signatures') === 0 },
      ];
    }
    if (!statsData?.data) return [];
    if (statType === 'taux') {
      return TAUX_FIXED_COLUMNS.map((col) => ({
        id: col.id,
        label: col.label,
        allZeros: statsData.data.reduce((s, item) => s + (Number(col.getValue(item)) || 0), 0) === 0,
      }));
    }
    if (['net', 'repartition', 'part_total', 'barres', 'camembert'].includes(statType) && statsData.etats) {
      return statsData.etats.map((etat) => ({
        id: etat.id,
        label: etat.abbreviation || etat.titre,
        allZeros: isEtatColumnAllZeros(statsData.data, etat.id),
      }));
    }
    return [];
  }, [activeTab, statType, statsData, kpiCommerciauxData]);

  const handleStatsExport = (format) => {
    setContextMenu(null);
    let payload;
    const filenameBase = `statistiques-${activeTab}-${filters.date_debut}-${filters.date_fin}`;
    if (activeTab === 'kpi-commerciaux' && kpiCommerciauxData?.rows) {
      const rows = kpiCommerciauxData.rows;
      const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
      const hidden = columnPrefs.hidden || {};
      const hideZero = columnPrefs.hideZeroColumns !== false;
      const visibleKpiBlocks = {
        honore: !hidden.honore && (!hideZero || sum('honore_a_suivre') > 0),
        refuse: !hidden.refuse && (!hideZero || sum('rdv_refuse') > 0),
        signatures: !hidden.signatures && (!hideZero || sum('signatures') > 0),
      };
      payload = buildKpiExport(kpiCommerciauxData, visibleKpiBlocks);
    } else if (statsData?.data) {
      const visibleEtats = getVisibleEtats(statsData.etats, statsData.data, columnPrefs);
      const visibleTauxCols = getVisibleTauxColumns(statsData.data, columnPrefs);
      payload = buildStatsTableExport(statsData, statType, visibleEtats, visibleTauxCols);
    } else {
      alert('Aucune donnée à exporter');
      return;
    }
    runStatsExport(format, payload, filenameBase);
  };

  const handleStatsPrint = () => {
    setContextMenu(null);
    printStatsArea(statsPrintRef.current);
  };

  const renderFilterForm = () => {
    return (
      <form onSubmit={handleSubmit} className="search-form stats-filter-form">
        <div className="search-form-grid">
          <div className="form-group">
            <label>Énergie</label>
            <select
              value={filters.produit}
              onChange={(e) => handleFilterChange('produit', e.target.value)}
            >
              <option value="">PAC ET PV</option>
              <option value="1">PAC</option>
              <option value="2">PV</option>
            </select>
          </div>

          {activeTab !== 'kpi-commerciaux' && (
          <div className="form-group">
            <label>Type de date</label>
            <select
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
            >
              {activeTab === 'agent' ? (
                <option value="date_insert_time">Date Insertion (Saisie)</option>
              ) : activeTab === 'confirmateur' ? (
                <option value="fiches_histo">Date actions (fiches_histo)</option>
              ) : activeTab === 'commercial' ? (
                <>
                  <option value="date_rdv_time">Date Rendez-vous</option>
                  <option value="date_modif_time">Date Modification</option>
                </>
              ) : (
                <>
                  <option value="date_modif_time">Date Qualification (Modification)</option>
                  <option value="date_insert_time">Date Insertion (Saisie)</option>
                  <option value="date_rdv_time">Date Rendez-vous</option>
                </>
              )}
            </select>
          </div>
          )}

          {activeTab === 'kpi-commerciaux' && (
            <div className="form-group">
              <label>Type de date</label>
              <input type="text" value="Date Rendez-vous" readOnly className="kpi-date-readonly" />
            </div>
          )}

          {activeTab === 'centre' && (
            <div className="form-group">
              <label>Centre</label>
              <select
                value={filters.id_centre}
                onChange={(e) => handleFilterChange('id_centre', e.target.value)}
              >
                <option value="">TOUS LES CENTRES</option>
                {centresData?.map(centre => (
                  <option key={centre.id} value={centre.id}>{centre.titre}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'confirmateur' && (
            <>
              <div className="form-group">
                <label>Centre</label>
                <select
                  value={filters.id_centre}
                  onChange={(e) => handleFilterChange('id_centre', e.target.value)}
                >
                  <option value="">TOUS LES CENTRES</option>
                  {centresData?.map(centre => (
                    <option key={centre.id} value={centre.id}>{centre.titre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Confirmateur</label>
                <select
                  value={filters.id_confirmateur}
                  onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                >
                  <option value="">TOUS LES CONFIRMATEURS</option>
                  {confirmateursData?.map(conf => (
                    <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'commercial' && (
            <div className="form-group">
              <label>Commercial</label>
              <select
                value={filters.id_commercial}
                onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
              >
                <option value="">TOUS LES COMMERCIAUX</option>
                {commerciauxData?.map(com => (
                  <option key={com.id} value={com.id}>{com.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="form-group">
              <label>Agent</label>
              <select
                value={filters.id_agent}
                onChange={(e) => handleFilterChange('id_agent', e.target.value)}
              >
                <option value="">TOUS LES AGENTS</option>
                {agentsData?.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Date début</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => handleFilterChange('date_debut', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Date fin</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => handleFilterChange('date_fin', e.target.value)}
            />
          </div>

          {activeTab !== 'kpi-commerciaux' && (
          <div className="form-group">
            <label>Affichage</label>
            <select
              value={statType}
              onChange={(e) => setStatType(e.target.value)}
            >
              <option value="net">EN CHIFFRE</option>
              <option value="taux">EN TAUX</option>
              <option value="repartition">RÉPARTITION % (par ligne)</option>
              <option value="part_total">PART DU TOTAL %</option>
              <option value="barres">BARRES</option>
              <option value="camembert">CAMEMBERT</option>
            </select>
          </div>
          )}
        </div>

        <div className="search-form-actions-left">
          <button type="submit" className="btn-search">
            <FaSearch /> Générer
          </button>
        </div>
      </form>
    );
  };

  const renderStatsTable = () => {
    if (isLoading) {
      return <div className="loading">Chargement des statistiques...</div>;
    }

    if (!statsData || !statsData.data || statsData.data.length === 0) {
      return <div className="no-data">Aucune donnée disponible pour les critères sélectionnés.</div>;
    }

    const { etats, data, total } = statsData;
    const visibleEtats = getVisibleEtats(etats, data, columnPrefs);
    const visibleTauxCols = getVisibleTauxColumns(data, columnPrefs);
    const visibleEtatIds = visibleEtats.map((e) => e.id);

    if (statType === 'taux') {
      // Affichage en mode TAUX - Taux = positif / (positif + négatif)
      const calcTaux = (pos, neg) => {
        const sum = (pos || 0) + (neg || 0);
        return sum > 0 ? (((pos || 0) / sum) * 100).toFixed(1) + '%' : '—';
      };
      const totalPos = data.reduce((sum, item) => sum + item.totals.positive, 0);
      const totalNeg = data.reduce((sum, item) => sum + item.totals.negative, 0);
      return (
        <table className="stats-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>{statsData.name_stat}</th>
              {visibleTauxCols.map((col) => (
                <th key={col.id} className={`stat-${col.id === 'positive' ? 'positive' : col.id === 'negative' ? 'negative' : 'neutre'}`}>
                  {col.label}
                </th>
              ))}
              <th>TAUX %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx}>
                <td className="stat-numero">{idx + 1}</td>
                <td {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'name' }, etats)}>
                  {item.name}
                </td>
                {visibleTauxCols.map((col) => (
                  <td
                    key={col.id}
                    className={col.id === 'positive' ? 'stat-positive' : col.id === 'negative' ? 'stat-negative' : 'stat-neutre'}
                    {...getDrillCellProps({ row: item, tauxColumn: col.id, cellKind: 'taux' }, etats)}
                  >
                    {col.getValue(item)}
                  </td>
                ))}
                <td className="stat-taux">{calcTaux(item.totals.positive, item.totals.negative)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td className="stat-numero">—</td>
              <td {...getDrillCellProps({ isTotalRow: true, etatIds: visibleEtatIds, cellKind: 'name' }, etats)}>
                <strong>TOTAL</strong>
              </td>
              {visibleTauxCols.map((col) => (
                <td
                  key={col.id}
                  className={col.id === 'positive' ? 'stat-positive' : col.id === 'negative' ? 'stat-negative' : 'stat-neutre'}
                  {...getDrillCellProps({ isTotalRow: true, tauxColumn: col.id, cellKind: 'taux' }, etats)}
                >
                  <strong>{data.reduce((sum, item) => sum + (Number(col.getValue(item)) || 0), 0)}</strong>
                </td>
              ))}
              <td className="stat-taux"><strong>{calcTaux(totalPos, totalNeg)}</strong></td>
            </tr>
          </tbody>
        </table>
      );
    }

    if (statType === 'repartition') {
      // Répartition % : chaque ligne = 100 %, valeur = part de l'état dans le total de la ligne
      return (
        <div className="table-responsive">
          <table className="stats-table stats-table-repartition">
            <thead>
              <tr>
                <th>N°</th>
                <th>{statsData.name_stat}</th>
                {visibleEtats.map(etat => (
                  <th key={etat.id} {...getEtatStatCellProps(etat)}>
                    {etat.abbreviation} %
                  </th>
                ))}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="stat-numero">{idx + 1}</td>
                  <td {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'name' }, etats)}>
                    {item.name}
                  </td>
                  {visibleEtats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = item.total > 0 ? ((count * 100) / item.total).toFixed(1) : '0';
                    return (
                      <td
                        key={etat.id}
                        {...mergeTdProps(
                          getEtatStatCellProps(etat),
                          { row: item, etatId: etat.id, cellKind: 'etat' },
                          etats
                        )}
                      >
                        {pct}%
                      </td>
                    );
                  })}
                  <td
                    className="stat-total"
                    {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'total' }, etats)}
                  >
                    {item.total}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="stat-numero">—</td>
                <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>TOTAL</td>
                {visibleEtats.map(etat => {
                  const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                  const pct = total > 0 ? ((colTotal * 100) / total).toFixed(1) : '0';
                  return (
                    <td
                      key={etat.id}
                      {...mergeTdProps(
                        getEtatStatCellProps(etat),
                        { isTotalRow: true, etatId: etat.id, cellKind: 'etat' },
                        etats
                      )}
                    >
                      <strong>{pct}%</strong>
                    </td>
                  );
                })}
                <td
                  className="stat-total"
                  {...getDrillCellProps({ isTotalRow: true, etatIds: visibleEtatIds, cellKind: 'total' }, etats)}
                >
                  <strong>{total}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (statType === 'part_total') {
      // Part du total % : chaque cellule = part de ce count dans le total général
      return (
        <div className="table-responsive">
          <table className="stats-table stats-table-part-total">
            <thead>
              <tr>
                <th>N°</th>
                <th>{statsData.name_stat}</th>
                {visibleEtats.map(etat => (
                  <th key={etat.id} {...getEtatStatCellProps(etat)}>
                    {etat.abbreviation} %
                  </th>
                ))}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="stat-numero">{idx + 1}</td>
                  <td {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'name' }, etats)}>
                    {item.name}
                  </td>
                  {visibleEtats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = total > 0 ? ((count * 100) / total).toFixed(1) : '0';
                    return (
                      <td
                        key={etat.id}
                        {...mergeTdProps(
                          getEtatStatCellProps(etat),
                          { row: item, etatId: etat.id, cellKind: 'etat' },
                          etats
                        )}
                      >
                        {pct}%
                      </td>
                    );
                  })}
                  <td
                    className="stat-total"
                    {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'total' }, etats)}
                  >
                    {total > 0 ? ((item.total * 100) / total).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="stat-numero">—</td>
                <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>TOTAL</td>
                {visibleEtats.map(etat => {
                  const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                  const pct = total > 0 ? ((colTotal * 100) / total).toFixed(1) : '0';
                  return (
                    <td
                      key={etat.id}
                      {...mergeTdProps(
                        getEtatStatCellProps(etat),
                        { isTotalRow: true, etatId: etat.id, cellKind: 'etat' },
                        etats
                      )}
                    >
                      <strong>{pct}%</strong>
                    </td>
                  );
                })}
                <td className="stat-total"><strong>100%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (statType === 'barres') {
      // Barres : une barre horizontale par ligne (segments proportionnels aux états)
      return (
        <div className="stats-barres-container">
          <div className="stats-barres-legend">
            {visibleEtats.map((etat) => {
              const etatCell = getEtatStatCellProps(etat);
              return (
                <span
                  key={etat.id}
                  className={`stats-barres-legend-item ${etatCell.className}`}
                  style={etatCell.style}
                >
                  {etat.abbreviation}
                </span>
              );
            })}
          </div>
          <div className="stats-barres-list">
            {data.map((item, idx) => (
              <div key={idx} className="stats-barres-row">
                <div className="stats-barres-label" title={item.name}>
                  {item.name}
                </div>
                <div className="stats-barres-track">
                  {item.total > 0 && visibleEtats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = (count * 100) / item.total;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={etat.id}
                        className="stats-barres-segment"
                        style={{ width: `${pct}%`, backgroundColor: etat.color }}
                        title={`${etat.abbreviation}: ${count} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="stats-barres-total">{item.total}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (statType === 'camembert') {
      // Camembert : répartition par état (total par état)
      const pieData = visibleEtats.map(etat => {
        const value = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
        return {
          name: etat.abbreviation,
          value,
          color: etat.color
        };
      }).filter(d => d.value > 0);

      return (
        <div className="stats-camembert-container">
          <div className="stats-camembert-chart">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="stats-camembert-total">
            Total : <strong>{total}</strong> fiches
          </div>
        </div>
      );
    }

    // Affichage en mode NET (chiffres)
    return (
      <div className="table-responsive">
        <table className="stats-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>{statsData.name_stat}</th>
              {visibleEtats.map(etat => (
                <th key={etat.id} {...getEtatStatCellProps(etat)}>
                  {etat.abbreviation}
                </th>
              ))}
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx}>
                <td className="stat-numero">{idx + 1}</td>
                <td {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'name' }, etats)}>
                  {item.name}
                </td>
                {visibleEtats.map(etat => {
                  const count = item.stats[etat.id] || 0;
                  return (
                    <td
                      key={etat.id}
                      {...mergeTdProps(
                        getEtatStatCellProps(etat),
                        { row: item, etatId: etat.id, cellKind: 'etat' },
                        etats
                      )}
                    >
                      {count}
                    </td>
                  );
                })}
                <td
                  className="stat-total"
                  {...getDrillCellProps({ row: item, etatIds: visibleEtatIds, cellKind: 'total' }, etats)}
                >
                  {item.total}
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td className="stat-numero">—</td>
              <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>
                TOTAL
              </td>
              {visibleEtats.map(etat => {
                const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                return (
                  <td
                    key={etat.id}
                    {...mergeTdProps(
                      getEtatStatCellProps(etat),
                      { isTotalRow: true, etatId: etat.id, cellKind: 'etat' },
                      etats
                    )}
                  >
                    {colTotal}
                  </td>
                );
              })}
              <td
                className="stat-total"
                {...getDrillCellProps({ isTotalRow: true, etatIds: visibleEtatIds, cellKind: 'total' }, etats)}
              >
                <strong>{total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderKpiCommerciaux = () => {
    if (kpiCommerciauxLoading) {
      return <div className="loading">Chargement des KPI commerciaux...</div>;
    }
    if (!kpiCommerciauxData?.rows?.length) {
      return <div className="no-data">Aucune donnée disponible pour les critères sélectionnés.</div>;
    }

    const rows = kpiCommerciauxData.rows;
    const period = kpiCommerciauxData.period || {};
    const sumKpi = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const hidden = columnPrefs.hidden || {};
    const hideZero = columnPrefs.hideZeroColumns !== false;
    const showHonore = !hidden.honore && (!hideZero || sumKpi('honore_a_suivre') > 0);
    const showRefuse = !hidden.refuse && (!hideZero || sumKpi('rdv_refuse') > 0);
    const showSignatures = !hidden.signatures && (!hideZero || sumKpi('signatures') > 0);

    const chartData = rows
      .filter((r) => r.total_rdv_honores > 0)
      .map((r, index) => ({
        ...r,
        commercial: String(r.commercial || '').toUpperCase(),
        barColor: getCommercialChartColor(r, index),
      }));

    const renderKpiTable = (countKey, countLabel, countClass, tauxKey, tauxLabel) => (
      <div className="kpi-commercial-table-wrap">
        <table className="kpi-commercial-table">
          <thead>
            <tr>
              <th className="kpi-col-commercial">COMMERCIAL</th>
              <th className={countClass}>{countLabel}</th>
              <th className="kpi-col-total">TOTAL RDV HONORÉS</th>
              <th className="kpi-col-taux">{tauxLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const drillRow = { ...row, id: row.id_commercial };
              return (
                <tr key={`${countKey}-${row.id_commercial}`}>
                  <td className="kpi-col-commercial">{String(row.commercial || '').toUpperCase()}</td>
                  <td
                    className={countClass}
                    {...getDrillCellProps(
                      { row: drillRow, kpiMetric: countKey, cellKind: 'etat' },
                      []
                    )}
                  >
                    {row[countKey]}
                  </td>
                  <td
                    className="kpi-col-total"
                    {...getDrillCellProps({ row: drillRow, cellKind: 'total' }, [])}
                  >
                    {row.total_rdv_honores}
                  </td>
                  <td
                    className="kpi-col-taux"
                    {...getDrillCellProps(
                      { row: drillRow, kpiMetric: countKey, cellKind: 'etat' },
                      []
                    )}
                  >
                    {formatPct(row[tauxKey])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    return (
      <div className="kpi-commerciaux-dashboard">
        <h3 className="kpi-commerciaux-title">
          {formatKpiPeriodTitle(period.date_debut, period.date_fin)}
        </h3>
        <div className="kpi-commerciaux-grid">
          {showHonore && renderKpiTable(
            'honore_a_suivre',
            'NBRE DE HONORÉ À SUIVRE',
            'kpi-col-honore',
            'taux_r2',
            'TAUX DE CONCRÉTISATION DES R2'
          )}
          {showRefuse && renderKpiTable(
            'rdv_refuse',
            'NBRE DE RDV REFUSÉ',
            'kpi-col-refuse',
            'taux_refuses',
            'TAUX DE CONCRÉTISATION DES REFUSÉS'
          )}
          {showSignatures && renderKpiTable(
            'signatures',
            'NBRE DE SIGNATURE',
            'kpi-col-signature',
            'taux_signes',
            'TAUX DE CONCRÉTISATION DES SIGNÉS'
          )}
          <div className="kpi-commercial-chart-wrap">
            <h4 className="kpi-chart-title">TAUX DE CONCRÉTISATION DES SIGNÉS</h4>
            {chartData.length === 0 ? (
              <div className="no-data">Aucune signature sur la période.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={chartData} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="commercial" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Taux signés']} />
                    <Bar dataKey="taux_signes" radius={[4, 4, 0, 0]} label={{ position: 'top', formatter: (v) => formatPct(v) }}>
                      {chartData.map((entry) => (
                        <Cell key={entry.id_commercial} fill={entry.barColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="kpi-chart-legend">
                  {chartData.map((entry) => (
                    <span
                      key={entry.id_commercial}
                      className="kpi-chart-legend-item"
                      style={{
                        backgroundColor: entry.barColor,
                        color: getEtatContrastColor(entry.barColor),
                      }}
                    >
                      {entry.commercial}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="statistiques-page">
      <h2 className="page-title"><FaChartBar /> Statistiques</h2>

      {/* Menu de navigation */}
      <div className="stats-menu">
        <button
          className={`menu-btn ${activeTab === 'centre' ? 'active' : ''}`}
          onClick={() => setActiveTab('centre')}
        >
          CENTRE
        </button>
        <button
          className={`menu-btn ${activeTab === 'agent' ? 'active' : ''}`}
          onClick={() => setActiveTab('agent')}
        >
          AGENT
        </button>
        <button
          className={`menu-btn ${activeTab === 'confirmateur' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirmateur')}
        >
          CONFIRMATEUR
        </button>
        <button
          className={`menu-btn ${activeTab === 'commercial' ? 'active' : ''}`}
          onClick={() => setActiveTab('commercial')}
        >
          COMMERCIAL
        </button>
        <button
          className={`menu-btn ${activeTab === 'kpi-commerciaux' ? 'active' : ''}`}
          onClick={() => setActiveTab('kpi-commerciaux')}
        >
          KPI COMMERCIAUX
        </button>
        <button
          className={`menu-btn ${activeTab === 'statko' ? 'active' : ''}`}
          onClick={() => setActiveTab('statko')}
        >
          STAT KO
        </button>
      </div>

      {/* Formulaire de filtres (style Dashboard) */}
      <div className="stats-filters search-panel">
        <div className="search-panel-header">
          <h2>
            <FaSearch />{' '}
            {activeTab === 'statko'
              ? 'Statistiques fiches KO par Agent'
              : activeTab === 'kpi-commerciaux'
                ? 'KPI Commerciaux'
                : `Statistiques par ${activeTab.toUpperCase()}`}
          </h2>
        </div>
        {renderFilterForm()}
      </div>

      {activeTab === 'kpi-commerciaux' && kpiCommerciauxData && (
        <StatsResultsActions
          contextMenu={contextMenu}
          onCloseContextMenu={() => setContextMenu(null)}
          onExport={handleStatsExport}
          onPrint={handleStatsPrint}
          onOpenColumnFilter={() => {
            setContextMenu(null);
            setColumnFilterOpen(true);
          }}
          columnFilterOpen={columnFilterOpen}
          onCloseColumnFilter={() => setColumnFilterOpen(false)}
          toggleableColumns={toggleableColumns}
          columnPrefs={columnPrefs}
          onColumnPrefsChange={setColumnPrefs}
        >
          <div
            ref={statsPrintRef}
            className="stats-results kpi-commerciaux-results stats-results-interactive"
            onContextMenu={handleResultsContextMenu}
          >
            <p className="stats-results-hint">
              Clic sur une cellule : ouvrir les fiches dans le Dashboard — clic droit : exporter, imprimer, colonnes
            </p>
            {renderKpiCommerciaux()}
          </div>
        </StatsResultsActions>
      )}

      {activeTab !== 'kpi-commerciaux' && statsData && (
        <StatsResultsActions
          contextMenu={contextMenu}
          onCloseContextMenu={() => setContextMenu(null)}
          onExport={handleStatsExport}
          onPrint={handleStatsPrint}
          onOpenColumnFilter={() => {
            setContextMenu(null);
            setColumnFilterOpen(true);
          }}
          columnFilterOpen={columnFilterOpen}
          onCloseColumnFilter={() => setColumnFilterOpen(false)}
          toggleableColumns={toggleableColumns}
          columnPrefs={columnPrefs}
          onColumnPrefsChange={setColumnPrefs}
        >
          <div
            ref={statsPrintRef}
            className="stats-results stats-results-interactive"
            onContextMenu={handleResultsContextMenu}
          >
            <p className="stats-results-hint">
              Clic sur une cellule : ouvrir les fiches dans le Dashboard — clic droit : exporter, imprimer, colonnes
            </p>
            {renderStatsTable()}
          </div>
        </StatsResultsActions>
      )}
    </div>
  );
};

export default Statistiques;
