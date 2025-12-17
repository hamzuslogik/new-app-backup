import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaTrophy, FaUsers, FaChartLine, FaCalendarDay, FaCalendarWeek, FaCalendarAlt } from 'react-icons/fa';
import './KPIQualification.css';

const KPIQualification = () => {
  const { user } = useAuth();
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

  // Récupérer les KPI
  const { data: kpiData, isLoading, error } = useQuery(
    ['kpi-qualification', selectedPeriod, selectedMonth],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      const res = await api.get('/statistiques/kpi-qualification', { params });
      return res.data.data;
    },
    {
      enabled: selectedPeriod !== 'mois' || !!selectedMonth
    }
  );

  const periods = [
    { key: 'jour', label: 'Aujourd\'hui', icon: FaCalendarDay },
    { key: 'semaine', label: 'Cette semaine', icon: FaCalendarWeek },
    { key: 'mois', label: 'Ce mois', icon: FaCalendarAlt }
  ];

  const currentData = kpiData?.[selectedPeriod];

  if (isLoading) {
    return (
      <div className="kpi-qualification">
        <div className="loading">Chargement des KPI...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpi-qualification">
        <div className="error">
          Erreur lors du chargement des KPI: {error.message || 'Erreur inconnue'}
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-qualification">
      <div className="kpi-header">
        <h1><FaChartLine /> KPI Qualification</h1>
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
                      // Si on passe à "mois" et qu'aucun mois n'est sélectionné, utiliser le mois en cours
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

      {currentData && (
        <div className="kpi-content">
          <div className="kpi-cards">
            {/* Meilleur Agent */}
            <div className="kpi-card best-agent">
              <div className="kpi-card-header">
                <FaTrophy className="kpi-icon" />
                <h2>Meilleur Agent</h2>
                <span className="period-label">{currentData.period}</span>
              </div>
              <div className="kpi-card-body">
                {currentData.best_agent ? (
                  <>
                    <div className="agent-info">
                      {currentData.best_agent.photo ? (
                        <img 
                          src={currentData.best_agent.photo} 
                          alt={currentData.best_agent.pseudo}
                          className="agent-avatar"
                        />
                      ) : (
                        <div className="agent-avatar placeholder">
                          {currentData.best_agent.pseudo ? currentData.best_agent.pseudo.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                      <div className="agent-details">
                        <div className="agent-name">
                          {currentData.best_agent.nom && currentData.best_agent.prenom
                            ? `${currentData.best_agent.nom} ${currentData.best_agent.prenom}`
                            : currentData.best_agent.pseudo || 'N/A'}
                        </div>
                        <div className="agent-pseudo">{currentData.best_agent.pseudo}</div>
                      </div>
                    </div>
                    <div className="kpi-value">
                      <span className="value">{currentData.best_agent.count}</span>
                      <span className="label">fiches validées</span>
                    </div>
                  </>
                ) : (
                  <div className="no-data">Aucun agent trouvé pour cette période</div>
                )}
              </div>
            </div>

            {/* Meilleure Équipe */}
            <div className="kpi-card best-team">
              <div className="kpi-card-header">
                <FaUsers className="kpi-icon" />
                <h2>Meilleure Équipe</h2>
                <span className="period-label">{currentData.period}</span>
              </div>
              <div className="kpi-card-body">
                {currentData.best_team ? (
                  <>
                    <div className="team-info">
                      <div className="superviseur-name">
                        {currentData.best_team.superviseur.nom && currentData.best_team.superviseur.prenom
                          ? `${currentData.best_team.superviseur.nom} ${currentData.best_team.superviseur.prenom}`
                          : currentData.best_team.superviseur.pseudo || 'N/A'}
                      </div>
                      <div className="superviseur-pseudo">{currentData.best_team.superviseur.pseudo}</div>
                      <div className="team-stats">
                        <span className="stat-item">
                          <strong>{currentData.best_team.nb_agents}</strong> agent{currentData.best_team.nb_agents > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="kpi-value">
                      <span className="value">{currentData.best_team.count}</span>
                      <span className="label">fiches validées</span>
                    </div>
                  </>
                ) : (
                  <div className="no-data">Aucune équipe trouvée pour cette période</div>
                )}
              </div>
            </div>
          </div>

          {/* Informations sur la période */}
          <div className="period-info">
            <p>
              Période: <strong>{currentData.date_start}</strong> au <strong>{currentData.date_end}</strong>
            </p>
            <p className="info-text">
              Les fiches validées correspondent aux fiches qui sont passées en phase 1, 2 ou 3 (hors groupe 0).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIQualification;

