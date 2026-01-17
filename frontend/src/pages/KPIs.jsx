import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { 
  FaTrophy, 
  FaUsers, 
  FaChartLine, 
  FaCalendarDay, 
  FaCalendarWeek, 
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaPercentage
} from 'react-icons/fa';
import './KPIs.css';

const KPIs = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('qualification'); // qualification, confirmation, centres
  const [selectedPeriod, setSelectedPeriod] = useState('jour'); // jour, semaine, mois
  const [selectedMonth, setSelectedMonth] = useState(''); // Format: YYYY-MM

  // Générer la liste des mois (12 derniers mois)
  const getAvailableMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
      months.push({ value: monthStr, label: monthLabel });
    }
    return months;
  };

  // Initialiser le mois en cours si on est sur la période "mois"
  useEffect(() => {
    if (selectedPeriod === 'mois' && !selectedMonth) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${year}-${month}`);
    }
  }, [selectedPeriod, selectedMonth]);

  // Récupérer les KPI Qualification
  const { data: kpiData, isLoading: isLoadingQualif, error: errorQualif } = useQuery(
    ['kpis', selectedPeriod, selectedMonth],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      const res = await api.get('/statistiques/kpis', { params });
      return res.data.data;
    },
    {
      enabled: (selectedPeriod !== 'mois' || !!selectedMonth) && activeTab === 'qualification'
    }
  );

  // Récupérer les KPI Confirmation
  const { data: confirmationData, isLoading: isLoadingConf, error: errorConf } = useQuery(
    ['kpis-confirmation', selectedPeriod, selectedMonth],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      const res = await api.get('/statistiques/kpis-confirmation', { params });
      return res.data.data;
    },
    {
      enabled: (selectedPeriod !== 'mois' || !!selectedMonth) && activeTab === 'confirmation'
    }
  );

  // Récupérer les KPI Par Centre
  const { data: centresData, isLoading: isLoadingCentres, error: errorCentres } = useQuery(
    ['kpis-centres', selectedPeriod, selectedMonth],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      const res = await api.get('/statistiques/kpis-centres', { params });
      return res.data.data;
    },
    {
      enabled: (selectedPeriod !== 'mois' || !!selectedMonth) && activeTab === 'centres'
    }
  );

  const isLoading = activeTab === 'qualification' ? isLoadingQualif : 
                   activeTab === 'confirmation' ? isLoadingConf : isLoadingCentres;
  const error = activeTab === 'qualification' ? errorQualif : 
                activeTab === 'confirmation' ? errorConf : errorCentres;

  const periods = [
    { key: 'jour', label: 'Aujourd\'hui', icon: FaCalendarDay },
    { key: 'semaine', label: 'Cette semaine', icon: FaCalendarWeek },
    { key: 'mois', label: 'Ce mois', icon: FaCalendarAlt }
  ];

  const currentData = activeTab === 'qualification' 
    ? kpiData?.[selectedPeriod] 
    : activeTab === 'confirmation'
    ? confirmationData?.[selectedPeriod]
    : centresData?.[selectedPeriod];

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
            className={`tab-btn ${activeTab === 'centres' ? 'active' : ''}`}
            onClick={() => setActiveTab('centres')}
          >
            Par Centre
          </button>
        </div>
        <div className="header-controls">
          <div className="period-selector">
            {periods.map(period => {
              const Icon = period.icon;
              return (
                <button
                  key={period.key}
                  className={`period-btn ${selectedPeriod === period.key ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPeriod(period.key);
                    if (period.key !== 'mois') {
                      setSelectedMonth('');
                    } else if (!selectedMonth) {
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      setSelectedMonth(`${year}-${month}`);
                    }
                  }}
                >
                  <Icon /> {period.label}
                </button>
              );
            })}
          </div>
          {selectedPeriod === 'mois' && (
            <div className="month-selector">
              <label htmlFor="month-select">Mois :</label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="month-select"
              >
                <option value="">Sélectionner un mois</option>
                {getAvailableMonths().map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'qualification' && currentData && (
        <div className="kpis-content">
          {/* Section Métriques Globales */}
          <div className="kpi-section">
            <h2 className="section-title">Métriques Globales</h2>
            <div className="kpi-cards metrics">
              {/* Taux de Conversion */}
              <div className="kpi-card conversion-rate">
                <div className="kpi-card-header">
                  <FaPercentage className="kpi-icon" />
                  <h3>Taux de Conversion</h3>
                </div>
                <div className="kpi-card-body">
                  <div className="kpi-value-large">
                    <span className="value">{formatPercentage(currentData.conversion_rate)}</span>
                    <span className="label">Fiches validées / Fiches totales</span>
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
            <p className="info-text">
              {activeTab === 'qualification' 
                ? 'Les fiches validées correspondent aux fiches qui sont passées en phase 1, 2 ou 3 (hors groupe 0).'
                : 'Les confirmations correspondent aux fiches avec état CONFIRMER (7). Les signatures correspondent aux fiches avec états SIGNER (13, 16, 44, 45).'}
            </p>
          </div>
        </div>
      )}

      {/* Contenu pour l'onglet Confirmation */}
      {activeTab === 'confirmation' && currentData && (
        <div className="kpis-content">
          {/* Section Métriques Globales Confirmation */}
          <div className="kpi-section">
            <h2 className="section-title">Métriques Globales</h2>
            <div className="kpi-cards metrics">
              {/* Taux de Confirmation */}
              {currentData.confirmation_rate !== undefined && (
                <div className="kpi-card confirmation-rate">
                  <div className="kpi-card-header">
                    <FaPercentage className="kpi-icon" />
                    <h3>Taux de Confirmation</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="kpi-value-large">
                      <span className="value">{formatPercentage(currentData.confirmation_rate)}</span>
                      <span className="label">Fiches confirmées / Fiches totales</span>
                    </div>
                    {currentData.confirmation_rate_change !== undefined && (
                      <div className="evolution-indicator">
                        {getTrendIcon(currentData.confirmation_rate_change > 0 ? 'up' : (currentData.confirmation_rate_change < 0 ? 'down' : 'stable'))}
                        <span 
                          className="evolution-value"
                          style={{ color: getTrendColor(currentData.confirmation_rate_change > 0 ? 'up' : (currentData.confirmation_rate_change < 0 ? 'down' : 'stable')) }}
                        >
                          {currentData.confirmation_rate_change > 0 ? '+' : ''}{formatPercentage(currentData.confirmation_rate_change)}
                        </span>
                        <span className="evolution-label">vs période précédente</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Taux de Signature */}
              {currentData.signature_rate !== undefined && (
                <div className="kpi-card signature-rate">
                  <div className="kpi-card-header">
                    <FaPercentage className="kpi-icon" />
                    <h3>Taux de Signature</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="kpi-value-large">
                      <span className="value">{formatPercentage(currentData.signature_rate)}</span>
                      <span className="label">Fiches signées / Fiches totales</span>
                    </div>
                    {currentData.signature_rate_change !== undefined && (
                      <div className="evolution-indicator">
                        {getTrendIcon(currentData.signature_rate_change > 0 ? 'up' : (currentData.signature_rate_change < 0 ? 'down' : 'stable'))}
                        <span 
                          className="evolution-value"
                          style={{ color: getTrendColor(currentData.signature_rate_change > 0 ? 'up' : (currentData.signature_rate_change < 0 ? 'down' : 'stable')) }}
                        >
                          {currentData.signature_rate_change > 0 ? '+' : ''}{formatPercentage(currentData.signature_rate_change)}
                        </span>
                        <span className="evolution-label">vs période précédente</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Évolution Confirmations */}
              {currentData.confirmation_evolution && (
                <div className="kpi-card evolution">
                  <div className="kpi-card-header">
                    <FaChartLine className="kpi-icon" />
                    <h3>Évolution Confirmations</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="evolution-comparison">
                      <div className="comparison-item">
                        <span className="comparison-label">Période actuelle</span>
                        <span className="comparison-value">{currentData.confirmation_evolution.current}</span>
                      </div>
                      <div className="comparison-item">
                        <span className="comparison-label">Période précédente</span>
                        <span className="comparison-value">{currentData.confirmation_evolution.previous}</span>
                      </div>
                    </div>
                    <div className="evolution-indicator">
                      {getTrendIcon(currentData.confirmation_evolution.trend)}
                      <span 
                        className="evolution-value"
                        style={{ color: getTrendColor(currentData.confirmation_evolution.trend) }}
                      >
                        {currentData.confirmation_evolution.change > 0 ? '+' : ''}{currentData.confirmation_evolution.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Évolution Signatures */}
              {currentData.signature_evolution && (
                <div className="kpi-card evolution">
                  <div className="kpi-card-header">
                    <FaChartLine className="kpi-icon" />
                    <h3>Évolution Signatures</h3>
                  </div>
                  <div className="kpi-card-body">
                    <div className="evolution-comparison">
                      <div className="comparison-item">
                        <span className="comparison-label">Période actuelle</span>
                        <span className="comparison-value">{currentData.signature_evolution.current}</span>
                      </div>
                      <div className="comparison-item">
                        <span className="comparison-label">Période précédente</span>
                        <span className="comparison-value">{currentData.signature_evolution.previous}</span>
                      </div>
                    </div>
                    <div className="evolution-indicator">
                      {getTrendIcon(currentData.signature_evolution.trend)}
                      <span 
                        className="evolution-value"
                        style={{ color: getTrendColor(currentData.signature_evolution.trend) }}
                      >
                        {currentData.signature_evolution.change > 0 ? '+' : ''}{currentData.signature_evolution.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section Top 3 Confirmateurs - Confirmations */}
          <div className="kpi-section">
            <h2 className="section-title">Top 3 Confirmateurs - Confirmations</h2>
            <div className="kpi-cards top-confirmateurs">
              {currentData.top3_confirmations && currentData.top3_confirmations.length > 0 ? (
                currentData.top3_confirmations.map((confirmateur, index) => (
                  <div key={confirmateur.id} className="kpi-card confirmateur-card">
                    <div className="kpi-card-header">
                      <span className="medal">{medals[index]}</span>
                      <h3>#{index + 1}</h3>
                    </div>
                    <div className="kpi-card-body">
                      <div className="agent-info">
                        {confirmateur.photo ? (
                          <img 
                            src={confirmateur.photo} 
                            alt={confirmateur.pseudo}
                            className="agent-avatar"
                          />
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

          {/* Section Top 3 Confirmateurs - Signatures */}
          <div className="kpi-section">
            <h2 className="section-title">Top 3 Confirmateurs - Signatures</h2>
            <div className="kpi-cards top-confirmateurs">
              {currentData.top3_signatures && currentData.top3_signatures.length > 0 ? (
                currentData.top3_signatures.map((confirmateur, index) => (
                  <div key={confirmateur.id} className="kpi-card confirmateur-card">
                    <div className="kpi-card-header">
                      <span className="medal">{medals[index]}</span>
                      <h3>#{index + 1}</h3>
                    </div>
                    <div className="kpi-card-body">
                      <div className="agent-info">
                        {confirmateur.photo ? (
                          <img 
                            src={confirmateur.photo} 
                            alt={confirmateur.pseudo}
                            className="agent-avatar"
                          />
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
                        <span className="label">signatures</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">Aucun confirmateur trouvé pour cette période</div>
              )}
            </div>
          </div>

          {/* Informations sur la période */}
          <div className="period-info">
            <p>
              Période: <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
            </p>
            <p className="info-text">
              Les confirmations correspondent aux fiches avec état CONFIRMER (7). Les signatures correspondent aux fiches avec états SIGNER (13, 16, 44, 45).
            </p>
          </div>
        </div>
      )}

      {/* Contenu pour l'onglet Par Centre */}
      {activeTab === 'centres' && currentData && (
        <div className="kpis-content">
          <div className="kpi-section">
            <h2 className="section-title">KPIs par Centre</h2>
            {currentData.centres && currentData.centres.length > 0 ? (
              <div className="centres-grid">
                {currentData.centres.map((centre) => (
                  <div key={centre.centre_id} className="centre-card">
                    <div className="centre-header">
                      <h3>{centre.centre_titre || `Centre #${centre.centre_id}`}</h3>
                    </div>
                    <div className="centre-body">
                      {/* Métriques Globales */}
                      <div className="centre-metrics">
                        <div className="metric-item">
                          <span className="metric-label">Taux de Conversion</span>
                          <span className="metric-value">{formatPercentage(centre.conversion_rate || 0)}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-label">Fiches Validées</span>
                          <span className="metric-value">{centre.validated_count || 0}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-label">Fiches Total</span>
                          <span className="metric-value">{centre.total_count || 0}</span>
                        </div>
                      </div>

                      {/* Top Agent */}
                      {centre.top_agent && (
                        <div className="centre-top-agent">
                          <h4>Meilleur Agent</h4>
                          <div className="agent-info">
                            {centre.top_agent.photo ? (
                              <img 
                                src={centre.top_agent.photo} 
                                alt={centre.top_agent.pseudo}
                                className="agent-avatar"
                              />
                            ) : (
                              <div className="agent-avatar placeholder">
                                {centre.top_agent.pseudo ? centre.top_agent.pseudo.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <div className="agent-details">
                              <div className="agent-name">
                                {centre.top_agent.nom && centre.top_agent.prenom
                                  ? `${centre.top_agent.nom} ${centre.top_agent.prenom}`
                                  : centre.top_agent.pseudo || 'N/A'}
                              </div>
                              <div className="agent-pseudo">{centre.top_agent.pseudo}</div>
                              <div className="agent-count">{centre.top_agent.count} fiches</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Top Équipe */}
                      {centre.top_team && (
                        <div className="centre-top-team">
                          <h4>Meilleure Équipe</h4>
                          <div className="team-info">
                            <div className="superviseur-name">
                              {centre.top_team.superviseur.nom && centre.top_team.superviseur.prenom
                                ? `${centre.top_team.superviseur.nom} ${centre.top_team.superviseur.prenom}`
                                : centre.top_team.superviseur.pseudo || 'N/A'}
                            </div>
                            <div className="superviseur-pseudo">{centre.top_team.superviseur.pseudo}</div>
                            <div className="team-count">{centre.top_team.count} fiches</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Aucun centre trouvé pour cette période</div>
            )}

            {/* Informations sur la période */}
            <div className="period-info">
              <p>
                Période: <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
              </p>
              <p className="info-text">
                Les KPIs sont calculés par centre pour la période sélectionnée.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIs;

