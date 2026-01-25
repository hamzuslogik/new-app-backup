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
  FaExpand, FaCompress, FaEye, FaEyeSlash
} from 'react-icons/fa';
import './StatistiquesV2.css';

const COLORS = ['#9cbfc8', '#4a7a87', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c'];

const StatistiquesV2 = () => {
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

  // Générer les dates selon la période
  const getPeriodDates = () => {
    if (useCustomDates && customDateStart && customDateEnd) {
      return { start: customDateStart, end: customDateEnd };
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (selectedPeriod) {
      case 'jour':
        return { start: todayStr, end: todayStr };
      case 'semaine':
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(today.getFullYear(), today.getMonth(), diff);
        return { start: monday.toISOString().split('T')[0], end: todayStr };
      case 'mois':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart.toISOString().split('T')[0], end: todayStr };
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

  // Récupérer la performance temporelle
  const { data: temporalData, isLoading: loadingTemporal } = useQuery(
    ['temporal-v2', activeTab],
    async () => {
      const res = await api.get('/statistiques-v2/temporal-performance', {
        params: { months: 6, metric_type: activeTab }
      });
      return res.data.data;
    },
    { enabled: activeTab === 'temporal' }
  );

  // Récupérer la heatmap
  const { data: heatmapData, isLoading: loadingHeatmap } = useQuery(
    ['heatmap-v2', periodDates, activeTab],
    async () => {
      const params = {
        date_debut: periodDates.start,
        date_fin: periodDates.end,
        metric_type: activeTab === 'qualification' ? 'creation' : 
                     activeTab === 'confirmation' ? 'confirmation' : 'signature'
      };
      const res = await api.get('/statistiques-v2/heatmap', { params });
      return res.data.data;
    },
    { enabled: activeTab === 'heatmap' }
  );

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
      validated: item.validated_fiches || 0
    }));
  };

  const formatHeatmapData = (data) => {
    if (!data || !data.heatmap) return [];
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const result = [];
    
    for (let day = 0; day < 7; day++) {
      const dayData = { day: days[day] };
      for (let hour = 0; hour < 24; hour++) {
        const item = data.heatmap.find(d => d.dayOfWeek === day + 1 && d.hour === hour);
        dayData[`h${hour}`] = item?.count || 0;
      }
      result.push(dayData);
    }
    return result;
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
                   activeTab === 'centres' ? loadingCentres :
                   activeTab === 'temporal' ? loadingTemporal :
                   loadingHeatmap;

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
          className={`tab-btn-v2 ${activeTab === 'temporal' ? 'active' : ''}`}
          onClick={() => setActiveTab('temporal')}
        >
          Performance Temporelle
        </button>
        <button
          className={`tab-btn-v2 ${activeTab === 'heatmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('heatmap')}
        >
          Heatmap
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

      {/* Contenu selon l'onglet actif */}
      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des statistiques...</p>
        </div>
      )}

      {!isLoading && activeTab === 'qualification' && qualifAdvanced && (
        <div className="stats-content">
          {/* Métriques principales */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <FaClock className="metric-icon" />
                <h3>Temps Moyen de Traitement</h3>
              </div>
              <div className="metric-value">
                {qualifAdvanced.avg_processing_time_hours?.toFixed(1) || 0} heures
              </div>
              <div className="metric-description">De la création à la validation</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <FaUsers className="metric-icon" />
                <h3>Fiches par Agent/Jour</h3>
              </div>
              <div className="metric-value">
                {qualifAdvanced.avg_fiches_per_agent_per_day?.toFixed(1) || 0}
              </div>
              <div className="metric-description">Moyenne sur la période</div>
            </div>
          </div>

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
                        {agent.avg_processing_hours && (
                          <span className="avg-time">
                            {parseFloat(agent.avg_processing_hours).toFixed(1)}h en moyenne
                          </span>
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
                <BarChart data={qualifAdvanced.rejection_rates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pseudo" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rejection_rate" fill="#dc3545" name="Taux de rejet (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Évolution quotidienne */}
          {qualifAdvanced.daily_evolution && qualifAdvanced.daily_evolution.length > 0 && (
            <div className="section-card">
              <h2 className="section-title">Évolution Quotidienne</h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={formatDailyEvolution(qualifAdvanced)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="total" stackId="1" stroke="#8884d8" fill="#8884d8" name="Total fiches" />
                  <Area type="monotone" dataKey="validated" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Fiches validées" />
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

      {!isLoading && activeTab === 'temporal' && temporalData && (
        <div className="stats-content">
          <div className="section-card">
            <h2 className="section-title">Performance sur 6 Mois</h2>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={temporalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                {temporalData[0]?.qualification && (
                  <Line type="monotone" dataKey="qualification.rate" stroke="#8884d8" strokeWidth={2} name="Taux Qualification (%)" />
                )}
                {temporalData[0]?.confirmation && (
                  <Line type="monotone" dataKey="confirmation.rate" stroke="#82ca9d" strokeWidth={2} name="Taux Confirmation (%)" />
                )}
                {temporalData[0]?.signatures && (
                  <Line type="monotone" dataKey="signatures.rate" stroke="#ffc107" strokeWidth={2} name="Taux Signatures (%)" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isLoading && activeTab === 'heatmap' && heatmapData && (
        <div className="stats-content">
          <div className="section-card">
            <h2 className="section-title">Heatmap d'Activité</h2>
            <div className="heatmap-container">
              {/* La heatmap sera implémentée avec un composant dédié */}
              <p>Heatmap en cours de développement</p>
            </div>
          </div>
        </div>
      )}

      {!isLoading && activeTab === 'comparison' && (
        <div className="stats-content">
          <div className="section-card">
            <h2 className="section-title">Comparaison de Périodes</h2>
            <p>Fonctionnalité de comparaison en cours de développement</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatistiquesV2;

