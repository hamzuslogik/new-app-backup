import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserCheck, FaFilter, FaSearch, FaFileExcel, FaFileCsv, FaFilePdf, FaChartBar, FaList, FaChevronDown, FaChevronUp, FaChartPie } from 'react-icons/fa';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import FicheDetailLink from '../components/FicheDetailLink';
import './StatsAgentsQualite.css';

const CHART_COLORS = ['#9cbfc8', '#4a7a87', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c'];

const StatsAgentsQualite = () => {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('stats'); // 'stats', 'fiches' ou 'kpis'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAgents, setExpandedAgents] = useState({});

  // États pour les filtres
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getFirstOfMonth = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    date_debut: getFirstOfMonth(),
    date_fin: getTodayDate(),
    id_agent_qualite: ''
  });

  // Récupérer les agents qualité (ceux qui ont fait des audits)
  const { data: agentsQualiteData } = useQuery('agents-qualite-list', async () => {
    const res = await api.get('/statistiques/agents-qualite', {
      params: {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin
      }
    });
    return res.data.data?.agents || [];
  });

  // Récupérer les statistiques avec filtres
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
    {
      enabled: !!filters.date_debut && !!filters.date_fin && viewMode !== 'kpis'
    }
  );

  // KPIs (alertes KO, remarques)
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

  // Filtrer les agents par recherche
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

  // Toggle expansion d'un agent
  const toggleExpand = (agentId) => {
    setExpandedAgents(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  };

  // Fonctions d'export
  const handleExportCSV = () => {
    if (!statsData?.agents || statsData.agents.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const columns = [
      { key: 'agent_pseudo', label: 'Agent' },
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

    exportToCSV(exportData, columns, `stats-agents-qualite-${filters.date_debut}-${filters.date_fin}`);
  };

  const handleExportExcel = () => {
    if (!statsData?.agents || statsData.agents.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const columns = [
      { key: 'agent_pseudo', label: 'Agent' },
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

    exportToExcel(exportData, columns, `stats-agents-qualite-${filters.date_debut}-${filters.date_fin}`);
  };

  const handleExportPDF = () => {
    if (!statsData?.agents || statsData.agents.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const columns = [
      { key: 'agent_pseudo', label: 'Agent' },
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

    exportToPDF(exportData, columns, `stats-agents-qualite-${filters.date_debut}-${filters.date_fin}`, 'Statistiques par Agent Qualité');
  };

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

  return (
    <div className="stats-agents-qualite-page">
      <div className="page-header">
        <h1><FaUserCheck /> Statistiques par Agent Qualité</h1>
        <div className="header-actions">
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
            <FaList /> Fiches Auditées
          </button>
          <button
            className={`mode-btn ${viewMode === 'kpis' ? 'active' : ''}`}
            onClick={() => setViewMode('kpis')}
          >
            <FaChartPie /> KPIs
          </button>
          <div className="export-buttons">
            <button onClick={handleExportCSV} className="btn-export" title="Exporter en CSV">
              <FaFileCsv />
            </button>
            <button onClick={handleExportExcel} className="btn-export" title="Exporter en Excel">
              <FaFileExcel />
            </button>
            <button onClick={handleExportPDF} className="btn-export" title="Exporter en PDF">
              <FaFilePdf />
            </button>
          </div>
        </div>
      </div>

      {/* Filtres */}
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
            <div className="filter-item">
              <label htmlFor="id_agent_qualite">Agent Qualité :</label>
              <select
                id="id_agent_qualite"
                value={filters.id_agent_qualite}
                onChange={(e) => handleFilterChange('id_agent_qualite', e.target.value)}
              >
                <option value="">Tous les agents</option>
                {agentsQualiteData?.map(agentStat => (
                  <option key={agentStat.agent.id} value={agentStat.agent.id}>
                    {agentStat.agent.pseudo} {agentStat.agent.nom && agentStat.agent.prenom ? `(${agentStat.agent.nom} ${agentStat.agent.prenom})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Recherche rapide */}
      <div className="search-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher un agent (nom, prénom, pseudo, fonction, centre)..."
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

      {/* Contenu */}
      {viewMode === 'stats' ? (
        <div className="stats-content">
          {statsData?.period && (
            <div className="period-info">
              Période : <strong>{statsData.period.date_debut}</strong> au <strong>{statsData.period.date_fin}</strong>
            </div>
          )}

          {filteredAgents && filteredAgents.length > 0 ? (
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
                        <div className="stat-label">Total Audits</div>
                      </div>
                      <div className="stat-metric">
                        <div className="stat-value">{agentStat.stats.fiches_avec_commentaire}</div>
                        <div className="stat-label">Avec Commentaire</div>
                      </div>
                    </div>

                    {expandedAgents[agentStat.agent.id] && (
                      <div className="stats-details">
                        <h4>Répartition par État</h4>
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
            <div className="no-data">Aucun agent qualité trouvé pour cette période</div>
          )}
        </div>
      ) : (
        <div className="fiches-content">
          {statsData?.period && (
            <div className="period-info">
              Période : <strong>{statsData.period.date_debut}</strong> au <strong>{statsData.period.date_fin}</strong>
            </div>
          )}

          {filteredAgents && filteredAgents.length > 0 ? (
            <div className="fiches-by-agent">
              {filteredAgents.map((agentStat) => (
                <div key={agentStat.agent.id} className="agent-fiches-section">
                  <div className="agent-section-header">
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
                      <div>
                        <h3>{agentStat.agent.pseudo}</h3>
                        <p className="agent-meta">
                          {agentStat.agent.nom && agentStat.agent.prenom 
                            ? `${agentStat.agent.nom} ${agentStat.agent.prenom}`
                            : ''} - {agentStat.stats.total_audits} audit{agentStat.stats.total_audits > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {agentStat.fiches_auditees && agentStat.fiches_auditees.length > 0 ? (
                    <table className="fiches-table">
                      <thead>
                        <tr>
                          <th>Date Audit</th>
                          <th>Nom / Prénom</th>
                          <th>Téléphone</th>
                          <th>CP / Ville</th>
                          <th>Agent Créateur</th>
                          <th>Centre</th>
                          <th>État</th>
                          <th>KO/HC</th>
                          <th>Commentaire Qualité</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentStat.fiches_auditees.map((fiche) => (
                          <tr key={fiche.id} className={`${fiche.ko ? 'row-ko' : ''} ${fiche.hc ? 'row-hc' : ''}`}>
                            <td>
                              {fiche.date_audit 
                                ? new Date(fiche.date_audit).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '-'}
                            </td>
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
                                <span className="pseudo">{fiche.agent_pseudo || '-'}</span>
                                {(fiche.agent_nom || fiche.agent_prenom) && (
                                  <span className="fullname">{fiche.agent_nom} {fiche.agent_prenom}</span>
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
                  ) : (
                    <div className="no-fiches">Aucune fiche auditée pour cet agent</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Aucun agent qualité trouvé pour cette période</div>
          )}
        </div>
      )}

      {/* Onglet KPIs */}
      {viewMode === 'kpis' && (
        <div className="kpis-content">
          {kpisLoading ? (
            <div className="loading">Chargement des KPIs...</div>
          ) : (
            <>
              {kpisData?.period && (
                <div className="period-info">
                  Période : <strong>{kpisData.period.date_debut}</strong> au <strong>{kpisData.period.date_fin}</strong>
                </div>
              )}

              {/* Tableau qualité qualification : alertes et remarques envoyées */}
              <section className="kpis-section">
                <h3>Qualité qualification – Alertes et remarques envoyées</h3>
                <div className="table-responsive">
                  <table className="stats-table kpis-table">
                    <thead>
                      <tr>
                        <th>Qualité</th>
                        <th>Alertes envoyées</th>
                        <th>Remarques envoyées</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kpisData?.qualite_qualification || []).length === 0 ? (
                        <tr><td colSpan={3} className="no-data">Aucune donnée</td></tr>
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

              {/* Camembert : RE qualification – alertes reçues par leurs agents */}
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
                          label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                        >
                          {(kpisData.re_alertes_pie || []).map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${value} alertes (${((props?.payload?.percent ?? 0) * 100).toFixed(1)}%)`, name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              {/* Graphique en barres : RE qualification – remarques reçues */}
              <section className="kpis-section">
                <h3>Remarques reçues par RE qualification (nombre et %)</h3>
                <div className="kpis-chart-wrap">
                  {(kpisData?.re_remarques_bar || []).length === 0 ? (
                    <div className="no-data">Aucune remarque sur la période</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={kpisData.re_remarques_bar} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip formatter={(value, name, props) => [`${value} (${props.payload.percent}%)`, name]} />
                        <Legend />
                        <Bar dataKey="value" name="Remarques" fill="#4a7a87" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              {/* Tableau agents qualification : remarques et alertes KO reçues */}
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
                        <tr><td colSpan={3} className="no-data">Aucun agent</td></tr>
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
    </div>
  );
};

export default StatsAgentsQualite;

