import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { 
  FaTrophy, 
  FaUsers, 
  FaChartLine, 
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaPercentage,
  FaDoorOpen
} from 'react-icons/fa';
import './KPIs.css';
import KpisDateFilter from '../components/KpisDateFilter';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const KPIs = () => {
  useForceDesktopViewport('kpis-page');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('qualification'); // qualification, confirmation, confirmation-jws, porte-ouverte
  const [selectedPorteOuverteCentre, setSelectedPorteOuverteCentre] = useState('');
  const [selectedPorteOuverteEtat, setSelectedPorteOuverteEtat] = useState('');

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getFirstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getDefaultDateFilters = () => ({
    date_champ: 'date_insert_time',
    date_debut: getFirstOfMonthStr(),
    date_fin: getTodayStr(),
    time_debut: '00:00:00',
    time_fin: '23:59:59',
  });

  const [dateFilters, setDateFilters] = useState(getDefaultDateFilters);
  const [appliedFilters, setAppliedFilters] = useState(getDefaultDateFilters);

  const buildKpiParams = (filters = appliedFilters) => {
    const params = {
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      time_debut: filters.time_debut,
      time_fin: filters.time_fin,
    };
    if (activeTab !== 'confirmation' && activeTab !== 'confirmation-jws') {
      params.date_champ = filters.date_champ;
    }
    return params;
  };

  const filterToDatetimeLocalValue = (dateValue, timeValue, defaultTime = '00:00:00') => {
    const d = String(dateValue || '').trim();
    if (!d) return '';
    const tRaw = String(timeValue || defaultTime || '').trim();
    const hhmm = tRaw.length >= 5 ? tRaw.slice(0, 5) : String(defaultTime || '00:00:00').slice(0, 5);
    return `${d}T${hhmm}`;
  };

  const handleDatetimeLocalChange = (bound, e) => {
    const v = e.target.value;
    if (!v) {
      setDateFilters((prev) => ({
        ...prev,
        ...(bound === 'debut' ? { date_debut: '', time_debut: '' } : { date_fin: '', time_fin: '' }),
      }));
      return;
    }
    const [datePart, timePart] = v.split('T');
    const hhmm = timePart && timePart.length >= 5 ? timePart.slice(0, 5) : bound === 'debut' ? '00:00' : '23:59';
    setDateFilters((prev) => ({
      ...prev,
      ...(bound === 'debut'
        ? { date_debut: datePart || '', time_debut: `${hhmm}:00` }
        : { date_fin: datePart || '', time_fin: `${hhmm}:00` }),
    }));
  };

  const applyNowToDatetimeBound = (bound) => {
    const now = new Date();
    const dateStr = getTodayStr();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    setDateFilters((prev) => ({
      ...prev,
      ...(bound === 'debut' ? { date_debut: dateStr, time_debut: timeStr } : { date_fin: dateStr, time_fin: timeStr }),
    }));
  };

  const handleDateChampChange = (value) => {
    setDateFilters((prev) => {
      const next = { ...prev, date_champ: value };
      if (value && (!prev.date_debut || !prev.date_fin)) {
        next.date_debut = getTodayStr();
        next.date_fin = getTodayStr();
        next.time_debut = '00:00:00';
        next.time_fin = '23:59:59';
      }
      if (!value) {
        next.date_debut = '';
        next.date_fin = '';
        next.time_debut = '';
        next.time_fin = '';
      }
      return next;
    });
  };

  const handleApplyDateFilters = () => {
    if (!dateFilters.date_debut || !dateFilters.date_fin) return;
    if (activeTab !== 'confirmation' && activeTab !== 'confirmation-jws' && !dateFilters.date_champ) return;
    setAppliedFilters({ ...dateFilters });
  };

  const handleResetDateFilters = () => {
    const defaults = getDefaultDateFilters();
    setDateFilters(defaults);
    setAppliedFilters(defaults);
  };

  const dateFiltersReady =
    !!appliedFilters.date_debut &&
    !!appliedFilters.date_fin &&
    (activeTab === 'confirmation' || activeTab === 'confirmation-jws' || !!appliedFilters.date_champ);

  const kpiQueryKey = ['kpis-filters', appliedFilters, activeTab];

  const { data: kpiData, isLoading: isLoadingQualif, error: errorQualif } = useQuery(
    [...kpiQueryKey, 'qualification'],
    async () => {
      const res = await api.get('/statistiques/kpis', { params: buildKpiParams() });
      return res.data.data;
    },
    { enabled: dateFiltersReady && activeTab === 'qualification' }
  );

  const { data: confirmationData, isLoading: isLoadingConf, error: errorConf } = useQuery(
    [...kpiQueryKey, 'confirmation'],
    async () => {
      const res = await api.get('/statistiques/kpis-confirmation', { params: buildKpiParams() });
      return res.data.data;
    },
    { enabled: dateFiltersReady && activeTab === 'confirmation' }
  );

  const { data: confirmationJwsData, isLoading: isLoadingConfJws, error: errorConfJws } = useQuery(
    [...kpiQueryKey, 'confirmation-jws'],
    async () => {
      const res = await api.get('/statistiques/kpis-confirmation-jws', { params: buildKpiParams() });
      return res.data.data;
    },
    { enabled: dateFiltersReady && activeTab === 'confirmation-jws' }
  );

  const PORTE_OUVERTE_ALL_JWS = '__ALL_JWS__';

  const { data: centresData } = useQuery(
    ['kpis-centres-actifs'],
    async () => {
      const res = await api.get('/management/centres');
      return (res.data?.data || []).filter((c) => Number(c?.etat) > 0);
    },
    { enabled: activeTab === 'porte-ouverte' }
  );

  const { data: porteOuverteData, isLoading: isLoadingPorteOuverte, error: errorPorteOuverte } = useQuery(
    [...kpiQueryKey, 'porte-ouverte', selectedPorteOuverteCentre],
    async () => {
      const params = buildKpiParams();
      if (selectedPorteOuverteCentre) {
        if (selectedPorteOuverteCentre === PORTE_OUVERTE_ALL_JWS) {
          params.centre_scope = 'all_jws';
        } else {
          params.id_centre = selectedPorteOuverteCentre;
        }
      }
      const res = await api.get('/statistiques/kpis-porte-ouverte', { params });
      return res.data.data;
    },
    { enabled: dateFiltersReady && activeTab === 'porte-ouverte' }
  );

  const isLoading = activeTab === 'qualification' ? isLoadingQualif : 
                   activeTab === 'confirmation' ? isLoadingConf : 
                   activeTab === 'porte-ouverte' ? isLoadingPorteOuverte :
                   isLoadingConfJws;
  const error = activeTab === 'qualification' ? errorQualif : 
                activeTab === 'confirmation' ? errorConf : 
                activeTab === 'porte-ouverte' ? errorPorteOuverte :
                errorConfJws;

  const currentData = activeTab === 'qualification'
    ? kpiData?.range
    : activeTab === 'confirmation'
    ? confirmationData?.range
    : activeTab === 'porte-ouverte'
    ? porteOuverteData?.range
    : confirmationJwsData?.range;
  const filteredPorteOuverteDetails = activeTab === 'porte-ouverte'
    ? (currentData?.details || []).filter((row) => {
        if (!selectedPorteOuverteEtat) return true;
        return String(row?.id_etat_final) === String(selectedPorteOuverteEtat);
      })
    : [];

  // Fonction pour formater le pourcentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '0%';
    return `${value.toFixed(1)}%`;
  };

  // Fonction pour obtenir l'icône de tendance
  const getTrendIcon = (trend) => {
    if (trend === 'up') return <FaArrowUp className="trend-icon up" />;
    if (trend === 'down') return <FaArrowDown className="trend-icon down" />;
    return <FaMinus className="trend-icon stable" />;
  };

  // Fonction pour obtenir la couleur de tendance
  const getTrendColor = (trend) => {
    if (trend === 'up') return '#4CAF50';
    if (trend === 'down') return '#f44336';
    return '#9E9E9E';
  };

  // Médailles pour le classement
  const medals = ['🥇', '🥈', '🥉'];

  const isConfirmationTab = activeTab === 'confirmation' || activeTab === 'confirmation-jws';

  const renderConfirmationKpiContent = (data) => {
    if (!data) return null;
    return (
      <div className="kpis-content">
        <div className="kpi-section">
          <h2 className="section-title">Métriques Globales</h2>
          <div className="kpi-cards metrics">
            {data.confirmation_rate !== undefined && (
              <div className="kpi-card confirmation-rate">
                <div className="kpi-card-header">
                  <FaPercentage className="kpi-icon" />
                  <h3>Taux de Confirmation</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="kpi-value-large">
                    <span className="value">{formatPercentage(data.confirmation_rate)}</span>
                    {(data.confirmations_count != null || data.fiches_traitees_count != null) && (
                      <span className="label label-detail">
                        {data.confirmations_count ?? 0} / {data.fiches_traitees_count ?? 0} fiches distinctes
                      </span>
                    )}
                  </div>
                  {data.confirmation_rate_change !== undefined && (
                    <div className="evolution-indicator">
                      {getTrendIcon(data.confirmation_rate_change > 0 ? 'up' : (data.confirmation_rate_change < 0 ? 'down' : 'stable'))}
                      <span
                        className="evolution-value"
                        style={{ color: getTrendColor(data.confirmation_rate_change > 0 ? 'up' : (data.confirmation_rate_change < 0 ? 'down' : 'stable')) }}
                      >
                        {data.confirmation_rate_change > 0 ? '+' : ''}{formatPercentage(data.confirmation_rate_change)}
                      </span>
                      <span className="evolution-label">vs période précédente</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.signature_rate !== undefined && (
              <div className="kpi-card signature-rate">
                <div className="kpi-card-header">
                  <FaPercentage className="kpi-icon" />
                  <h3>Taux de Signature</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="kpi-value-large">
                    <span className="value">{formatPercentage(data.signature_rate)}</span>
                    {((data.signatures_fiches_distinct_count ??
                      data.signatures_count ??
                      data.fiches_signees_count) != null ||
                      (data.compte_rendu_visites_count ?? data.rdvs_visites_count) != null) && (
                      <span className="label label-detail">
                        {data.signatures_fiches_distinct_count ??
                          data.signatures_count ??
                          data.fiches_signees_count ??
                          0}{' '}
                        / {data.compte_rendu_visites_count ?? data.rdvs_visites_count ?? 0}
                      </span>
                    )}
                  </div>
                  {data.signature_rate_change !== undefined && (
                    <div className="evolution-indicator">
                      {getTrendIcon(data.signature_rate_change > 0 ? 'up' : (data.signature_rate_change < 0 ? 'down' : 'stable'))}
                      <span
                        className="evolution-value"
                        style={{ color: getTrendColor(data.signature_rate_change > 0 ? 'up' : (data.signature_rate_change < 0 ? 'down' : 'stable')) }}
                      >
                        {data.signature_rate_change > 0 ? '+' : ''}{formatPercentage(data.signature_rate_change)}
                      </span>
                      <span className="evolution-label">vs période précédente</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.confirmation_evolution && (
              <div className="kpi-card evolution">
                <div className="kpi-card-header">
                  <FaChartLine className="kpi-icon" />
                  <h3>Évolution Confirmations</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="evolution-comparison">
                    <div className="comparison-item">
                      <span className="comparison-label">Période actuelle</span>
                      <span className="comparison-value">{data.confirmation_evolution.current}</span>
                    </div>
                    <div className="comparison-item">
                      <span className="comparison-label">Période précédente</span>
                      <span className="comparison-value">{data.confirmation_evolution.previous}</span>
                    </div>
                  </div>
                  <div className="evolution-indicator">
                    {getTrendIcon(data.confirmation_evolution.trend)}
                    <span
                      className="evolution-value"
                      style={{ color: getTrendColor(data.confirmation_evolution.trend) }}
                    >
                      {data.confirmation_evolution.change > 0 ? '+' : ''}{data.confirmation_evolution.change.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {data.signature_evolution && (
              <div className="kpi-card evolution">
                <div className="kpi-card-header">
                  <FaChartLine className="kpi-icon" />
                  <h3>Évolution fiches signées</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="evolution-comparison">
                    <div className="comparison-item">
                      <span className="comparison-label">Période actuelle</span>
                      <span className="comparison-value">{data.signature_evolution.current}</span>
                    </div>
                    <div className="comparison-item">
                      <span className="comparison-label">Période précédente</span>
                      <span className="comparison-value">{data.signature_evolution.previous}</span>
                    </div>
                  </div>
                  <div className="evolution-indicator">
                    {getTrendIcon(data.signature_evolution.trend)}
                    <span
                      className="evolution-value"
                      style={{ color: getTrendColor(data.signature_evolution.trend) }}
                    >
                      {data.signature_evolution.change > 0 ? '+' : ''}{data.signature_evolution.change.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="kpi-section">
          <h2 className="section-title">Top 3 Confirmateurs - Confirmations</h2>
          <div className="kpi-cards top-confirmateurs">
            {data.top3_confirmations && data.top3_confirmations.length > 0 ? (
              data.top3_confirmations.map((confirmateur, index) => (
                <div key={confirmateur.id} className="kpi-card confirmateur-card">
                  <div className="kpi-card-header">
                    <span className="medal">{medals[index]}</span>
                    <h3>#{index + 1}</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="agent-info">
                      {confirmateur.photo ? (
                        <img src={confirmateur.photo} alt={confirmateur.pseudo} className="agent-avatar" />
                      ) : (
                        <div className="agent-avatar placeholder">
                          {confirmateur.pseudo ? confirmateur.pseudo.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div className="agent-details">
                        <div className="agent-name">
                          {confirmateur.nom && confirmateur.prenom
                            ? `${confirmateur.nom} ${confirmateur.prenom}`
                            : confirmateur.pseudo || 'N/A'}
                        </div>
                        <div className="agent-pseudo">{confirmateur.pseudo}</div>
                      </div>
                    </div>
                    <div className="kpi-value">
                      <span className="value">{confirmateur.count}</span>
                      <span className="label">confirmations</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">Aucun confirmateur trouvé pour cette période</div>
            )}
          </div>
        </div>

        <div className="kpi-section">
          <h2 className="section-title">Top 3 Confirmateurs - Fiches signées distinctes</h2>
          <div className="kpi-cards top-confirmateurs">
            {data.top3_signatures && data.top3_signatures.length > 0 ? (
              data.top3_signatures.map((confirmateur, index) => (
                <div key={confirmateur.id} className="kpi-card confirmateur-card">
                  <div className="kpi-card-header">
                    <span className="medal">{medals[index]}</span>
                    <h3>#{index + 1}</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="agent-info">
                      {confirmateur.photo ? (
                        <img src={confirmateur.photo} alt={confirmateur.pseudo} className="agent-avatar" />
                      ) : (
                        <div className="agent-avatar placeholder">
                          {confirmateur.pseudo ? confirmateur.pseudo.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div className="agent-details">
                        <div className="agent-name">
                          {confirmateur.nom && confirmateur.prenom
                            ? `${confirmateur.nom} ${confirmateur.prenom}`
                            : confirmateur.pseudo || 'N/A'}
                        </div>
                        <div className="agent-pseudo">{confirmateur.pseudo}</div>
                      </div>
                    </div>
                    <div className="kpi-value">
                      <span className="value">{confirmateur.count}</span>
                      <span className="label">fiches signées distinctes</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">Aucun confirmateur trouvé pour cette période</div>
            )}
          </div>
        </div>

        <div className="period-info">
          <p>
            Période: <strong>{data.date_start}</strong> au <strong>{data.date_end}</strong>
          </p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="kpis-page">
        <div className="loading">Chargement des KPI...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpis-page">
        <div className="error">
          Erreur lors du chargement des KPI: {error.message || 'Erreur inconnue'}
        </div>
      </div>
    );
  }

  return (
    <div className="kpis-page">
      <div className="kpis-header">
        <h1><FaChartLine /> KPIs</h1>
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'qualification' ? 'active' : ''}`}
            onClick={() => setActiveTab('qualification')}
          >
            Qualification
          </button>
          <button
            className={`tab-btn ${activeTab === 'confirmation' ? 'active' : ''}`}
            onClick={() => setActiveTab('confirmation')}
          >
            Confirmation
          </button>
          <button
            className={`tab-btn ${activeTab === 'confirmation-jws' ? 'active' : ''}`}
            onClick={() => setActiveTab('confirmation-jws')}
          >
            Confirmation JWS
          </button>
          <button
            className={`tab-btn ${activeTab === 'porte-ouverte' ? 'active' : ''}`}
            onClick={() => setActiveTab('porte-ouverte')}
          >
            <FaDoorOpen style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Porte ouverte
          </button>
        </div>
        <KpisDateFilter
          dateFilters={dateFilters}
          onDateChampChange={handleDateChampChange}
          onDatetimeChange={handleDatetimeLocalChange}
          onApplyNow={applyNowToDatetimeBound}
          onApply={handleApplyDateFilters}
          onReset={handleResetDateFilters}
          hideDateChamp={isConfirmationTab}
          extraControls={
            activeTab === 'porte-ouverte' ? (
              <div className="form-group porte-ouverte-centre-filter">
                <label htmlFor="porte-ouverte-centre-select">Centre</label>
                <select
                  id="porte-ouverte-centre-select"
                  value={selectedPorteOuverteCentre}
                  onChange={(e) => setSelectedPorteOuverteCentre(e.target.value)}
                  className="month-select"
                >
                  <option value="">Tous les centres</option>
                  <option value={PORTE_OUVERTE_ALL_JWS}>Tous les centres JWS</option>
                  {(centresData || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titre}
                    </option>
                  ))}
                </select>
              </div>
            ) : null
          }
        />
      </div>
      {activeTab === 'qualification' && currentData && (
        <div className="kpis-content">
          {/* Section Métriques Globales */}
          <div className="kpi-section">
            <h2 className="section-title">Métriques Globales</h2>
            <div className="kpi-cards metrics">
              {/* Taux de Conformité */}
              <div className="kpi-card conversion-rate">
                <div className="kpi-card-header">
                  <FaPercentage className="kpi-icon" />
                  <h3>Taux de Conformité</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="kpi-value-large">
                    <span className="value">{formatPercentage(currentData.conversion_rate)}</span>
                    <span className="label">Fiches validées / Fiches produites</span>
                  </div>
                  <div className="conversion-details">
                    <span className="detail-item">
                      <span className="detail-value">{currentData.conversion_validated || 0}</span>
                      <span className="detail-label">validées</span>
                    </span>
                    <span className="detail-separator">/</span>
                    <span className="detail-item">
                      <span className="detail-value">{currentData.conversion_produced || 0}</span>
                      <span className="detail-label">produites</span>
                    </span>
                  </div>
                  {currentData.conversion_rate_change !== undefined && (
                    <div className="evolution-indicator">
                      {getTrendIcon(currentData.conversion_rate_change > 0 ? 'up' : (currentData.conversion_rate_change < 0 ? 'down' : 'stable'))}
                      <span 
                        className="evolution-value"
                        style={{ color: getTrendColor(currentData.conversion_rate_change > 0 ? 'up' : (currentData.conversion_rate_change < 0 ? 'down' : 'stable')) }}
                      >
                        {currentData.conversion_rate_change > 0 ? '+' : ''}{formatPercentage(currentData.conversion_rate_change)}
                      </span>
                      <span className="evolution-label">vs période précédente</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Taux de Conversion */}
              {currentData.transformation_rate !== undefined && (
                <div className="kpi-card transformation-rate">
                  <div className="kpi-card-header">
                    <FaPercentage className="kpi-icon" />
                    <h3>Taux de Conversion</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="kpi-value-large">
                      <span className="value">{formatPercentage(currentData.transformation_rate)}</span>
                      <span className="label">Fiches confirmées / Fiches validées</span>
                    </div>
                    {currentData.transformation_rate_change !== undefined && (
                      <div className="evolution-indicator">
                        {getTrendIcon(currentData.transformation_rate_change > 0 ? 'up' : (currentData.transformation_rate_change < 0 ? 'down' : 'stable'))}
                        <span 
                          className="evolution-value"
                          style={{ color: getTrendColor(currentData.transformation_rate_change > 0 ? 'up' : (currentData.transformation_rate_change < 0 ? 'down' : 'stable')) }}
                        >
                          {currentData.transformation_rate_change > 0 ? '+' : ''}{formatPercentage(currentData.transformation_rate_change)}
                        </span>
                        <span className="evolution-label">vs période précédente</span>
                      </div>
                    )}
                    {currentData.transformation_count !== undefined && currentData.transformation_total !== undefined && (
                      <div className="kpi-details">
                        <span className="details-text">
                          {currentData.transformation_count} confirmées sur {currentData.transformation_total} validées
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Évolution */}
              {currentData.evolution && (
                <div className="kpi-card evolution">
                  <div className="kpi-card-header">
                    <FaChartLine className="kpi-icon" />
                    <h3>Évolution</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="evolution-comparison">
                      <div className="comparison-item">
                        <span className="comparison-label">Période actuelle</span>
                        <span className="comparison-value">{currentData.evolution.current}</span>
                      </div>
                      <div className="comparison-item">
                        <span className="comparison-label">Période précédente</span>
                        <span className="comparison-value">{currentData.evolution.previous}</span>
                      </div>
                    </div>
                    <div className="evolution-indicator">
                      {getTrendIcon(currentData.evolution.trend)}
                      <span 
                        className="evolution-value"
                        style={{ color: getTrendColor(currentData.evolution.trend) }}
                      >
                        {currentData.evolution.change > 0 ? '+' : ''}{currentData.evolution.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section Performance - Top 3 Agents */}
          <div className="kpi-section">
            <h2 className="section-title">Top 3 Agents</h2>
            <div className="kpi-cards top-agents">
              {currentData.top3_agents && currentData.top3_agents.length > 0 ? (
                currentData.top3_agents.map((agent, index) => (
                  <div key={agent.id} className="kpi-card agent-card">
                    <div className="kpi-card-header">
                      <span className="medal">{medals[index]}</span>
                      <h3>#{index + 1}</h3>
                    </div>
                    <div className="kpi-card-body">
                      <div className="agent-info">
                        {agent.photo ? (
                          <img 
                            src={agent.photo} 
                            alt={agent.pseudo}
                            className="agent-avatar"
                          />
                        ) : (
                          <div className="agent-avatar placeholder">
                            {agent.pseudo ? agent.pseudo.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div className="agent-details">
                          <div className="agent-name">
                            {agent.nom && agent.prenom
                              ? `${agent.nom} ${agent.prenom}`
                              : agent.pseudo || 'N/A'}
                          </div>
                          <div className="agent-pseudo">{agent.pseudo}</div>
                        </div>
                      </div>
                      <div className="kpi-value">
                        <span className="value">{agent.count}</span>
                        <span className="label">fiches validées</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">Aucun agent trouvé pour cette période</div>
              )}
            </div>
          </div>

          {/* Section Performance - Top 3 Équipes */}
          <div className="kpi-section">
            <h2 className="section-title">Top 3 Équipes</h2>
            <div className="kpi-cards top-teams">
              {currentData.top3_teams && currentData.top3_teams.length > 0 ? (
                currentData.top3_teams.map((team, index) => (
                  <div key={team.superviseur.id} className="kpi-card team-card">
                    <div className="kpi-card-header">
                      <span className="medal">{medals[index]}</span>
                      <h3>#{index + 1}</h3>
                    </div>
                    <div className="kpi-card-body">
                      <div className="team-info">
                        <div className="superviseur-name">
                          {team.superviseur.nom && team.superviseur.prenom
                            ? `${team.superviseur.nom} ${team.superviseur.prenom}`
                            : team.superviseur.pseudo || 'N/A'}
                        </div>
                        <div className="superviseur-pseudo">{team.superviseur.pseudo}</div>
                        <div className="team-stats">
                          <span className="stat-item">
                            <strong>{team.nb_agents}</strong> agent{team.nb_agents > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="kpi-value">
                        <span className="value">{team.count}</span>
                        <span className="label">fiches validées</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">Aucune équipe trouvée pour cette période</div>
              )}
            </div>
          </div>

          {/* Informations sur la période */}
          <div className="period-info">
            <p>
              Période: <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Contenu pour l'onglet Porte ouverte */}
      {activeTab === 'porte-ouverte' && currentData && (
        <div className="kpis-content">
          <div className="kpi-section">
            <h2 className="section-title">Statistiques Porte ouverte</h2>
            <div className="kpi-cards metrics">
              <div className="kpi-card conversion-rate">
                <div className="kpi-card-header">
                  <FaDoorOpen className="kpi-icon" />
                  <h3>Enregistrements</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="kpi-value-large">
                    <span className="value">{currentData.total_lignes ?? 0}</span>
                    <span className="label">lignes porte ouverte sur la période</span>
                  </div>
                  <div className="conversion-details">
                    <span className="detail-item">
                      <span className="detail-value">{currentData.total_fiches_distinct ?? 0}</span>
                      <span className="detail-label">fiches distinctes</span>
                    </span>
                  </div>
                  {currentData.evolution && (
                    <div className="evolution-indicator" style={{ marginTop: '12px' }}>
                      {getTrendIcon(currentData.evolution.trend)}
                      <span
                        className="evolution-value"
                        style={{ color: getTrendColor(currentData.evolution.trend) }}
                      >
                        {currentData.evolution.change > 0 ? '+' : ''}
                        {Number(currentData.evolution.change).toFixed(1)}%
                      </span>
                      <span className="evolution-label">vs période précédente (lignes)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="kpi-section">
            <h2 className="section-title">Répartition par état</h2>
            <div className="kpi-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="stats-table kpis-table" style={{ width: '100%', maxWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>État</th>
                    <th style={{ textAlign: 'right' }}>Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {(currentData.par_etat || []).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="no-data">
                        Aucun enregistrement pour cette période
                      </td>
                    </tr>
                  ) : (
                    (currentData.par_etat || []).map((row) => (
                      <tr key={`${row.id_etat}-${row.etat_titre}`}>
                        <td>{row.etat_titre || `État #${row.id_etat}`}</td>
                        <td style={{ textAlign: 'right' }}>{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="kpi-section">
            <h2 className="section-title">Détails des fiches porte ouverte</h2>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <div className="month-selector">
                <label htmlFor="porte-ouverte-etat-details-select">État :</label>
                <select
                  id="porte-ouverte-etat-details-select"
                  value={selectedPorteOuverteEtat}
                  onChange={(e) => setSelectedPorteOuverteEtat(e.target.value)}
                  className="month-select"
                >
                  <option value="">Tous les états</option>
                  {(currentData.par_etat || []).map((etat) => (
                    <option key={`po-etat-${etat.id_etat}`} value={etat.id_etat}>
                      {etat.etat_titre || `État #${etat.id_etat}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="kpi-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="stats-table kpis-table" style={{ width: '100%', minWidth: '1200px' }}>
                <thead>
                  <tr>
                    <th>ID Fiche</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>Code postal</th>
                    <th>Ville</th>
                    <th>Centre</th>
                    <th>État</th>
                    <th>Commercial</th>
                    <th>Approbateur</th>
                    <th>Date de visite</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPorteOuverteDetails.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="no-data">
                        Aucun détail de fiche pour cette période
                      </td>
                    </tr>
                  ) : (
                    filteredPorteOuverteDetails.map((row) => (
                      <tr key={`${row.id}-${row.id_fiche}`}>
                        <td>{row.id_fiche}</td>
                        <td>{row.nom || '-'}</td>
                        <td>{row.prenom || '-'}</td>
                        <td>{row.tel || '-'}</td>
                        <td>{row.cp || '-'}</td>
                        <td>{row.ville || '-'}</td>
                        <td>{row.centre_titre || '-'}</td>
                        <td>{row.etat_titre || `État #${row.id_etat_final}`}</td>
                        <td>{row.commercial_pseudo || '-'}</td>
                        <td>{row.approbateur_pseudo || '-'}</td>
                        <td>{row.date_visite || row.date_approbation || row.date_creation || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="period-info">
            <p>
              Période : <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
            </p>
          </div>
        </div>
      )}

      {activeTab === 'confirmation' && renderConfirmationKpiContent(currentData)}
      {activeTab === 'confirmation-jws' && renderConfirmationKpiContent(currentData)}

    </div>
  );
};

export default KPIs;

