import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaTrophy, FaUsers, FaChartLine, FaCalendarDay, FaCalendarWeek, FaCalendarAlt, FaFileAlt, FaBan, FaUserTimes, FaExclamationTriangle, FaCommentDots } from 'react-icons/fa';
import './KPIQualification.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

/** taux côté API = fiches validées / fiches produites sur le périmètre autorisé (global ou équipe) */
function getTauxConversionDisplay(tauxConversion) {
  if (!tauxConversion || typeof tauxConversion !== 'object') {
    return { kind: 'missing' };
  }
  const fichesValidees = Number(tauxConversion.fiches_validees);
  const fichesProduites = Number(tauxConversion.fiches_produites);
  let taux = typeof tauxConversion.taux === 'number' && !Number.isNaN(tauxConversion.taux) ? tauxConversion.taux : null;
  if (taux == null && fichesProduites > 0) {
    taux = (fichesValidees / fichesProduites) * 100;
  }
  if (fichesProduites <= 0) {
    return { kind: 'nc', fichesValidees, fichesProduites };
  }
  if (taux == null || Number.isNaN(taux)) {
    return { kind: 'missing' };
  }
  return { kind: 'ok', taux, fichesValidees, fichesProduites };
}

function KpiCounterCard({ icon: Icon, label, total, filtered, showDual, accentClass }) {
  const displayFiltered = filtered ?? 0;
  const displayTotal = total ?? displayFiltered;

  return (
    <div className={`kpi-counter-card ${accentClass || ''}`}>
      <div className="kpi-counter-header">
        <Icon className="kpi-counter-icon" aria-hidden />
        <h3>{label}</h3>
      </div>
      {showDual ? (
        <div className="kpi-counter-dual">
          <div className="kpi-counter-block">
            <span className="kpi-counter-value">{displayTotal.toLocaleString('fr-FR')}</span>
            <span className="kpi-counter-sub">Totalité</span>
          </div>
          <div className="kpi-counter-block kpi-counter-block-filtered">
            <span className="kpi-counter-value">{displayFiltered.toLocaleString('fr-FR')}</span>
            <span className="kpi-counter-sub">Filtré</span>
          </div>
        </div>
      ) : (
        <div className="kpi-counter-single">
          <span className="kpi-counter-value">{displayFiltered.toLocaleString('fr-FR')}</span>
        </div>
      )}
    </div>
  );
}

