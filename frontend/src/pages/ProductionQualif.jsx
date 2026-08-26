import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { FaChartBar, FaFilter, FaPrint, FaList, FaSearch, FaFileAlt, FaFileExcel, FaFileCsv, FaFilePdf, FaChevronDown, FaTimes, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import SystemMessageBanner from '../components/SystemMessageBanner';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './ProductionQualif.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const ID_ETAT_HC = 55;

const getFicheEtatDisplay = (fiche) => {
  if (fiche.ko === 1 || fiche.ko === '1') {
    return { label: 'KO', color: '#dc3545' };
  }
  if (Number(fiche.id_etat_final) === ID_ETAT_HC) {
    return { label: fiche.etat_titre || 'HC', color: fiche.etat_color || '#ff9800' };
  }
  const isGroupe0 = fiche.etat_groupe === '0' || fiche.etat_groupe === 0;
  if (isGroupe0) {
    return { label: fiche.etat_titre || '-', color: fiche.etat_color || '#ccc' };
  }
  return { label: 'Validée', color: '#4CAF50' };
};

const ProductionQualif = () => {
  useForceDesktopViewport('production-qualif-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('stats'); // 'stats' (RP) ou 'fiches' (RP + superviseur)
  const [searchTerm, setSearchTerm] = useState('');
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const multiSelectRef = useRef(null);

  const [filters, setFilters] = useState({
    date_debut: getFirstOfMonthLocal(),
    date_fin: getTodayLocal(),
    id_superviseur: '',
    id_etat_final: [] // Tableau pour multi-select
  });

  // État pour gérer l'édition du commentaire qualité
  const [editingComment, setEditingComment] = useState({ hash: null, value: '' });

  // Vérifier si l'utilisateur est un RP Qualification (fonction 12) ou Superviseur Qualification (fonction 2)
  const isRPQualif = user?.fonction === 12;
  const isSuperviseurQualif = user?.fonction === 2;
  const isAdmin = user?.fonction === 1;
  const isBackofficeOrAdmin = user?.fonction === 11 || isAdmin;
  const canViewStats = isRPQualif || isSuperviseurQualif || isBackofficeOrAdmin;
  const canViewFiches = isRPQualif || isSuperviseurQualif || isBackofficeOrAdmin;
  const canSeeCommentaireQualite = isRPQualif || isSuperviseurQualif || isBackofficeOrAdmin;
  
  // Vérifier si l'utilisateur peut modifier/créer des commentaires qualité
  // Seul Admin (fonction 1) peut modifier
  const canEditCommentaireQualite = isAdmin;

  // Récupérer les superviseurs (périmètre selon le rôle)
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
      // Pour les statistiques, on peut envoyer le premier état ou filtrer côté backend
      if (filters.id_etat_final && filters.id_etat_final.length > 0) {
        // Si un seul état, l'envoyer directement
        if (filters.id_etat_final.length === 1) {
          params.id_etat_final = filters.id_etat_final[0];
        }
        // Sinon, on ne filtre pas côté backend pour les stats (on affiche tout)
      }
      
      const res = await api.get('/statistiques/production-qualif', { params });
      return res.data.data;
    },
    { enabled: viewMode === 'stats' && canViewStats }
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
        page: 1
      };
      if (filters.date_debut) params.date_debut = filters.date_debut;
      if (filters.date_fin) params.date_fin = filters.date_fin;
      // Filtrer par superviseur côté backend
      if (filters.id_superviseur) {
        params.id_superviseur = filters.id_superviseur;
      }
      // Filtrer par état (y compris "validated")
      // Envoyer tous les états au backend pour un filtrage optimisé
      if (filters.id_etat_final && filters.id_etat_final.length > 0) {
        // Envoyer le tableau d'états au backend
        params.id_etat_final = filters.id_etat_final;
      }
      
      try {
        const res = await api.get('/fiches/agents-sous-responsabilite', { params });
        return res.data;
      } catch (error) {
        console.error('Erreur lors de la récupération des fiches:', error);
        throw error;
      }
    },
    {
      enabled: viewMode === 'fiches' && canViewFiches,
      retry: 1
    }
  );

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
        queryClient.invalidateQueries(['fiches-production-qualif']);
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

  // Filtrer les fiches par recherche rapide et par états multiples
  const filteredFiches = useMemo(() => {
    if (!fichesData?.data) return [];
    
    let filtered = fichesData.data;
    
    // Filtrer par états multiples
    if (filters.id_etat_final && filters.id_etat_final.length > 0) {
      filtered = filtered.filter((fiche) => {
        const isGroupe0 = fiche.etat_groupe === '0' || fiche.etat_groupe === 0;
        const ficheIdEtat = String(fiche.id_etat_final);
        const isFicheKo = fiche.ko === 1 || fiche.ko === '1';
        const isFicheHc = Number(fiche.id_etat_final) === ID_ETAT_HC;

        const isValidatedSelected = filters.id_etat_final.includes('validated');
        const isKoSelected = filters.id_etat_final.includes('ko');
        const isHcSelected = filters.id_etat_final.includes('hc');
        const isFicheValidated = !isGroupe0 && !isFicheKo;

        const isEtatSelected = filters.id_etat_final.includes(ficheIdEtat);

        return (
          (isValidatedSelected && isFicheValidated)
          || (isKoSelected && isFicheKo)
          || (isHcSelected && isFicheHc)
          || (isEtatSelected && !isFicheKo)
        );
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

  const handlePrint = () => {
    window.print();
  };

  // Fonctions d'export
  const handleExportCSV = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      // Préparer les données avec le superviseur
      const exportData = fiches.map(fiche => {
        const agent = agentsData?.find(a => a.id === fiche.id_agent);
        const superviseur = superviseurs.find(s => s.id === agent?.chef_equipe);
        const superviseurName = superviseur 
          ? (superviseur.nom && superviseur.prenom 
              ? `${superviseur.nom} ${superviseur.prenom}`
              : superviseur.pseudo || '-')
          : '-';
        
        const { label: displayEtat } = getFicheEtatDisplay(fiche);
        
        return {
          ...fiche,
          superviseur_name: superviseurName,
          etat_titre: displayEtat
        };
      });
      
      const columns = [
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      exportToCSV(exportData, columns, 'production-qualif-fiches');
    } else if (viewMode === 'stats' && stats.superviseurs && stats.superviseurs.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Superviseur + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation);
      
      // Créer les colonnes
      const columns = [
        { key: 'superviseur', label: 'Superviseur' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label })),
        { key: 'total', label: 'Total' },
        { key: 'etat_Validé', label: 'Validé' }
      ];
      
      // Créer les lignes (une par superviseur)
      const statsData = stats.superviseurs.map(superviseurStat => {
        const superviseurName = superviseurStat.superviseur.nom && superviseurStat.superviseur.prenom
          ? `${superviseurStat.superviseur.nom} ${superviseurStat.superviseur.prenom}`
          : superviseurStat.superviseur.pseudo || 'N/A';
        
        const row = { superviseur: superviseurName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = superviseurStat.stats[etat.id]?.count || 0;
        });

        row.total = superviseurStat.total || 0;
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = superviseurStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToCSV(statsData, columns, 'production-qualif-stats');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      // Préparer les données avec le superviseur
      const exportData = fiches.map(fiche => {
        const agent = agentsData?.find(a => a.id === fiche.id_agent);
        const superviseur = superviseurs.find(s => s.id === agent?.chef_equipe);
        const superviseurName = superviseur 
          ? (superviseur.nom && superviseur.prenom 
              ? `${superviseur.nom} ${superviseur.prenom}`
              : superviseur.pseudo || '-')
          : '-';
        
        const { label: displayEtat } = getFicheEtatDisplay(fiche);
        
        return {
          ...fiche,
          superviseur_name: superviseurName,
          etat_titre: displayEtat
        };
      });
      
      const columns = [
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      exportToExcel(exportData, columns, 'production-qualif-fiches');
    } else if (viewMode === 'stats' && stats.superviseurs && stats.superviseurs.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Superviseur + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation);
      
      // Créer les colonnes
      const columns = [
        { key: 'superviseur', label: 'Superviseur' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label })),
        { key: 'total', label: 'Total' },
        { key: 'etat_Validé', label: 'Validé' }
      ];
      
      // Créer les lignes (une par superviseur)
      const statsData = stats.superviseurs.map(superviseurStat => {
        const superviseurName = superviseurStat.superviseur.nom && superviseurStat.superviseur.prenom
          ? `${superviseurStat.superviseur.nom} ${superviseurStat.superviseur.prenom}`
          : superviseurStat.superviseur.pseudo || 'N/A';
        
        const row = { superviseur: superviseurName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = superviseurStat.stats[etat.id]?.count || 0;
        });

        row.total = superviseurStat.total || 0;
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = superviseurStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToExcel(statsData, columns, 'production-qualif-stats');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const handleExportPDF = () => {
    if (viewMode === 'fiches' && fiches.length > 0) {
      // Préparer les données avec le superviseur et formater les dates
      const exportData = fiches.map(fiche => {
        const agent = agentsData?.find(a => a.id === fiche.id_agent);
        const superviseur = superviseurs.find(s => s.id === agent?.chef_equipe);
        const superviseurName = superviseur 
          ? (superviseur.nom && superviseur.prenom 
              ? `${superviseur.nom} ${superviseur.prenom}`
              : superviseur.pseudo || '-')
          : '-';
        
        const { label: displayEtat } = getFicheEtatDisplay(fiche);
        
        return {
          ...fiche,
          superviseur_name: superviseurName,
          date_insert_time: fiche.date_insert_time ? new Date(fiche.date_insert_time).toLocaleDateString('fr-FR') : '-',
          etat_titre: displayEtat
        };
      });
      
      const columns = [
        { key: 'date_insert_time', label: 'Date création' },
        { key: 'agent_pseudo', label: 'Agent' },
        { key: 'nom', label: 'Nom' },
        { key: 'prenom', label: 'Prénom' },
        { key: 'tel', label: 'Téléphone' },
        { key: 'cp', label: 'CP' },
        { key: 'etat_titre', label: 'État' },
        ...(canSeeCommentaireQualite ? [{ key: 'commentaire_qualite', label: 'Commentaire Qualité' }] : [])
      ];
      exportToPDF(exportData, columns, 'production-qualif-fiches', 'Production Qualification - Fiches');
    } else if (viewMode === 'stats' && stats.superviseurs && stats.superviseurs.length > 0) {
      // Exporter les statistiques en format tableau croisé
      // Colonnes : Superviseur + tous les états
      const etatLabels = stats.etats.map(etat => etat.titre || etat.abbreviation);
      
      // Créer les colonnes
      const columns = [
        { key: 'superviseur', label: 'Superviseur' },
        ...etatLabels.map(label => ({ key: `etat_${label}`, label })),
        { key: 'total', label: 'Total' },
        { key: 'etat_Validé', label: 'Validé' }
      ];
      
      // Créer les lignes (une par superviseur)
      const statsData = stats.superviseurs.map(superviseurStat => {
        const superviseurName = superviseurStat.superviseur.nom && superviseurStat.superviseur.prenom
          ? `${superviseurStat.superviseur.nom} ${superviseurStat.superviseur.prenom}`
          : superviseurStat.superviseur.pseudo || 'N/A';
        
        const row = { superviseur: superviseurName };
        
        // Ajouter les valeurs pour chaque état
        stats.etats.forEach(etat => {
          const label = etat.titre || etat.abbreviation;
          row[`etat_${label}`] = superviseurStat.stats[etat.id]?.count || 0;
        });

        row.total = superviseurStat.total || 0;
        // Ajouter la valeur "Validé"
        row['etat_Validé'] = superviseurStat.stats['validated']?.count || 0;
        
        return row;
      });
      
      exportToPDF(statsData, columns, 'production-qualif-stats', 'Production Qualification - Statistiques');
    } else {
      alert('Aucune donnée à exporter');
    }
  };

  const superviseurs = superviseursData || [];
  const etats = etatsData || [];
  const stats = statsData || { superviseurs: [], etats: [], period: {} };
  const fiches = filteredFiches || [];

  return (
    <div className="production-qualif">
      <div className="noprint">
        <SystemMessageBanner />
      </div>
      <div className="production-header noprint">
        <h1><FaChartBar /> Production Qualification</h1>
        <div className="header-actions">
          {(canViewStats || canViewFiches) && (
            <div className="view-mode-toggle noprint">
              {canViewStats && (
                <button
                  className={`mode-btn ${viewMode === 'stats' ? 'active' : ''}`}
                  onClick={() => setViewMode('stats')}
                >
                  <FaChartBar /> Statistiques
                </button>
              )}
              {canViewFiches && (
                <button
                  className={`mode-btn ${viewMode === 'fiches' ? 'active' : ''}`}
                  onClick={() => setViewMode('fiches')}
                >
                  <FaList /> Fiches
                </button>
              )}
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
          <button className="print-btn noprint" onClick={handlePrint}>
            <FaPrint /> Imprimer
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="production-filters noprint">
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
            <label>État (multi-select)</label>
            <div className="multi-select-wrapper" ref={multiSelectRef}>
              <div 
                className="multi-select-trigger"
                onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}
              >
                <div className="multi-select-selected">
                  {filters.id_etat_final.length === 0 ? (
                    <span className="multi-select-placeholder">Tous les états</span>
                  ) : (
                    <div className="multi-select-badges">
                      {filters.id_etat_final.slice(0, 2).map((etatId, idx) => {
                        if (etatId === 'validated') {
                          return (
                            <span key={idx} className="multi-select-badge">
                              Validée
                            </span>
                          );
                        }
                        if (etatId === 'ko') {
                          return (
                            <span key={idx} className="multi-select-badge ko">
                              KO
                            </span>
                          );
                        }
                        if (etatId === 'hc') {
                          return (
                            <span key={idx} className="multi-select-badge hc">
                              HC
                            </span>
                          );
                        }
                        const etat = etats.find(e => String(e.id) === etatId);
                        return etat ? (
                          <span key={idx} className="multi-select-badge">
                            {etat.titre}
                          </span>
                        ) : null;
                      })}
                      {filters.id_etat_final.length > 2 && (
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
                        checked={filters.id_etat_final.length === 0}
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
                        checked={filters.id_etat_final.includes('validated')}
                        onChange={(e) => {
                          const newEtats = e.target.checked
                            ? [...filters.id_etat_final, 'validated']
                            : filters.id_etat_final.filter(e => e !== 'validated');
                          handleFilterChange('id_etat_final', newEtats);
                        }}
                      />
                      <span>Validée (hors groupe 0, hors KO)</span>
                    </label>
                    <label className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={filters.id_etat_final.includes('ko')}
                        onChange={(e) => {
                          const newEtats = e.target.checked
                            ? [...filters.id_etat_final, 'ko']
                            : filters.id_etat_final.filter((id) => id !== 'ko');
                          handleFilterChange('id_etat_final', newEtats);
                        }}
                      />
                      <span style={{ color: '#dc3545' }}>KO</span>
                    </label>
                    <label className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={filters.id_etat_final.includes('hc')}
                        onChange={(e) => {
                          const newEtats = e.target.checked
                            ? [...filters.id_etat_final, 'hc']
                            : filters.id_etat_final.filter((id) => id !== 'hc');
                          handleFilterChange('id_etat_final', newEtats);
                        }}
                      />
                      <span style={{ color: '#ff9800' }}>HC (hors cible)</span>
                    </label>
                    {etats.filter(e => e.groupe === '0' || e.groupe === 0).map(etat => (
                      <label key={etat.id} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={filters.id_etat_final.includes(String(etat.id))}
                          onChange={(e) => {
                            const newEtats = e.target.checked
                              ? [...filters.id_etat_final, String(etat.id)]
                              : filters.id_etat_final.filter(e => e !== String(etat.id));
                            handleFilterChange('id_etat_final', newEtats);
                          }}
                        />
                        <span style={{ color: etat.color || '#333' }}>{etat.titre}</span>
                      </label>
                    ))}
                  </div>
                  {filters.id_etat_final.length > 0 && (
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
                        {filters.id_etat_final.length} sélectionné{filters.id_etat_final.length > 1 ? 's' : ''}
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
      {canViewFiches && viewMode === 'fiches' && (
        <div className="quick-search-container noprint">
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

      <div className="production-content">
        {viewMode === 'fiches' && canViewFiches ? (
          // Vue fiches
          loadingFiches ? (
            <div className="loading noprint">Chargement des fiches...</div>
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
              <div className="period-info print-period">
                Période : {filters.date_debut} au {filters.date_fin}
              </div>
              <div className="results-info noprint">
                {searchTerm || filters.id_superviseur || (filters.id_etat_final && filters.id_etat_final.length > 0) ? (
                  <p>{fiches.length} fiche{fiches.length > 1 ? 's' : ''} trouvée{fiches.length > 1 ? 's' : ''} (sur {fichesData?.data?.length || fichesData?.pagination?.total || 0})</p>
                ) : (
                  <p>Total: {fichesData?.data?.length || fichesData?.pagination?.total || 0} fiche{(fichesData?.data?.length || fichesData?.pagination?.total || 0) > 1 ? 's' : ''}</p>
                )}
              </div>
              <table
                className={`fiches-table fiches-table--wrap${canSeeCommentaireQualite ? '' : ' fiches-table--no-comment'}`}
              >
                <colgroup>
                  <col className="colw-date" />
                  <col className="colw-agent" />
                  <col className="colw-nom" />
                  <col className="colw-prenom" />
                  <col className="colw-tel" />
                  <col className="colw-cp" />
                  <col className="colw-etat" />
                  {canSeeCommentaireQualite && <col className="colw-comment" />}
                  <col className="colw-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-date">Date création</th>
                    <th className="col-agent">Agent</th>
                    <th className="col-nom">Nom</th>
                    <th className="col-prenom">Prénom</th>
                    <th className="col-tel">Téléphone</th>
                    <th className="col-cp">CP</th>
                    <th className="col-etat">État</th>
                    {canSeeCommentaireQualite && <th className="col-comment">Commentaire Qualité</th>}
                    <th className="col-actions noprint">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map((fiche) => (
                      <tr key={fiche.id || fiche.hash}>
                        <td className="col-date">{fiche.date_insert_time ? new Date(fiche.date_insert_time).toLocaleDateString('fr-FR') : '-'}</td>
                        <td className="col-agent">{fiche.agent_pseudo || '-'}</td>
                        <td className="col-nom">{fiche.nom || '-'}</td>
                        <td className="col-prenom">{fiche.prenom || '-'}</td>
                        <td className="col-tel">{fiche.tel || '-'}</td>
                        <td className="col-cp">{fiche.cp || '-'}</td>
                        <td className="col-etat">
                          {(() => {
                            const { label: displayEtat, color: displayColor } = getFicheEtatDisplay(fiche);
                            return (
                              <span
                                className="etat-badge"
                                style={{ backgroundColor: displayColor }}
                              >
                                {displayEtat}
                              </span>
                            );
                          })()}
                        </td>
                        {canSeeCommentaireQualite && (
                          <td className="col-comment">
                            <div className="comment-quick-edit-container">
                              {canEditCommentaireQualite ? (
                                <>
                                  <div className="comment-quick-actions noprint">
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
                        <td className="col-actions noprint">
                          {isRPQualif ? (
                            <span 
                              className="btn-detail disabled" 
                              title="Accès aux détails désactivé pour les RP Qualification"
                              style={{ 
                                opacity: 0.5, 
                                cursor: 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />
                            </span>
                          ) : (
                            <FicheDetailLink 
                              ficheHash={fiche.hash}
                              ficheId={fiche.id}
                              className="btn-detail"
                              title="Voir les détails"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />
                            </FicheDetailLink>
                          )}
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
          <div className="loading noprint">Chargement des données...</div>
        ) : stats.superviseurs && stats.superviseurs.length > 0 ? (
          <>
            <div className="period-info print-period">
              Période :{' '}
              {stats.period?.date_debut && stats.period?.date_fin
                ? `${stats.period.date_debut} au ${stats.period.date_fin}`
                : filters.date_debut && filters.date_fin
                  ? `${filters.date_debut} au ${filters.date_fin}`
                  : '—'}
            </div>
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
                    <th style={{ color: '#ffffff' }}>Total</th>
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
                      <td className="stat-cell total-inserted" title="Total fiches insérées">
                        <strong>{superviseurStat.total || 0}</strong>
                      </td>
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
                          sum + (Number(supStat.total) || 0), 0
                        )}
                      </strong>
                    </td>
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

