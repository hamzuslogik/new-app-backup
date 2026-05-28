import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import {
  FaUserCheck,
  FaFilter,
  FaSearch,
  FaFileExcel,
  FaFileCsv,
  FaFilePdf,
  FaChartBar,
  FaList,
  FaChevronDown,
  FaChevronUp,
  FaClipboardCheck,
  FaChartPie,
  FaCalendarCheck
} from 'react-icons/fa';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import FicheDetailLink from '../components/FicheDetailLink';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './StatsAgentsQualite.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const CHART_COLORS = ['#9cbfc8', '#4a7a87', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c'];

const StatsAgentsQualite = () => {
  useForceDesktopViewport('stats-agents-qualite-page');
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('stats');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAgents, setExpandedAgents] = useState({});
  const [expandedConfirmationAgents, setExpandedConfirmationAgents] = useState({});

  const [filters, setFilters] = useState({
    date_debut: getFirstOfMonthLocal(),
    date_fin: getTodayLocal(),
    id_agent_qualite_qualif: '',
    id_agent_qualite_confirmation: '',
  });

  const { data: statsData, isLoading, error } = useQuery(
    ['stats-agents-qualite', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) delete params[key];
      });
      const res = await api.get('/statistiques/agents-qualite', { params });
      return res.data.data;
    },
    { enabled: !!filters.date_debut && !!filters.date_fin && viewMode !== 'kpis' }
  );

  const { data: kpisData, isLoading: kpisLoading } = useQuery(
    ['stats-agents-qualite-kpis', filters.date_debut, filters.date_fin],
    async () => {
      const res = await api.get('/statistiques/agents-qualite-kpis', {
        params: { date_debut: filters.date_debut, date_fin: filters.date_fin }
      });
      return res.data.data;
    },
    { enabled: viewMode === 'kpis' && !!filters.date_debut && !!filters.date_fin }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const completudesData = statsData?.qualite_confirmation?.completudes;
  const auditData = statsData?.qualite_confirmation?.audit_confirmation;
  const rdvsAudites = statsData?.qualite_confirmation?.rdvs_audites || [];
  const fichesAuditeesQualif = statsData?.fiches_auditees_qualif || [];
  const agentsQualiteQualifOptions = statsData?.agents_qualite_qualif_options || [];
  const agentsQualiteConfirmationOptions =
    statsData?.qualite_confirmation?.audit_confirmation?.agents_options || [];

  const filteredAgents = useMemo(() => {
    if (!statsData?.agents) return [];
    if (!searchTerm.trim()) return statsData.agents;
    const term = searchTerm.toLowerCase();
    return statsData.agents.filter(agentStat =>
      agentStat.agent.pseudo?.toLowerCase().includes(term) ||
      agentStat.agent.nom?.toLowerCase().includes(term) ||
      agentStat.agent.prenom?.toLowerCase().includes(term) ||
      agentStat.agent.fonction_titre?.toLowerCase().includes(term) ||
      agentStat.agent.centre_titre?.toLowerCase().includes(term)
    );
  }, [statsData, searchTerm]);

  const filteredConfirmationAgents = useMemo(() => {
    const agents = completudesData?.agents || [];
    if (!searchTerm.trim()) return agents;
    const term = searchTerm.toLowerCase();
    return agents.filter(row =>
      row.agent.pseudo?.toLowerCase().includes(term) ||
      row.agent.nom?.toLowerCase().includes(term) ||
      row.agent.prenom?.toLowerCase().includes(term)
    );
  }, [completudesData, searchTerm]);

  const confirmationCardsByAgent = useMemo(() => {
    const map = new Map();
    (completudesData?.agents || []).forEach((row) => {
      map.set(row.agent.id, {
        agent: row.agent,
        completudes: row.stats,
        audit: { total_rdvs_audites: 0, avec_observation: 0 }
      });
    });
    (auditData?.agents || []).forEach((row) => {
      const existing = map.get(row.agent.id);
      if (existing) {
        existing.audit = row.stats;
      } else {
        map.set(row.agent.id, {
          agent: row.agent,
          completudes: { total_completudes: 0, en_attente: 0, traitees: 0 },
          audit: row.stats
        });
      }
    });
    return Array.from(map.values()).filter((row) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        row.agent.pseudo?.toLowerCase().includes(term) ||
        row.agent.nom?.toLowerCase().includes(term) ||
        row.agent.prenom?.toLowerCase().includes(term)
      );
    });
  }, [completudesData, auditData, searchTerm]);

  const filteredFichesAuditeesQualif = useMemo(() => {
    if (!searchTerm.trim()) return fichesAuditeesQualif;
    const term = searchTerm.toLowerCase();
    return fichesAuditeesQualif.filter((fiche) =>
      fiche.nom?.toLowerCase().includes(term) ||
      fiche.prenom?.toLowerCase().includes(term) ||
      fiche.tel?.includes(term) ||
      fiche.qualite?.pseudo?.toLowerCase().includes(term) ||
      fiche.agent_pseudo?.toLowerCase().includes(term) ||
      fiche.centre_titre?.toLowerCase().includes(term)
    );
  }, [fichesAuditeesQualif, searchTerm]);

  const fichesAuditeesToneStats = useMemo(() => {
    const eligibleFiches = filteredFichesAuditeesQualif.filter((fiche) => {
      const groupe = fiche?.etat_groupe;
      return !(String(groupe) === '0');
    });
    const total = eligibleFiches.length;
    const stats = { positif: 0, negatif: 0, neutre: 0, total };

    eligibleFiches.forEach((fiche) => {
      const taux = String(fiche?.etat_taux || '').toUpperCase().trim();
      if (taux === 'NEGATIVE') {
        stats.negatif += 1;
      } else if (taux === 'POSITIVE') {
        stats.positif += 1;
      } else {
        stats.neutre += 1;
      }
    });

    const percent = (value) => (total > 0 ? ((value / total) * 100).toFixed(1) : '0.0');

    return {
      ...stats,
      positif_percent: percent(stats.positif),
      negatif_percent: percent(stats.negatif),
      neutre_percent: percent(stats.neutre),
    };
  }, [filteredFichesAuditeesQualif]);

  const filteredRdvsAudites = useMemo(() => {
    if (!searchTerm.trim()) return rdvsAudites;
    const term = searchTerm.toLowerCase();
    return rdvsAudites.filter((rdv) =>
      rdv.nom?.toLowerCase().includes(term) ||
      rdv.prenom?.toLowerCase().includes(term) ||
      rdv.tel?.includes(term) ||
      rdv.auditeur?.pseudo?.toLowerCase().includes(term) ||
      rdv.confirmateur_pseudo?.toLowerCase().includes(term)
    );
  }, [rdvsAudites, searchTerm]);

  const formatAgentOptionLabel = (agent) => {
    if (!agent) return '';
    const name = `${agent.nom || ''} ${agent.prenom || ''}`.trim();
    return name ? `${agent.pseudo} (${name})` : agent.pseudo;
  };

  const toggleExpand = (agentId) => {
    setExpandedAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const toggleConfirmationExpand = (agentId) => {
    setExpandedConfirmationAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const buildQualifExportData = () => {
    if (!statsData?.agents?.length) return null;
    const columns = [
      { key: 'agent_pseudo', label: 'Agent qualité' },
      { key: 'agent_nom', label: 'Nom' },
      { key: 'agent_fonction', label: 'Fonction' },
      { key: 'agent_centre', label: 'Centre' },
      { key: 'total_audits', label: 'Total Audits' },
      { key: 'fiches_avec_commentaire', label: 'Fiches avec Commentaire' }
    ];
    const exportData = statsData.agents.map(agentStat => ({
      agent_pseudo: agentStat.agent.pseudo,
      agent_nom: `${agentStat.agent.nom || ''} ${agentStat.agent.prenom || ''}`.trim(),
      agent_fonction: agentStat.agent.fonction_titre || '-',
      agent_centre: agentStat.agent.centre_titre || '-',
      total_audits: agentStat.stats.total_audits,
      fiches_avec_commentaire: agentStat.stats.fiches_avec_commentaire
    }));
    return { columns, exportData };
  };

  const handleExportCSV = () => {
    const built = buildQualifExportData();
    if (!built) {
      alert('Aucune donnée à exporter');
      return;
    }
    exportToCSV(built.exportData, built.columns, `stats-qualite-qualification-${filters.date_debut}-${filters.date_fin}`);
  };

  const handleExportExcel = () => {
    const built = buildQualifExportData();
    if (!built) {
      alert('Aucune donnée à exporter');
      return;
    }
    exportToExcel(built.exportData, built.columns, `stats-qualite-qualification-${filters.date_debut}-${filters.date_fin}`);
  };

  const handleExportPDF = () => {
    const built = buildQualifExportData();
    if (!built) {
      alert('Aucune donnée à exporter');
      return;
    }
    exportToPDF(
      built.exportData,
      built.columns,
      `stats-qualite-qualification-${filters.date_debut}-${filters.date_fin}`,
      'Statistiques Qualité qualification'
    );
  };

  const completudesTotaux = completudesData?.totaux;
  const auditTotaux = auditData?.totaux;
  const hasError = viewMode !== 'kpis' && error;

  if (viewMode !== 'kpis' && isLoading) {
    return (
      <div className="stats-agents-qualite-page">
        <div className="loading">Chargement des statistiques...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="stats-agents-qualite-page">
        <div className="error">
          Erreur lors du chargement des statistiques: {error?.message || 'Erreur inconnue'}
        </div>
      </div>
    );
  }

  const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="stats-agents-qualite-page">
      <div className="page-header">
        <h1><FaUserCheck /> Statistiques Qualité</h1>
        <div className="header-actions">
          <div className="export-buttons">
            <button onClick={handleExportCSV} className="btn-export" title="Exporter qualité qualification (CSV)">
              <FaFileCsv />
            </button>
            <button onClick={handleExportExcel} className="btn-export" title="Exporter qualité qualification (Excel)">
              <FaFileExcel />
            </button>
            <button onClick={handleExportPDF} className="btn-export" title="Exporter qualité qualification (PDF)">
              <FaFilePdf />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-item">
              <label htmlFor="date_debut">Date début :</label>
              <input
                type="date"
                id="date_debut"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="date_fin">Date fin :</label>
              <input
                type="date"
                id="date_fin"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="search-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button
          className="toggle-filters-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {(statsData?.period || kpisData?.period) && (
        <div className="period-info">
          Période :{' '}
          <strong>{(statsData?.period || kpisData?.period)?.date_debut}</strong> au{' '}
          <strong>{(statsData?.period || kpisData?.period)?.date_fin}</strong>
        </div>
      )}

      {/* Section 1 — Qualité qualification */}
      <section className="page-main-section section-qualification">
        <div className="section-header">
          <div>
            <h2>Qualité qualification</h2>
          </div>
          <div className="section-mode-btns">
            <button
              className={`mode-btn ${viewMode === 'stats' ? 'active' : ''}`}
              onClick={() => setViewMode('stats')}
            >
              <FaChartBar /> Statistiques
            </button>
            <button
              className={`mode-btn ${viewMode === 'fiches' ? 'active' : ''}`}
              onClick={() => setViewMode('fiches')}
            >
              <FaList /> Fiches auditées qualif
            </button>
            <button
              className={`mode-btn ${viewMode === 'rdvs' ? 'active' : ''}`}
              onClick={() => setViewMode('rdvs')}
            >
              <FaCalendarCheck /> RDVs audités
            </button>
            <button
              className={`mode-btn ${viewMode === 'kpis' ? 'active' : ''}`}
              onClick={() => setViewMode('kpis')}
            >
              <FaChartPie /> KPIs
            </button>
          </div>
        </div>

        {viewMode === 'kpis' && (
          <div className="kpis-content">
            {kpisLoading ? (
              <div className="loading">Chargement des KPIs...</div>
            ) : (
              <>
                <section className="kpis-section">
                  <h3>Qualité qualification – Alertes et remarques envoyées</h3>
                  <div className="table-responsive">
                    <table className="stats-table kpis-table">
                      <thead>
                        <tr>
                          <th>Agent qualité</th>
                          <th>Alertes KO envoyées</th>
                          <th>Remarques envoyées</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kpisData?.qualite_qualification || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="no-data">Aucune donnée</td>
                          </tr>
                        ) : (
                          (kpisData?.qualite_qualification || []).map((row) => (
                            <tr key={row.id}>
                              <td>{row.pseudo || `${row.nom || ''} ${row.prenom || ''}`.trim() || row.id}</td>
                              <td>{row.nb_alertes_envoyees}</td>
                              <td>{row.nb_remarques_envoyees}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="kpis-section">
                  <h3>Répartition des alertes KO par RE qualification</h3>
                  <div className="kpis-chart-wrap">
                    {(kpisData?.re_alertes_pie || []).length === 0 ? (
                      <div className="no-data">Aucune alerte sur la période</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={kpisData.re_alertes_pie}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            label={({ name, value, percent }) =>
                              `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`
                            }
                          >
                            {(kpisData.re_alertes_pie || []).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, props) => [
                              `${value} alertes (${((props?.payload?.percent ?? 0) * 100).toFixed(1)}%)`,
                              name
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>

                <section className="kpis-section">
                  <h3>Remarques reçues par RE qualification (nombre et %)</h3>
                  <div className="kpis-chart-wrap">
                    {(kpisData?.re_remarques_bar || []).length === 0 ? (
                      <div className="no-data">Aucune remarque sur la période</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={kpisData.re_remarques_bar}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} />
                          <YAxis />
                          <Tooltip
                            formatter={(value, name, props) => [
                              `${value} (${props.payload.percent}%)`,
                              name
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" name="Remarques" fill="#4a7a87" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>

                <section className="kpis-section">
                  <h3>Agents qualification – Remarques et alertes KO reçues</h3>
                  <div className="table-responsive">
                    <table className="stats-table kpis-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Alertes KO reçues</th>
                          <th>Remarques reçues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kpisData?.agents_qualification || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="no-data">Aucun agent</td>
                          </tr>
                        ) : (
                          (kpisData?.agents_qualification || []).map((row) => (
                            <tr key={row.id}>
                              <td>{row.pseudo || `${row.nom || ''} ${row.prenom || ''}`.trim() || row.id}</td>
                              <td>{row.nb_alertes_ko_recues}</td>
                              <td>{row.nb_remarques_recues}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {viewMode === 'stats' && (
          <div className="stats-content">
            <h3 className="subsection-title">Audits qualification</h3>
            {filteredAgents.length > 0 ? (
              <div className="agents-stats-grid">
                {filteredAgents.map((agentStat) => (
                  <div key={agentStat.agent.id} className="agent-stat-card">
                    <div className="agent-stat-header">
                      <div className="agent-info">
                        {agentStat.agent.photo ? (
                          <img
                            src={agentStat.agent.photo}
                            alt={agentStat.agent.pseudo}
                            className="agent-avatar"
                          />
                        ) : (
                          <div className="agent-avatar placeholder">
                            {agentStat.agent.pseudo ? agentStat.agent.pseudo.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div className="agent-details">
                          <div className="agent-name">{agentStat.agent.pseudo}</div>
                          <div className="agent-meta">
                            {agentStat.agent.nom && agentStat.agent.prenom
                              ? `${agentStat.agent.nom} ${agentStat.agent.prenom}`
                              : ''}
                          </div>
                          <div className="agent-meta">
                            {agentStat.agent.fonction_titre || '-'} | {agentStat.agent.centre_titre || '-'}
                          </div>
                        </div>
                      </div>
                      <button
                        className="expand-btn"
                        onClick={() => toggleExpand(agentStat.agent.id)}
                      >
                        {expandedAgents[agentStat.agent.id] ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </div>
                    <div className="agent-stat-body">
                      <div className="stat-metrics">
                        <div className="stat-metric">
                          <div className="stat-value">{agentStat.stats.total_audits}</div>
                          <div className="stat-label">Fiches auditées</div>
                        </div>
                        <div className="stat-metric">
                          <div className="stat-value">{agentStat.stats.fiches_avec_commentaire}</div>
                          <div className="stat-label">Avec commentaire</div>
                        </div>
                      </div>
                      {expandedAgents[agentStat.agent.id] && (
                        <div className="stats-details">
                          <h4>Répartition par état</h4>
                          <div className="etats-stats">
                            {Object.values(agentStat.stats.par_etat).map(etat => (
                              <div key={etat.id} className="etat-stat-item">
                                <span
                                  className="etat-badge"
                                  style={{ backgroundColor: etat.color }}
                                >
                                  {etat.abbreviation || etat.titre}
                                </span>
                                <span className="etat-count">{etat.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Aucune fiche auditée (agents qualification) pour cette période</div>
            )}

            <h3 className="subsection-title confirmation-subsection-title">
              <FaClipboardCheck /> Qualité confirmation
            </h3>
            {(completudesTotaux || auditTotaux) && (
              <div className="confirmation-totaux">
                {completudesTotaux && (
                  <>
                    <div className="totaux-metric">
                      <span className="totaux-value">{completudesTotaux.total_completudes}</span>
                      <span className="totaux-label">Complétudes</span>
                    </div>
                    <div className="totaux-metric totaux-en-attente">
                      <span className="totaux-value">{completudesTotaux.en_attente}</span>
                      <span className="totaux-label">En attente</span>
                    </div>
                    <div className="totaux-metric totaux-traitees">
                      <span className="totaux-value">{completudesTotaux.traitees}</span>
                      <span className="totaux-label">Traitées</span>
                    </div>
                  </>
                )}
                {auditTotaux && (
                  <>
                    <div className="totaux-metric totaux-audit">
                      <span className="totaux-value">{auditTotaux.total_rdvs_audites}</span>
                      <span className="totaux-label">RDVs audités</span>
                    </div>
                    <div className="totaux-metric totaux-audit-obs">
                      <span className="totaux-value">{auditTotaux.avec_observation}</span>
                      <span className="totaux-label">Avec observation</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {confirmationCardsByAgent.length > 0 ? (
              <div className="agents-stats-grid confirmation-cards-grid">
                {confirmationCardsByAgent.map((row) => (
                  <div key={row.agent.id} className="agent-stat-card confirmation-agent-card">
                    <div className="agent-stat-header">
                      <div className="agent-info">
                        {row.agent.photo ? (
                          <img src={row.agent.photo} alt={row.agent.pseudo} className="agent-avatar" />
                        ) : (
                          <div className="agent-avatar placeholder confirmation-placeholder">
                            {row.agent.pseudo?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="agent-details">
                          <div className="agent-name">{row.agent.pseudo}</div>
                          <div className="agent-meta">
                            {row.agent.nom && row.agent.prenom
                              ? `${row.agent.nom} ${row.agent.prenom}`
                              : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        className="expand-btn"
                        onClick={() => toggleConfirmationExpand(row.agent.id)}
                      >
                        {expandedConfirmationAgents[row.agent.id] ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </div>
                    <div className="agent-stat-body">
                      <div className="stat-metrics stat-metrics-3">
                        <div className="stat-metric">
                          <div className="stat-value confirmation-value">
                            {row.completudes.total_completudes}
                          </div>
                          <div className="stat-label">Complétudes</div>
                        </div>
                        <div className="stat-metric">
                          <div className="stat-value confirmation-value">
                            {row.audit.total_rdvs_audites}
                          </div>
                          <div className="stat-label">RDVs audités</div>
                        </div>
                        <div className="stat-metric">
                          <div className="stat-value confirmation-value">
                            {row.audit.avec_observation}
                          </div>
                          <div className="stat-label">Avec observation</div>
                        </div>
                      </div>
                      {expandedConfirmationAgents[row.agent.id] && (
                        <div className="stats-details">
                          <div className="confirmation-detail-metrics">
                            <span>En attente : <strong>{row.completudes.en_attente}</strong></span>
                            <span>Traitées : <strong>{row.completudes.traitees}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Aucune activité qualité confirmation sur cette période</div>
            )}
          </div>
        )}

        {viewMode === 'fiches' && (
          <div className="fiches-content">
            <div className="tab-filters">
              <div className="filter-item">
                <label htmlFor="id_agent_qualite_qualif">Agent qualité qualification :</label>
                <select
                  id="id_agent_qualite_qualif"
                  value={filters.id_agent_qualite_qualif}
                  onChange={(e) => handleFilterChange('id_agent_qualite_qualif', e.target.value)}
                >
                  <option value="">Tous les agents</option>
                  {agentsQualiteQualifOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {formatAgentOptionLabel(agent)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="tab-results-count">
                {filteredFichesAuditeesQualif.length} fiche(s)
              </span>
            </div>
            <div className="table-responsive">
              <table className="stats-table audit-tone-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Nombre</th>
                    <th>Pourcentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Positif</td>
                    <td className="num-cell">{fichesAuditeesToneStats.positif}</td>
                    <td className="num-cell">{fichesAuditeesToneStats.positif_percent}%</td>
                  </tr>
                  <tr>
                    <td>Négatif</td>
                    <td className="num-cell">{fichesAuditeesToneStats.negatif}</td>
                    <td className="num-cell">{fichesAuditeesToneStats.negatif_percent}%</td>
                  </tr>
                  <tr>
                    <td>Neutre</td>
                    <td className="num-cell">{fichesAuditeesToneStats.neutre}</td>
                    <td className="num-cell">{fichesAuditeesToneStats.neutre_percent}%</td>
                  </tr>
                  <tr className="audit-tone-total-row">
                    <td>Total</td>
                    <td className="num-cell">{fichesAuditeesToneStats.total}</td>
                    <td className="num-cell">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {filteredFichesAuditeesQualif.length > 0 ? (
              <div className="table-responsive">
                <table className="fiches-table">
                  <thead>
                    <tr>
                      <th>Date audit</th>
                      <th>Nom / Prénom</th>
                      <th>Téléphone</th>
                      <th>CP / Ville</th>
                      <th>Agent qualité qualification</th>
                      <th>Agent qualification</th>
                      <th>Centre</th>
                      <th>État</th>
                      <th>KO/HC</th>
                      <th>Commentaire qualité</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFichesAuditeesQualif.map((fiche) => (
                      <tr
                        key={fiche.id}
                        className={`${fiche.ko ? 'row-ko' : ''} ${fiche.hc ? 'row-hc' : ''}`}
                      >
                        <td>{formatDateTime(fiche.date_audit)}</td>
                        <td>
                          <div className="name-cell">
                            <span className="nom">{fiche.nom || '-'}</span>
                            <span className="prenom">{fiche.prenom || '-'}</span>
                          </div>
                        </td>
                        <td>{fiche.tel || '-'}</td>
                        <td>
                          <div className="location-cell">
                            <span>{fiche.cp || '-'}</span>
                            <span className="ville">{fiche.ville || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="agent-cell">
                            <span className="pseudo">{fiche.qualite?.pseudo || '-'}</span>
                            {(fiche.qualite?.nom || fiche.qualite?.prenom) && (
                              <span className="fullname">
                                {fiche.qualite.nom} {fiche.qualite.prenom}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="agent-cell">
                            <span className="pseudo">{fiche.agent_pseudo || '-'}</span>
                            {(fiche.agent_nom || fiche.agent_prenom) && (
                              <span className="fullname">
                                {fiche.agent_nom} {fiche.agent_prenom}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{fiche.centre_titre || '-'}</td>
                        <td>
                          <span
                            className="etat-badge"
                            style={{ backgroundColor: fiche.etat_color || '#ccc' }}
                          >
                            {fiche.etat_abbreviation || fiche.etat_titre || '-'}
                          </span>
                        </td>
                        <td className="status-cell">
                          {fiche.ko ? <span className="status-badge ko">KO</span> : null}
                          {fiche.hc ? <span className="status-badge hc">HC</span> : null}
                          {!fiche.ko && !fiche.hc ? <span className="status-ok">-</span> : null}
                        </td>
                        <td className="comment-cell">
                          {fiche.commentaire_qualite ? (
                            <div className="comment-preview" title={fiche.commentaire_qualite}>
                              {fiche.commentaire_qualite.length > 80
                                ? `${fiche.commentaire_qualite.substring(0, 80)}...`
                                : fiche.commentaire_qualite}
                            </div>
                          ) : (
                            <span className="no-comment">-</span>
                          )}
                        </td>
                        <td>
                          <FicheDetailLink
                            ficheHash={fiche.hash}
                            ficheId={fiche.id}
                            className="btn-detail"
                            title="Voir les détails"
                          >
                            <FaSearch />
                          </FicheDetailLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">Aucune fiche auditée pour cette période</div>
            )}
          </div>
        )}

        {viewMode === 'rdvs' && (
          <div className="fiches-content rdvs-audites-content">
            <div className="tab-filters">
              <div className="filter-item">
                <label htmlFor="id_agent_qualite_confirmation">Agent qualité confirmation :</label>
                <select
                  id="id_agent_qualite_confirmation"
                  value={filters.id_agent_qualite_confirmation}
                  onChange={(e) => handleFilterChange('id_agent_qualite_confirmation', e.target.value)}
                >
                  <option value="">Tous les agents</option>
                  {agentsQualiteConfirmationOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {formatAgentOptionLabel(agent)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="tab-results-count">
                {filteredRdvsAudites.length} RDV(s)
              </span>
            </div>
            <div className="rdvs-kpi-tables">
              <div className="table-responsive">
                <table className="stats-table rdvs-kpi-table">
                  <thead>
                    <tr>
                      <th colSpan={3}>Signature sur RDVs audités</th>
                    </tr>
                    <tr>
                      <th>RDVs audités</th>
                      <th>Signatures</th>
                      <th>Taux de signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num-cell">{auditTotaux?.total_rdvs_audites || 0}</td>
                      <td className="num-cell">{auditTotaux?.signatures || 0}</td>
                      <td className="num-cell">{auditTotaux?.taux_signature || 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="table-responsive">
                <table className="stats-table rdvs-kpi-table">
                  <thead>
                    <tr>
                      <th colSpan={3}>Porte ouverte sur RDVs audités</th>
                    </tr>
                    <tr>
                      <th>RDVs audités</th>
                      <th>Porte ouverte</th>
                      <th>Taux porte ouverte</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num-cell">{auditTotaux?.total_rdvs_audites || 0}</td>
                      <td className="num-cell">{auditTotaux?.porte_ouverte || 0}</td>
                      <td className="num-cell">{auditTotaux?.taux_porte_ouverte || 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {filteredRdvsAudites.length > 0 ? (
              <div className="table-responsive">
                <table className="fiches-table rdvs-audites-table">
                  <thead>
                    <tr>
                      <th>Date RDV</th>
                      <th>Nom / Prénom</th>
                      <th>Téléphone</th>
                      <th>Confirmateur</th>
                      <th>Produit</th>
                      <th>Audité par</th>
                      <th>Observation</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRdvsAudites.map((rdv) => (
                      <tr key={rdv.id}>
                        <td>{formatDateTime(rdv.date_rdv_time)}</td>
                        <td>
                          <div className="name-cell">
                            <span className="nom">{rdv.nom || '-'}</span>
                            <span className="prenom">{rdv.prenom || '-'}</span>
                          </div>
                        </td>
                        <td>{rdv.tel || '-'}</td>
                        <td>{rdv.confirmateur_pseudo || '-'}</td>
                        <td>{rdv.produit_nom || '-'}</td>
                        <td>
                          <div className="agent-cell">
                            <span className="pseudo">{rdv.auditeur?.pseudo || '-'}</span>
                            {(rdv.auditeur?.nom || rdv.auditeur?.prenom) && (
                              <span className="fullname">
                                {rdv.auditeur.nom} {rdv.auditeur.prenom}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="comment-cell">
                          {rdv.observation_qualite ? (
                            <div className="comment-preview" title={rdv.observation_qualite}>
                              {rdv.observation_qualite.length > 80
                                ? `${rdv.observation_qualite.substring(0, 80)}...`
                                : rdv.observation_qualite}
                            </div>
                          ) : (
                            <span className="no-comment">-</span>
                          )}
                        </td>
                        <td>
                          <FicheDetailLink
                            ficheHash={rdv.hash}
                            ficheId={rdv.id}
                            className="btn-detail"
                            title="Voir les détails"
                          >
                            <FaSearch />
                          </FicheDetailLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">Aucun RDV audité sur cette période</div>
            )}
          </div>
        )}
      </section>

      {/* Section 2 — Qualité confirmation (détail complétudes + audit) */}
      {viewMode !== 'kpis' && (
        <section className="page-main-section section-confirmation">
          <div className="section-header">
            <div>
              <h2><FaClipboardCheck /> Qualité confirmation</h2>
            </div>
          </div>

          {auditTotaux && (
            <div className="confirmation-audit-summary">
              <div className="totaux-metric totaux-audit">
                <span className="totaux-value">{auditTotaux.total_rdvs_audites}</span>
                <span className="totaux-label">RDVs audités (période)</span>
              </div>
              <div className="totaux-metric totaux-audit-obs">
                <span className="totaux-value">{auditTotaux.avec_observation}</span>
                <span className="totaux-label">Avec observation qualité</span>
              </div>
            </div>
          )}

          <h3 className="subsection-title">Complétudes par agent</h3>
          {completudesTotaux && (
            <div className="confirmation-totaux confirmation-totaux-compact">
              <div className="totaux-metric">
                <span className="totaux-value">{completudesTotaux.total_completudes}</span>
                <span className="totaux-label">Total complétudes</span>
              </div>
              <div className="totaux-metric totaux-en-attente">
                <span className="totaux-value">{completudesTotaux.en_attente}</span>
                <span className="totaux-label">En attente</span>
              </div>
              <div className="totaux-metric totaux-traitees">
                <span className="totaux-value">{completudesTotaux.traitees}</span>
                <span className="totaux-label">Traitées</span>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table className="stats-table confirmation-table">
              <thead>
                <tr>
                  <th>Agent qualité confirmation</th>
                  <th>Complétudes créées</th>
                  <th>En attente</th>
                  <th>Traitées</th>
                </tr>
              </thead>
              <tbody>
                {filteredConfirmationAgents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="no-data">
                      Aucune complétude créée sur cette période
                    </td>
                  </tr>
                ) : (
                  filteredConfirmationAgents.map((row) => (
                    <tr key={row.agent.id}>
                      <td>
                        <div className="agent-cell-inline">
                          {row.agent.photo ? (
                            <img src={row.agent.photo} alt={row.agent.pseudo} className="agent-avatar-sm" />
                          ) : (
                            <span className="agent-avatar-sm placeholder">
                              {row.agent.pseudo?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          )}
                          <span>
                            <strong>{row.agent.pseudo}</strong>
                            {(row.agent.nom || row.agent.prenom) && (
                              <span className="agent-meta">
                                {' '}
                                — {row.agent.nom} {row.agent.prenom}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="num-cell">{row.stats.total_completudes}</td>
                      <td className="num-cell">{row.stats.en_attente}</td>
                      <td className="num-cell">{row.stats.traitees}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 className="subsection-title">Audit confirmation par agent</h3>
          <div className="table-responsive">
            <table className="stats-table confirmation-table audit-table">
              <thead>
                <tr>
                  <th>Agent qualité confirmation</th>
                  <th>RDVs audités</th>
                  <th>Avec observation</th>
                </tr>
              </thead>
              <tbody>
                {(auditData?.agents || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="no-data">
                      Aucun RDV audité sur cette période
                    </td>
                  </tr>
                ) : (
                  (auditData?.agents || []).map((row) => (
                    <tr key={row.agent.id}>
                      <td>
                        <div className="agent-cell-inline">
                          {row.agent.photo ? (
                            <img src={row.agent.photo} alt={row.agent.pseudo} className="agent-avatar-sm" />
                          ) : (
                            <span className="agent-avatar-sm placeholder">
                              {row.agent.pseudo?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          )}
                          <span>
                            <strong>{row.agent.pseudo}</strong>
                            {(row.agent.nom || row.agent.prenom) && (
                              <span className="agent-meta">
                                {' '}
                                — {row.agent.nom} {row.agent.prenom}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="num-cell">{row.stats.total_rdvs_audites}</td>
                      <td className="num-cell">{row.stats.avec_observation}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default StatsAgentsQualite;
