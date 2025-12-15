import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCalendarAlt, FaUser, FaFileAlt, FaMapMarkerAlt, FaSearch, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import './PlanningCommercial.css';

const PlanningCommercial = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('today'); // 'yesterday', 'today', 'tomorrow', 'week', 'nextWeek'
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 100,
    fiche_search: false,
    date_champ: 'date_rdv_time',
    date_debut: new Date().toISOString().split('T')[0], // Aujourd'hui par défaut
    date_fin: new Date().toISOString().split('T')[0],
    time_debut: '00:00:00',
    time_fin: '23:59:59',
    id_etat_final: user?.fonction === 5 ? '7' : '' // Pour commerciaux : pré-sélectionner CONFIRMER (7)
  });

  // Fonctions pour calculer les dates
  const getDateRange = (period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(period) {
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        return {
          date_debut: dateStr,
          date_fin: dateStr,
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
      }
      case 'today': {
        const dateStr = today.toISOString().split('T')[0];
        return {
          date_debut: dateStr,
          date_fin: dateStr,
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
      }
      case 'tomorrow': {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        return {
          date_debut: dateStr,
          date_fin: dateStr,
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
      }
      case 'week': {
        // Semaine actuelle : lundi à dimanche
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si dimanche, aller au lundi précédent
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return {
          date_debut: monday.toISOString().split('T')[0],
          date_fin: sunday.toISOString().split('T')[0],
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
      }
      case 'nextWeek': {
        // Semaine prochaine : lundi à dimanche
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si dimanche, aller au lundi précédent
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() + diff);
        
        // Lundi de la semaine prochaine (7 jours après le lundi actuel)
        const nextMonday = new Date(currentMonday);
        nextMonday.setDate(currentMonday.getDate() + 7);
        
        // Dimanche de la semaine prochaine
        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 6);
        
        return {
          date_debut: nextMonday.toISOString().split('T')[0],
          date_fin: nextSunday.toISOString().split('T')[0],
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
      }
      default:
        return {
          date_debut: today.toISOString().split('T')[0],
          date_fin: today.toISOString().split('T')[0],
          time_debut: '00:00:00',
          time_fin: '23:59:59'
        };
    }
  };

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data;
  });

  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data;
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data;
  });

  const { data: produitsData } = useQuery('produits', async () => {
    try {
      const res = await api.get('/management/produits');
      return res.data.data || [];
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      return [];
    }
  });

  // Filtrer les utilisateurs par fonction
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const centres = centresData ? centresData.filter(c => c.etat > 0) : [];
  const etats = etatsData || [];

  // Pour les commerciaux : filtrer uniquement les états de Phase 3 + CONFIRMER (état 7)
  // Note: groupe est un VARCHAR dans la base, donc on compare avec des chaînes
  const etatsPhase3 = etats.filter(e => String(e.groupe) === '3' || e.groupe === 3);
  const etatConfirmer = etats.find(e => e.id === 7); // CONFIRMER (état 7) - Phase 2
  const etatsFiltres = user?.fonction === 5 
    ? [...(etatConfirmer ? [etatConfirmer] : []), ...etatsPhase3] // CONFIRMER + Phase 3
    : etats;
  
  // Pour les commerciaux : pré-sélectionner l'état CONFIRMER (7) par défaut
  const etatParDefaut = user?.fonction === 5 ? '7' : '';

  // Construire les paramètres de requête
  const getQueryParams = () => {
    if (filters.fiche_search) {
      const searchParams = { ...filters, fiche_search: 1 };
      
      // Pour commerciaux : forcer l'état à Phase 3 (ou CONFIRMER si non spécifié)
      if (user?.fonction === 5) {
        if (!searchParams.id_etat_final || searchParams.id_etat_final === '') {
          searchParams.id_etat_final = '7'; // CONFIRMER par défaut
        }
      }
      
      // Nettoyer les paramètres vides
      Object.keys(searchParams).forEach(key => {
        if (key === 'page' || key === 'limit' || key === 'fiche_search') {
          return;
        }
        if (searchParams[key] === '' || searchParams[key] === null || searchParams[key] === undefined) {
          delete searchParams[key];
        }
      });
      
      return searchParams;
    }
    
    // Utiliser les dates de l'onglet actif si pas de recherche personnalisée
    const dateRange = getDateRange(activeTab || 'today');
    
    // Par défaut : selon l'onglet actif
    const defaultParams = {
      page: filters.page || 1,
      limit: filters.limit || 100,
      date_champ: 'date_rdv_time',
      date_debut: dateRange.date_debut,
      date_fin: dateRange.date_fin,
      time_debut: dateRange.time_debut,
      time_fin: dateRange.time_fin
    };
    
    // Pour commerciaux : forcer l'état CONFIRMER (7)
    if (user?.fonction === 5) {
      defaultParams.id_etat_final = '7';
    }
    
    return defaultParams;
  };

  // Récupérer les RDV des commerciaux avec mise à jour automatique
  const { data, isLoading, error, refetch } = useQuery(
    ['planning-commercial', filters],
    async () => {
      const params = getQueryParams();
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) delete params[key];
      });
      const res = await api.get('/fiches/planning-commercial', { params });
      return res.data;
    },
    {
      refetchInterval: 30000, // Rafraîchir automatiquement toutes les 30 secondes
      refetchOnWindowFocus: true, // Rafraîchir quand l'utilisateur revient sur la page
      refetchOnMount: true, // Rafraîchir à chaque montage du composant
      staleTime: 15000, // Considérer les données comme périmées après 15 secondes
      onError: (err) => {
        console.error("Erreur lors du chargement du planning commercial:", err);
        toast.error(`Erreur: ${err.response?.data?.message || err.message}`);
      }
    }
  );

  const handleFilterChange = (key, value) => {
    // Si l'utilisateur modifie manuellement les dates, désactiver l'onglet actif
    if (key === 'date_debut' || key === 'date_fin') {
      setActiveTab(null);
    }
    
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset à la page 1 lors d'un changement de filtre
      fiche_search: false // Réinitialiser le flag de recherche si on change un filtre
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveTab(null); // Désactiver l'onglet actif lors d'une recherche personnalisée
    setFilters(prev => ({ ...prev, fiche_search: true, page: 1 }));
    refetch();
  };

  const handleReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setActiveTab('today'); // Réinitialiser à l'onglet "Aujourd'hui"
    setFilters({
      page: 1,
      limit: 100,
      fiche_search: false,
      date_champ: 'date_rdv_time',
      date_debut: today,
      date_fin: today,
      time_debut: '00:00:00',
      time_fin: '23:59:59',
      id_etat_final: user?.fonction === 5 ? '7' : '' // Pour commerciaux : réinitialiser à CONFIRMER
    });
  };

  // Gérer le changement d'onglet
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const dateRange = getDateRange(tab);
    setFilters(prev => ({
      ...prev,
      fiche_search: false, // Désactiver la recherche personnalisée
      page: 1,
      date_debut: dateRange.date_debut,
      date_fin: dateRange.date_fin,
      time_debut: dateRange.time_debut,
      time_fin: dateRange.time_fin
    }));
  };

  // Format date
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

  // Obtenir la couleur de l'état
  const getEtatColor = (etatId) => {
    const etat = etats.find(e => e.id === etatId);
    return etat?.color || '#cccccc';
  };

  // Obtenir le nom du produit
  const getProduitName = (produitId) => {
    return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
  };

  // Obtenir la couleur du produit
  const getProduitColor = (produitId) => {
    return produitId === 1 ? '#0000CD' : produitId === 2 ? '#FFE441' : '#cccccc';
  };

  // Obtenir le nom du commercial
  const getCommercialName = (fiche) => {
    const names = [];
    if (fiche.commercial_pseudo) names.push(fiche.commercial_pseudo);
    if (fiche.commercial_2_pseudo) names.push(fiche.commercial_2_pseudo);
    return names.length > 0 ? names.join(' / ') : '-';
  };

  if (isLoading && !data) {
    return (
      <div className="planning-commercial-loading">
        <div className="spinner"></div>
        <p>Chargement du planning commercial...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-commercial-error">
        <p>Erreur lors du chargement du planning commercial</p>
        <button onClick={() => refetch()}>Réessayer</button>
      </div>
    );
  }

  const fiches = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };

  return (
    <div className="planning-commercial">
      <div className="planning-commercial-header">
        <div className="planning-commercial-header-left">
          <h1><FaCalendarAlt /> Planning Commercial</h1>
          <p>Liste des rendez-vous confirmés et affectés aux commerciaux</p>
        </div>
      </div>

      {/* Panneau de recherche et filtres - Visible seulement pour non-commerciaux */}
      {user?.fonction !== 5 && (
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

                {/* Nom et Prénom */}
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

                {/* Critère de recherche */}
                <div className="form-group">
                  <label>Critère</label>
                  <input
                    type="text"
                    value={filters.critere || ''}
                    onChange={(e) => handleFilterChange('critere', e.target.value)}
                    placeholder="Critère"
                  />
                </div>

                {/* Type de critère */}
                <div className="form-group">
                  <label>Type de critère</label>
                  <select
                    value={filters.critere_champ || 'tel'}
                    onChange={(e) => handleFilterChange('critere_champ', e.target.value)}
                  >
                    <option value="tel">Téléphone</option>
                    <option value="cp">Code Postal</option>
                    <option value="commentaire">Commentaire</option>
                  </select>
                </div>

                {/* Département */}
                {(user?.fonction !== 6 && user?.fonction !== 3) && (
                  <div className="form-group">
                    <label>Département</label>
                    <input
                      type="text"
                      value={filters.cp || ''}
                      onChange={(e) => handleFilterChange('cp', e.target.value)}
                      placeholder="Département (ex: 75)"
                      maxLength="2"
                    />
                  </div>
                )}

                {/* Confirmateur */}
                {user?.fonction !== 3 && (
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
                    {etatsFiltres.map(etat => (
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

              <div className="form-actions">
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

      {/* Onglets pour accès rapide */}
      <div className="planning-commercial-tabs">
        <button
          className={`tab-button ${activeTab === 'yesterday' ? 'active' : ''}`}
          onClick={() => handleTabChange('yesterday')}
        >
          <FaCalendarAlt /> RDV d'hier
        </button>
        <button
          className={`tab-button ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => handleTabChange('today')}
        >
          <FaCalendarAlt /> RDV aujourd'hui
        </button>
        <button
          className={`tab-button ${activeTab === 'tomorrow' ? 'active' : ''}`}
          onClick={() => handleTabChange('tomorrow')}
        >
          <FaCalendarAlt /> RDV de demain
        </button>
        <button
          className={`tab-button ${activeTab === 'week' ? 'active' : ''}`}
          onClick={() => handleTabChange('week')}
        >
          <FaCalendarAlt /> RDV de la semaine
        </button>
        <button
          className={`tab-button ${activeTab === 'nextWeek' ? 'active' : ''}`}
          onClick={() => handleTabChange('nextWeek')}
        >
          <FaCalendarAlt /> Semaine prochaine
        </button>
      </div>

      {/* Résultats */}
      <div className="planning-commercial-results">
        <div className="results-header">
          <h2>
            {filters.fiche_search 
              ? 'Résultats de la recherche' 
              : activeTab === 'yesterday'
                ? 'RDV confirmés d\'hier'
                : activeTab === 'today'
                  ? 'RDV confirmés aujourd\'hui'
                  : activeTab === 'tomorrow'
                    ? 'RDV confirmés de demain'
                    : activeTab === 'week'
                      ? 'RDV confirmés de la semaine'
                      : activeTab === 'nextWeek'
                        ? 'RDV confirmés de la semaine prochaine'
                        : 'RDV confirmés des commerciaux'}
          </h2>
          <div className="results-header-right">
            <div className="limit-selector">
              <label htmlFor="limit-select">Afficher :</label>
              <select
                id="limit-select"
                value={filters.limit === 999999 ? 'all' : filters.limit}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange('limit', value === 'all' ? 999999 : parseInt(value));
                  handleFilterChange('page', 1);
                }}
                className="limit-select"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="all">Tout</option>
              </select>
            </div>
            <p className="results-count">
              Total: <strong>{pagination.total}</strong> RDV
            </p>
          </div>
        </div>

        {fiches.length === 0 ? (
          <div className="no-results">
            <p>Aucun RDV trouvé</p>
          </div>
        ) : (
          <>
            <div className="fiches-table-container">
              <table className="fiches-table">
                <thead>
                  <tr>
                    <th>Date RDV</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Ville</th>
                    <th>Commercial</th>
                    <th>Produit</th>
                    <th>État</th>
                    <th>Compte rendu</th>
                    <th>Centre</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map((fiche) => {
                    const etatColor = getEtatColor(fiche.id_etat_final);
                    const produitColor = getProduitColor(fiche.produit);
                    const hasCompteRendu = fiche.has_compte_rendu === 1 || fiche.has_compte_rendu === true;
                    
                    return (
                      <tr 
                        key={fiche.hash}
                        style={{ backgroundColor: `${etatColor}20` }}
                      >
                        <td data-label="Date RDV:">
                          <strong>{formatDate(fiche.date_rdv_time)}</strong>
                          {fiche.rdv_urgent === 1 || fiche.qualification_code === 'RDV_URGENT' ? (
                            <span style={{ 
                              marginLeft: '8px', 
                              fontWeight: 'bold', 
                              fontSize: '0.77em',
                              color: '#ff0000'
                            }}>
                              (URGENT)
                            </span>
                          ) : null}
                        </td>
                        <td data-label="Nom:">{fiche.nom || ''}</td>
                        <td data-label="Prénom:">{fiche.prenom || ''}</td>
                        <td data-label="Téléphone:">{fiche.tel || ''}</td>
                        <td data-label="CP:">{fiche.cp || ''}</td>
                        <td data-label="Ville:">{fiche.ville || ''}</td>
                        <td data-label="Commercial:">
                          <span style={{ fontWeight: '500' }}>
                            {getCommercialName(fiche)}
                          </span>
                        </td>
                        <td data-label="Produit:">
                          <span 
                            className="produit-badge"
                            style={{ backgroundColor: produitColor }}
                          >
                            {getProduitName(fiche.produit)}
                          </span>
                        </td>
                        <td data-label="État:">
                          <span 
                            className="etat-badge"
                            style={{ backgroundColor: etatColor }}
                          >
                            {fiche.etat_titre || 'N/A'}
                          </span>
                        </td>
                        <td data-label="Compte rendu:">
                          {hasCompteRendu ? (
                            <span 
                              className="compte-rendu-badge"
                              style={{ 
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.85em',
                                fontWeight: 'bold'
                              }}
                              title="Un compte rendu a été rédigé"
                            >
                              ✓ Rédigé
                            </span>
                          ) : (
                            <span 
                              className="compte-rendu-badge"
                              style={{ 
                                backgroundColor: '#f44336',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.85em',
                                fontWeight: 'bold'
                              }}
                              title="Aucun compte rendu rédigé"
                            >
                              ✗ Non rédigé
                            </span>
                          )}
                        </td>
                        <td data-label="Centre:">{fiche.centre_titre || '-'}</td>
                        <td data-label="">
                          <FicheDetailLink 
                            ficheHash={fiche.hash}
                            className="btn-detail"
                          >
                            Détails
                          </FicheDetailLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && filters.limit !== 999999 && (
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
    </div>
  );
};

export default PlanningCommercial;

