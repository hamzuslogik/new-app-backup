import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { FaChartBar, FaFilter, FaPrint, FaList, FaSearch, FaFileAlt } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import './ProductionQualif.css';

const ProductionQualif = () => {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('stats'); // 'stats' ou 'fiches'
  const [searchTerm, setSearchTerm] = useState('');

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
    id_superviseur: '',
    id_etat_final: ''
  });

  // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
  const isRPQualif = user?.fonction === 12;

  // Récupérer les superviseurs assignés au RP Qualification
  const { data: superviseursData } = useQuery(
    'superviseurs-assignes-rp-production',
    async () => {
      const res = await api.get('/management/utilisateurs');
      if (isRPQualif) {
        // Pour RP Qualification : seulement les superviseurs assignés
        return res.data.data?.filter(u => u.id_rp_qualif === user?.id && u.etat > 0) || [];
      } else {
        // Pour les autres : tous les superviseurs (utilisateurs avec agents)
        return res.data.data?.filter(u => {
          // Un superviseur est quelqu'un qui a des agents sous sa responsabilité
          const hasAgents = res.data.data?.some(agent => 
            agent.chef_equipe === u.id && agent.fonction === 3 && agent.etat > 0
          );
          return hasAgents && u.etat > 0 && u.fonction !== 3;
        }) || [];
      }
    },
    { enabled: !!user }
  );

  // Récupérer les états - uniquement groupe 0 + Validé pour RP Qualification
  const { data: etatsData } = useQuery('etats-production-qualif', async () => {
    const res = await api.get('/management/etats');
    let etats = res.data.data || [];
    
    // Pour RP Qualification, filtrer uniquement les états groupe 0
    if (isRPQualif) {
      etats = etats.filter(e => e.groupe === '0' || e.groupe === 0);
    }
    
    return etats;
  });

  // Récupérer les statistiques de production
  const { data: statsData, isLoading: loadingStats } = useQuery(
    ['production-qualif', filters],
    async () => {
      const params = {};
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      if (filters.id_superviseur) params.id_superviseur = filters.id_superviseur;
      if (filters.id_etat_final) params.id_etat_final = filters.id_etat_final;
      
      const res = await api.get('/statistiques/production-qualif', { params });
      return res.data.data;
    },
    { enabled: viewMode === 'stats' }
  );

  // Récupérer les agents pour le filtre (si nécessaire)
  const { data: agentsData } = useQuery(
    'agents-production-qualif',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter(u => u.fonction === 3 && u.etat > 0) || [];
    },
    { enabled: viewMode === 'fiches' && !!user }
  );

  // Récupérer les fiches créées par les agents des superviseurs assignés au RP
  // La route /fiches/agents-sous-responsabilite gère déjà le filtrage pour les RP Qualification
  const { data: fichesData, isLoading: loadingFiches, error: fichesError } = useQuery(
    ['fiches-production-qualif', filters, viewMode],
    async () => {
      const params = {
        page: 1,
        limit: 1000
      };
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      // La route backend gère déjà le filtrage par superviseur pour les RP
      // On peut passer id_agent si on veut filtrer par un agent spécifique
      if (filters.id_etat_final && filters.id_etat_final !== 'validated') {
        params.id_etat_final = filters.id_etat_final;
      }
      
      try {
        const res = await api.get('/fiches/agents-sous-responsabilite', { params });
        console.log('Réponse fiches:', res.data);
        return res.data;
      } catch (error) {
        console.error('Erreur lors de la récupération des fiches:', error);
        throw error;
      }
    },
    { 
      enabled: viewMode === 'fiches' && isRPQualif,
      retry: 1
    }
  );

  // Filtrer les fiches par recherche rapide et par superviseur
  const filteredFiches = useMemo(() => {
    if (!fichesData?.data) return [];
    
    let filtered = fichesData.data;
    
    // Filtrer par superviseur si sélectionné
    if (filters.id_superviseur && agentsData) {
      const agentsSuperviseur = agentsData.filter(a => 
        a.chef_equipe === parseInt(filters.id_superviseur)
      );
      const agentIds = agentsSuperviseur.map(a => a.id);
      filtered = filtered.filter(fiche => agentIds.includes(fiche.id_agent));
    }
    
    // Filtrer par état "Validé" si sélectionné
    if (filters.id_etat_final === 'validated' && etatsData) {
      const etatsGroupe0Ids = etatsData
        .filter(e => e.groupe === '0' || e.groupe === 0)
        .map(e => e.id);
      filtered = filtered.filter(fiche => !etatsGroupe0Ids.includes(fiche.id_etat_final));
    }
    
    // Filtrer par recherche rapide
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(fiche => {
        return (
          (fiche.nom && fiche.nom.toLowerCase().includes(term)) ||
          (fiche.prenom && fiche.prenom.toLowerCase().includes(term)) ||
          (fiche.tel && fiche.tel.includes(term)) ||
          (fiche.cp && fiche.cp.includes(term)) ||
          (fiche.agent_pseudo && fiche.agent_pseudo.toLowerCase().includes(term)) ||
          (fiche.etat_titre && fiche.etat_titre.toLowerCase().includes(term))
        );
      });
    }
    
    return filtered;
  }, [fichesData, searchTerm, filters.id_superviseur, filters.id_etat_final, agentsData, etatsData]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const superviseurs = superviseursData || [];
  const etats = etatsData || [];
  const stats = statsData || { superviseurs: [], etats: [], period: {} };
  const fiches = filteredFiches || [];

  return (
    <div className="production-qualif">
      <div className="production-header">
        <h1><FaChartBar /> Production Qualification</h1>
        <div className="header-actions">
          {isRPQualif && (
            <div className="view-mode-toggle noprint">
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
                <FaList /> Fiches
              </button>
            </div>
          )}
          <button 
            className="filter-toggle-btn noprint" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
          <button className="print-btn noprint" onClick={handlePrint}>
            <FaPrint /> Imprimer
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="production-filters">
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
          <div className="filter-group">
            <label>Superviseur</label>
            <select
              value={filters.id_superviseur}
              onChange={(e) => handleFilterChange('id_superviseur', e.target.value)}
            >
              <option value="">Tous les superviseurs</option>
              {superviseurs.map(superviseur => (
                <option key={superviseur.id} value={superviseur.id}>
                  {superviseur.nom && superviseur.prenom 
                    ? `${superviseur.nom} ${superviseur.prenom}`
                    : superviseur.pseudo || `ID: ${superviseur.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>État</label>
            <select
              value={filters.id_etat_final}
              onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
            >
              <option value="">Tous les états</option>
              <option value="validated">Validé (hors groupe 0)</option>
              {etats.filter(e => e.groupe === '0' || e.groupe === 0).map(etat => (
                <option key={etat.id} value={etat.id}>
                  {etat.titre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Recherche rapide pour les fiches */}
      {isRPQualif && viewMode === 'fiches' && (
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

      <div className="production-content">
        {viewMode === 'fiches' && isRPQualif ? (
          // Vue fiches pour RP Qualification
          loadingFiches ? (
            <div className="loading">Chargement des fiches...</div>
          ) : fichesError ? (
            <div className="no-data" style={{ color: 'red' }}>
              Erreur lors du chargement des fiches: {fichesError.message || 'Erreur inconnue'}
              <br />
              <small>Vérifiez que vous avez bien des superviseurs assignés et que les dates sont correctes.</small>
            </div>
          ) : (fichesData && (!fichesData.data || fichesData.data.length === 0)) && !loadingFiches ? (
            <div className="no-data">
              Aucune fiche trouvée pour cette période.
              <br />
              <small>
                Vérifiez vos filtres (dates: {filters.date_debut} - {filters.date_fin}, superviseur, état) ou assurez-vous que des fiches existent pour les agents sous la responsabilité de vos superviseurs.
              </small>
            </div>
          ) : fiches && fiches.length > 0 ? (
            <div className="fiches-table-container">
              <div className="results-info">
                {searchTerm || filters.id_superviseur || filters.id_etat_final ? (
                  <p>{fiches.length} fiche{fiches.length > 1 ? 's' : ''} trouvée{fiches.length > 1 ? 's' : ''} (sur {fichesData?.data?.length || fichesData?.pagination?.total || 0})</p>
                ) : (
                  <p>Total: {fichesData?.data?.length || fichesData?.pagination?.total || 0} fiche{(fichesData?.data?.length || fichesData?.pagination?.total || 0) > 1 ? 's' : ''}</p>
                )}
              </div>
              <table className="fiches-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date création</th>
                    <th>Agent</th>
                    <th>Superviseur</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map(fiche => {
                    // Trouver le superviseur de l'agent
                    const agent = agentsData?.find(a => a.id === fiche.id_agent);
                    const superviseur = superviseurs.find(s => s.id === agent?.chef_equipe);
                    return (
                      <tr key={fiche.id}>
                        <td>{fiche.id}</td>
                        <td>{fiche.date_insert_time ? new Date(fiche.date_insert_time).toLocaleDateString('fr-FR') : '-'}</td>
                        <td>{fiche.agent_pseudo || '-'}</td>
                        <td>
                          {superviseur 
                            ? (superviseur.nom && superviseur.prenom 
                                ? `${superviseur.nom} ${superviseur.prenom}`
                                : superviseur.pseudo || '-')
                            : '-'}
                        </td>
                        <td>{fiche.nom || '-'}</td>
                        <td>{fiche.prenom || '-'}</td>
                        <td>{fiche.tel || '-'}</td>
                        <td>{fiche.cp || '-'}</td>
                        <td>
                          <span 
                            className="etat-badge"
                            style={{ backgroundColor: fiche.etat_color || '#ccc' }}
                          >
                            {fiche.etat_titre || '-'}
                          </span>
                        </td>
                        <td>
                          <FicheDetailLink 
                            ficheHash={fiche.hash}
                            ficheId={fiche.id}
                            className="btn-detail"
                            title="Voir les détails"
                          >
                            <FaFileAlt />
                          </FicheDetailLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data">Aucune fiche trouvée pour cette période</div>
          )
        ) : loadingStats ? (
          <div className="loading">Chargement des données...</div>
        ) : stats.superviseurs && stats.superviseurs.length > 0 ? (
          <>
            {stats.period && (
              <div className="period-info">
                Période : {stats.period.date_debut} au {stats.period.date_fin}
              </div>
            )}
            <div className="table-container">
              <table className="production-table">
                <thead style={{ backgroundColor: '#9cbfc8', color: '#ffffff' }}>
                  <tr>
                    <th style={{ color: '#ffffff' }}>Superviseur</th>
                    {stats.etats && stats.etats.map(etat => (
                      <th key={etat.id} title={etat.titre} style={{ color: '#ffffff' }}>
                        {etat.abbreviation || etat.titre}
                      </th>
                    ))}
                    <th style={{ color: '#ffffff' }}>Validé</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.superviseurs.map((superviseurStat, index) => (
                    <tr key={superviseurStat.superviseur.id || index}>
                      <td className="superviseur-cell">
                        <strong>
                          {superviseurStat.superviseur.nom && superviseurStat.superviseur.prenom 
                            ? `${superviseurStat.superviseur.nom} ${superviseurStat.superviseur.prenom}`
                            : superviseurStat.superviseur.pseudo || 'N/A'}
                        </strong>
                      </td>
                      {stats.etats && stats.etats.map(etat => {
                        const stat = superviseurStat.stats[etat.id];
                        const count = stat?.count || 0;
                        return (
                          <td 
                            key={etat.id}
                            className="stat-cell"
                            title={etat.titre}
                            style={{ 
                              backgroundColor: count > 0 ? (etat.color ? `${etat.color}20` : '#e3f2fd') : 'transparent',
                              color: count > 0 ? '#333' : '#999'
                            }}
                          >
                            {count}
                          </td>
                        );
                      })}
                      <td className="stat-cell validated">
                        {superviseurStat.stats['validated']?.count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td><strong>Totaux</strong></td>
                    {stats.etats && stats.etats.map(etat => {
                      const total = stats.superviseurs.reduce((sum, supStat) => {
                        const stat = supStat.stats[etat.id];
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
                        {stats.superviseurs.reduce((sum, supStat) => 
                          sum + (supStat.stats['validated']?.count || 0), 0
                        )}
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

export default ProductionQualif;