const KPIQualification = () => {
  useForceDesktopViewport('kpi-qualification-page');
  const { user } = useAuth();
  const canUseScopeFilters = user?.fonction === 11 || user?.fonction === 1;
  const [selectedPeriod, setSelectedPeriod] = useState('jour'); // jour, semaine, mois
  const [selectedMonth, setSelectedMonth] = useState(''); // Format: YYYY-MM
  const [scopeFilters, setScopeFilters] = useState({
    id_rp: '',
    id_superviseur: '',
    id_agent: '',
  });

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
  const { data: usersData } = useQuery(
    ['kpi-qualification-users', canUseScopeFilters],
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data?.data || [];
    },
    { enabled: canUseScopeFilters }
  );

  const { data: kpiData, isLoading, error } = useQuery(
    ['kpi-qualification', selectedPeriod, selectedMonth, scopeFilters.id_rp, scopeFilters.id_superviseur, scopeFilters.id_agent],
    async () => {
      const params = {};
      if (selectedPeriod === 'mois' && selectedMonth) {
        params.month = selectedMonth;
      }
      if (canUseScopeFilters) {
        if (scopeFilters.id_rp) params.id_rp = scopeFilters.id_rp;
        if (scopeFilters.id_superviseur) params.id_superviseur = scopeFilters.id_superviseur;
        if (scopeFilters.id_agent) params.id_agent = scopeFilters.id_agent;
      }
      const res = await api.get('/statistiques/kpi-qualification', { params });
      return res.data.data;
    },
    {
      enabled: selectedPeriod !== 'mois' || !!selectedMonth
    }
  );

  const rps = (usersData || []).filter((u) => Number(u.fonction) === 12 && Number(u.etat) > 0);
  const superviseursQualif = (usersData || []).filter((u) => Number(u.fonction) === 2 && Number(u.etat) > 0);
  const agentsQualif = (usersData || []).filter((u) => Number(u.fonction) === 3 && Number(u.etat) > 0);
  const visibleSuperviseurs = scopeFilters.id_rp
    ? superviseursQualif.filter((s) => String(s.id_rp_qualif || '') === String(scopeFilters.id_rp))
    : superviseursQualif;
  const visibleAgents = scopeFilters.id_superviseur
    ? agentsQualif.filter((a) => String(a.chef_equipe || '') === String(scopeFilters.id_superviseur))
    : agentsQualif;

  const periods = [
    { key: 'jour', label: 'Aujourd\'hui', icon: FaCalendarDay },
    { key: 'semaine', label: 'Cette semaine', icon: FaCalendarWeek },
    { key: 'mois', label: 'Ce mois', icon: FaCalendarAlt }
  ];

  const currentData = kpiData?.[selectedPeriod];
  const details = currentData?.details;
  const showDualCounters = !!(details?.has_filter && canUseScopeFilters);
  const detailCounters = [
    { key: 'fiches_produites', label: 'Fiches produites', icon: FaFileAlt, accentClass: 'counter-produites' },
    { key: 'nb_ko', label: 'KO', icon: FaBan, accentClass: 'counter-ko' },
    { key: 'nb_hc', label: 'HC', icon: FaUserTimes, accentClass: 'counter-hc' },
    { key: 'nb_alertes_recues', label: 'Alertes reçues', icon: FaExclamationTriangle, accentClass: 'counter-alertes' },
    { key: 'nb_remarques_recues', label: 'Remarques reçues', icon: FaCommentDots, accentClass: 'counter-remarques' },
  ];

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
          {selectedPeriod === 'mois' && !canUseScopeFilters && (
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
          {canUseScopeFilters && (
            <div className={`scope-filters ${selectedPeriod === 'mois' ? 'with-month' : ''}`}>
              {selectedPeriod === 'mois' && (
                <div className="scope-filter-group month-inline">
                  <label htmlFor="month-select-inline">Mois</label>
                  <select
                    id="month-select-inline"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
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
              <div className="scope-filter-group">
                <label htmlFor="kpi-rp-select">RP</label>
                <select
                  id="kpi-rp-select"
                  value={scopeFilters.id_rp}
                  onChange={(e) => {
                    const nextRp = e.target.value;
                    setScopeFilters((prev) => ({
                      ...prev,
                      id_rp: nextRp,
                      id_superviseur: '',
                      id_agent: '',
                    }));
                  }}
                >
                  <option value="">Tous les RP</option>
                  {rps.map((rp) => (
                    <option key={rp.id} value={rp.id}>
                      {rp.pseudo || `${rp.nom || ''} ${rp.prenom || ''}`.trim() || `RP #${rp.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="scope-filter-group">
                <label htmlFor="kpi-superviseur-select">RE</label>
                <select
                  id="kpi-superviseur-select"
                  value={scopeFilters.id_superviseur}
                  onChange={(e) => {
                    const nextSuperviseur = e.target.value;
                    setScopeFilters((prev) => ({
                      ...prev,
                      id_superviseur: nextSuperviseur,
                      id_agent: '',
                    }));
                  }}
                >
                  <option value="">Tous les RE</option>
                  {visibleSuperviseurs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.pseudo || `${s.nom || ''} ${s.prenom || ''}`.trim() || `RE #${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="scope-filter-group">
                <label htmlFor="kpi-agent-select">Agent</label>
                <select
                  id="kpi-agent-select"
                  value={scopeFilters.id_agent}
                  onChange={(e) => setScopeFilters((prev) => ({ ...prev, id_agent: e.target.value }))}
                >
                  <option value="">Tous les agents</option>
                  {visibleAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.pseudo || `${a.nom || ''} ${a.prenom || ''}`.trim() || `Agent #${a.id}`}
                    </option>
                  ))}
                </select>
              </div>
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

            {/* Taux de Conformité */}
            <div className="kpi-card taux-conversion">
              <div className="kpi-card-header">
                <FaChartLine className="kpi-icon" />
                <h2>Taux de Conformité</h2>
                <span className="period-label">{currentData.period}</span>
              </div>
              <div className="kpi-card-body">
                {(() => {
                  const tauxView = getTauxConversionDisplay(currentData.taux_conversion);
                  if (tauxView.kind === 'ok') {
                    return (
                      <>
                        <div className="kpi-value taux-value">
                          <span className="value">
                            {Number(tauxView.taux).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}&nbsp;%
                          </span>
                        </div>
                        <div className="conversion-details">
                          <div className="detail-item">
                            <span className="detail-value">{tauxView.fichesValidees}</span>
                            <span className="detail-label">fiches validées</span>
                          </div>
                          <div className="detail-separator">/</div>
                          <div className="detail-item">
                            <span className="detail-value">{tauxView.fichesProduites}</span>
                            <span className="detail-label">fiches produites</span>
                          </div>
                        </div>
                      </>
                    );
                  }
                  if (tauxView.kind === 'nc') {
                    return (
                      <>
                        <p className="kpi-taux-hint">Aucune fiche produite sur la période (dénominateur = 0)</p>
                        <div className="kpi-value taux-value taux-na">
                          <span className="value taux-na-text">N/C</span>
                          <span className="label taux-na-sublabel">Taux non calculable</span>
                        </div>
                        <div className="conversion-details">
                          <div className="detail-item">
                            <span className="detail-value">{tauxView.fichesValidees}</span>
                            <span className="detail-label">fiches validées</span>
                          </div>
                          <div className="detail-separator">/</div>
                          <div className="detail-item">
                            <span className="detail-value">{tauxView.fichesProduites}</span>
                            <span className="detail-label">fiches produites</span>
                          </div>
                        </div>
                      </>
                    );
                  }
                  return <div className="no-data">Données non disponibles (API taux de conformité)</div>;
                })()}
              </div>
            </div>
          </div>

          {details && (
            <div className="kpi-details-section">
              <div className="kpi-details-header">
                <h2>Détail production</h2>
                <span className="kpi-details-period">
                  {currentData.date_start} → {currentData.date_end}
                </span>
              </div>
              <div className="kpi-counter-grid">
                {detailCounters.map(({ key, label, icon, accentClass }) => (
                  <KpiCounterCard
                    key={key}
                    icon={icon}
                    label={label}
                    accentClass={accentClass}
                    showDual={showDualCounters}
                    total={details.total?.[key]}
                    filtered={details.filtered?.[key]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KPIQualification;

