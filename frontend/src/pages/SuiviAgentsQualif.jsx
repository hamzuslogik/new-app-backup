import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserTie, FaFilter, FaSearch, FaFileExcel, FaFileCsv, FaFilePdf, FaChevronDown, FaTimes, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import SystemMessageBanner from '../components/SystemMessageBanner';
import './SuiviAgentsQualif.css';

const SuiviAgentsQualif = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const multiSelectRef = useRef(null);
  
  // État pour gérer l'édition du commentaire qualité
  const [editingComment, setEditingComment] = useState({ hash: null, value: '' });

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
  
  // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
  const isRPQualif = user?.fonction === 12;
  
  // Vérifier si l'utilisateur est un Administrateur (fonction 1)
  const isAdmin = user?.fonction === 1;
  
  // Vérifier si l'utilisateur est un Superviseur Qualification (fonction 2) ou RP Qualification (fonction 12)
  const isSuperviseurQualif = user?.fonction === 2;
  const canSeeCommentaireQualite = isRPQualif || isSuperviseurQualif;
  
  // Vérifier si l'utilisateur peut modifier/créer des commentaires qualité
  // Seul Admin (fonction 1) peut modifier
  const canEditCommentaireQualite = isAdmin;
  
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
    id_rp: '', // Nouveau filtre par RP
    id_etat_final: [] // Tableau pour multi-select
  });

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

  // Récupérer les états - uniquement groupe 0 + Validé
  const { data: etatsData } = useQuery('etats-suivi-agents-qualif', async () => {
    const res = await api.get('/management/etats');
    let etats = res.data.data || [];
    // Filtrer uniquement les états groupe 0
    etats = etats.filter(e => e.groupe === '0' || e.groupe === 0);
    return etats;
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
      // Envoyer tous les états au backend pour un filtrage optimisé
      if (filters.id_etat_final && Array.isArray(filters.id_etat_final) && filters.id_etat_final.length > 0) {
        params.id_etat_final = filters.id_etat_final;
      }
      
      const res = await api.get('/fiches/agents-sous-responsabilite', { params });
      return res.data;
    },
    { enabled: viewMode === 'fiches' && isREQualif }
  );

  // Filtrer les fiches par recherche rapide et par états multiples
  const filteredFiches = useMemo(() => {
    if (!fichesData?.data) return [];
    
    let filtered = fichesData.data;
    
    // Filtrer par états multiples
    if (filters.id_etat_final && Array.isArray(filters.id_etat_final) && filters.id_etat_final.length > 0) {
      filtered = filtered.filter(fiche => {
        const isGroupe0 = fiche.etat_groupe === '0' || fiche.etat_groupe === 0;
        const ficheIdEtat = String(fiche.id_etat_final);
        
        // Vérifier si "validated" est sélectionné et si la fiche est validée (hors groupe 0)
        const isValidatedSelected = filters.id_etat_final.includes('validated');
        const isFicheValidated = !isGroupe0;
        
        // Vérifier si l'état de la fiche est dans la liste sélectionnée
        const isEtatSelected = filters.id_etat_final.includes(ficheIdEtat);
        
        // La fiche correspond si :
        // - "validated" est sélectionné ET la fiche est validée, OU
        // - l'état de la fiche est dans la liste sélectionnée
        return (isValidatedSelected && isFicheValidated) || isEtatSelected;
      });
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
          (fiche.etat_titre && fiche.etat_titre.toLowerCase().includes(term)) ||
          (fiche.commentaire_qualite && fiche.commentaire_qualite.toLowerCase().includes(term))
        );
      });
    }
    
    return filtered;
  }, [fichesData, searchTerm, filters.id_etat_final]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Mutation pour mettre à jour le commentaire qualité
  const updateCommentaireQualiteMutation = useMutation(
    async ({ hash, commentaire_qualite }) => {
      const res = await api.patch(`/fiches/${hash}/field`, {
        field: 'commentaire_qualite',
        value: commentaire_qualite
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fiches-agents-sous-responsabilite']);
        toast.success('Commentaire qualité enregistré avec succès');
        setEditingComment({ hash: null, value: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement du commentaire');
      }
    }
  );

  const handleSaveComment = (hash) => {
    const commentaire = editingComment.hash === hash ? editingComment.value : '';
    updateCommentaireQualiteMutation.mutate({ hash, commentaire_qualite: commentaire });
  };

  const handleKeyDown = (e, hash) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleSaveComment(hash);
    } else if (e.key === 'Escape') {
      setEditingComment({ hash: null, value: '' });
    }
  };

  // Fermer le dropdown multi-select quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(event.target)) {
        setIsMultiSelectOpen(false);
      }
    };

    if (isMultiSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMultiSelectOpen]);

  // Fonctions d'export
  const handleExportCSV = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      exportToCSV(fiches, columns, 'suivi-agents-qualif-fiches');
    } else if (viewMode === 'stats' && stats.agents && stats.agents.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Agent + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation).concat(['Validé']);
      
      // Créer les colonnes
      const columns = [
        { key: 'agent', label: 'Agent' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label }))
      ];
      
      // Créer les lignes (une par agent)
      const statsData = stats.agents.map(agentStat => {
        const agentName = agentStat.agent.pseudo || 'N/A';
        
        const row = { agent: agentName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = agentStat.stats[etat.id]?.count || 0;
        });
        
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = agentStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToCSV(statsData, columns, 'suivi-agents-qualif-stats');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      exportToExcel(fiches, columns, 'suivi-agents-qualif-fiches');
    } else if (viewMode === 'stats' && stats.agents && stats.agents.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Agent + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation).concat(['Validé']);
      
      // Créer les colonnes
      const columns = [
        { key: 'agent', label: 'Agent' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label }))
      ];
      
      // Créer les lignes (une par agent)
      const statsData = stats.agents.map(agentStat => {
        const agentName = agentStat.agent.pseudo || 'N/A';
        
        const row = { agent: agentName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = agentStat.stats[etat.id]?.count || 0;
        });
        
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = agentStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToExcel(statsData, columns, 'suivi-agents-qualif-stats');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const handleExportPDF = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      // Formater les dates pour le PDF
      const formattedData = fiches.map(fiche => ({
        ...fiche,
        date_insert_time: fiche.date_insert_time ? new Date(fiche.date_insert_time).toLocaleDateString('fr-FR') : '-'
      }));
      exportToPDF(formattedData, columns, 'suivi-agents-qualif-fiches', 'Suivi Agents Qualification - Fiches');
    } else if (viewMode === 'stats' && stats.agents && stats.agents.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Agent + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation).concat(['Validé']);
      
      // Créer les colonnes
      const columns = [
        { key: 'agent', label: 'Agent' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label }))
      ];
      
      // Créer les lignes (une par agent)
      const statsData = stats.agents.map(agentStat => {
        const agentName = agentStat.agent.pseudo || 'N/A';
        
        const row = { agent: agentName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = agentStat.stats[etat.id]?.count || 0;
        });
        
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = agentStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToPDF(statsData, columns, 'suivi-agents-qualif-stats', 'Suivi Agents Qualification - Statistiques');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const agents = agentsData || [];
  const stats = statsData || { agents: [], etats: [], period: {} };
  const fiches = filteredFiches || [];

  return (
    <div className="suivi-agents-qualif">
      <SystemMessageBanner />
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
          <div className="export-buttons noprint">
            <button className="export-btn" onClick={handleExportExcel} title="Exporter en Excel">
              <FaFileExcel /> Excel
            </button>
            <button className="export-btn" onClick={handleExportCSV} title="Exporter en CSV">
              <FaFileCsv /> CSV
            </button>
            <button className="export-btn" onClick={handleExportPDF} title="Exporter en PDF">
              <FaFilePdf /> PDF
            </button>
          </div>
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
          <div className="filter-group">
            <label>État (multi-select)</label>
            <div className="multi-select-wrapper" ref={multiSelectRef}>
              <div 
                className="multi-select-trigger"
                onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}
              >
                <div className="multi-select-selected">
                  {(!filters.id_etat_final || filters.id_etat_final.length === 0) ? (
                    <span className="multi-select-placeholder">Tous les états</span>
                  ) : (
                    <div className="multi-select-badges">
                      {(filters.id_etat_final || []).slice(0, 2).map((etatId, idx) => {
                        if (etatId === 'validated') {
                          return (
                            <span key={idx} className="multi-select-badge">
                              Validée
                            </span>
                          );
                        }
                        const etat = etatsData?.find(e => String(e.id) === etatId);
                        return etat ? (
                          <span key={idx} className="multi-select-badge">
                            {etat.titre}
                          </span>
                        ) : null;
                      })}
                      {filters.id_etat_final && filters.id_etat_final.length > 2 && (
                        <span className="multi-select-badge more">
                          +{filters.id_etat_final.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <FaChevronDown className={`multi-select-arrow ${isMultiSelectOpen ? 'open' : ''}`} />
              </div>
              {isMultiSelectOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-options">
                    <label className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={!filters.id_etat_final || filters.id_etat_final.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleFilterChange('id_etat_final', []);
                          }
                        }}
                      />
                      <span>Tous les états</span>
                    </label>
                    <label className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={filters.id_etat_final && filters.id_etat_final.includes('validated')}
                        onChange={(e) => {
                          const currentEtats = filters.id_etat_final || [];
                          const newEtats = e.target.checked
                            ? [...currentEtats, 'validated']
                            : currentEtats.filter(e => e !== 'validated');
                          handleFilterChange('id_etat_final', newEtats);
                        }}
                      />
                      <span>Validée (hors groupe 0)</span>
                    </label>
                    {etatsData?.filter(e => e.groupe === '0' || e.groupe === 0).map(etat => (
                      <label key={etat.id} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={filters.id_etat_final && filters.id_etat_final.includes(String(etat.id))}
                          onChange={(e) => {
                            const currentEtats = filters.id_etat_final || [];
                            const newEtats = e.target.checked
                              ? [...currentEtats, String(etat.id)]
                              : currentEtats.filter(e => e !== String(etat.id));
                            handleFilterChange('id_etat_final', newEtats);
                          }}
                        />
                        <span style={{ color: etat.color || '#333' }}>{etat.titre}</span>
                      </label>
                    ))}
                  </div>
                  {filters.id_etat_final && filters.id_etat_final.length > 0 && (
                    <div className="multi-select-footer">
                      <button
                        type="button"
                        className="multi-select-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFilterChange('id_etat_final', []);
                        }}
                      >
                        <FaTimes /> Tout effacer
                      </button>
                      <span className="multi-select-count">
                        {filters.id_etat_final && filters.id_etat_final.length} sélectionné{(filters.id_etat_final && filters.id_etat_final.length > 1) ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recherche rapide pour les fiches */}
      {isREQualif && viewMode === 'fiches' && (
        <div className="quick-search-container">
          <FaSearch />
          <input
            type="text"
            placeholder="Recherche rapide (nom, prénom, téléphone, code postal, agent, état, commentaire qualité)..."
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
                    {canSeeCommentaireQualite && <th>Commentaire Qualité</th>}
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
                      {canSeeCommentaireQualite && (
                        <td className="comment-qualite-cell">
                          <div className="comment-quick-edit-container">
                            {canEditCommentaireQualite ? (
                              <>
                                <div className="comment-quick-actions">
                                  {(() => {
                                    const currentValue = editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '');
                                    const originalValue = fiche.commentaire_qualite || '';
                                    const hasChanges = editingComment.hash === fiche.hash && currentValue !== originalValue;
                                    
                                    return hasChanges && (
                                      <>
                                        <button
                                          className="btn-save-comment-quick"
                                          onClick={() => handleSaveComment(fiche.hash)}
                                          disabled={updateCommentaireQualiteMutation.isLoading}
                                          title="Enregistrer (Ctrl+Enter)"
                                        >
                                          <FaSave />
                                        </button>
                                        <button
                                          className="btn-cancel-comment-quick"
                                          onClick={() => {
                                            setEditingComment({ hash: null, value: '' });
                                          }}
                                          disabled={updateCommentaireQualiteMutation.isLoading}
                                          title="Annuler (Echap)"
                                        >
                                          <FaTimes />
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                                <textarea
                                  value={editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '')}
                                  onChange={(e) => {
                                    if (editingComment.hash !== fiche.hash) {
                                      setEditingComment({ hash: fiche.hash, value: e.target.value });
                                    } else {
                                      setEditingComment({ ...editingComment, value: e.target.value });
                                    }
                                  }}
                                  onFocus={() => {
                                    if (editingComment.hash !== fiche.hash) {
                                      setEditingComment({ hash: fiche.hash, value: fiche.commentaire_qualite || '' });
                                    }
                                  }}
                                  onKeyDown={(e) => handleKeyDown(e, fiche.hash)}
                                  className="comment-textarea-quick"
                                  placeholder="Commentaire qualité... (Ctrl+Enter pour sauvegarder)"
                                  rows={2}
                                />
                              </>
                            ) : (
                              <div className="comment-readonly">
                                <div className="comment-readonly-text">
                                  {fiche.commentaire_qualite || <span className="no-comment">Aucun commentaire qualité</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
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

