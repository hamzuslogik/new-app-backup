import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import api from '../config/api';
import { FaSearch, FaChevronDown, FaChevronUp, FaFileAlt, FaCalendarAlt, FaChartBar, FaComments, FaCheck, FaHome, FaCalendarCheck, FaCalendarTimes, FaSort, FaSortUp, FaSortDown, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import FicheDetailModal from '../components/FicheDetailModal';
import './Dashboard.css';

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const { setAutoHide, isDesktop } = useSidebar();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = 'confirmed'; // Toujours 'confirmed' puisqu'il n'y a plus d'onglet
  
  // Forcer le viewport à 1400px pour désactiver la responsivité mobile
  useEffect(() => {
    // Sauvegarder le viewport original
    const originalViewport = document.querySelector('meta[name="viewport"]');
    const originalContent = originalViewport?.getAttribute('content') || '';
    
    // Créer ou modifier la balise meta viewport
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1400');
    
    // Ajouter une classe au body pour cibler uniquement cette page
    document.body.classList.add('dashboard-page');
    document.documentElement.classList.add('dashboard-page');
    
    // Forcer les styles sur html et body
    document.documentElement.style.width = '1400px';
    document.documentElement.style.maxWidth = 'none';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.width = '1400px';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'hidden';
    
    // Nettoyage au démontage du composant
    return () => {
      // Restaurer le viewport original
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }
      
      // Retirer la classe du body
      document.body.classList.remove('dashboard-page');
      document.documentElement.classList.remove('dashboard-page');
      
      // Restaurer les styles html et body
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';
    };
  }, []);
  
  // Pour Confirmateur (fonction 6) et RE Confirmation (fonction 14)
  const isConfirmateur = user?.fonction === 6;
  const isREConfirmation = user?.fonction === 14;
  const isConfirmateurOrRE = isConfirmateur || isREConfirmation;
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    fiche_search: false,
  });
  
  // Lire les paramètres de l'URL et les appliquer aux filtres
  useEffect(() => {
    const urlParams = Object.fromEntries(searchParams.entries());
    if (Object.keys(urlParams).length > 0 && urlParams.fiche_search === '1') {
      // Convertir les paramètres de l'URL en filtres
      const newFilters = {
        page: parseInt(urlParams.page) || 1,
        limit: parseInt(urlParams.limit) || 10,
        fiche_search: true,
        ...urlParams
      };
      // Convertir id_etat_final en nombre si présent
      if (newFilters.id_etat_final) {
        newFilters.id_etat_final = parseInt(newFilters.id_etat_final);
      }
      setFilters(newFilters);
      // Ouvrir automatiquement les filtres si des paramètres sont présents
      setShowFilters(true);
    }
  }, [searchParams]);
  const [sortConfig, setSortConfig] = useState({
    key: 'date_rdv_time', // Tri par défaut sur la date de RDV
    direction: 'asc', // 'asc' or 'desc'
  });
  const [selectedFicheHash, setSelectedFicheHash] = useState(null);
  const [showConfirmateursTable, setShowConfirmateursTable] = useState(false); // Fermé par défaut
  const [quickSearch, setQuickSearch] = useState(''); // Recherche rapide

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data;
  });

  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data;
  });

  const { data: etatsData, isLoading: isLoadingEtats, error: etatsError } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    console.log('États récupérés:', res.data.data);
    return res.data.data;
  });

  // Récupérer les produits
  const { data: produitsData } = useQuery('produits', async () => {
    try {
      const res = await api.get('/management/produits');
      return res.data.data || [];
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      return [];
    }
  });

  // Calculer la date d'aujourd'hui (début et fin de journée)
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

  // Construire les paramètres selon l'onglet actif
  const getQueryParams = () => {
    const { dateStr, timeStart, timeEnd } = getTodayDateRange();
    // Si limit est 999999 (Tout) ou si recherche rapide active, utiliser une valeur très élevée pour récupérer toutes les fiches
    const isQuickSearchActive = quickSearch.trim() !== '';
    const limitParam = isQuickSearchActive ? 999999 : (filters.limit === 999999 ? 999999 : filters.limit);
    const pageParam = isQuickSearchActive ? 1 : (filters.page || 1);
    
    // Si une recherche a été effectuée (fiche_search = true), utiliser les filtres personnalisés
    if (filters.fiche_search) {
      // Utiliser les filtres personnalisés de l'utilisateur
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
    
    // Sinon, appliquer les filtres par défaut selon l'onglet actif
    const baseParams = { 
      page: pageParam,
      limit: limitParam
    };
    
    // Fiches CONFIRMER (7) uniquement et RDV_URGENT modifiées aujourd'hui
    return {
      ...baseParams,
      id_etat_final: [7], // CONFIRMER uniquement (exclure ANNULER ET A REPROGRAMMER - état 8)
      qualification_code: 'RDV_URGENT', // Inclure aussi les RDV_URGENT (peuvent être en état 7)
      date_champ: 'date_modif_time',
      date_debut: dateStr,
      date_fin: dateStr,
      time_debut: timeStart,
      time_fin: timeEnd,
    };
  };

  // Récupérer les statistiques des RDV
  const { data: dashboardStats, isLoading: isLoadingStats, error: statsError } = useQuery(
    'dashboard-stats',
    async () => {
      const res = await api.get('/statistiques/dashboard');
      console.log('Statistiques Dashboard reçues:', res.data.data);
      console.log('Confirmateurs:', res.data.data?.confirmateurs);
      return res.data.data;
    },
    {
      refetchInterval: 60000, // Rafraîchir toutes les minutes
    }
  );

  // Récupérer les fiches
  const { data, isLoading, error, refetch } = useQuery(
    ['fiches', filters, activeTab, quickSearch],
    async () => {
      console.time('[PERF] Requête API fiches - Total');
      console.log('[PERF] Début chargement fiches - Paramètres:', { filters, activeTab, quickSearch });
      
      const params = getQueryParams();
      console.log('[PERF] Paramètres de requête générés:', params);
      
      const requestStartTime = performance.now();
      const response = await api.get('/fiches', { params });
      const requestEndTime = performance.now();
      const requestDuration = requestEndTime - requestStartTime;
      
      console.log(`[PERF] Requête API terminée en ${requestDuration.toFixed(2)}ms`);
      console.log(`[PERF] Nombre de fiches reçues: ${response.data?.data?.length || 0}`);
      console.log(`[PERF] Pagination:`, response.data?.pagination);
      
      console.timeEnd('[PERF] Requête API fiches - Total');
      return response.data;
    },
    { keepPreviousData: true }
  );

  // Filtrer les utilisateurs par fonction
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const centres = centresData ? centresData.filter(c => c.etat > 0) : [];
  const etats = etatsData || [];

  // Grouper les états par phase
  // Note: groupe est un VARCHAR dans la base, donc on compare avec des chaînes
  const etatsPhase1 = etats.filter(e => String(e.groupe) === '1' || e.groupe === 1);
  const etatsPhase2 = etats.filter(e => String(e.groupe) === '2' || e.groupe === 2);
  const etatsPhase3 = etats.filter(e => String(e.groupe) === '3' || e.groupe === 3);

  // Debug: afficher les états et leurs groupes
  if (etats.length > 0) {
    console.log('États chargés:', etats.length);
    console.log('États Phase 1:', etatsPhase1.length, etatsPhase1.map(e => ({ id: e.id, titre: e.titre, groupe: e.groupe })));
    console.log('États Phase 2:', etatsPhase2.length, etatsPhase2.map(e => ({ id: e.id, titre: e.titre, groupe: e.groupe })));
    console.log('États Phase 3:', etatsPhase3.length, etatsPhase3.map(e => ({ id: e.id, titre: e.titre, groupe: e.groupe })));
  }
  
  if (etatsError) {
    console.error('Erreur lors du chargement des états:', etatsError);
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Reset à la page 1 seulement si ce n'est pas un changement de page
      page: key === 'page' ? value : 1
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
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
      limit: 10,
      fiche_search: false,
    });
    // Réinitialiser aussi les filtres de date pour revenir aux valeurs par défaut
    queryClient.invalidateQueries(['fiches']);
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

  // Vérifier les indicateurs dans l'historique basés sur les titres des états
  const checkIndicators = (histoString) => {
    if (!histoString || !etatsData) return { r2: false, rf: false, an: false };
    
    const histoArray = histoString.split(',').map(Number);
    let hasAnnuler = false;
    let hasRefuser = false;
    let hasR2 = false;
    
    // Vérifier chaque ID dans l'historique
    histoArray.forEach(etatId => {
      const etat = etatsData.find(e => e.id === etatId);
      if (etat && etat.titre) {
        const titre = etat.titre.toUpperCase();
        // Vérifier si "RDV ANNULER" est présent dans le titre
        if (titre.includes('RDV ANNULER')) {
          hasAnnuler = true;
        }
        // Vérifier si "REFUSER" est présent dans le titre
        if (titre.includes('REFUSER')) {
          hasRefuser = true;
        }
        // Vérifier pour R2 (CLIENT HONORE A SUIVRE = état 9)
        if (etatId === 9 || titre.includes('CLIENT HONORE')) {
          hasR2 = true;
        }
      }
    });
    
    return {
      r2: hasR2,
      rf: hasRefuser,
      an: hasAnnuler
    };
  };

  // Obtenir le nom de l'utilisateur
  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  // Obtenir le nom du centre
  const getCentreName = (centreId) => {
    if (!centreId || !centresData) return '';
    const centre = centresData.find(c => c.id === centreId);
    return centre?.titre || '';
  };

  // Obtenir le nom de l'état
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

  // Déclarer fichesData avant les early returns pour pouvoir l'utiliser dans les hooks
  const fichesData = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };
  
  // Log performance après chargement des données
  useEffect(() => {
    if (fichesData.length > 0) {
      console.log(`[PERF] Fiches chargées en mémoire: ${fichesData.length}`);
      console.log(`[PERF] Pagination actuelle: page ${pagination.page}/${pagination.pages}, total: ${pagination.total}`);
    }
  }, [fichesData.length, pagination.page, pagination.pages, pagination.total]);

  // Masquer automatiquement le sidebar quand il y a des données dans le tableau (sur desktop uniquement)
  // IMPORTANT: Ce useEffect doit être appelé AVANT tous les early returns pour respecter les règles des hooks React
  useEffect(() => {
    if (isDesktop !== undefined && isDesktop) {
      if (fichesData && fichesData.length > 0) {
        setAutoHide(true);
      } else {
        setAutoHide(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichesData.length, isDesktop]);

  // Log performance total du traitement - IMPORTANT: Avant les early returns
  // Cette variable sera utilisée dans le useEffect, mais elle doit être déclarée avant
  // Les calculs seront faits après les early returns
  const [processedFichesCount, setProcessedFichesCount] = useState(0);
  
  useEffect(() => {
    if (processedFichesCount > 0) {
      console.log(`[PERF] === RÉSUMÉ PERFORMANCE ===`);
      console.log(`[PERF] Fiches après traitement: ${processedFichesCount}`);
      console.log(`[PERF] Recherche rapide active: ${quickSearch.trim() !== '' ? 'Oui (' + quickSearch + ')' : 'Non'}`);
      console.log(`[PERF] Tri actif: ${sortConfig.key ? sortConfig.key + ' (' + sortConfig.direction + ')' : 'Non'}`);
      console.log(`[PERF] ========================`);
    }
  }, [processedFichesCount, quickSearch, sortConfig.key, sortConfig.direction]);

  if (isLoading && !data) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Chargement des fiches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>Erreur lors du chargement des fiches</p>
        <button onClick={() => refetch()}>Réessayer</button>
      </div>
    );
  }

  // Mapping des colonnes aux clés de données
  const columnKeys = {
    'Nom': 'nom',
    'Prénom': 'prenom',
    'Téléphone': 'tel',
    'CP': 'cp',
    'Date Insertion': 'date_insert_time',
    'Date RDV': 'date_rdv_time',
    'État Final': 'id_etat_final',
    'Confirmateur': 'id_confirmateur',
    'Commercial': 'id_commercial',
    'Centre': 'id_centre',
    'Produit': 'produit',
    'Validé': 'valider',
  };

  // Fonction de tri
  const handleSort = (columnName) => {
    const key = columnKeys[columnName];
    if (!key) return;

    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Fonction pour obtenir l'icône de tri
  const getSortIcon = (columnName) => {
    const key = columnKeys[columnName];
    if (!key || sortConfig.key !== key) {
      return <FaSort className="sort-icon" />;
    }
    return sortConfig.direction === 'asc' 
      ? <FaSortUp className="sort-icon sort-active" />
      : <FaSortDown className="sort-icon sort-active" />;
  };

  // Fonction pour obtenir la valeur de tri pour une colonne
  const getSortValue = (fiche, key) => {
    // Pour les colonnes avec valeurs transformées, utiliser les fonctions helper
    if (key === 'id_confirmateur') {
      return getConfirmateursFormatted(fiche).toLowerCase();
    }
    if (key === 'id_commercial') {
      return getUserName(fiche.id_commercial).toLowerCase();
    }
    if (key === 'id_centre') {
      return getCentreName(fiche.id_centre).toLowerCase();
    }
    if (key === 'id_etat_final') {
      return getEtatName(fiche.id_etat_final).toLowerCase();
    }
    if (key === 'produit') {
      return getProduitName(fiche.produit).toLowerCase();
    }
    
    // Pour les autres colonnes, utiliser la valeur brute
    let value = fiche[key];
    if (value == null) value = '';
    
    // Pour les dates, retourner le timestamp
    if (key.includes('date') || key.includes('time')) {
      return new Date(value || 0).getTime();
    }
    
    // Sinon, retourner la chaîne en minuscules
    return String(value).toLowerCase();
  };

  // Fonction pour trier les fiches
  // Performance: Mesure du temps de tri
  const sortStartTime = performance.now();
  const sortedFiches = [...fichesData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
  const sortEndTime = performance.now();
  if (fichesData.length > 0 && sortConfig.key) {
    console.log(`[PERF] Tri de ${fichesData.length} fiches par "${sortConfig.key}" (${sortConfig.direction}) effectué en ${(sortEndTime - sortStartTime).toFixed(2)}ms`);
  }

  // Filtrer les fiches selon la recherche rapide
  // Performance: Filtrage des fiches
  const filterStartTime = performance.now();
  const filteredFiches = quickSearch.trim() === '' 
    ? sortedFiches 
    : sortedFiches.filter(fiche => {
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
          (fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') ? 'rdv urgent' : ''
        ];
        
        return searchFields.some(field => 
          field.toString().toLowerCase().includes(searchLower)
        );
      });
  const filterEndTime = performance.now();
  if (quickSearch.trim() !== '' && sortedFiches.length > 0) {
    console.log(`[PERF] Filtrage de ${sortedFiches.length} fiches avec "${quickSearch}" effectué en ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    console.log(`[PERF] Résultats après filtrage: ${filteredFiches.length} fiches (${((filteredFiches.length / sortedFiches.length) * 100).toFixed(1)}%)`);
  }

  const fiches = filteredFiches;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1><FaHome /> Tableau de bord</h1>
          <p>Bienvenue, {user?.pseudo || 'Utilisateur'}</p>
        </div>
      </div>

      {/* Section des statistiques RDV */}
      {!isLoadingStats && dashboardStats && (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // URL pour "confirmer de la journée"
        const confirmesUrl = `/dashboard?fiche_search=1&id_etat_final=7&date_champ=date_modif_time&date_debut=${todayStr}&date_fin=${todayStr}&time_debut=00:00:00&time_fin=23:59:59`;
        
        // URL pour "annuler à reprogrammer"
        const annulerUrl = `/dashboard?fiche_search=1&id_etat_final=8&date_champ=date_modif_time&date_debut=${todayStr}&date_fin=${todayStr}&time_debut=00:00:00&time_fin=23:59:59`;
        
        // URL pour "rdv à venir"
        const rdvVenirUrl = `/dashboard?fiche_search=1&id_etat_final=7&date_champ=date_rdv_time&date_debut=${todayStr}&time_debut=00:00:00`;
        
        return (
          <div className="dashboard-stats-section">
            <div className="stats-cards">
              {/* Confirmer de la journée */}
              <Link to={confirmesUrl} className="stat-card stat-card-success">
                <div className="stat-card-icon">
                  <FaCalendarCheck />
                </div>
                <div className="stat-card-content">
                  <div className="stat-card-value">{dashboardStats.rdvTodayConfirmed || 0}</div>
                  <div className="stat-card-label">Confirmer de la journée</div>
                </div>
              </Link>

              {/* Annuler à reprogrammer */}
              <Link to={annulerUrl} className="stat-card stat-card-warning">
                <div className="stat-card-icon">
                  <FaCalendarTimes />
                </div>
                <div className="stat-card-content">
                  <div className="stat-card-value">{dashboardStats.rdvTodayAnnuler || 0}</div>
                  <div className="stat-card-label">Annuler à reprogrammer</div>
                </div>
              </Link>

              {/* RDV à venir */}
              <Link to={rdvVenirUrl} className="stat-card stat-card-info">
                <div className="stat-card-icon">
                  <FaCalendarAlt />
                </div>
                <div className="stat-card-content">
                  <div className="stat-card-value">{dashboardStats.rdvUpcoming || 0}</div>
                  <div className="stat-card-label">RDV à venir</div>
                </div>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Panneau de recherche et filtres */}
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
                {isLoadingEtats ? (
                  <select disabled>
                    <option>Chargement...</option>
                  </select>
                ) : etatsError ? (
                  <select disabled>
                    <option>Erreur de chargement</option>
                  </select>
                ) : (
                  <select
                    value={filters.id_etat_final || ''}
                    onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {etatsPhase1.length > 0 && (
                      <optgroup label="PHASE 1">
                        {etatsPhase1.map(etat => (
                          <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                            {etat.titre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {etatsPhase2.length > 0 && (
                      <optgroup label="PHASE 2">
                        {etatsPhase2.map(etat => (
                          <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                            {etat.titre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {etatsPhase3.length > 0 && (
                      <optgroup label="PHASE 3">
                        <option value="t_s" style={{ backgroundColor: '#FF3380' }}>TOUT SIGNER</option>
                        {etatsPhase3.map(etat => (
                          <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                            {etat.titre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {/* Si aucun état n'est trouvé dans les phases, afficher tous les états */}
                    {etatsPhase1.length === 0 && etatsPhase2.length === 0 && etatsPhase3.length === 0 && etats.length > 0 && (
                      <>
                        {etats.map(etat => (
                          <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                            {etat.titre}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
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

      {/* Résultats */}
      <div className="dashboard-results">
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
                : `${pagination.total}`}
          </h2>
          {isLoading && (
            <div className="search-loading-indicator">
              <div className="spinner-small"></div>
              <span>Recherche en cours...</span>
            </div>
          )}
        </div>

        {isLoading && fiches.length === 0 ? (
          <div className="dashboard-loading">
            <div className="spinner"></div>
            <p>Chargement des résultats de recherche...</p>
            <div className="table-skeleton" style={{ marginTop: '24px', width: '100%' }}>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="table-skeleton-row" style={{ marginBottom: '8px', height: '45px' }}></div>
              ))}
            </div>
          </div>
        ) : fiches.length === 0 ? (
          <div className="no-results">
            <p>Aucune fiche trouvée{quickSearch ? ` pour "${quickSearch}"` : ''}</p>
          </div>
        ) : (
          <>
            <div className={`fiches-table-container ${isLoading ? 'loading' : ''}`}>
              <table className="fiches-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('Nom')} className="sortable-header">
                      Nom {getSortIcon('Nom')}
                    </th>
                    <th onClick={() => handleSort('Prénom')} className="sortable-header">
                      Prénom {getSortIcon('Prénom')}
                    </th>
                    <th onClick={() => handleSort('Téléphone')} className="sortable-header">
                      Téléphone {getSortIcon('Téléphone')}
                    </th>
                    <th onClick={() => handleSort('CP')} className="sortable-header">
                      CP {getSortIcon('CP')}
                    </th>
                    <th onClick={() => handleSort('Date Insertion')} className="sortable-header">
                      Date Insertion {getSortIcon('Date Insertion')}
                    </th>
                    <th onClick={() => handleSort('Date RDV')} className="sortable-header">
                      Date RDV {getSortIcon('Date RDV')}
                    </th>
                    <th onClick={() => handleSort('État Final')} className="sortable-header">
                      État Final {getSortIcon('État Final')}
                    </th>
                    <th onClick={() => handleSort('Confirmateur')} className="sortable-header">
                      Confirmateur {getSortIcon('Confirmateur')}
                    </th>
                    <th onClick={() => handleSort('Commercial')} className="sortable-header">
                      Commercial {getSortIcon('Commercial')}
                    </th>
                    <th onClick={() => handleSort('Centre')} className="sortable-header">
                      Centre {getSortIcon('Centre')}
                    </th>
                    <th onClick={() => handleSort('Produit')} className="sortable-header">
                      Produit {getSortIcon('Produit')}
                    </th>
                    <th onClick={() => handleSort('Validé')} className="sortable-header">
                      Validé {getSortIcon('Validé')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map((fiche) => {
                    const indicators = checkIndicators(fiche.id_etat_histo);
                    const etatColor = getEtatColor(fiche.id_etat_final);
                    const produitColor = getProduitColor(fiche.produit);
                    
                    return (
                      <tr 
                        key={fiche.hash}
                        style={{ backgroundColor: `${etatColor}20` }}
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
                          <div className="fiche-indicators">
                            {indicators.r2 && <span className="indicator r2" title="Rappel">R2</span>}
                            {indicators.rf && <span className="indicator rf" title="Refus">REF</span>}
                            {indicators.an && <span className="indicator an" title="Annulation">ANN</span>}
                          </div>
                          <button
                            onClick={() => setSelectedFicheHash(fiche.hash)}
                            className="btn-detail"
                            title="Voir les détails"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <FaSearch style={{ color: '#ffffff', fontSize: '11.9px' }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-container">
              <div className="limit-selector">
                <label htmlFor="limit-select">Afficher :</label>
                <select
                  id="limit-select"
                  value={filters.limit === 999999 ? 'all' : filters.limit}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange('limit', value === 'all' ? 999999 : parseInt(value));
                    handleFilterChange('page', 1); // Reset à la page 1
                  }}
                  className="limit-select"
                >
                  <option value="10">10</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="all">Tout</option>
                </select>
              </div>
              {pagination.pages > 1 && filters.limit !== 999999 && quickSearch.trim() === '' && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Précédent
                  </button>
                  <span>
                    Page {pagination.page} sur {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tableau des confirmateurs avec leurs RDV - Affichage conditionnel selon la permission */}
        {/* Masquer pour Confirmateur (fonction 6) et RE Confirmation (fonction 7) selon les exigences */}
        {hasPermission('dashboard_view_confirmateurs_tabs') && 
         !isConfirmateurOrRE && // Masquer pour Confirmateur et RE Confirmation
         !isLoadingStats && dashboardStats && (
          <div className="confirmateurs-table-section">
            <div className="confirmateurs-table-header">
              <h3 className="confirmateurs-table-title">Confirmateurs et leurs RDV</h3>
              <button 
                className="btn-toggle-confirmateurs"
                onClick={() => setShowConfirmateursTable(!showConfirmateursTable)}
                title={showConfirmateursTable ? 'Masquer le tableau' : 'Afficher le tableau'}
              >
                {showConfirmateursTable ? (
                  <>
                    <FaEyeSlash /> Masquer
                  </>
                ) : (
                  <>
                    <FaEye /> Afficher
                  </>
                )}
              </button>
            </div>
            {showConfirmateursTable && (
            <div className="confirmateurs-table-wrapper">
            {dashboardStats.confirmateurs && Array.isArray(dashboardStats.confirmateurs) && dashboardStats.confirmateurs.length > 0 ? (
              <div className="confirmateurs-table-container">
                <table className="confirmateurs-table">
                  <thead>
                    <tr>
                      <th>Confirmateur</th>
                      <th>RDV Aujourd'hui</th>
                      <th>RDV à Venir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.confirmateurs.map((conf) => (
                      <tr key={conf.id}>
                        <td>
                          <div className="confirmateur-cell">
                            {conf.photo ? (
                              <img src={conf.photo} alt={conf.pseudo} className="confirmateur-avatar-small" />
                            ) : (
                              <div className="confirmateur-avatar-small placeholder">
                                {conf.pseudo ? conf.pseudo.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <span className="confirmateur-name">{conf.pseudo || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="rdv-count-cell">
                          <span className={`rdv-count ${(conf.rdv_today === 0 || !conf.rdv_today) ? 'zero' : ''}`}>
                            {conf.rdv_today || 0}
                          </span>
                        </td>
                        <td className="rdv-count-cell">
                          <span className={`rdv-count ${(conf.rdv_upcoming === 0 || !conf.rdv_upcoming) ? 'zero' : ''}`}>
                            {conf.rdv_upcoming || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', textAlign: 'center', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                {statsError ? 'Erreur lors du chargement des confirmateurs' : 'Aucun confirmateur actif trouvé'}
              </p>
            )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de détail de fiche */}
      {selectedFicheHash && (
        <FicheDetailModal
          ficheHash={selectedFicheHash}
          onClose={() => setSelectedFicheHash(null)}
        />
      )}
    </div>
  );
};


export default Dashboard;
