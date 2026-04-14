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
  FaPercentage,
  FaDoorOpen
} from 'react-icons/fa';
import './KPIs.css';

const KPIs = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('qualification'); // qualification, confirmation, confirmation-jws, porte-ouverte
  const [selectedPeriod, setSelectedPeriod] = useState('jour'); // jour, semaine, mois
  const [selectedMonth, setSelectedMonth] = useState(''); // Format: YYYY-MM
  const [selectedPorteOuverteCentre, setSelectedPorteOuverteCentre] = useState('');
  const [selectedPorteOuverteEtat, setSelectedPorteOuverteEtat] = useState('');
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const [porteOuverteDateDebut, setPorteOuverteDateDebut] = useState(getFirstOfMonthStr());
  const [porteOuverteDateFin, setPorteOuverteDateFin] = useState(getTodayStr());

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

  // Récupérer les KPI Confirmation JWS (centre CALL_JWS uniquement)
  const { data: confirmationJwsData, isLoading: isLoadingConfJws, error: errorConfJws } = useQuery(
    ['kpis-confirmation-jws', selectedPeriod, selectedMonth],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      const res = await api.get('/statistiques/kpis-confirmation-jws', { params });
      return res.data.data;
    },
    {
      enabled: (selectedPeriod !== 'mois' || !!selectedMonth) && activeTab === 'confirmation-jws'
    }
  );

  const { data: centresData } = useQuery(
    ['kpis-centres-jws'],
    async () => {
      const res = await api.get('/management/centres');
      return (res.data?.data || []).filter((c) =>
        String(c?.titre || '').toUpperCase().includes('JWS')
      );
    },
    { enabled: activeTab === 'porte-ouverte' }
  );

  const { data: porteOuverteData, isLoading: isLoadingPorteOuverte, error: errorPorteOuverte } = useQuery(
    ['kpis-porte-ouverte', selectedPeriod, selectedMonth, selectedPorteOuverteCentre, porteOuverteDateDebut, porteOuverteDateFin],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      if (selectedPorteOuverteCentre) {
        params.id_centre = selectedPorteOuverteCentre;
      }
      if (porteOuverteDateDebut) {
        params.date_debut = porteOuverteDateDebut;
      }
      if (porteOuverteDateFin) {
        params.date_fin = porteOuverteDateFin;
      }
      const res = await api.get('/statistiques/kpis-porte-ouverte', { params });
      return res.data.data;
    },
    {
      enabled: (selectedPeriod !== 'mois' || !!selectedMonth) && activeTab === 'porte-ouverte'
    }
  );

  const isLoading = activeTab === 'qualification' ? isLoadingQualif : 
                   activeTab === 'confirmation' ? isLoadingConf : 
                   activeTab === 'porte-ouverte' ? isLoadingPorteOuverte :
                   isLoadingConfJws;
  const error = activeTab === 'qualification' ? errorQualif : 
                activeTab === 'confirmation' ? errorConf : 
                activeTab === 'porte-ouverte' ? errorPorteOuverte :
                errorConfJws;

  const periods = [
    { key: 'jour', label: 'Aujourd\'hui', icon: FaCalendarDay },
    { key: 'semaine', label: 'Cette semaine', icon: FaCalendarWeek },
    { key: 'mois', label: 'Ce mois', icon: FaCalendarAlt }
  ];

  const currentData = activeTab === 'qualification' 
    ? kpiData?.[selectedPeriod] 
    : activeTab === 'confirmation'
    ? confirmationData?.[selectedPeriod]
    : activeTab === 'porte-ouverte'
    ? (porteOuverteData?.custom || porteOuverteData?.[selectedPeriod])
    : confirmationJwsData?.[selectedPeriod];
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
        <div className="header-controls">
          {activeTab !== 'porte-ouverte' && (
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
          )}
          {activeTab !== 'porte-ouverte' && selectedPeriod === 'mois' && (
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
          {activeTab === 'porte-ouverte' && (
            <>
            <div className="month-selector">
              <label htmlFor="porte-ouverte-date-debut">Date début :</label>
              <input
                id="porte-ouverte-date-debut"
                type="date"
                className="month-select"
                value={porteOuverteDateDebut}
                onChange={(e) => setPorteOuverteDateDebut(e.target.value)}
              />
            </div>
            <div className="month-selector">
              <label htmlFor="porte-ouverte-date-fin">Date fin :</label>
              <input
                id="porte-ouverte-date-fin"
                type="date"
                className="month-select"
                value={porteOuverteDateFin}
                onChange={(e) => setPorteOuverteDateFin(e.target.value)}
              />
            </div>
            <div className="month-selector">
              <label htmlFor="porte-ouverte-centre-select">Centre :</label>
              <select
                id="porte-ouverte-centre-select"
                value={selectedPorteOuverteCentre}
                onChange={(e) => setSelectedPorteOuverteCentre(e.target.value)}
                className="month-select"
              >
                <option value="">Tous les centres JWS</option>
                {(centresData || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre}
                  </option>
                ))}
              </select>
            </div>
            </>
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

              {/* Taux de Transformation des Agents Qualification */}
              {currentData.transformation_rate !== undefined && (
                <div className="kpi-card transformation-rate">
                  <div className="kpi-card-header">
                    <FaPercentage className="kpi-icon" />
                    <h3>Taux de Transformation</h3>
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
            <p className="info-text">
              Taux de conversion = Fiches validées / Fiches produites. Validées = fiches hors groupe 0 et KO=0. Produites = fiches créées par agents qualification, hors poubelle et doublon.
            </p>
          </div>
        </div>
      )}

      {/* Contenu pour l'onglet Porte ouverte */}
      {activeTab === 'porte-ouverte' && currentData && (
        <div className="kpis-content">
          <div className="kpi-section">
            <h2 className="section-title">Statistiques Porte ouverte</h2>
            <p className="section-description" style={{ marginBottom: '1rem', color: '#555' }}>
              Comptes rendus approuvés avec une qualification « porte ouverte » (Honoré à suivre, Refuser, Signer, Hors cible confirmateur, HHC technique, etc.), par date d&apos;approbation.
            </p>
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
            <h2 className="section-title" style={{ color: '#ffffff' }}>Détails des fiches porte ouverte</h2>
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
                    <th>Date approbation</th>
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
                        <td>{row.date_approbation || row.date_creation || '-'}</td>
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
            <p className="info-text">
              Périmètre identique aux autres onglets KPIs : fiches du centre CALL_JWS lorsque ce centre est configuré ; sinon toutes les fiches. Archives exclues.
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

      {/* Contenu pour l'onglet Confirmation JWS */}
      {activeTab === 'confirmation-jws' && currentData && (
        <div className="kpis-content">
          <div className="kpi-section">
            <h2 className="section-title">Statistiques Confirmation JWS</h2>
            <p className="section-description">
              Statistiques de transformation et performance pour les centres Call_JWS
            </p>
            
            {currentData.centres && currentData.centres.length > 0 ? (
              <div className="centres-grid">
                {currentData.centres.map((centre) => (
                  <div key={centre.centre_id} className="centre-card">
                    <div className="centre-header">
                      <h3>{centre.centre_titre}</h3>
                    </div>
                    <div className="centre-metrics">
                      {/* Métriques principales */}
                      <div className="metric-row">
                        <div className="metric-item">
                          <div className="metric-label">Total Fiches</div>
                          <div className="metric-value">{centre.total_count || 0}</div>
                        </div>
                        <div className="metric-item">
                          <div className="metric-label">Fiches Confirmées</div>
                          <div className="metric-value">{centre.confirmed_count || 0}</div>
                        </div>
                        <div className="metric-item">
                          <div className="metric-label">Fiches Signées</div>
                          <div className="metric-value">{centre.signed_count || 0}</div>
                        </div>
                      </div>
                      
                      {/* Taux de conversion - uniquement confirmer et signatures */}
                      <div className="rates-section">
                        <h4>Taux de Conversion</h4>
                        <div className="rates-grid">
                          <div className="rate-card highlight">
                            <div className="rate-label">Taux de Conversion en Confirmer</div>
                            <div className="rate-value">{formatPercentage(centre.confirmation_rate || 0)}</div>
                            <div className="rate-description">Confirmées / Total (par date confirmation)</div>
                          </div>
                          <div className="rate-card highlight">
                            <div className="rate-label">Taux de Conversion en Signatures</div>
                            <div className="rate-value">{formatPercentage(centre.signature_rate || 0)}</div>
                            <div className="rate-description">Signées / Total (par date insertion)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Aucune donnée disponible pour cette période</div>
            )}
            
            {/* Informations sur la période */}
            <div className="period-info">
              <p>
                Période: <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default KPIs;

