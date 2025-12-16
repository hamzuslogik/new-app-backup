import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserTie, FaFilter, FaSearch } from 'react-icons/fa';
import './SuiviAgentsQualif.css';

const SuiviAgentsQualif = () => {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Vérifier si l'utilisateur est un RE Qualification (a des agents sous sa responsabilité)
  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite',
    async () => {
      const res = await api.get('/management/utilisateurs');
      const agents = res.data.data?.filter(u => u.chef_equipe === user?.id && u.fonction === 3) || [];
      return agents;
    },
    { enabled: !!user }
  );

  const isREQualif = agentsSousResponsabilite && agentsSousResponsabilite.length > 0;
  
  // Pour Superviseur Qualification (RE Qualification), le mode par défaut est 'fiches' selon les exigences
  const [viewMode, setViewMode] = useState('stats'); // 'stats' ou 'fiches'
  
  // Forcer le mode 'fiches' pour RE Qualification selon les exigences
  useEffect(() => {
    if (isREQualif && viewMode !== 'fiches') {
      setViewMode('fiches');
    }
  }, [isREQualif]);

  // États pour les filtres
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    date_debut: getTodayDate(), // Aujourd'hui par défaut pour RE Qualification
    date_fin: getTodayDate(), // Aujourd'hui par défaut
    id_agent: '',
    id_rp: '' // Nouveau filtre par RP
  });

  // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
  const isRPQualif = user?.fonction === 12;
  
  // Vérifier si l'utilisateur est un Administrateur (fonction 1)
  const isAdmin = user?.fonction === 1;

  // Récupérer les superviseurs assignés au RP Qualification (pour filtrer leurs agents)
  const { data: superviseursAssignesRP } = useQuery(
    'superviseurs-assignes-rp',
    async () => {
      const res = await api.get('/management/utilisateurs');
      // Récupérer les superviseurs qui ont id_rp_qualif = user.id
      const superviseurs = res.data.data?.filter(u => u.id_rp_qualif === user?.id && u.etat > 0) || [];
      return superviseurs;
    },
    { enabled: isRPQualif && !!user }
  );

  // Récupérer tous les RP Qualifications (pour le filtre RP si administrateur)
  const { data: rpsData } = useQuery(
    'rps-qualif-list',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter(u => u.fonction === 12 && u.etat > 0) || [];
    },
    { enabled: isAdmin }
  );

  // Récupérer les superviseurs assignés à un RP spécifique (pour le filtre RP)
  const { data: superviseursDuRP } = useQuery(
    ['superviseurs-du-rp', filters.id_rp],
    async () => {
      if (!filters.id_rp) return [];
      const res = await api.get('/management/utilisateurs');
      // Récupérer les superviseurs qui ont id_rp_qualif = filters.id_rp
      return res.data.data?.filter(u => u.id_rp_qualif === parseInt(filters.id_rp) && u.etat > 0) || [];
    },
    { enabled: isAdmin && !!filters.id_rp }
  );

  // Récupérer les agents qualification (filtrés par responsabilité si RE Qualification ou RP Qualification)
  const { data: agentsData } = useQuery(
    ['agents-qualif-list', isREQualif, isRPQualif, isAdmin, user?.id, superviseursAssignesRP, filters.id_rp, superviseursDuRP],
    async () => {
      const res = await api.get('/management/utilisateurs');
      let agents = res.data.data?.filter(u => u.fonction === 3 && u.etat > 0) || [];
      
      // Si Administrateur avec filtre RP sélectionné, filtrer par les superviseurs de ce RP
      if (isAdmin && filters.id_rp && superviseursDuRP && superviseursDuRP.length > 0) {
        const superviseurIds = superviseursDuRP.map(s => s.id);
        agents = agents.filter(a => superviseurIds.includes(a.chef_equipe));
      }
      // Si RE Qualification, filtrer uniquement ses agents (ceux qui ont chef_equipe = user.id)
      else if (isREQualif && user?.id) {
        agents = agents.filter(a => a.chef_equipe === user.id);
      }
      // Si RP Qualification, filtrer uniquement les agents des superviseurs assignés
      else if (isRPQualif) {
        // Si les superviseurs ne sont pas encore chargés, retourner un tableau vide temporairement
        if (!superviseursAssignesRP) {
          return [];
        }
        // Si aucun superviseur n'est assigné, retourner un tableau vide
        if (superviseursAssignesRP.length === 0) {
          return [];
        }
        // Filtrer les agents dont le chef_equipe correspond à l'un des superviseurs assignés
        const superviseurIds = superviseursAssignesRP.map(s => s.id);
        agents = agents.filter(a => superviseurIds.includes(a.chef_equipe));
      }
      // Pour les administrateurs sans filtre RP, afficher tous les agents
      // Pour les autres utilisateurs (non RE, non RP, non Admin), afficher tous les agents
      
      return agents;
    },
    { 
      // Pour RP Qualification, attendre que les superviseurs soient chargés
      // Pour Admin avec filtre RP, attendre que les superviseurs du RP soient chargés
      enabled: (!isRPQualif || (isRPQualif && superviseursAssignesRP !== undefined)) && 
               (!(isAdmin && filters.id_rp) || (isAdmin && filters.id_rp && superviseursDuRP !== undefined)),
      // Invalider quand les données de responsabilité changent
      refetchOnMount: true
    }
  );

  // Récupérer les centres
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  // Récupérer les statistiques
  const { data: statsData, isLoading: loadingStats } = useQuery(
    ['agents-qualif-stats', filters],
    async () => {
      const params = {};
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      if (filters.id_agent) params.id_agent = filters.id_agent;
      if (isAdmin && filters.id_rp) params.id_rp = filters.id_rp;
      
      const res = await api.get('/statistiques/agents-qualif', { params });
      return res.data.data;
    },
    { enabled: viewMode === 'stats' }
  );

  // Récupérer les fiches créées aujourd'hui par les agents sous responsabilité
  const { data: fichesData, isLoading: loadingFiches } = useQuery(
    ['fiches-agents-sous-responsabilite', filters],
    async () => {
      const params = {
        page: 1,
        limit: 1000
      };
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      if (filters.id_agent) params.id_agent = filters.id_agent;
      
      const res = await api.get('/fiches/agents-sous-responsabilite', { params });
      return res.data;
    },
    { enabled: viewMode === 'fiches' && isREQualif }
  );

  // Filtrer les fiches par recherche rapide
  const filteredFiches = useMemo(() => {
    if (!fichesData?.data || !searchTerm) return fichesData?.data || [];
    
    const term = searchTerm.toLowerCase();
    return fichesData.data.filter(fiche => {
      return (
        (fiche.nom && fiche.nom.toLowerCase().includes(term)) ||
        (fiche.prenom && fiche.prenom.toLowerCase().includes(term)) ||
        (fiche.tel && fiche.tel.includes(term)) ||
        (fiche.cp && fiche.cp.includes(term)) ||
        (fiche.agent_pseudo && fiche.agent_pseudo.toLowerCase().includes(term)) ||
        (fiche.etat_titre && fiche.etat_titre.toLowerCase().includes(term))
      );
    });
  }, [fichesData, searchTerm]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const agents = agentsData || [];
  const stats = statsData || { agents: [], etats: [], period: {} };
  const fiches = filteredFiches || [];

  return (
    <div className="suivi-agents-qualif">
      <div className="suivi-header">
        <h1><FaUserTie /> Suivi Agents Qualification</h1>
        <div className="header-actions">
          {isREQualif && (
            <div className="view-mode-toggle">
              <button
                className={viewMode === 'stats' ? 'active' : ''}
                onClick={() => setViewMode('stats')}
              >
                Statistiques
              </button>
              <button
                className={viewMode === 'fiches' ? 'active' : ''}
                onClick={() => setViewMode('fiches')}
              >
                Fiches
              </button>
            </div>
          )}
          <button 
            className="filter-toggle-btn noprint" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="suivi-filters">
          <div className="filter-group">
            <label>Date début</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => handleFilterChange('date_debut', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Date fin</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => handleFilterChange('date_fin', e.target.value)}
            />
          </div>
          {isAdmin && (
            <div className="filter-group">
              <label>RP Qualification</label>
              <select
                value={filters.id_rp}
                onChange={(e) => {
                  handleFilterChange('id_rp', e.target.value);
                  // Réinitialiser le filtre agent quand on change le RP
                  handleFilterChange('id_agent', '');
                }}
              >
                <option value="">Tous les RP</option>
                {rpsData && rpsData.map(rp => (
                  <option key={rp.id} value={rp.id}>{rp.pseudo}</option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label>Agent</label>
            <select
              value={filters.id_agent}
              onChange={(e) => handleFilterChange('id_agent', e.target.value)}
            >
              <option value="">Tous les agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Recherche rapide pour les fiches */}
      {isREQualif && viewMode === 'fiches' && (
        <div className="quick-search-container">
          <FaSearch />
          <input
            type="text"
            placeholder="Recherche rapide (nom, prénom, téléphone, code postal, agent, état)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="quick-search-input"
          />
        </div>
      )}

      <div className="suivi-content">
        {viewMode === 'fiches' && isREQualif ? (
          // Vue fiches pour RE Qualification
          loadingFiches ? (
            <div className="loading">Chargement des fiches...</div>
          ) : fiches.length > 0 ? (
            <div className="fiches-table-container">
              <div className="results-info">
                {searchTerm ? (
                  <p>{fiches.length} fiche{fiches.length > 1 ? 's' : ''} trouvée{fiches.length > 1 ? 's' : ''} (sur {fichesData?.pagination?.total || 0})</p>
                ) : (
                  <p>Total: {fichesData?.pagination?.total || 0} fiche{fichesData?.pagination?.total > 1 ? 's' : ''}</p>
                )}
              </div>
              <table className="fiches-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date création</th>
                    <th>Agent</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map(fiche => (
                    <tr key={fiche.id}>
                      <td>{fiche.id}</td>
                      <td>{fiche.date_insert_time ? new Date(fiche.date_insert_time).toLocaleDateString('fr-FR') : '-'}</td>
                      <td>{fiche.agent_pseudo || '-'}</td>
                      <td>{fiche.nom || '-'}</td>
                      <td>{fiche.prenom || '-'}</td>
                      <td>{fiche.tel || '-'}</td>
                      <td>{fiche.cp || '-'}</td>
                      <td>
                        <span 
                          className="etat-badge"
                          style={{ backgroundColor: (fiche.etat_groupe === '0' || fiche.etat_groupe === 0) ? (fiche.etat_color || '#ccc') : '#4CAF50' }}
                        >
                          {(fiche.etat_groupe === '0' || fiche.etat_groupe === 0) ? (fiche.etat_titre || '-') : 'Validé'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data">Aucune fiche trouvée pour cette période</div>
          )
        ) : loadingStats ? (
          <div className="loading">Chargement des données...</div>
        ) : stats.agents && stats.agents.length > 0 ? (
          <>
            {stats.period && (
              <div className="period-info">
                Période : {stats.period.date_debut} au {stats.period.date_fin}
              </div>
            )}
            <div className="table-container">
              <table className="suivi-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Agent</th>
                    {stats.etats && stats.etats.length > 0 && stats.etats.map(etat => (
                      <th key={etat.id} title={etat.titre}>
                        {etat.abbreviation || etat.titre}
                      </th>
                    ))}
                    <th rowSpan="2">Validé</th>
                    <th rowSpan="2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.agents.map((agentStat, index) => (
                    <tr key={agentStat.agent.id || index}>
                      <td>
                        <div className="agent-cell">
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
                          <span className="agent-name">{agentStat.agent.pseudo || 'N/A'}</span>
                        </div>
                      </td>
                      {stats.etats && stats.etats.map(etat => {
                        const stat = agentStat.stats.find(s => s.id === etat.id);
                        const count = stat?.count || 0;
                        return (
                          <td 
                            key={etat.id}
                            style={{ 
                              backgroundColor: count > 0 ? `${etat.color}20` : 'transparent',
                              color: count > 0 ? '#333' : '#999'
                            }}
                          >
                            {count}
                          </td>
                        );
                      })}
                      <td 
                        className="validated-cell"
                        style={{ 
                          backgroundColor: (agentStat.validated || 0) > 0 ? '#4CAF5020' : 'transparent',
                          color: (agentStat.validated || 0) > 0 ? '#333' : '#999'
                        }}
                      >
                        {agentStat.validated || 0}
                      </td>
                      <td className="total-cell">
                        <strong>{agentStat.total || 0}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td><strong>Totaux</strong></td>
                    {stats.etats && stats.etats.map(etat => {
                      const total = stats.agents.reduce((sum, agentStat) => {
                        const stat = agentStat.stats.find(s => s.id === etat.id);
                        return sum + (stat?.count || 0);
                      }, 0);
                      return (
                        <td key={etat.id} className="total-cell">
                          <strong>{total}</strong>
                        </td>
                      );
                    })}
                    <td className="total-cell">
                      <strong>
                        {stats.agents.reduce((sum, agentStat) => sum + (agentStat.validated || 0), 0)}
                      </strong>
                    </td>
                    <td className="total-cell">
                      <strong>
                        {stats.agents.reduce((sum, agentStat) => sum + (agentStat.total || 0), 0)}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <div className="no-data">Aucune donnée disponible pour cette période</div>
        )}
      </div>
    </div>
  );
};

export default SuiviAgentsQualif;

