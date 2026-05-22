import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  FaChartLine, FaChartBar, FaChartPie, FaCalendarDay, FaCalendarWeek,
  FaCalendarAlt, FaArrowUp, FaArrowDown, FaMinus, FaPercentage, FaDownload,
  FaFilter, FaTimes, FaUsers, FaBuilding, FaMapMarkerAlt, FaUserTie,
  FaClock, FaExclamationTriangle, FaCheckCircle, FaFileExcel, FaFilePdf,
  FaExpand, FaCompress, FaEye, FaEyeSlash, FaBell, FaInfoCircle, FaWindowClose
} from 'react-icons/fa';
import { toLocalDateString, getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './StatistiquesV2.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const COLORS = ['#9cbfc8', '#4a7a87', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c'];

const StatistiquesV2 = () => {
  useForceDesktopViewport('statistiques-v2-page');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('qualification');
  const [selectedPeriod, setSelectedPeriod] = useState('mois');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  
  // Filtres avancés
  const [filters, setFilters] = useState({
    id_agent: '',
    id_equipe: '',
    id_rp: '',
    id_centre: '',
    id_departement: '',
    id_confirmateur: ''
  });

  // États pour les graphiques
  const [visibleCharts, setVisibleCharts] = useState({
    line: true,
    bar: true,
    pie: true,
    area: true,
    radar: false
  });

  // État pour le drill-down (modal de détails)
  const [drillDownData, setDrillDownData] = useState(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  // État pour les alertes de performance
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(true);

  // Générer les dates selon la période
  const getPeriodDates = () => {
    if (useCustomDates && customDateStart && customDateEnd) {
      return { start: customDateStart, end: customDateEnd };
    }

    const todayStr = getTodayLocal();

    switch (selectedPeriod) {
      case 'jour':
        return { start: todayStr, end: todayStr };
      case 'semaine': {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(today.getFullYear(), today.getMonth(), diff);
        return { start: toLocalDateString(monday), end: todayStr };
      }
      case 'mois':
        return { start: getFirstOfMonthLocal(), end: todayStr };
      default:
        return { start: todayStr, end: todayStr };
    }
  };

  const periodDates = getPeriodDates();

  // Récupérer les données de référence pour les filtres
  const { data: agentsData } = useQuery('agents-v2', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 3) || [];
  });

  const { data: superviseursData } = useQuery('superviseurs-qualif-v2', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 2) || [];
  });

  const { data: rpsQualifData } = useQuery('rps-qualif-v2', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 12) || [];
  });

  const { data: confirmateursData } = useQuery('confirmateurs-v2', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const { data: centresData } = useQuery('centres-v2', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  // Récupérer les métriques avancées Qualification
  const { data: qualifAdvanced, isLoading: loadingQualif } = useQuery(
    ['qualif-advanced-v2', periodDates, filters],
    async () => {
      const params = {
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        ...filters
      };
      const res = await api.get('/statistiques-v2/qualification-advanced', { params });
      return res.data.data;
    },
    { enabled: activeTab === 'qualification' }
  );

  // Récupérer les métriques avancées Confirmation
  const { data: confAdvanced, isLoading: loadingConf } = useQuery(
    ['conf-advanced-v2', periodDates, filters],
    async () => {
      const params = {
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        ...filters
      };
      const res = await api.get('/statistiques-v2/confirmation-advanced', { params });
      return res.data.data;
    },
    { enabled: activeTab === 'confirmation' }
  );

  // Récupérer les métriques avancées Centres
  const { data: centresAdvanced, isLoading: loadingCentres } = useQuery(
    ['centres-advanced-v2', periodDates, filters],
    async () => {
      const params = {
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        ...filters
      };
      const res = await api.get('/statistiques-v2/centres-advanced', { params });
      return res.data.data;
    },
    { enabled: activeTab === 'centres' }
  );

  // Récupérer les données de comparaison
  const [comparisonPeriod, setComparisonPeriod] = useState({
    period1: { start: '', end: '' },
    period2: { start: '', end: '' }
  });
  const { data: comparisonData, isLoading: loadingComparison } = useQuery(
    ['comparison-v2', comparisonPeriod],
    async () => {
      if (!comparisonPeriod.period1.start || !comparisonPeriod.period2.start) return null;
      const params = {
        period1_start: comparisonPeriod.period1.start,
        period1_end: comparisonPeriod.period1.end,
        period2_start: comparisonPeriod.period2.start,
        period2_end: comparisonPeriod.period2.end
      };
      const res = await api.get('/statistiques-v2/comparison', { params });
      return res.data.data;
    },
    { enabled: activeTab === 'comparison' && !!comparisonPeriod.period1.start && !!comparisonPeriod.period2.start }
  );

  // Alertes de performance (hors onglet Qualification)
  useEffect(() => {
    if (activeTab === 'qualification') {
      setAlerts([]);
      return;
    }
    const fetchAlerts = async () => {
      try {
        const params = {
          date_debut: periodDates.start,
          date_fin: periodDates.end
        };
        const res = await api.get('/statistiques-v2/alerts', { params });
        if (res.data.success && res.data.data) {
          setAlerts(res.data.data);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des alertes:', error);
      }
    };
    fetchAlerts();
  }, [periodDates, activeTab]);

  // Fonction pour gérer le clic sur un graphique (drill-down)
  const handleChartClick = async (data, type) => {
    setDrillDownLoading(true);
    setShowDrillDown(true);
    
    try {
      let params = {
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        ...filters
      };

      // Ajouter les paramètres spécifiques selon le type de clic
      if (type === 'agent' && data.id) {
        params.id_agent = data.id;
        params.drill_type = 'agent';
      } else if (type === 'date' && data.date) {
        params.date = data.date;
        params.drill_type = 'date';
      } else if (type === 'centre' && data.centre_id) {
        params.id_centre = data.centre_id;
        params.drill_type = 'centre';
      }

      const res = await api.get('/statistiques-v2/drill-down', { params });
      if (res.data.success) {
        setDrillDownData({
          ...res.data.data,
          clickedData: data,
          type: type
        });
      }
    } catch (error) {
      console.error('Erreur lors du drill-down:', error);
      alert('Erreur lors du chargement des détails');
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Fonction d'export
  const handleExport = async (format) => {
    try {
      const params = {
        type: activeTab,
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        format: format,
        metric_type: activeTab
      };
      const res = await api.get('/statistiques-v2/export', { params });
      
      if (format === 'csv') {
        exportToCSV(res.data.data);
      } else if (format === 'excel') {
        exportToExcel(res.data.data);
      }
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export');
    }
  };

  const exportToCSV = (data) => {
    // Implémentation de l'export CSV
    let csv = '';
    if (data.data.qualification) {
      csv += 'Agent,Total Fiches,Fiches Validées,Temps Moyen (heures)\n';
      data.data.qualification.forEach(row => {
        csv += `${row.agent},${row.total_fiches},${row.fiches_validees},${row.temps_moyen_heures}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistiques-${activeTab}-${periodDates.start}-${periodDates.end}.csv`;
    a.click();
  };

  const exportToExcel = (data) => {
    // Pour Excel, on peut utiliser une bibliothèque comme xlsx
    // Pour l'instant, on exporte en CSV
    exportToCSV(data);
  };

  // Formater les données pour les graphiques
  const formatDailyEvolution = (data) => {
    if (!data || !data.daily_evolution) return [];
    return data.daily_evolution.map(item => ({
      date: new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      total: item.total_fiches || 0,
      validated: item.validated_fiches || 0,
      ko: item.ko_fiches || 0
    }));
  };

  const formatRatioLabel = (row, idKey, pseudoKey, nomKey, prenomKey) => {
    if (!row) return '';
    if (row[pseudoKey]) return row[pseudoKey];
    const nom = [row[nomKey], row[prenomKey]].filter(Boolean).join(' ').trim();
    return nom || `#${row[idKey]}`;
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${parseFloat(value).toFixed(1)}%`;
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <FaArrowUp className="trend-icon up" />;
    if (value < 0) return <FaArrowDown className="trend-icon down" />;
    return <FaMinus className="trend-icon stable" />;
  };

  const isLoading = activeTab === 'qualification' ? loadingQualif :
                   activeTab === 'confirmation' ? loadingConf :
                   activeTab === 'centres' ? loadingCentres : false;

  return (
    <div className="statistiques-v2-page">
      <div className="stats-v2-header">
        <h1><FaChartLine /> Statistiques V2</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={() => handleExport('csv')}>
            <FaFileExcel /> Export CSV
          </button>
          <button className="btn-export" onClick={() => handleExport('excel')}>
            <FaFilePdf /> Export PDF
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="tabs-container-v2">
        <button
          className={`tab-btn-v2 ${activeTab === 'qualification' ? 'active' : ''}`}
          onClick={() => setActiveTab('qualification')}
        >
          Qualification
        </button>
        <button
          className={`tab-btn-v2 ${activeTab === 'confirmation' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirmation')}
        >
          Confirmation
        </button>
        <button
          className={`tab-btn-v2 ${activeTab === 'centres' ? 'active' : ''}`}
          onClick={() => setActiveTab('centres')}
        >
          Centres
        </button>
        <button
          className={`tab-btn-v2 ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          Comparaison
        </button>
      </div>

      {/* Filtres et périodes */}
      <div className="filters-section">
        <div className="period-selector-v2">
          <button
            className={`period-btn-v2 ${selectedPeriod === 'jour' ? 'active' : ''}`}
            onClick={() => { setSelectedPeriod('jour'); setUseCustomDates(false); }}
          >
            <FaCalendarDay /> Aujourd'hui
          </button>
          <button
            className={`period-btn-v2 ${selectedPeriod === 'semaine' ? 'active' : ''}`}
            onClick={() => { setSelectedPeriod('semaine'); setUseCustomDates(false); }}
          >
            <FaCalendarWeek /> Cette semaine
          </button>
          <button
            className={`period-btn-v2 ${selectedPeriod === 'mois' ? 'active' : ''}`}
            onClick={() => { setSelectedPeriod('mois'); setUseCustomDates(false); }}
          >
            <FaCalendarAlt /> Ce mois
          </button>
          <button
            className={`period-btn-v2 ${useCustomDates ? 'active' : ''}`}
            onClick={() => setUseCustomDates(true)}
          >
            <FaCalendarAlt /> Personnalisé
          </button>
        </div>

        {useCustomDates && (
          <div className="custom-dates">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => setCustomDateStart(e.target.value)}
              className="date-input"
            />
            <span>au</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => setCustomDateEnd(e.target.value)}
              className="date-input"
            />
          </div>
        )}

        {/* Filtres avancés */}
        <div className="advanced-filters">
          <FaFilter /> Filtres avancés
          <div className="filters-grid">
            <select
              value={filters.id_agent}
              onChange={(e) => setFilters({ ...filters, id_agent: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les agents</option>
              {agentsData?.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
              ))}
            </select>

            {activeTab === 'qualification' && (
              <>
                <select
                  value={filters.id_rp}
                  onChange={(e) => setFilters({ ...filters, id_rp: e.target.value, id_equipe: '' })}
                  className="filter-select"
                >
                  <option value="">Tous les RP qualification</option>
                  {rpsQualifData?.map((rp) => (
                    <option key={rp.id} value={rp.id}>{rp.pseudo || `RP #${rp.id}`}</option>
                  ))}
                </select>
                <select
                  value={filters.id_equipe}
                  onChange={(e) => setFilters({ ...filters, id_equipe: e.target.value })}
                  className="filter-select"
                >
                  <option value="">Tous les RE</option>
                  {superviseursData?.map((re) => (
                    <option key={re.id} value={re.id}>{re.pseudo || `RE #${re.id}`}</option>
                  ))}
                </select>
              </>
            )}

            {activeTab !== 'qualification' && (
              <select
                value={filters.id_confirmateur}
                onChange={(e) => setFilters({ ...filters, id_confirmateur: e.target.value })}
                className="filter-select"
              >
                <option value="">Tous les confirmateurs</option>
                {confirmateursData?.map(conf => (
                  <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                ))}
              </select>
            )}

            <select
              value={filters.id_centre}
              onChange={(e) => setFilters({ ...filters, id_centre: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les centres</option>
              {centresData?.map(centre => (
                <option key={centre.id} value={centre.id}>{centre.titre}</option>
              ))}
            </select>

            <button
              className="btn-clear-filters"
              onClick={() => setFilters({
                id_agent: '',
                id_equipe: '',
                id_rp: '',
                id_centre: '',
                id_departement: '',
                id_confirmateur: ''
              })}
            >
              <FaTimes /> Effacer les filtres
            </button>
          </div>
        </div>
      </div>

      {/* Alertes de performance (pas sur l'onglet Qualification) */}
      {activeTab !== 'qualification' && showAlerts && alerts.length > 0 && (
        <div className="alerts-container">
          <div className="alerts-header">
            <FaBell className="alerts-icon" />
            <h3>Alertes de Performance</h3>
            <button className="btn-close-alerts" onClick={() => setShowAlerts(false)}>
              <FaWindowClose />
            </button>
          </div>
          <div className="alerts-list">
            {alerts.map((alert, index) => (
              <div key={index} className={`alert-item alert-${alert.severity || 'info'}`}>
                <FaExclamationTriangle className="alert-icon" />
                <div className="alert-content">
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-message">{alert.message}</div>
                  {alert.metric && (
                    <div className="alert-metric">
                      <span className="metric-label">{alert.metric.label}:</span>
                      <span className="metric-value">{alert.metric.value}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenu selon l'onglet actif */}
      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des statistiques...</p>
        </div>
      )}

      {!isLoading && activeTab === 'qualification' && qualifAdvanced && (
        <div className="stats-content">
          {/* Ratio par RE */}
          {qualifAdvanced.ratio_by_re?.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Ratio par équipe (RE qualification)</h2>
              <p className="section-subtitle">
                Fiches validées / fiches produites par les agents qualification de chaque RE (KO inclus dans les produites).
              </p>
              <ResponsiveContainer width="100%" height={Math.max(300, qualifAdvanced.ratio_by_re.length * 36)}>
                <BarChart data={qualifAdvanced.ratio_by_re} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="re_pseudo"
                    tickFormatter={(_, idx) =>
                      formatRatioLabel(
                        qualifAdvanced.ratio_by_re[idx],
                        're_id',
                        're_pseudo',
                        're_nom',
                        're_prenom'
                      )
                    }
                    width={75}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'ratio_pct') return [`${value}%`, 'Ratio'];
                      return [value, name];
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload
                        ? formatRatioLabel(
                            payload[0].payload,
                            're_id',
                            're_pseudo',
                            're_nom',
                            're_prenom'
                          )
                        : ''
                    }
                  />
                  <Legend />
                  <Bar dataKey="ratio_pct" fill="#4a7a87" name="Ratio (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ratio par RP */}
          {qualifAdvanced.ratio_by_rp?.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Ratio par plateau (RP qualification)</h2>
              <p className="section-subtitle">
                Agrégation par RP qualification (agents rattachés aux RE du plateau).
              </p>
              <ResponsiveContainer width="100%" height={Math.max(280, qualifAdvanced.ratio_by_rp.length * 40)}>
                <BarChart data={qualifAdvanced.ratio_by_rp} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="rp_pseudo"
                    tickFormatter={(_, idx) =>
                      formatRatioLabel(
                        qualifAdvanced.ratio_by_rp[idx],
                        'rp_id',
                        'rp_pseudo',
                        'rp_nom',
                        'rp_prenom'
                      )
                    }
                    width={75}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'ratio_pct') return [`${value}%`, 'Ratio'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ratio_pct" fill="#9cbfc8" name="Ratio (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top 10 Agents */}
          <div className="section-card">
            <h2 className="section-title">Top 10 Agents</h2>
            <div className="top-agents-grid">
              {qualifAdvanced.top10_agents?.map((agent, index) => (
                <div key={agent.id} className="agent-card-v2">
                  <div className="agent-rank">#{index + 1}</div>
                  <div className="agent-info">
                    {agent.photo ? (
                      <img src={agent.photo} alt={agent.pseudo} className="agent-avatar" />
                    ) : (
                      <div className="agent-avatar placeholder">
                        {agent.pseudo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="agent-details">
                      <div className="agent-name">
                        {agent.nom && agent.prenom ? `${agent.nom} ${agent.prenom}` : agent.pseudo}
                      </div>
                      <div className="agent-stats">
                        <span>{agent.count_validated} fiches validées</span>
                        {(agent.count_ko > 0) && (
                          <span className="avg-time">{agent.count_ko} KO</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Taux de rejet par agent */}
          {qualifAdvanced.rejection_rates && qualifAdvanced.rejection_rates.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Taux de Rejet par Agent</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={qualifAdvanced.rejection_rates}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      handleChartClick(data.activePayload[0].payload, 'agent');
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pseudo" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rejection_rate" fill="#dc3545" name="Taux de rejet / KO (%)" cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Évolution quotidienne */}
          {qualifAdvanced.daily_evolution && qualifAdvanced.daily_evolution.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Évolution Quotidienne</h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart 
                  data={formatDailyEvolution(qualifAdvanced)}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const clickedData = data.activePayload[0].payload;
                      handleChartClick({ date: clickedData.date }, 'date');
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stackId="1" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    name="Total fiches"
                    cursor="pointer"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="validated" 
                    stackId="2" 
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                    name="Fiches validées"
                    cursor="pointer"
                  />
                  <Area
                    type="monotone"
                    dataKey="ko"
                    stackId="3"
                    stroke="#dc3545"
                    fill="#dc3545"
                    name="Fiches KO"
                    cursor="pointer"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!isLoading && activeTab === 'confirmation' && confAdvanced && (
        <div className="stats-content">
          {/* Métriques principales */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <FaCheckCircle className="metric-icon" />
                <h3>Taux de Conversion en Fiche Confirmée</h3>
              </div>
              <div className="metric-value">
                {formatPercentage(confAdvanced.confirmation_rate)}
              </div>
              <div className="metric-description">
                {confAdvanced.confirmed_count} confirmées sur {confAdvanced.total_count} total
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <FaCheckCircle className="metric-icon" />
                <h3>Nombre de Signatures</h3>
              </div>
              <div className="metric-value">
                {confAdvanced.signatures_count || 0}
              </div>
              <div className="metric-description">
                Fiches signées sur la période
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <FaClock className="metric-icon" />
                <h3>Délai Confirmation → Signature</h3>
              </div>
              <div className="metric-value">
                {confAdvanced.avg_confirmation_to_signature_days?.toFixed(1) || 0} jours
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <FaExclamationTriangle className="metric-icon" />
                <h3>Taux de Rétractation</h3>
              </div>
              <div className="metric-value">
                {formatPercentage(confAdvanced.retraction_rate)}
              </div>
              <div className="metric-description">
                {confAdvanced.retracted_count} rétractées sur {confAdvanced.total_count} total
              </div>
            </div>
          </div>

          {/* Top 10 Confirmateurs */}
          <div className="section-card">
            <h2 className="section-title">Top 10 Confirmateurs</h2>
            <div className="top-confirmateurs-grid">
              {confAdvanced.top10_confirmateurs?.map((conf, index) => (
                <div key={conf.id} className="confirmateur-card-v2">
                  <div className="confirmateur-rank">#{index + 1}</div>
                  <div className="confirmateur-info">
                    {conf.photo ? (
                      <img src={conf.photo} alt={conf.pseudo} className="agent-avatar" />
                    ) : (
                      <div className="agent-avatar placeholder">
                        {conf.pseudo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="confirmateur-details">
                      <div className="confirmateur-name">
                        {conf.nom && conf.prenom ? `${conf.nom} ${conf.prenom}` : conf.pseudo}
                      </div>
                      <div className="confirmateur-stats">
                        <span>{conf.confirmations_count} confirmations</span>
                        <span>{conf.signatures_count} signatures</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Évolution quotidienne confirmations/signatures */}
          {confAdvanced.daily_evolution && confAdvanced.daily_evolution.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Évolution Quotidienne</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={confAdvanced.daily_evolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="confirmations" stroke="#8884d8" strokeWidth={2} name="Confirmations" />
                  <Line type="monotone" dataKey="signatures" stroke="#82ca9d" strokeWidth={2} name="Signatures" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!isLoading && activeTab === 'centres' && centresAdvanced && (
        <div className="stats-content">
          <div className="centres-grid-v2">
            {centresAdvanced.centres?.map(centre => (
              <div key={centre.centre_id} className="centre-card-v2">
                <div className="centre-header-v2">
                  <h3>{centre.centre_titre}</h3>
                </div>
                <div className="centre-metrics-v2">
                  <div className="metric-item-v2">
                    <span className="metric-label">Total Fiches</span>
                    <span className="metric-value">{centre.total_count || 0}</span>
                  </div>
                  <div className="metric-item-v2">
                    <span className="metric-label">Fiches Signées</span>
                    <span className="metric-value">{centre.signed_count || 0}</span>
                  </div>
                  <div className="metric-item-v2">
                    <span className="metric-label">Taux de Croissance</span>
                    <span className={`metric-value ${centre.growth_rate >= 0 ? 'positive' : 'negative'}`}>
                      {getTrendIcon(centre.growth_rate)}
                      {formatPercentage(Math.abs(centre.growth_rate))}
                    </span>
                  </div>
                  <div className="metric-item-v2">
                    <span className="metric-label">Productivité</span>
                    <span className="metric-value">{centre.productivity_per_day?.toFixed(1) || 0} fiches/jour</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && activeTab === 'comparison' && (
        <div className="stats-content">
          <div className="section-card">
            <h2 className="section-title">Comparaison de Périodes</h2>
            <div className="comparison-periods">
              <div className="period-selector-comparison">
                <div className="period-group">
                  <h3>Période 1</h3>
                  <input
                    type="date"
                    value={comparisonPeriod.period1.start}
                    onChange={(e) => setComparisonPeriod({
                      ...comparisonPeriod,
                      period1: { ...comparisonPeriod.period1, start: e.target.value }
                    })}
                    className="date-input"
                  />
                  <span>au</span>
                  <input
                    type="date"
                    value={comparisonPeriod.period1.end}
                    onChange={(e) => setComparisonPeriod({
                      ...comparisonPeriod,
                      period1: { ...comparisonPeriod.period1, end: e.target.value }
                    })}
                    className="date-input"
                  />
                </div>
                <div className="period-group">
                  <h3>Période 2</h3>
                  <input
                    type="date"
                    value={comparisonPeriod.period2.start}
                    onChange={(e) => setComparisonPeriod({
                      ...comparisonPeriod,
                      period2: { ...comparisonPeriod.period2, start: e.target.value }
                    })}
                    className="date-input"
                  />
                  <span>au</span>
                  <input
                    type="date"
                    value={comparisonPeriod.period2.end}
                    onChange={(e) => setComparisonPeriod({
                      ...comparisonPeriod,
                      period2: { ...comparisonPeriod.period2, end: e.target.value }
                    })}
                    className="date-input"
                  />
                </div>
              </div>

              {loadingComparison && (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Chargement de la comparaison...</p>
                </div>
              )}

              {!loadingComparison && comparisonData && (
                <div className="comparison-results">
                  <div className="comparison-metrics">
                    {comparisonData.fiches_generes && (
                      <div className="comparison-metric">
                        <h4>Fiches générées</h4>
                        <div className="metric-comparison">
                          <div className="period-value period1">
                            <span className="label">Période 1</span>
                            <span className="value">{comparisonData.fiches_generes.period1?.count ?? 0}</span>
                          </div>
                          <div className="period-value period2">
                            <span className="label">Période 2</span>
                            <span className="value">{comparisonData.fiches_generes.period2?.count ?? 0}</span>
                          </div>
                          <div className="comparison-diff">
                            <span className={`diff ${parseFloat(comparisonData.fiches_generes.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
                              {getTrendIcon(parseFloat(comparisonData.fiches_generes.evolution || 0))}
                              {Math.abs(parseFloat(comparisonData.fiches_generes.evolution || 0)).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comparisonData.fiches_qualifiees && (
                      <div className="comparison-metric">
                        <h4>Fiches qualifiées</h4>
                        <div className="metric-comparison">
                          <div className="period-value period1">
                            <span className="label">Période 1</span>
                            <span className="value">{comparisonData.fiches_qualifiees.period1?.count ?? 0}</span>
                            <span className="sub">({comparisonData.fiches_qualifiees.period1?.rate ?? 0}%)</span>
                          </div>
                          <div className="period-value period2">
                            <span className="label">Période 2</span>
                            <span className="value">{comparisonData.fiches_qualifiees.period2?.count ?? 0}</span>
                            <span className="sub">({comparisonData.fiches_qualifiees.period2?.rate ?? 0}%)</span>
                          </div>
                          <div className="comparison-diff">
                            <span className={`diff ${parseFloat(comparisonData.fiches_qualifiees.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
                              {getTrendIcon(parseFloat(comparisonData.fiches_qualifiees.evolution || 0))}
                              {Math.abs(parseFloat(comparisonData.fiches_qualifiees.evolution || 0)).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comparisonData.fiches_confirmees && (
                      <div className="comparison-metric">
                        <h4>Fiches confirmées</h4>
                        <div className="metric-comparison">
                          <div className="period-value period1">
                            <span className="label">Période 1</span>
                            <span className="value">{comparisonData.fiches_confirmees.period1?.count ?? 0}</span>
                            <span className="sub">({comparisonData.fiches_confirmees.period1?.rate ?? 0}%)</span>
                          </div>
                          <div className="period-value period2">
                            <span className="label">Période 2</span>
                            <span className="value">{comparisonData.fiches_confirmees.period2?.count ?? 0}</span>
                            <span className="sub">({comparisonData.fiches_confirmees.period2?.rate ?? 0}%)</span>
                          </div>
                          <div className="comparison-diff">
                            <span className={`diff ${parseFloat(comparisonData.fiches_confirmees.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
                              {getTrendIcon(parseFloat(comparisonData.fiches_confirmees.evolution || 0))}
                              {Math.abs(parseFloat(comparisonData.fiches_confirmees.evolution || 0)).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comparisonData.signatures && (
                      <div className="comparison-metric">
                        <h4>Nombre de signatures</h4>
                        <div className="metric-comparison">
                          <div className="period-value period1">
                            <span className="label">Période 1</span>
                            <span className="value">{comparisonData.signatures.period1?.count ?? 0}</span>
                            <span className="sub">({comparisonData.signatures.period1?.rate ?? 0}%)</span>
                          </div>
                          <div className="period-value period2">
                            <span className="label">Période 2</span>
                            <span className="value">{comparisonData.signatures.period2?.count ?? 0}</span>
                            <span className="sub">({comparisonData.signatures.period2?.rate ?? 0}%)</span>
                          </div>
                          <div className="comparison-diff">
                            <span className={`diff ${parseFloat(comparisonData.signatures.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
                              {getTrendIcon(parseFloat(comparisonData.signatures.evolution || 0))}
                              {Math.abs(parseFloat(comparisonData.signatures.evolution || 0)).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comparisonData.retractees && (
                      <div className="comparison-metric">
                        <h4>Rétractées</h4>
                        <div className="metric-comparison">
                          <div className="period-value period1">
                            <span className="label">Période 1</span>
                            <span className="value">{comparisonData.retractees.period1?.count ?? 0}</span>
                            <span className="sub">({comparisonData.retractees.period1?.rate ?? 0}%)</span>
                          </div>
                          <div className="period-value period2">
                            <span className="label">Période 2</span>
                            <span className="value">{comparisonData.retractees.period2?.count ?? 0}</span>
                            <span className="sub">({comparisonData.retractees.period2?.rate ?? 0}%)</span>
                          </div>
                          <div className="comparison-diff">
                            <span className={`diff ${parseFloat(comparisonData.retractees.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
                              {getTrendIcon(parseFloat(comparisonData.retractees.evolution || 0))}
                              {Math.abs(parseFloat(comparisonData.retractees.evolution || 0)).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatistiquesV2;

