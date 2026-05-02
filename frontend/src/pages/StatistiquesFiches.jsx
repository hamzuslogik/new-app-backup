import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartBar, FaFilter, FaCalendarAlt, FaSearch, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getFirstOfMonthLocal, getLastDayOfMonthLocal } from '../utils/dateUtils';
import './StatistiquesFiches.css';

const initialFilters = () => ({
  date_debut: getFirstOfMonthLocal(),
  date_fin: getLastDayOfMonthLocal(),
  date_champ: 'date_modif_time',
  id_centre: ''
});

/** Colonnes triables du tableau fiches (Statistiques fiches) */
const FICHES_SORT_KEYS = {
  nom: 'nom',
  prenom: 'prenom',
  tel: 'tel',
  cp: 'cp',
  date_insert: 'date_insert',
  date_rdv: 'date_rdv',
  confirmateur: 'confirmateur',
  commercial: 'commercial',
  etat: 'etat'
};

function dateToSortNumber(value) {
  if (value == null || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

const StatistiquesFiches = () => {
  const { user } = useAuth();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Récupérer les centres (filtrés selon le rôle)
  const { data: centresData } = useQuery(
    ['centres-statistiques', user?.id],
    async () => {
      const res = await api.get('/management/centres');
      return res.data.data || [];
    }
  );

  // Vérifier si l'utilisateur a accès à cette page
  const hasAccess = !!user?.id && ([1, 2, 7].includes(user.fonction) || user.fonction === 9);

  const buildQueryParams = (f) => {
    const params = {
      date_debut: f.date_debut,
      date_fin: f.date_fin,
      date_champ: f.date_champ
    };
    if (f.id_centre) {
      params.id_centre = f.id_centre;
    }
    return params;
  };

  // Récupérer les statistiques (pour les onglets) — uniquement selon appliedFilters
  const {
    data: statsData,
    isLoading: isLoadingStats,
    isFetching: isFetchingStats,
    error: errorStats
  } = useQuery(
    ['statistiques-fiches', appliedFilters, user?.id],
    async () => {
      const res = await api.get('/statistiques/fiches-par-centre', {
        params: buildQueryParams(appliedFilters)
      });
      return res.data;
    },
    {
      enabled: hasAccess,
      keepPreviousData: true,
      onError: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
      }
    }
  );

  // Récupérer les fiches détaillées
  const {
    data: fichesData,
    isLoading: isLoadingFiches,
    isFetching: isFetchingFiches,
    error: errorFiches
  } = useQuery(
    ['fiches-detaillees', appliedFilters, user?.id],
    async () => {
      const res = await api.get('/statistiques/fiches-detaillees', {
        params: buildQueryParams(appliedFilters)
      });
      return res.data;
    },
    {
      enabled: hasAccess,
      keepPreviousData: true,
      onError: (error) => {
        console.error('Erreur lors du chargement des fiches détaillées:', error);
      }
    }
  );

  const handleApplySearch = () => {
    setAppliedFilters({ ...draftFilters });
    setActiveTab(0);
  };

  const isFetchingResults = isFetchingStats || isFetchingFiches;
  const isBootstrapping =
    hasAccess &&
    !errorStats &&
    !errorFiches &&
    (statsData === undefined || fichesData === undefined) &&
    (isFetchingStats || isFetchingFiches);

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '-') return '0';
    return Number(num).toLocaleString('fr-FR');
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  /** Couleur d’état (comme le dashboard) */
  const getEtatColorForFiche = (fiche) => {
    const c = fiche?.etat_color;
    if (c != null && String(c).trim() !== '') return String(c).trim();
    return '#cccccc';
  };

  const stats = statsData?.data || [];
  const fiches = fichesData?.data || [];
  const totalGlobal = stats.reduce((sum, centre) => sum + (centre.total_fiches || 0), 0);

  // Grouper les fiches par centre
  const fichesByCentre = {};
  fiches.forEach(fiche => {
    // Trouver le centre de la fiche
    const centreId = fiche.id_centre || 'unknown';
    if (!fichesByCentre[centreId]) {
      fichesByCentre[centreId] = [];
    }
    fichesByCentre[centreId].push(fiche);
  });

  // Si un seul centre ou filtre par centre, afficher directement
  // Sinon, utiliser des onglets
  const showTabs = stats.length > 1 && !appliedFilters.id_centre;
  const displayStats = appliedFilters.id_centre
    ? stats.filter(c => c.centre_id === parseInt(appliedFilters.id_centre, 10))
    : showTabs
      ? [stats[activeTab]]
      : stats;

  // Obtenir les fiches pour le centre actif
  const getFichesForActiveCentre = () => {
    if (appliedFilters.id_centre) {
      return fichesByCentre[parseInt(appliedFilters.id_centre, 10)] || [];
    }
    if (showTabs && stats[activeTab]) {
      const centreId = stats[activeTab].centre_id;
      return fichesByCentre[centreId] || [];
    }
    if (stats.length === 1 && stats[0]) {
      return fichesByCentre[stats[0].centre_id] || [];
    }
    return fiches;
  };

  const activeFiches = getFichesForActiveCentre();

  const sortedFiches = useMemo(() => {
    if (!sortKey || activeFiches.length === 0) return activeFiches;
    const mult = sortDir === 'asc' ? 1 : -1;
    const list = [...activeFiches];
    list.sort((a, b) => {
      if (sortKey === FICHES_SORT_KEYS.etat) {
        const ida =
          a.id_etat_final != null && a.id_etat_final !== ''
            ? Number(a.id_etat_final)
            : NaN;
        const idb =
          b.id_etat_final != null && b.id_etat_final !== ''
            ? Number(b.id_etat_final)
            : NaN;
        const aNum = Number.isFinite(ida);
        const bNum = Number.isFinite(idb);
        if (aNum && bNum && ida !== idb) return (ida - idb) * mult;
        if (aNum && !bNum) return -1 * mult;
        if (!aNum && bNum) return 1 * mult;
        const ta = (a.etat_titre || '').toLowerCase();
        const tb = (b.etat_titre || '').toLowerCase();
        return ta.localeCompare(tb, 'fr', { sensitivity: 'base' }) * mult;
      }

      let va;
      let vb;
      switch (sortKey) {
        case FICHES_SORT_KEYS.nom:
          va = (a.nom || '').toLowerCase();
          vb = (b.nom || '').toLowerCase();
          break;
        case FICHES_SORT_KEYS.prenom:
          va = (a.prenom || '').toLowerCase();
          vb = (b.prenom || '').toLowerCase();
          break;
        case FICHES_SORT_KEYS.tel:
          va = (a.tel || a.gsm1 || '').toLowerCase();
          vb = (b.tel || b.gsm1 || '').toLowerCase();
          break;
        case FICHES_SORT_KEYS.cp:
          va = (a.cp || '').toLowerCase();
          vb = (b.cp || '').toLowerCase();
          break;
        case FICHES_SORT_KEYS.date_insert:
          va = dateToSortNumber(a.date_insert_time);
          vb = dateToSortNumber(b.date_insert_time);
          break;
        case FICHES_SORT_KEYS.date_rdv:
          va = dateToSortNumber(a.date_rdv_time);
          vb = dateToSortNumber(b.date_rdv_time);
          break;
        case FICHES_SORT_KEYS.confirmateur:
          va = (a.confirmateur_nom || '').toLowerCase();
          vb = (b.confirmateur_nom || '').toLowerCase();
          break;
        case FICHES_SORT_KEYS.commercial:
          va = (a.commercial_nom || '').toLowerCase();
          vb = (b.commercial_nom || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (
        sortKey === FICHES_SORT_KEYS.date_insert ||
        sortKey === FICHES_SORT_KEYS.date_rdv
      ) {
        const na = va == null ? -Infinity : va;
        const nb = vb == null ? -Infinity : vb;
        if (na !== nb) return (na - nb) * mult;
        return 0;
      }

      return (
        String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' }) * mult
      );
    });
    return list;
  }, [activeFiches, sortKey, sortDir]);

  const handleSortColumn = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (key) => {
    if (sortKey !== key) {
      return <FaSort className="fiches-sort-icon fiches-sort-icon--muted" aria-hidden />;
    }
    return sortDir === 'asc' ? (
      <FaSortUp className="fiches-sort-icon fiches-sort-icon--active" aria-hidden />
    ) : (
      <FaSortDown className="fiches-sort-icon fiches-sort-icon--active" aria-hidden />
    );
  };

  const etatsChartRows = useMemo(() => {
    const total = activeFiches.length;
    if (!total) return [];
    const byKey = new Map();
    for (const f of activeFiches) {
      const id = f.id_etat_final != null && f.id_etat_final !== '' ? String(f.id_etat_final) : '_none';
      const titre = (f.etat_titre || 'Sans état').trim() || 'Sans état';
      const color =
        f.etat_color != null && String(f.etat_color).trim() !== ''
          ? String(f.etat_color).trim()
          : '#94a3b8';
      if (!byKey.has(id)) {
        byKey.set(id, { id, titre, color, count: 0 });
      }
      byKey.get(id).count += 1;
    }
    return [...byKey.values()]
      .map((row) => {
        const pct = (row.count / total) * 100;
        const labelCourt =
          row.titre.length > 36 ? `${row.titre.slice(0, 33)}…` : row.titre;
        return {
          ...row,
          labelCourt,
          pct,
          labelValue: `${Number(row.count).toLocaleString('fr-FR')} (${pct.toFixed(1)} %)`
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [activeFiches]);

  const etatsChartHeight = Math.min(520, Math.max(200, etatsChartRows.length * 36 + 72));

  const queryError =
    errorStats?.response?.data?.message ||
    errorStats?.message ||
    errorFiches?.response?.data?.message ||
    errorFiches?.message ||
    (statsData?.success === false ? statsData?.message : null) ||
    (fichesData?.success === false ? fichesData?.message : null);

  if (!hasAccess) {
    return (
      <div className="statistiques-fiches-page">
        <div className="error-message">
          Vous n'avez pas accès à cette page. Cette page est réservée aux administrateurs et aux utilisateurs avec la fonction 9.
        </div>
      </div>
    );
  }

  return (
    <div className="statistiques-fiches-page">
      <div className="page-header">
        <h1>
          <FaChartBar /> Statistiques Fiches
        </h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-toolbar">
            <div className="filter-field filter-field-date">
              <label htmlFor="sf-date-debut">
                <FaCalendarAlt /> Date de début
              </label>
              <input
                id="sf-date-debut"
                type="date"
                value={draftFilters.date_debut}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_debut: e.target.value })
                }
              />
            </div>
            <div className="filter-field filter-field-date">
              <label htmlFor="sf-date-fin">
                <FaCalendarAlt /> Date de fin
              </label>
              <input
                id="sf-date-fin"
                type="date"
                value={draftFilters.date_fin}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_fin: e.target.value })
                }
              />
            </div>
            <div className="filter-field filter-field-champ">
              <label htmlFor="sf-date-champ">Champ de date</label>
              <select
                id="sf-date-champ"
                value={draftFilters.date_champ}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_champ: e.target.value })
                }
              >
                <option value="date_modif_time">Date de modification</option>
                <option value="date_insert_time">Date d&apos;insertion</option>
              </select>
            </div>
            {([1, 2, 7].includes(user?.fonction)) && (
              <div className="filter-field filter-field-centre">
                <label htmlFor="sf-centre">Centre (optionnel)</label>
                <select
                  id="sf-centre"
                  value={draftFilters.id_centre}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, id_centre: e.target.value })
                  }
                >
                  <option value="">Tous les centres</option>
                  {centresData &&
                    centresData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titre}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div className="filters-toolbar-footer">
            <button
              type="button"
              className="btn-rechercher-stat-fiches"
              onClick={handleApplySearch}
              disabled={isFetchingResults}
            >
              <FaSearch /> Rechercher
            </button>
          </div>
        </div>
      )}

      {isBootstrapping && (
        <div className="statistiques-fiches-loading">
          <LoadingSpinner text="Chargement des statistiques..." />
        </div>
      )}

      {queryError && !isBootstrapping && (
        <div className="error-message">
          Erreur lors du chargement des statistiques : {queryError || 'Erreur inconnue'}
        </div>
      )}

      {/* Message si aucune donnée */}
      {!isBootstrapping && !queryError && !isFetchingResults && stats.length === 0 && (
        <div className="no-data-message">
          <p>Aucune statistique disponible pour la période sélectionnée.</p>
          <p>Veuillez ajuster les filtres de date ou sélectionner un autre centre.</p>
        </div>
      )}

      {/* Résumé global */}
      {!isBootstrapping && !queryError && stats.length > 0 && (
        <div className={`summary-cards${isFetchingResults ? ' summary-cards--refreshing' : ''}`}>
          <div className="summary-card card-primary">
            <div className="summary-icon">
              <FaChartBar />
            </div>
            <div className="summary-content">
              <div className="summary-label">Total des fiches</div>
              <div className="summary-value">{formatNumber(totalGlobal)}</div>
            </div>
          </div>
          <div className="summary-card card-secondary">
            <div className="summary-icon">
              <FaChartBar />
            </div>
            <div className="summary-content">
              <div className="summary-label">Centres</div>
              <div className="summary-value">{stats.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Onglets si plusieurs centres */}
      {!isBootstrapping && !queryError && showTabs && (
        <div className={`tabs-container${isFetchingResults ? ' tabs-container--refreshing' : ''}`}>
          {stats.map((centre, index) => (
            <button
              key={centre.centre_id}
              className={`tab-button ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {centre.centre_titre || `Centre ${index + 1}`}
              <span className="tab-badge">({formatNumber(fichesByCentre[centre.centre_id]?.length || 0)})</span>
            </button>
          ))}
        </div>
      )}

      {/* Tableau des fiches */}
      {!isBootstrapping && !queryError && (
      <div className={`stats-table-container${isFetchingResults ? ' stats-table-container--refreshing' : ''}`}>
        {activeFiches.length === 0 ? (
          <div className="no-data">
            Aucune fiche disponible pour la période sélectionnée
          </div>
        ) : (
          <div className="fiches-table-wrapper">
            <div className="table-header-info">
              <h3>
                {displayStats[0]?.centre_titre || 'Tous les centres'}
                <span className="fiches-count">({formatNumber(activeFiches.length)} fiches)</span>
              </h3>
            </div>

            {etatsChartRows.length > 0 && (
              <div className="stat-fiches-etats-chart">
                <h4 className="stat-fiches-etats-chart-title">Répartition par état</h4>
                <p className="stat-fiches-etats-chart-sub">
                  Nombre et pourcentage du total des fiches affichées ({formatNumber(activeFiches.length)}).
                </p>
                <div className="stat-fiches-etats-chart-inner">
                  <ResponsiveContainer width="100%" height={etatsChartHeight}>
                    <BarChart
                      layout="vertical"
                      data={etatsChartRows}
                      margin={{ top: 6, right: 132, left: 8, bottom: 6 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="labelCourt"
                        width={168}
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const pct = item?.payload?.pct;
                          const pctStr =
                            pct != null && Number.isFinite(pct)
                              ? ` (${pct.toFixed(2)} % du total)`
                              : '';
                          return [`${formatNumber(value)} fiche(s)${pctStr}`, 'Effectif'];
                        }}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.titre || ''
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[0, 6, 6, 0]}
                        isAnimationActive={!isFetchingResults}
                        maxBarSize={28}
                      >
                        {etatsChartRows.map((entry, index) => (
                          <Cell key={`etat-bar-${entry.id}-${index}`} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="labelValue"
                          position="right"
                          style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <table className="fiches-detail-table">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.nom
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.nom)}
                  >
                    <span className="fiches-detail-th-inner">
                      Nom {renderSortIcon(FICHES_SORT_KEYS.nom)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.prenom
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.prenom)}
                  >
                    <span className="fiches-detail-th-inner">
                      Prénom {renderSortIcon(FICHES_SORT_KEYS.prenom)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.tel
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.tel)}
                  >
                    <span className="fiches-detail-th-inner">
                      Téléphone {renderSortIcon(FICHES_SORT_KEYS.tel)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.cp
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.cp)}
                  >
                    <span className="fiches-detail-th-inner">
                      CP {renderSortIcon(FICHES_SORT_KEYS.cp)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.date_insert
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.date_insert)}
                  >
                    <span className="fiches-detail-th-inner">
                      Date insertion {renderSortIcon(FICHES_SORT_KEYS.date_insert)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.date_rdv
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.date_rdv)}
                  >
                    <span className="fiches-detail-th-inner">
                      Date / Heure RDV {renderSortIcon(FICHES_SORT_KEYS.date_rdv)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.confirmateur
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.confirmateur)}
                  >
                    <span className="fiches-detail-th-inner">
                      Confirmateur {renderSortIcon(FICHES_SORT_KEYS.confirmateur)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.commercial
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.commercial)}
                  >
                    <span className="fiches-detail-th-inner">
                      Commercial {renderSortIcon(FICHES_SORT_KEYS.commercial)}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="fiches-detail-th-sortable"
                    aria-sort={
                      sortKey === FICHES_SORT_KEYS.etat
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSortColumn(FICHES_SORT_KEYS.etat)}
                  >
                    <span className="fiches-detail-th-inner">
                      État {renderSortIcon(FICHES_SORT_KEYS.etat)}
                    </span>
                  </th>
                  <th scope="col" className="fiches-detail-th-static">
                    Détails
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiches.map((fiche) => {
                  const etatColor = getEtatColorForFiche(fiche);
                  return (
                    <tr
                      key={fiche.id || fiche.hash}
                      className="fiche-row-by-etat"
                      style={{
                        backgroundColor: `${etatColor}40`,
                        borderLeft: `4px solid ${etatColor}`
                      }}
                    >
                      <td>{fiche.nom || '-'}</td>
                      <td>{fiche.prenom || '-'}</td>
                      <td>{fiche.tel || fiche.gsm1 || '-'}</td>
                      <td>{fiche.cp || '-'}</td>
                      <td>{formatDateOnly(fiche.date_insert_time)}</td>
                      <td>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                      <td>{fiche.confirmateur_nom || '-'}</td>
                      <td>{fiche.commercial_nom || '-'}</td>
                      <td>
                        {fiche.etat_titre ? (
                          <span
                            className="etat-badge"
                            style={{
                              backgroundColor: etatColor,
                              color: '#ffffff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '10.2px',
                              fontWeight: '600'
                            }}
                          >
                            {fiche.etat_titre}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {fiche.hash ? (
                          <FicheDetailLink
                            ficheHash={fiche.hash}
                            className="btn-detail-link"
                            title="Voir les détails"
                          >
                            <FaSearch />
                          </FicheDetailLink>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default StatistiquesFiches;
