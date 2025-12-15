import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserTie, FaFileAlt, FaFilter, FaChartBar } from 'react-icons/fa';
import './SuiviAgents.css';

const SuiviAgents = () => {
  const { user } = useAuth();
  
  // Vérifier si l'utilisateur est un RE Qualification (a des agents sous sa responsabilité)
  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite-suivi-agents',
    async () => {
      const res = await api.get('/management/utilisateurs');
      const agents = res.data.data?.filter(u => u.chef_equipe === user?.id && u.fonction === 3) || [];
      return agents;
    },
    { enabled: !!user }
  );

  const isREQualif = agentsSousResponsabilite && agentsSousResponsabilite.length > 0;
  
  // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
  const isRPQualif = user?.fonction === 12;

  // Récupérer les superviseurs assignés au RP Qualification
  const { data: superviseursAssignesRP } = useQuery(
    'superviseurs-assignes-rp',
    async () => {
      const res = await api.get('/management/utilisateurs');
      const utilisateurs = res.data.data || [];
      // Filtrer uniquement les superviseurs assignés au RP (id_rp_qualif = user.id)
      const superviseurs = utilisateurs.filter(u => {
        return u.etat > 0 && u.id_rp_qualif === user?.id && u.fonction !== 3;
      });
      return superviseurs;
    },
    { enabled: isRPQualif && !!user }
  );
  
  // Pour RE Qualification, masquer les filtres et utiliser automatiquement l'ID de l'utilisateur
  const [showFilters, setShowFilters] = useState(!isREQualif);
  const [filters, setFilters] = useState({
    date_debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0],
    id_superviseur: isREQualif ? (user?.id || '') : ''
  });

  // Récupérer la liste des superviseurs (utilisateurs qui ont des agents sous leur supervision)
  // Pour RP Qualification : uniquement les superviseurs assignés
  // Pour les autres (non RE Qualification) : tous les superviseurs
  const { data: superviseursData } = useQuery(
    ['superviseurs-list', isRPQualif],
    async () => {
      const res = await api.get('/management/utilisateurs');
      const utilisateurs = res.data.data || [];
      
      // Pour RP Qualification, filtrer uniquement les superviseurs assignés
      let candidatsSuperviseurs = utilisateurs;
      if (isRPQualif) {
        candidatsSuperviseurs = candidatsSuperviseurs.filter(u => u.id_rp_qualif === user?.id);
      }
      
      // Filtrer les utilisateurs qui ont au moins un agent sous leur supervision
      // Un superviseur est quelqu'un qui a des agents (chef_equipe = son id)
      const superviseurs = candidatsSuperviseurs.filter(u => {
        if (u.etat <= 0 || u.fonction === 3) return false; // Exclure les agents et les inactifs
        
        // Vérifier qu'il y a au moins un agent avec chef_equipe = son id
        const aDesAgents = utilisateurs.some(
          agent => agent.chef_equipe === u.id && agent.fonction === 3 && agent.etat > 0
        );
        return aDesAgents;
      });
      
      return superviseurs;
    },
    { enabled: !isREQualif && (isRPQualif ? !!superviseursAssignesRP : true) }
  );

  // Pour RE Qualification, définir automatiquement l'ID du superviseur quand isREQualif devient true
  useEffect(() => {
    if (isREQualif && user?.id) {
      setFilters(prev => {
        if (prev.id_superviseur !== user.id) {
          return { ...prev, id_superviseur: user.id };
        }
        return prev;
      });
      setShowFilters(false);
    }
  }, [isREQualif, user?.id]);

  // Sélectionner automatiquement le premier superviseur si il n'y en a qu'un pour un RP
  useEffect(() => {
    if (isRPQualif && superviseursData && superviseursData.length === 1 && !filters.id_superviseur) {
      setFilters(prev => ({ ...prev, id_superviseur: superviseursData[0].id }));
    }
  }, [isRPQualif, superviseursData, filters.id_superviseur]);

  // Récupérer les statistiques des agents pour le superviseur sélectionné
  const { data: statsData, isLoading: loadingStats } = useQuery(
    ['superviseur-stats', filters.id_superviseur, filters.date_debut, filters.date_fin],
    async () => {
      if (!filters.id_superviseur) return null;
      const params = {};
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      
      const res = await api.get(`/statistiques/superviseur/${filters.id_superviseur}`, { params });
      return res.data.data;
    },
    { enabled: !!filters.id_superviseur }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const superviseurs = superviseursData || [];
  const stats = statsData || { superviseur: null, agents: [], period: {} };

  return (
    <div className="suivi-agents">
      <div className="suivi-header">
        <h1><FaUserTie /> Suivi des Agents</h1>
        {/* Masquer le bouton de filtres pour RE Qualification */}
        {!isREQualif && (
          <button 
            className="filter-toggle-btn" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
        )}
      </div>

      {/* Masquer les filtres pour RE Qualification, mais les afficher pour RP Qualification */}
      {showFilters && !isREQualif && (
        <div className="suivi-filters">
          <div className="filter-group">
            <label>Superviseur</label>
            <select
              value={filters.id_superviseur}
              onChange={(e) => handleFilterChange('id_superviseur', e.target.value)}
            >
              <option value="">Sélectionner un superviseur</option>
              {superviseurs.map(superviseur => (
                <option key={superviseur.id} value={superviseur.id}>
                  {superviseur.pseudo} ({superviseur.fonction_titre || '-'})
                </option>
              ))}
            </select>
          </div>
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
        </div>
      )}

      <div className="suivi-content">
        {!filters.id_superviseur ? (
          <div className="no-selection">
            <p>Veuillez sélectionner un superviseur pour afficher les statistiques de ses agents.</p>
          </div>
        ) : loadingStats ? (
          <div className="loading">Chargement des données...</div>
        ) : stats.agents && stats.agents.length > 0 ? (
          <>
            {stats.superviseur && (
              <div className="superviseur-info">
                <h2>Superviseur : {stats.superviseur.pseudo}</h2>
                {stats.period && (
                  <p className="period-info">
                    Période : {stats.period.date_debut} au {stats.period.date_fin}
                  </p>
                )}
              </div>
            )}

            <div className="agents-grid">
              {stats.agents.map((agentStat, index) => (
                <div key={agentStat.agent.id || index} className="agent-card">
                  <div className="agent-card-header">
                    <div className="agent-avatar-section">
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
                      <div className="agent-info">
                        <h3>{agentStat.agent.pseudo || 'N/A'}</h3>
                        <p className="agent-centre">{agentStat.agent.centre_nom || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="agent-stats">
                    <div className="stat-row">
                      <div className="stat-item">
                        <FaFileAlt className="stat-icon" />
                        <div className="stat-content">
                          <div className="stat-value">{agentStat.statistiques.total || 0}</div>
                          <div className="stat-label">Total fiches</div>
                        </div>
                      </div>
                      <div className="stat-item">
                        <FaChartBar className="stat-icon" />
                        <div className="stat-content">
                          <div className="stat-value">{agentStat.statistiques.aujourdhui || 0}</div>
                          <div className="stat-label">Aujourd'hui</div>
                        </div>
                      </div>
                    </div>

                    <div className="stat-row">
                      <div className="stat-item">
                        <div className="stat-content">
                          <div className="stat-value">{agentStat.statistiques.cette_semaine || 0}</div>
                          <div className="stat-label">Cette semaine</div>
                        </div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-content">
                          <div className="stat-value">{agentStat.statistiques.ce_mois || 0}</div>
                          <div className="stat-label">Ce mois</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Détails par état */}
                  {agentStat.statistiques.par_etat && agentStat.statistiques.par_etat.length > 0 && (
                    <div className="etats-section">
                      <h4>Fiches par état (Groupe 0)</h4>
                      <div className="etats-list">
                        {agentStat.statistiques.par_etat.map((etat, idx) => (
                          <div key={idx} className="etat-item">
                            <span 
                              className="etat-badge"
                              style={{ backgroundColor: etat.etat_color || '#cccccc' }}
                            >
                              {etat.etat_abbreviation || etat.etat_titre}
                            </span>
                            <span className="etat-count">{etat.count || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Résumé global */}
            <div className="summary-section">
              <h3>Résumé global</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-value">
                    {stats.agents.reduce((sum, a) => sum + (a.statistiques.total || 0), 0)}
                  </div>
                  <div className="summary-label">Total fiches créées</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">
                    {stats.agents.reduce((sum, a) => sum + (a.statistiques.aujourdhui || 0), 0)}
                  </div>
                  <div className="summary-label">Fiches aujourd'hui</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">
                    {stats.agents.reduce((sum, a) => sum + (a.statistiques.ce_mois || 0), 0)}
                  </div>
                  <div className="summary-label">Fiches ce mois</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{stats.agents.length}</div>
                  <div className="summary-label">Agents sous supervision</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="no-data">
            {stats.superviseur ? (
              <p>Aucun agent assigné à ce superviseur.</p>
            ) : (
              <p>Aucune donnée disponible pour cette période.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviAgents;

