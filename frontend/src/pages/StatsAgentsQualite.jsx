import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaUserCheck, FaFilter, FaSearch, FaFileExcel, FaFileCsv, FaFilePdf, FaChartBar, FaList, FaChevronDown, FaChevronUp, FaClipboardCheck } from 'react-icons/fa';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import FicheDetailLink from '../components/FicheDetailLink';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './StatsAgentsQualite.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const StatsAgentsQualite = () => {
  useForceDesktopViewport('stats-agents-qualite-page');
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('stats');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAgents, setExpandedAgents] = useState({});

  const [filters, setFilters] = useState({
    date_debut: getFirstOfMonthLocal(),
    date_fin: getTodayLocal(),
    id_agent_qualite: ''
  });

  const { data: agentsQualiteData } = useQuery(
    ['agents-qualite-list', filters.date_debut, filters.date_fin],
    async () => {
      const res = await api.get('/statistiques/agents-qualite', {
        params: {
          date_debut: filters.date_debut,
          date_fin: filters.date_fin
        }
      });
      return res.data.data?.agents || [];
    },
    { enabled: !!filters.date_debut && !!filters.date_fin }
  );

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
    { enabled: !!filters.date_debut && !!filters.date_fin }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

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
    const agents = statsData?.qualite_confirmation?.agents || [];
    if (!searchTerm.trim()) return agents;
    const term = searchTerm.toLowerCase();
    return agents.filter(row =>
      row.agent.pseudo?.toLowerCase().includes(term) ||
      row.agent.nom?.toLowerCase().includes(term) ||
      row.agent.prenom?.toLowerCase().includes(term)
    );
  }, [statsData, searchTerm]);

  const toggleExpand = (agentId) => {
    setExpandedAgents(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
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

  const confirmationTotaux = statsData?.qualite_confirmation?.totaux;

  if (isLoading) {
    return (
      <div className="stats-agents-qualite-page">
        <div className="loading">Chargement des statistiques...</div>
      </div>
    );
  }

  if (error) {
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

      <div className="search-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher un agent qualité..."
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

      {statsData?.period && (
        <div className="period-info">
          Période : <strong>{statsData.period.date_debut}</strong> au <strong>{statsData.period.date_fin}</strong>
        </div>
      )}

      {/* Section 1 — Qualité qualification */}
      <section className="page-main-section section-qualification">
        <div className="section-header">
          <div>
            <h2>Qualité qualification</h2>
            <p className="section-subtitle">
              Fiches auditées insérées par des agents qualification (fonction 3), sur la période (date d&apos;insertion).
            </p>
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
              <FaList /> Fiches auditées
            </button>
          </div>
        </div>

        {viewMode === 'stats' ? (
          <div className="stats-content">
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
          </div>
        ) : (
          <div className="fiches-content">
            {filteredAgents.length > 0 ? (
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
                              : ''}{' '}
                            — {agentStat.stats.total_audits} fiche{agentStat.stats.total_audits > 1 ? 's' : ''} auditée{agentStat.stats.total_audits > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {agentStat.fiches_auditees?.length > 0 ? (
                      <table className="fiches-table">
                        <thead>
                          <tr>
                            <th>Date audit</th>
                            <th>Nom / Prénom</th>
                            <th>Téléphone</th>
                            <th>CP / Ville</th>
                            <th>Agent qualification</th>
                            <th>Centre</th>
                            <th>État</th>
                            <th>KO/HC</th>
                            <th>Commentaire qualité</th>
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
              <div className="no-data">Aucune fiche auditée (agents qualification) pour cette période</div>
            )}
          </div>
        )}
      </section>

      {/* Section 2 — Qualité confirmation (complétudes) */}
      <section className="page-main-section section-confirmation">
        <div className="section-header">
          <div>
            <h2><FaClipboardCheck /> Qualité confirmation</h2>
            <p className="section-subtitle">
              Complétudes créées par les agents qualité confirmation (fonction 4), sur la période (date de création).
            </p>
          </div>
        </div>

        {confirmationTotaux && (
          <div className="confirmation-totaux">
            <div className="totaux-metric">
              <span className="totaux-value">{confirmationTotaux.total_completudes}</span>
              <span className="totaux-label">Total complétudes</span>
            </div>
            <div className="totaux-metric totaux-en-attente">
              <span className="totaux-value">{confirmationTotaux.en_attente}</span>
              <span className="totaux-label">En attente</span>
            </div>
            <div className="totaux-metric totaux-traitees">
              <span className="totaux-value">{confirmationTotaux.traitees}</span>
              <span className="totaux-label">Traitées</span>
            </div>
            <div className="totaux-metric totaux-non-traitees">
              <span className="totaux-value">{confirmationTotaux.non_traitees}</span>
              <span className="totaux-label">Non traitées</span>
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
                <th>Non traitées</th>
              </tr>
            </thead>
            <tbody>
              {filteredConfirmationAgents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-data">Aucune complétude créée sur cette période</td>
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
                    <td className="num-cell">{row.stats.non_traitees}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default StatsAgentsQualite;
