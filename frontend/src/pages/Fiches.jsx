import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaPlus, FaEdit, FaArchive, FaTimes, FaSearch, FaChevronDown, FaChevronUp, FaCheck, FaFileAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './Fiches.css';

const Fiches = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAgentQualif = user?.fonction === 3;
  const [showFilters, setShowFilters] = useState(!isAgentQualif); // Masquer pour agent qualif
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFiche, setEditingFiche] = useState(null);
  const [quickSearch, setQuickSearch] = useState(''); // Recherche rapide
  const [filters, setFilters] = useState({
    page: 1,
    limit: 500,
    fiche_search: false,
  });

  // Options de cache communes pour les données de référence (rarement modifiées)
  const referenceDataOptions = {
    staleTime: 5 * 60 * 1000, // 5 minutes - considérer les données comme fraîches pendant 5 min
    cacheTime: 30 * 60 * 1000, // 30 minutes - garder en cache même si non utilisées
    refetchOnWindowFocus: false, // Ne pas refetch au focus de la fenêtre
    refetchOnMount: false, // Ne pas refetch si déjà en cache
  };

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data;
  }, referenceDataOptions);

  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data;
  }, referenceDataOptions);

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data;
  }, referenceDataOptions);

  const { data: professionsData } = useQuery('professions', async () => {
    const res = await api.get('/management/professions');
    return res.data.data;
  }, referenceDataOptions);

  const { data: modeChauffageData } = useQuery('mode-chauffage', async () => {
    const res = await api.get('/management/mode-chauffage');
    return res.data.data;
  }, referenceDataOptions);

  const { data: etudeRaisonData } = useQuery('etude-raison', async () => {
    const res = await api.get('/management/etude-raison');
    return res.data.data;
  }, referenceDataOptions);

  const { data: typeContratData } = useQuery('type-contrat', async () => {
    const res = await api.get('/management/type-contrat');
    return res.data.data;
  }, referenceDataOptions);

  // Récupérer les produits
  const { data: produitsData } = useQuery('produits', async () => {
    const res = await api.get('/management/produits');
    return res.data.data || [];
  }, referenceDataOptions);

  // Calculer la date d'aujourd'hui
  const getTodayDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Format: YYYY-MM-DD
    const dateStr = `${year}-${month}-${day}`;
    
    return { 
      dateStr,
      timeStart: '00:00:00',
      timeEnd: '23:59:59'
    };
  };

  // Construire les paramètres de requête
  const getQueryParams = () => {
    // Si limit est 999999 (Tout) ou si recherche rapide active, utiliser une valeur très élevée pour récupérer toutes les fiches
    const isQuickSearchActive = quickSearch.trim() !== '';
    const limitParam = isQuickSearchActive ? 999999 : (filters.limit === 999999 ? 999999 : filters.limit);
    const pageParam = isQuickSearchActive ? 1 : (filters.page || 1);
    
    // Si une recherche a été effectuée (fiche_search = true), utiliser les filtres personnalisés
    if (filters.fiche_search) {
      const searchParams = { 
        ...filters, 
        limit: limitParam,
        page: pageParam,
        fiche_search: 1
      };
      
      // Nettoyer les paramètres vides (mais garder page, limit, fiche_search, critere, critere_champ)
      Object.keys(searchParams).forEach(key => {
        if (key === 'page' || key === 'limit' || key === 'fiche_search') {
          return; // Ne pas supprimer ces paramètres
        }
        // Si critere est rempli, garder critere_champ même s'il est vide (utiliser la valeur par défaut)
        if (key === 'critere_champ' && searchParams.critere) {
          // Garder critere_champ avec la valeur par défaut 'tel' si vide
          if (!searchParams.critere_champ) {
            searchParams.critere_champ = 'tel';
          }
          return;
        }
        // Si on fait une recherche par critère uniquement, ne pas appliquer les filtres de date par défaut
        // Supprimer les dates si elles sont les dates d'aujourd'hui (valeurs par défaut) et qu'on cherche par critère
        if (key === 'date_debut' || key === 'date_fin' || key === 'date_champ' || key === 'time_debut' || key === 'time_fin') {
          // Si critere est rempli et que les dates sont les dates d'aujourd'hui, les supprimer pour permettre une recherche globale
          if (searchParams.critere) {
            const today = new Date().toISOString().split('T')[0];
            if (key === 'date_debut' && searchParams.date_debut === today) {
              delete searchParams[key];
              return;
            }
            if (key === 'date_fin' && searchParams.date_fin === today) {
              delete searchParams[key];
              return;
            }
            if ((key === 'date_champ' || key === 'time_debut' || key === 'time_fin') && searchParams.critere) {
              // Supprimer ces paramètres si on cherche uniquement par critère
              delete searchParams[key];
              return;
            }
          }
        }
        if (searchParams[key] === '' || searchParams[key] === null || searchParams[key] === undefined) {
          delete searchParams[key];
        }
      });
      
      return searchParams;
    }
    
    // Sinon, par défaut : afficher les fiches créées aujourd'hui
    const { dateStr, timeStart, timeEnd } = getTodayDateRange();
    const defaultParams = {
      page: pageParam,
      limit: limitParam,
      date_champ: 'date_insert_time',
      date_debut: dateStr,
      date_fin: dateStr,
      time_debut: timeStart,
      time_fin: timeEnd
    };
    
    // Pour l'agent qualification, filtrer uniquement ses fiches créées aujourd'hui
    if (isAgentQualif && user?.id) {
      defaultParams.id_agent = user.id;
    }
    
    return defaultParams;
  };

  // Récupérer les stats du mois pour agent qualification
  const { data: statsMois } = useQuery(
    ['fiches-stats-mois'],
    async () => {
      const res = await api.get('/fiches/stats/mois');
      return res.data;
    },
    { enabled: isAgentQualif }
  );

  // Récupérer les fiches
  const { data, isLoading, error, refetch } = useQuery(
    ['fiches', filters, quickSearch],
    async () => {
      const params = getQueryParams();
      const response = await api.get('/fiches', { params });
      return response.data;
    },
    { keepPreviousData: true }
  );

  // Mutation pour créer une fiche
  const createMutation = useMutation(
    async (ficheData) => {
      const response = await api.post('/fiches', ficheData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fiches');
        setShowCreateModal(false);
        toast.success('Fiche créée avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création de la fiche');
      }
    }
  );

  // Mutation pour modifier une fiche
  const updateMutation = useMutation(
    async ({ hash, data }) => {
      const response = await api.put(`/fiches/${hash}`, data);
      return response.data;
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries('fiches');
        // Si la date du RDV a été modifiée, invalider toutes les queries de planning
        if (variables.data && variables.data.date_rdv_time !== undefined) {
          queryClient.invalidateQueries(['planning-week']);
          queryClient.invalidateQueries(['planning-availability']);
          queryClient.invalidateQueries(['planning-modal']);
          queryClient.invalidateQueries(['availability-modal']);
        }
        setEditingFiche(null);
        toast.success('Fiche mise à jour avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour de la fiche');
      }
    }
  );

  // Mutation pour archiver une fiche
  const archiveMutation = useMutation(
    async ({ id, archive }) => {
      const response = await api.patch(`/fiches/${id}/archive`, { archive });
      return response.data;
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries('fiches');
        toast.success(variables.archive ? 'Fiche archivée avec succès' : 'Fiche désarchivée avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'archivage de la fiche');
      }
    }
  );

  // Filtrer les utilisateurs par fonction
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const agents = usersData ? usersData.filter(u => u.fonction === 3 && u.etat > 0) : [];
  const centres = centresData ? centresData.filter(c => c.etat > 0) : [];
  const etats = etatsData || [];

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Si on cherche uniquement par critère, ne pas appliquer les filtres de date
    const newFilters = { ...filters, fiche_search: true, page: 1 };
    
    // Si critere est rempli et qu'aucune date n'a été spécifiquement définie, supprimer les dates
    if (newFilters.critere && !newFilters.date_debut && !newFilters.date_fin) {
      // Les dates ne sont pas dans les filtres, donc pas besoin de les supprimer
    } else if (newFilters.critere) {
      // Si critere est rempli, vérifier si les dates sont les dates d'aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      if (newFilters.date_debut === today && newFilters.date_fin === today) {
        // Supprimer les dates pour permettre une recherche globale
        delete newFilters.date_debut;
        delete newFilters.date_fin;
        delete newFilters.date_champ;
        delete newFilters.time_debut;
        delete newFilters.time_fin;
      }
    }
    
    setFilters(newFilters);
    refetch();
  };

  const handleReset = () => {
    setFilters({
      page: 1,
      limit: 500,
      fiche_search: false,
    });
  };

  const handleArchive = (fiche, archive) => {
    if (window.confirm(`Êtes-vous sûr de vouloir ${archive ? 'archiver' : 'désarchiver'} cette fiche ?`)) {
      archiveMutation.mutate({ id: fiche.id, archive });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEtatColor = (etatId) => {
    const etat = etats.find(e => e.id === etatId);
    return etat?.color || '#cccccc';
  };

  const getProduitColor = (produitId) => {
    return produitId === 1 ? '#0000CD' : produitId === 2 ? '#FFE441' : '#cccccc';
  };

  const getProduitName = (produitId) => {
    return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
  };

  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  const getCentreName = (centreId) => {
    if (!centreId || !centresData) return '';
    const centre = centresData.find(c => c.id === centreId);
    return centre?.titre || '';
  };

  const getEtatName = (etatId) => {
    if (!etatId) return '';
    const etat = etats.find(e => e.id === etatId);
    return etat?.titre || '';
  };

  // Obtenir les confirmateurs formatés (avec confirmateur 2 et 3 si existent)
  const getConfirmateursFormatted = (fiche) => {
    const confirmateursList = [];
    
    if (fiche.id_confirmateur) {
      const conf1 = getUserName(fiche.id_confirmateur);
      if (conf1) confirmateursList.push(conf1);
    }
    
    if (fiche.id_confirmateur_2) {
      const conf2 = getUserName(fiche.id_confirmateur_2);
      if (conf2) confirmateursList.push(conf2);
    }
    
    if (fiche.id_confirmateur_3) {
      const conf3 = getUserName(fiche.id_confirmateur_3);
      if (conf3) confirmateursList.push(conf3);
    }
    
    return confirmateursList.length > 0 ? confirmateursList.join(' | ') : '';
  };

  if (isLoading && !data) {
    return (
      <div className="fiches-loading">
        <div className="spinner"></div>
        <p>Chargement des fiches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fiches-error">
        <p>Erreur lors du chargement des fiches</p>
        <button onClick={() => refetch()}>Réessayer</button>
      </div>
    );
  }

  const allFiches = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };

  // Filtrer les fiches selon la recherche rapide
  const fiches = quickSearch.trim() === '' 
    ? allFiches 
    : allFiches.filter(fiche => {
        const searchLower = quickSearch.toLowerCase();
        // Rechercher dans tous les champs
        const searchFields = [
          fiche.nom || '',
          fiche.prenom || '',
          fiche.tel || '',
          fiche.cp || '',
          fiche.ville || '',
          fiche.adresse || '',
          formatDate(fiche.date_insert_time),
          formatDate(fiche.date_rdv_time),
          formatDate(fiche.date_modif_time),
          getEtatName(fiche.id_etat_final),
          getConfirmateursFormatted(fiche),
          getUserName(fiche.id_commercial),
          getCentreName(fiche.id_centre),
          getProduitName(fiche.produit),
          fiche.valider > 0 ? 'validé' : '',
        ];
        
        return searchFields.some(field => 
          field.toString().toLowerCase().includes(searchLower)
        );
      });

  return (
    <div className="fiches-page">
      <div className="fiches-header">
        <h1><FaFileAlt /> Gestion des Fiches</h1>
        {/* Permissions : Admin (1, 2), Agents (3), Qualité (4), Commerciaux (5), Confirmateurs (6), Dev (7), Autres (8) */}
        {hasPermission('fiches_create') && (
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            title="Créer une nouvelle fiche client"
          >
            <FaPlus /> Créer une fiche
          </button>
        )}
      </div>

      {/* Cards de production du mois pour Agent Qualification */}
      {isAgentQualif && statsMois && (
        <div className="production-cards-container">
          <h2>Production du mois</h2>
          <div className="production-cards">
            {statsMois.data?.map((stat) => (
              <div 
                key={stat.etat_id} 
                className="production-card"
                style={{ borderLeftColor: stat.etat_color }}
              >
                <div className="production-card-header">
                  <h3>{stat.etat_nom}</h3>
                </div>
                <div className="production-card-count">
                  {stat.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panneau de recherche et filtres */}
      {!isAgentQualif && (
      <div className="search-panel">
        <div 
          className="search-panel-header"
          onClick={() => setShowFilters(!showFilters)}
        >
          <h2>
            <FaSearch /> Recherche et Filtres
          </h2>
          {showFilters ? <FaChevronUp /> : <FaChevronDown />}
        </div>

        {showFilters && (
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-form-grid">
              {/* Produits */}
              {user?.fonction !== 5 && (
                <div className="form-group">
                  <label>Produit</label>
                  <select
                    value={Array.isArray(filters.produit) ? filters.produit[0] || '' : filters.produit || ''}
                    onChange={(e) => handleFilterChange('produit', e.target.value ? e.target.value : '')}
                  >
                    <option value="">Tous les produits</option>
                    {produitsData && Array.isArray(produitsData) && produitsData.length > 0 ? (
                      produitsData.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nom || `Produit ${prod.id}`}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">PAC</option>
                        <option value="2">PV</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Nom et Prénom */}
              {user?.fonction !== 5 && (
                <>
                  <div className="form-group">
                    <label>Nom</label>
                    <input
                      type="text"
                      value={filters.nom || ''}
                      onChange={(e) => handleFilterChange('nom', e.target.value)}
                      placeholder="Nom"
                    />
                  </div>
                  <div className="form-group">
                    <label>Prénom</label>
                    <input
                      type="text"
                      value={filters.prenom || ''}
                      onChange={(e) => handleFilterChange('prenom', e.target.value)}
                      placeholder="Prénom"
                    />
                  </div>
                </>
              )}

              {/* Critère de recherche */}
              <div className="form-group">
                <label>Critère</label>
                <input
                  type="text"
                  value={filters.critere || ''}
                  onChange={(e) => handleFilterChange('critere', e.target.value)}
                  placeholder="Critère"
                  required={user?.fonction === 5}
                />
              </div>

              {/* Type de critère */}
              <div className="form-group">
                <label>Type de critère</label>
                <select
                  value={filters.critere_champ || 'tel'}
                  onChange={(e) => handleFilterChange('critere_champ', e.target.value)}
                  required={user?.fonction === 5}
                >
                  <option value="tel">Téléphone</option>
                  {user?.fonction !== 5 && (
                    <>
                      <option value="cp">Code Postal</option>
                      <option value="commentaire">Commentaire</option>
                    </>
                  )}
                </select>
              </div>

              {/* Département */}
              {(user?.fonction !== 5 && user?.fonction !== 6 && user?.fonction !== 3) && (
                <div className="form-group">
                  <label>Département(s)</label>
                  <input
                    type="text"
                    value={filters.cp || ''}
                    onChange={(e) => handleFilterChange('cp', e.target.value)}
                    placeholder="Département(s) (ex: 75 ou 75,13,69)"
                  />
                </div>
              )}

              {/* Confirmateur */}
              {user?.fonction !== 5 && user?.fonction !== 3 && (
                <div className="form-group">
                  <label>Confirmateur</label>
                  <select
                    value={filters.id_confirmateur || ''}
                    onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {confirmateurs.map(conf => (
                      <option key={conf.id} value={conf.id}>
                        {conf.pseudo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Commercial */}
              {user?.fonction !== 5 && (
                <div className="form-group">
                  <label>Commercial</label>
                  <select
                    value={filters.id_commercial || ''}
                    onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {commerciaux.map(com => (
                      <option key={com.id} value={com.id}>
                        {com.pseudo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Centre */}
              {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7) && (
                <div className="form-group">
                  <label>Centre</label>
                  <select
                    value={filters.id_centre || ''}
                    onChange={(e) => handleFilterChange('id_centre', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {centres.map(centre => (
                      <option key={centre.id} value={centre.id}>
                        {centre.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* État final */}
              <div className="form-group">
                <label>État final</label>
                <select
                  value={filters.id_etat_final || ''}
                  onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
                >
                  <option value="">Tous</option>
                  {etats.map(etat => (
                    <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color }}>
                      {etat.titre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Champ de date */}
              <div className="form-group">
                <label>Champ de date</label>
                <select
                  value={filters.date_champ || ''}
                  onChange={(e) => handleFilterChange('date_champ', e.target.value)}
                >
                  <option value="">Sélectionnez date</option>
                  <option value="date_modif_time">Date Modification</option>
                  <option value="date_insert_time">Date Insertion</option>
                  <option value="date_appel_time">Date d'appel</option>
                  {user?.fonction !== 3 && (
                    <option value="date_rdv_time">Date Planning</option>
                  )}
                </select>
              </div>

              {/* Date début */}
              <div className="form-group date-group">
                <label>Date début</label>
                <div className="date-time-inputs">
                  <input
                    type="date"
                    value={filters.date_debut || ''}
                    onChange={(e) => handleFilterChange('date_debut', e.target.value)}
                  />
                  <input
                    type="time"
                    value={filters.time_debut || '00:00:00'}
                    onChange={(e) => handleFilterChange('time_debut', e.target.value)}
                  />
                </div>
              </div>

              {/* Date fin */}
              <div className="form-group date-group">
                <label>Date fin</label>
                <div className="date-time-inputs">
                  <input
                    type="date"
                    value={filters.date_fin || ''}
                    onChange={(e) => handleFilterChange('date_fin', e.target.value)}
                  />
                  <input
                    type="time"
                    value={filters.time_fin || '23:59:59'}
                    onChange={(e) => handleFilterChange('time_fin', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="search-form-actions">
              <button type="submit" className="btn-search">
                <FaSearch /> RECHERCHE
              </button>
              <button type="button" onClick={handleReset} className="btn-reset">
                Réinitialiser
              </button>
            </div>
          </form>
        )}
      </div>
      )}

      {/* Résultats */}
      <div className="fiches-results">
        {/* Zone de recherche rapide */}
        <div className="quick-search-container" style={{ marginBottom: '16px', position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <FaSearch style={{ position: 'absolute', left: '12px', color: '#666', zIndex: 1 }} />
            <input
              type="text"
              className="quick-search-input"
              placeholder="Recherche rapide"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              style={{ 
                width: '100%',
                padding: '10px 12px 10px 40px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {quickSearch && (
              <button
                onClick={() => setQuickSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Effacer la recherche"
              >
                <FaTimes />
              </button>
            )}
          </div>
        </div>

        <div className="results-header">
          <h2>
            {quickSearch.trim() !== '' 
              ? `Résultats de la recherche rapide: ${fiches.length} fiche${fiches.length > 1 ? 's' : ''}`
              : filters.fiche_search 
                ? `Résultats de la recherche ${pagination.total}` 
                : 'Fiches créées aujourd\'hui'}
          </h2>
          <p className="results-count">
            {quickSearch.trim() !== '' 
              ? <>Affichage: <strong>{fiches.length}</strong> fiches</>
              : <>Total: <strong>{pagination.total}</strong> fiches</>}
          </p>
        </div>

        {fiches.length === 0 ? (
          <div className="no-results">
            <p>Aucune fiche trouvée{quickSearch ? ` pour "${quickSearch}"` : ''}</p>
          </div>
        ) : (
          <>
            <div className="fiches-table-container">
              <table className="fiches-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Date Insertion</th>
                    <th>Date RDV</th>
                    <th>État Final</th>
                    <th>Confirmateur</th>
                    <th>Commercial</th>
                    <th>Centre</th>
                    <th>Produit</th>
                    <th>Validé</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map((fiche) => {
                    const etatColor = getEtatColor(fiche.id_etat_final);
                    const produitColor = getProduitColor(fiche.produit);
                    
                    return (
                      <tr 
                        key={fiche.hash}
                        style={{ backgroundColor: `${etatColor}20` }}
                        className={fiche.archive ? 'archived' : ''}
                      >
                        <td data-label="">{fiche.nom || ''} {fiche.prenom || ''}</td>
                        <td data-label="Prénom:">{fiche.prenom || ''}</td>
                        <td data-label="Téléphone:">{fiche.tel || ''}</td>
                        <td data-label="CP:">{fiche.cp || ''}</td>
                        <td data-label="Date Insertion:">{formatDate(fiche.date_insert_time)}</td>
                        <td data-label="Date RDV:">{formatDate(fiche.date_rdv_time)}</td>
                        <td data-label="État:">
                          <span 
                            className="etat-badge"
                            style={{ backgroundColor: etatColor }}
                          >
                            {getEtatName(fiche.id_etat_final)}
                            {(fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') && (
                              <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '0.77em' }}>
                                (RDV_URGENT)
                              </span>
                            )}
                          </span>
                        </td>
                        <td data-label="Confirmateur:">{getConfirmateursFormatted(fiche)}</td>
                        <td data-label="Commercial:">{getUserName(fiche.id_commercial)}</td>
                        <td data-label="Centre:">{getCentreName(fiche.id_centre)}</td>
                        <td data-label="Produit:">
                          <span 
                            className="produit-indicator"
                            style={{ backgroundColor: produitColor, color: '#ffffff' }}
                            title={getProduitName(fiche.produit)}
                          >
                            {getProduitName(fiche.produit)}
                          </span>
                        </td>
                        <td data-label="Validé:" style={{ textAlign: 'center' }}>
                          {fiche.valider > 0 ? (
                            <FaCheck 
                              style={{ 
                                color: '#28a745', 
                                fontSize: '15.3px',
                                cursor: 'pointer'
                              }} 
                              title={`Validée${fiche.conf_rdv_avec ? ` avec ${fiche.conf_rdv_avec}` : ''}`}
                            />
                          ) : (
                            <span style={{ color: '#ccc' }}>-</span>
                          )}
                        </td>
                        <td data-label="">
                          <div className="fiche-actions">
                            {fiche.archive === 1 || fiche.archive === true ? (
                              <div className="fiche-indicators">
                                <span className="indicator archive" title="Archivée">ARCH</span>
                              </div>
                            ) : null}
                            <div className="action-buttons">
                              <FicheDetailLink 
                                ficheHash={fiche.hash}
                                className="btn-detail"
                                title="Voir les détails"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />
                              </FicheDetailLink>
                              <button
                                className="btn-edit"
                                onClick={() => {
                                  // Pour l'édition, on a besoin de l'ID, mais il est masqué
                                  // On peut utiliser le hash pour récupérer la fiche
                                  setEditingFiche({ ...fiche, id: null }); // L'ID sera récupéré via le hash
                                }}
                                title="Modifier"
                              >
                                <FaEdit />
                              </button>
                              {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7) && (
                                <button
                                  className="btn-archive"
                                  onClick={() => {
                                    // Pour l'archivage, on utilise le hash
                                    if (fiche.hash) {
                                      archiveMutation.mutate({ id: fiche.hash, archive: !fiche.archive });
                                    }
                                  }}
                                  title={fiche.archive ? 'Désarchiver' : 'Archiver'}
                                >
                                  <FaArchive />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handleFilterChange('page', pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Précédent
                </button>
                <span>
                  Page {pagination.page} sur {pagination.pages}
                </span>
                <button
                  onClick={() => handleFilterChange('page', pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de création */}
      {showCreateModal && (
        <FicheFormModal
          fiche={null}
          centres={centres}
          agents={agents}
          confirmateurs={confirmateurs}
          commerciaux={commerciaux}
          etats={etats}
          professions={professionsData || []}
          modeChauffage={modeChauffageData || []}
          etudeRaison={etudeRaisonData || []}
          typeContratData={typeContratData || []}
          onClose={() => setShowCreateModal(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Modal de modification */}
      {editingFiche && (
        <FicheFormModal
          fiche={editingFiche}
          centres={centres}
          agents={agents}
          confirmateurs={confirmateurs}
          commerciaux={commerciaux}
          etats={etats}
          professions={professionsData || []}
          modeChauffage={modeChauffageData || []}
          etudeRaison={etudeRaisonData || []}
          typeContratData={typeContratData || []}
          onClose={() => setEditingFiche(null)}
          onSave={(data) => updateMutation.mutate({ hash: editingFiche.hash, data })}
          isLoading={updateMutation.isLoading}
        />
      )}
    </div>
  );
};

// Composant Modal pour le formulaire de fiche
const FicheFormModal = ({ 
  fiche, 
  centres, 
  agents, 
  confirmateurs, 
  commerciaux, 
  etats,
  professions,
  modeChauffage,
  etudeRaison,
  typeContratData,
  onClose, 
  onSave, 
  isLoading 
}) => {
  const { user } = useAuth();
  const isEdit = !!fiche;
  
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(true);
  
  const [formData, setFormData] = useState({
    civ: fiche?.civ || 'MR',
    nom: fiche?.nom || '',
    prenom: fiche?.prenom || '',
    tel: fiche?.tel || '',
    gsm1: fiche?.gsm1 || '',
    gsm2: fiche?.gsm2 || '',
    email: fiche?.email || '',
    adresse: fiche?.adresse || '',
    cp: fiche?.cp || '',
    ville: fiche?.ville || '',
    situation_conjugale: fiche?.situation_conjugale || 'MARIE',
    produit: fiche?.produit || 1,
    id_centre: fiche?.id_centre || user?.centre || '',
    id_agent: fiche?.id_agent || user?.id || '',
    id_etat_final: fiche?.id_etat_final || 1,
    id_confirmateur: fiche?.id_confirmateur || '',
    id_confirmateur_2: fiche?.id_confirmateur_2 || '',
    id_confirmateur_3: fiche?.id_confirmateur_3 || '',
    id_commercial: fiche?.id_commercial || '',
    id_commercial_2: fiche?.id_commercial_2 || '',
    profession_mr: fiche?.profession_mr || '',
    profession_madame: fiche?.profession_madame || '',
    type_contrat_mr: fiche?.type_contrat_mr || '',
    type_contrat_madame: fiche?.type_contrat_madame || '',
    age_mr: fiche?.age_mr || '',
    age_madame: fiche?.age_madame || '',
    revenu_foyer: fiche?.revenu_foyer || '',
    credit_foyer: fiche?.credit_foyer || '',
    nb_enfants: fiche?.nb_enfants || '',
    proprietaire_maison: fiche?.proprietaire_maison || '',
    surface_habitable: fiche?.surface_habitable || '',
    surface_chauffee: fiche?.surface_chauffee || '',
    annee_systeme_chauffage: fiche?.annee_systeme_chauffage || '',
    mode_chauffage: fiche?.mode_chauffage || '',
    consommation_chauffage: fiche?.consommation_chauffage || '',
    consommation_electricite: fiche?.consommation_electricite || '',
    circuit_eau: fiche?.circuit_eau || '',
    nb_pieces: fiche?.nb_pieces || '',
    etude: fiche?.etude || 'NON',
    etude_raison: fiche?.etude_raison || '',
    orientation_toiture: fiche?.orientation_toiture || '',
    site_classe: fiche?.site_classe || '',
    zones_ombres: fiche?.zones_ombres || '',
    commentaire: fiche?.commentaire || '',
    date_rdv_time: fiche?.date_rdv_time ? fiche.date_rdv_time.split(' ')[0] : '',
    date_rdv_time_hour: fiche?.date_rdv_time ? fiche.date_rdv_time.split(' ')[1]?.substring(0, 5) : '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Préparer les données pour l'envoi
    const submitData = { ...formData };
    
    // Combiner date et heure du RDV
    if (submitData.date_rdv_time && submitData.date_rdv_time_hour) {
      submitData.date_rdv_time = `${submitData.date_rdv_time} ${submitData.date_rdv_time_hour}:00`;
    } else if (submitData.date_rdv_time) {
      submitData.date_rdv_time = `${submitData.date_rdv_time} 00:00:00`;
    }
    
    // Supprimer les champs temporaires
    delete submitData.date_rdv_time_hour;
    
    // Convertir les valeurs vides en null
    Object.keys(submitData).forEach(key => {
      if (submitData[key] === '') {
        submitData[key] = null;
      }
    });
    
    onSave(submitData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Modifier la fiche' : 'Créer une nouvelle fiche'}</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="fiche-form">
          <div className="form-sections">
            {/* Section Données personnelles */}
            <div className="form-section">
              <h3>Données personnelles</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Civilité *</label>
                  <select name="civ" value={formData.civ} onChange={handleChange} required>
                    <option value="MR">MR</option>
                    <option value="MME">MME</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nom *</label>
                  <input type="text" name="nom" value={formData.nom} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Prénom *</label>
                  <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Téléphone *</label>
                  <input type="tel" name="tel" value={formData.tel} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>GSM1</label>
                  <input type="tel" name="gsm1" value={formData.gsm1} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>GSM2</label>
                  <input type="tel" name="gsm2" value={formData.gsm2} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input type="text" name="adresse" value={formData.adresse} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Code postal</label>
                  <input type="text" name="cp" value={formData.cp} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Ville</label>
                  <input type="text" name="ville" value={formData.ville} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Situation conjugale</label>
                  <select name="situation_conjugale" value={formData.situation_conjugale} onChange={handleChange}>
                    <option value="MARIE">Marié</option>
                    <option value="CELIBATAIRE">Célibataire</option>
                    <option value="CONCUBINAGE">Concubinage</option>
                    <option value="VEUF/VEUVE">Veuf/Veuve</option>
                    <option value="DIVORCE">Divorcé</option>
                    <option value="PAXE">Pacsé</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section Informations professionnelles */}
            <div className="form-section">
              <h3>Informations professionnelles</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Profession Monsieur</label>
                  <select name="profession_mr" value={formData.profession_mr || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {professions.map(prof => (
                      <option key={prof.id} value={prof.id}>{prof.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Profession Madame</label>
                  <select name="profession_madame" value={formData.profession_madame || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {professions.map(prof => (
                      <option key={prof.id} value={prof.id}>{prof.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type contrat Monsieur</label>
                  <select name="type_contrat_mr" value={formData.type_contrat_mr || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {typeContratData.map(contrat => (
                      <option key={contrat.id} value={contrat.id}>{contrat.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type contrat Madame</label>
                  <select name="type_contrat_madame" value={formData.type_contrat_madame || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {typeContratData.map(contrat => (
                      <option key={contrat.id} value={contrat.id}>{contrat.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Âge Monsieur</label>
                  <input type="number" name="age_mr" value={formData.age_mr || ''} onChange={handleChange} min="0" />
                </div>
                <div className="form-group">
                  <label>Âge Madame</label>
                  <input type="number" name="age_madame" value={formData.age_madame || ''} onChange={handleChange} min="0" />
                </div>
                <div className="form-group">
                  <label>Revenu du foyer</label>
                  <input type="text" name="revenu_foyer" value={formData.revenu_foyer || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Crédit du foyer</label>
                  <input type="text" name="credit_foyer" value={formData.credit_foyer || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Nombre d'enfants</label>
                  <input type="number" name="nb_enfants" value={formData.nb_enfants || ''} onChange={handleChange} min="0" />
                </div>
              </div>
            </div>

            {/* Section Informations logement */}
            <div className="form-section">
              <h3>Informations logement</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Propriétaire de la maison</label>
                  <select name="proprietaire_maison" value={formData.proprietaire_maison || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    <option value="MR">MR</option>
                    <option value="MME">MME</option>
                    <option value="LES DEUX">LES DEUX</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Surface habitable</label>
                  <input type="text" name="surface_habitable" value={formData.surface_habitable || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Surface chauffée</label>
                  <input type="text" name="surface_chauffee" value={formData.surface_chauffee || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Année système chauffage</label>
                  <input type="number" name="annee_systeme_chauffage" value={formData.annee_systeme_chauffage || ''} onChange={handleChange} min="1970" max={new Date().getFullYear()} />
                </div>
                <div className="form-group">
                  <label>Mode de chauffage</label>
                  <select name="mode_chauffage" value={formData.mode_chauffage || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {modeChauffage.map(mode => (
                      <option key={mode.id} value={mode.id}>{mode.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Consommation chauffage</label>
                  <input type="text" name="consommation_chauffage" value={formData.consommation_chauffage || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Consommation électricité</label>
                  <input type="text" name="consommation_electricite" value={formData.consommation_electricite || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Circuit eau</label>
                  <select name="circuit_eau" value={formData.circuit_eau || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    <option value="OUI">OUI</option>
                    <option value="NON">NON</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nombre de pièces</label>
                  <input type="number" name="nb_pieces" value={formData.nb_pieces || ''} onChange={handleChange} min="0" />
                </div>
              </div>
            </div>

            {/* Section Produit et Assignation */}
            <div className="form-section">
              <h3>Produit et Assignation</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Produit *</label>
                  <select name="produit" value={formData.produit} onChange={handleChange} required>
                    <option value="1">PAC</option>
                    <option value="2">PV</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Étude</label>
                  <select name="etude" value={formData.etude} onChange={handleChange}>
                    <option value="NON">NON</option>
                    <option value="OUI">OUI</option>
                  </select>
                </div>
                {formData.etude === 'OUI' && (
                  <div className="form-group">
                    <label>Raison de l'étude</label>
                    <select name="etude_raison" value={formData.etude_raison || ''} onChange={handleChange}>
                      <option value="">Sélectionner</option>
                      {etudeRaison.map(raison => (
                        <option key={raison.id} value={raison.id}>{raison.nom}</option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.produit == 2 && (
                  <>
                    <div className="form-group">
                      <label>Orientation toiture</label>
                      <select name="orientation_toiture" value={formData.orientation_toiture || ''} onChange={handleChange}>
                        <option value="">Sélectionner</option>
                        <option value="NORD">NORD</option>
                        <option value="SUD">SUD</option>
                        <option value="EST">EST</option>
                        <option value="OUEST">OUEST</option>
                        <option value="NORD-EST">NORD-EST</option>
                        <option value="NORD-OUEST">NORD-OUEST</option>
                        <option value="SUD-EST">SUD-EST</option>
                        <option value="SUD-OUEST">SUD-OUEST</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Site classé</label>
                      <select name="site_classe" value={formData.site_classe || ''} onChange={handleChange}>
                        <option value="">Sélectionner</option>
                        <option value="OUI">OUI</option>
                        <option value="NON">NON</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Zones d'ombres</label>
                      <input type="text" name="zones_ombres" value={formData.zones_ombres || ''} onChange={handleChange} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Centre *</label>
                  <select name="id_centre" value={formData.id_centre} onChange={handleChange} required>
                    <option value="">Sélectionner</option>
                    {centres.map(centre => (
                      <option key={centre.id} value={centre.id}>{centre.titre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Agent</label>
                  <select name="id_agent" value={formData.id_agent || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Confirmateur 1</label>
                  <select name="id_confirmateur" value={formData.id_confirmateur || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {confirmateurs.map(conf => (
                      <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Confirmateur 2</label>
                  <select name="id_confirmateur_2" value={formData.id_confirmateur_2 || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {confirmateurs.map(conf => (
                      <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Confirmateur 3</label>
                  <select name="id_confirmateur_3" value={formData.id_confirmateur_3 || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {confirmateurs.map(conf => (
                      <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Commercial principal</label>
                  <select name="id_commercial" value={formData.id_commercial || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {commerciaux.map(com => (
                      <option key={com.id} value={com.id}>{com.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Commercial secondaire</label>
                  <select name="id_commercial_2" value={formData.id_commercial_2 || ''} onChange={handleChange}>
                    <option value="">Sélectionner</option>
                    {commerciaux.map(com => (
                      <option key={com.id} value={com.id}>{com.pseudo}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>État final</label>
                  <select name="id_etat_final" value={formData.id_etat_final} onChange={handleChange}>
                    {etats.map(etat => (
                      <option key={etat.id} value={etat.id}>{etat.titre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date RDV</label>
                  <input type="date" name="date_rdv_time" value={formData.date_rdv_time || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Heure RDV</label>
                  <input type="time" name="date_rdv_time_hour" value={formData.date_rdv_time_hour || ''} onChange={handleChange} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Commentaire</label>
                  <textarea name="commentaire" value={formData.commentaire || ''} onChange={handleChange} rows="3" />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Annuler
            </button>
            <button type="submit" className="btn-save" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : (isEdit ? 'Modifier' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Fiches;
