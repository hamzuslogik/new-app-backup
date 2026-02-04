import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaRobot, FaCalendarAlt, FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaChartLine, FaSpinner } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './AssistanceIA.css';

const AssistanceIA = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('problems'); // 'problems', 'qualification', 'report'

  // Récupérer l'analyse des rendez-vous pour la date sélectionnée
  const { data: analysisData, isLoading, error, refetch } = useQuery(
    ['ia-assistance', selectedDate],
    async () => {
      const res = await api.get('/ia-assistance/analyze', {
        params: { date: selectedDate }
      });
      return res.data.data;
    },
    {
      enabled: !!selectedDate,
      refetchOnWindowFocus: false
    }
  );

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProblemSeverityClass = (severity) => {
    switch (severity) {
      case 'high':
        return 'problem-high';
      case 'medium':
        return 'problem-medium';
      case 'low':
        return 'problem-low';
      default:
        return '';
    }
  };

  const getQualificationClass = (score) => {
    if (score >= 80) return 'qualification-excellent';
    if (score >= 60) return 'qualification-good';
    if (score >= 40) return 'qualification-medium';
    return 'qualification-low';
  };

  const getQualificationLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    return 'Faible';
  };

  return (
    <div className="assistance-ia-page">
      <div className="assistance-ia-header">
        <div className="header-left">
          <h1><FaRobot /> Assistance IA</h1>
          <p>Analyse intelligente des rendez-vous basée sur les règles métier</p>
        </div>
        <div className="header-controls">
          <label htmlFor="date-select">
            <FaCalendarAlt /> Date d'analyse :
          </label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="date-input"
          />
          <button
            className="btn-refresh"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Actualiser l'analyse"
          >
            {isLoading ? <FaSpinner className="spinning" /> : 'Actualiser'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="loading-container">
          <FaSpinner className="spinner-large spinning" />
          <p>Analyse en cours...</p>
        </div>
      )}

      {error && (
        <div className="error-container">
          <FaExclamationTriangle />
          <p>Erreur lors du chargement de l'analyse</p>
          <button onClick={() => refetch()}>Réessayer</button>
        </div>
      )}

      {!isLoading && !error && analysisData && (
        <>
          {/* Onglets */}
          <div className="analysis-tabs">
            <button
              className={`tab-button ${activeTab === 'problems' ? 'active' : ''}`}
              onClick={() => setActiveTab('problems')}
            >
              <FaExclamationTriangle /> Problèmes détectés
              {analysisData.problems && analysisData.problems.length > 0 && (
                <span className="badge-count">{analysisData.problems.length}</span>
              )}
            </button>
            <button
              className={`tab-button ${activeTab === 'qualification' ? 'active' : ''}`}
              onClick={() => setActiveTab('qualification')}
            >
              <FaChartLine /> Qualification
              {analysisData.qualifiedRdvs && analysisData.qualifiedRdvs.length > 0 && (
                <span className="badge-count">{analysisData.qualifiedRdvs.length}</span>
              )}
            </button>
            <button
              className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              <FaInfoCircle /> Rapport synthétique
            </button>
          </div>

          {/* Contenu des onglets */}
          <div className="analysis-content">
            {/* Onglet Problèmes */}
            {activeTab === 'problems' && (
              <div className="problems-section">
                <div className="section-header">
                  <h2>Problèmes détectés</h2>
                  <p className="section-description">
                    Analyse automatique des rendez-vous pour identifier les incohérences et anomalies
                  </p>
                </div>

                {analysisData.problems && analysisData.problems.length > 0 ? (
                  <div className="problems-list">
                    {analysisData.problems.map((problem, index) => (
                      <div key={index} className={`problem-card ${getProblemSeverityClass(problem.severity)}`}>
                        <div className="problem-header">
                          <div className="problem-icon">
                            {problem.severity === 'high' && <FaExclamationTriangle />}
                            {problem.severity === 'medium' && <FaInfoCircle />}
                            {problem.severity === 'low' && <FaInfoCircle />}
                          </div>
                          <div className="problem-title">
                            <h3>{problem.type}</h3>
                            <span className="problem-severity">{problem.severity}</span>
                          </div>
                        </div>
                        <div className="problem-body">
                          <p className="problem-description">{problem.description}</p>
                          {problem.fiche && (
                            <div className="problem-fiche">
                              <FicheDetailLink
                                ficheHash={problem.fiche.hash}
                                ficheId={problem.fiche.id}
                                className="fiche-link"
                              >
                                Fiche #{problem.fiche.id} - {problem.fiche.nom} {problem.fiche.prenom}
                              </FicheDetailLink>
                              {problem.fiche.tel && (
                                <span className="fiche-tel">Tél: {problem.fiche.tel}</span>
                              )}
                            </div>
                          )}
                          {problem.details && (
                            <div className="problem-details">
                              <strong>Détails :</strong>
                              <pre>{JSON.stringify(problem.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <FaCheckCircle />
                    <p>Aucun problème détecté pour cette date</p>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Qualification */}
            {activeTab === 'qualification' && (
              <div className="qualification-section">
                <div className="section-header">
                  <h2>Qualification des rendez-vous</h2>
                  <p className="section-description">
                    Évaluation de la fiabilité des rendez-vous basée sur l'historique des états
                  </p>
                </div>

                {analysisData.qualifiedRdvs && analysisData.qualifiedRdvs.length > 0 ? (
                  <div className="qualification-table-container">
                    <table className="qualification-table">
                      <thead>
                        <tr>
                          <th>Fiche</th>
                          <th>Client</th>
                          <th>Date RDV</th>
                          <th>Score</th>
                          <th>Qualification</th>
                          <th>Historique</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisData.qualifiedRdvs.map((rdv) => (
                          <tr key={rdv.fiche_id}>
                            <td>
                              <FicheDetailLink
                                ficheHash={rdv.hash}
                                ficheId={rdv.fiche_id}
                                className="fiche-link"
                              >
                                #{rdv.fiche_id}
                              </FicheDetailLink>
                            </td>
                            <td>
                              {rdv.nom} {rdv.prenom}
                              {rdv.tel && <div className="client-tel">{rdv.tel}</div>}
                            </td>
                            <td>{formatRdvDateTime(rdv.date_rdv_time)}</td>
                            <td>
                              <div className={`score-badge ${getQualificationClass(rdv.score)}`}>
                                {rdv.score}/100
                              </div>
                            </td>
                            <td>
                              <span className={`qualification-label ${getQualificationClass(rdv.score)}`}>
                                {getQualificationLabel(rdv.score)}
                              </span>
                            </td>
                            <td>
                              <div className="history-summary">
                                {rdv.state_changes && rdv.state_changes > 0 && (
                                  <span className="history-badge">
                                    {rdv.state_changes} changement{rdv.state_changes > 1 ? 's' : ''}
                                  </span>
                                )}
                                {rdv.has_cancellations && (
                                  <span className="history-badge warning">Annulations</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <FaInfoCircle />
                    <p>Aucun rendez-vous à qualifier pour cette date</p>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Rapport */}
            {activeTab === 'report' && (
              <div className="report-section">
                <div className="section-header">
                  <h2>Rapport synthétique</h2>
                  <p className="section-description">
                    Vue d'ensemble des rendez-vous planifiés pour le {formatDate(selectedDate)}
                  </p>
                </div>

                {analysisData.report && (
                  <div className="report-content">
                    {/* Statistiques générales */}
                    <div className="report-stats">
                      <div className="stat-card">
                        <div className="stat-value">{analysisData.report.total_rdv || 0}</div>
                        <div className="stat-label">Total RDV</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{analysisData.report.confirmed_rdv || 0}</div>
                        <div className="stat-label">Confirmés</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{analysisData.report.problems_count || 0}</div>
                        <div className="stat-label">Problèmes</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">
                          {analysisData.report.average_score ? Math.round(analysisData.report.average_score) : 0}
                        </div>
                        <div className="stat-label">Score moyen</div>
                      </div>
                    </div>

                    {/* Résumé textuel */}
                    {analysisData.report.summary && (
                      <div className="report-summary">
                        <h3>Résumé</h3>
                        <div className="summary-text">
                          {analysisData.report.summary.split('\n').map((line, index) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommandations */}
                    {analysisData.report.recommendations && analysisData.report.recommendations.length > 0 && (
                      <div className="report-recommendations">
                        <h3>Recommandations</h3>
                        <ul>
                          {analysisData.report.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tendances */}
                    {analysisData.report.trends && analysisData.report.trends.length > 0 && (
                      <div className="report-trends">
                        <h3>Tendances observées</h3>
                        <ul>
                          {analysisData.report.trends.map((trend, index) => (
                            <li key={index}>{trend}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AssistanceIA;

