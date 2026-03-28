import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import api from '../config/api';
import { FaSearch, FaChevronDown, FaChevronUp, FaFileAlt, FaCalendarAlt, FaChartBar, FaComments, FaCheck, FaHome, FaCalendarCheck, FaCalendarTimes, FaSignature, FaSort, FaSortUp, FaSortDown, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import FicheDetailModal from '../components/FicheDetailModal';
import SystemMessageBanner from '../components/SystemMessageBanner';
import ScrollToTopButton from '../components/common/ScrollToTopButton';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './Dashboard.css';

/** Aligné sur le garde-fou backend : fiche_search seul ne doit pas lancer une requête sur toute la table. */
function dashboardUrlHasNarrowingCriteria(params) {
  const q = (k) => {
    const v = params[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  };
  return (
    q('id_etat_final') ||
    q('id_sous_etat') ||
    q('date_champ') ||
    q('date_debut') ||
    q('date_fin') ||
    q('critere') ||
    q('critere_champ') ||
    q('rdv_valid') ||
    q('rdv_non_valid') ||
    q('rdv_affilie') ||
    q('rdv_non_affilie') ||
    q('sgn_week') ||
    q('sgn_month') ||
    q('prof_ret') ||
    q('prof_celib') ||
    q('include_ko') ||
    q('tel') ||
    q('cp') ||
    q('nom') ||
    q('prenom') ||
    q('produit') ||
    q('id_commercial') ||
    q('id_confirmateur') ||
    q('id_re') ||
    q('id_centre') ||
    q('id_agent') ||
    q('affectation') ||
    q('suivi') ||
    q('day_rdv') ||
    q('ko') ||
    q('hc') ||
    q('annuler_repro_type') ||
    q('qualification_code') ||
    params.include_archive === '1' ||
    params.include_archive === 'true' ||
    q('w') ||
    q('y') ||
    params.yesterday === '1' ||
    params.tomorrow === '1'
  );
}

function getTodayDateRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return { dateStr, timeStart: '00:00:00', timeEnd: '23:59:59' };
}

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const { setAutoHide, isDesktop, isMobile } = useSidebar();
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
    
    // Forcer les styles sur html et body - utiliser min-width pour permettre le scroll si nécessaire
    document.documentElement.style.minWidth = '1400px';
    document.documentElement.style.width = 'auto';
    document.documentElement.style.maxWidth = 'none';
    document.documentElement.style.overflowX = 'auto'; // Permettre le scroll horizontal si nécessaire
    document.body.style.minWidth = '1400px';
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'auto'; // Permettre le scroll horizontal si nécessaire
    
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
      document.documentElement.style.minWidth = '';
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.minWidth = '';
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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  // Par défaut : filtre vide (état Tous, date non sélectionnée, date début/fin vides)
  const getInitialFilters = () => ({
    page: 1,
    limit: 999999,
    fiche_search: false,
    id_etat_final: '',
    date_champ: '',
    date_debut: '',
    date_fin: '',
    time_debut: '',
    time_fin: '',
    include_archive: false,
    ko: '', // '' = tous, '0' = fiches OK, '1' = fiches KO
    id_centre: '',
    id_sous_etat: '',
    annuler_repro_type: '', // '' = tous, 'compte_rendu' ou 'repro_confirmateurs' (visible si état = Annuler à reprogrammer)
    include_confirmateur_2: true,
  });

  /** Filtres initiaux : confirmateur (6) — case « inclure 2e confirmateur » décochée (réservée à une recherche explicite). */
  const getFiltersForUser = (u) => {
    const base = getInitialFilters();
    if (u?.fonction === 6) return { ...base, include_confirmateur_2: false };
    return base;
  };
  const [filters, setFilters] = useState(getInitialFilters);
  // Filtres appliqués à la requête (mis à jour uniquement au clic sur Recherche, pagination ou reset)
  const [appliedFilters, setAppliedFilters] = useState(getInitialFilters);
  
  // Lire l’URL ; sans query : défaut confirmateur = actions du jour (fiches_histo), autres = confirmées du jour
  useEffect(() => {
    const urlParams = Object.fromEntries(searchParams.entries());
    const hasUrl = Object.keys(urlParams).length > 0;
    if (hasUrl && urlParams.fiche_search === '1' && !dashboardUrlHasNarrowingCriteria(urlParams)) {
      setSearchParams({}, { replace: true });
      return;
    }
    if (hasUrl && urlParams.fiche_search === '1') {
      const newFilters = {
        page: parseInt(urlParams.page) || 1,
        limit: parseInt(urlParams.limit) || 999999,
        fiche_search: true,
        ...urlParams
      };
      if (newFilters.id_etat_final) {
        newFilters.id_etat_final = parseInt(newFilters.id_etat_final);
      }
      if (newFilters.include_confirmateur_2 !== undefined && newFilters.include_confirmateur_2 !== null) {
        const v = newFilters.include_confirmateur_2;
        newFilters.include_confirmateur_2 =
          v === true || v === 1 || v === '1' || v === 'true';
      }
      // Ne pas pré-remplir dates / état depuis l’URL : uniquement ce qui est dans les paramètres
      setFilters(newFilters);
      setAppliedFilters(newFilters);
      setShowFilters(true);
    } else if (Object.keys(urlParams).length === 0 && user) {
      // Aucun état ni plage date par défaut : ne pas lancer /fiches au montage (toutes sessions — requête trop lourde sans critères)
      const defaultApplied = {
        ...getInitialFilters(),
        page: 1,
        limit: 999999,
        fiche_search: false,
        id_etat_final: '',
        date_champ: '',
        date_debut: '',
        date_fin: '',
        time_debut: '',
        time_fin: '',
        ...(user.fonction === 6 ? { include_confirmateur_2: false } : {}),
      };
      // Garder le formulaire de filtres "initialisé" (non pré-rempli),
      // tout en affichant les résultats par défaut via appliedFilters.
      setFilters(getFiltersForUser(user));
      setAppliedFilters(defaultApplied);
      setShowFilters(false);
    }
  }, [searchParams, user]);

  // Ref pour le champ critère dans le modal (focus à l'ouverture)
  const searchModalCritereRef = useRef(null);
  useEffect(() => {
    if (showSearchModal && searchModalCritereRef.current && user?.fonction !== 5) {
      const t = setTimeout(() => {
        searchModalCritereRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [showSearchModal, user?.fonction]);

  const [selectedFicheHash, setSelectedFicheHash] = useState(null);

  const [sortConfig, setSortConfig] = useState({
    key: 'date_rdv_time', // Tri par défaut sur la date de RDV
    direction: 'asc', // 'asc' or 'desc'
  });
  const [showConfirmateursTable, setShowConfirmateursTable] = useState(false); // Fermé par défaut
  const [quickSearch, setQuickSearch] = useState(''); // Recherche rapide
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 250);

  const normalizeText = (v) => (typeof v === 'string' ? v.trim() : v);

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data;
  });

  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data;
  });

  const { data: sousEtatsData } = useQuery('sous-etat', async () => {
    const res = await api.get('/management/sous-etat');
    return res.data.data || [];
  }, { staleTime: 5 * 60 * 1000 });

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

  // Construire les paramètres selon l'onglet actif (utilise appliedFilters = filtres envoyés à l'API)
  const getQueryParams = (sourceFilters) => {
    const src = sourceFilters || appliedFilters;
    const { dateStr, timeStart, timeEnd } = getTodayDateRange();
    const isQuickSearchActive = debouncedQuickSearch.trim() !== '';
    const limitParam = isQuickSearchActive ? 999999 : (src.limit === 999999 ? 999999 : src.limit);
    const pageParam = isQuickSearchActive ? 1 : (src.page || 1);
    
    if (src.fiche_search) {
      const searchParams = { 
        ...src, 
        limit: limitParam,
        page: pageParam,
        fiche_search: 1
      };

      // Normaliser le critère (enlever espaces avant/après)
      if (typeof searchParams.critere === 'string') {
        searchParams.critere = searchParams.critere.trim();
      }
      // Nom et Prénom sont dans le type de critère : ne pas envoyer nom/prenom en double
      const champ = searchParams.critere_champ || 'tel';
      if (champ === 'nom' || champ === 'prenom') {
        delete searchParams.nom;
        delete searchParams.prenom;
      }

      // Nettoyer les paramètres vides (mais garder page, limit, fiche_search, critere, critere_champ)
      Object.keys(searchParams).forEach(key => {
        if (key === 'page' || key === 'limit' || key === 'fiche_search') {
          return; // Ne pas supprimer ces paramètres
        }
        // include_archive: n'envoyer au backend que si activé
        if (key === 'include_archive') {
          if (searchParams.include_archive) {
            searchParams.include_archive = 1;
          } else {
            delete searchParams.include_archive;
          }
          return;
        }
        // include_confirmateur_2 : autre profil = avec id_confirmateur ; confirmateur (6) = uniquement si coché (recherche), sinon ne pas envoyer (défaut API inchangé)
        if (key === 'include_confirmateur_2') {
          if (searchParams.id_confirmateur) {
            searchParams.include_confirmateur_2 = searchParams.include_confirmateur_2 ? 1 : 0;
          } else if (user?.fonction === 6) {
            if (searchParams.include_confirmateur_2) {
              searchParams.include_confirmateur_2 = 1;
            } else {
              delete searchParams.include_confirmateur_2;
            }
          } else {
            delete searchParams.include_confirmateur_2;
          }
          return;
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
          // Si critere est rempli : recherche globale (y compris confirmateur : enlever plage / date_champ par défaut)
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

    if (src.include_archive) {
      baseParams.include_archive = 1;
    }
    
    const defaultParams = {
      ...baseParams,
      fiche_search: 1,
      date_champ: '',
      date_debut: '',
      date_fin: '',
      time_debut: '',
      time_fin: '',
    };
    if (src.id_centre) {
      defaultParams.id_centre = src.id_centre;
    }
    return defaultParams;
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

  // Récupérer les fiches (requête lancée uniquement au clic Recherche, pagination ou reset)
  const { data, isLoading, isFetching, error, refetch } = useQuery(
    ['fiches', appliedFilters, activeTab, debouncedQuickSearch],
    async () => {
      console.time('[PERF] Requête API fiches - Total');
      const params = getQueryParams();
      const response = await api.get('/fiches', { params });
      console.timeEnd('[PERF] Requête API fiches - Total');
      return response.data;
    },
    { keepPreviousData: true, enabled: !!appliedFilters.fiche_search }
  );

  // Filtrer les utilisateurs par fonction
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const centres = centresData ? centresData.filter(c => c.etat > 0) : [];
  // Groupe 0 visible uniquement par RE qualification (2), Agent qualification (3), Qualité qualification (8), RP qualification (12)
  const canSeeGroupe0 = [2, 3, 8, 12].includes(Number(user?.fonction));
  const etats = (etatsData || []).filter(e => {
    if (String(e.groupe) === '0' || e.groupe === 0) return canSeeGroupe0;
    return true;
  });

  // Grouper les états par phase
  const normalizeTitre = (t) => (!t ? '' : String(t).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim());
  const CONFIRMATEUR_ETATS_PHASE2 = ['confirmer', 'annuler a reprogrammer', 'client honore a suivre', 'honore hors cible confirmateurs', 'rdv annuler', 'refuser'];
  const isEtatAllowedForConfirmateur = (e, allowedList) => {
    const n = normalizeTitre(e.titre);
    return allowedList.some(a => n === a || n.includes(a) || a.includes(n));
  };
  /** Phase 3 confirmateur : uniquement l'option "SIGNER" dans le filtre (pas Signer retracter, Signer PM, Signer complet) */
  const isEtatAllowedForConfirmateurPhase3 = (e) => {
    const n = normalizeTitre(e.titre);
    if (n.includes('retracter') || n.includes('pm') || n.includes('2 fois') || n.includes('complet')) return false;
    return n === 'signer';
  };

  let etatsPhase0 = etats.filter(e => String(e.groupe) === '0' || e.groupe === 0);
  let etatsPhase1 = etats.filter(e => String(e.groupe) === '1' || e.groupe === 1);
  let etatsPhase2 = etats.filter(e => String(e.groupe) === '2' || e.groupe === 2);
  let etatsPhase3 = etats.filter(e => String(e.groupe) === '3' || e.groupe === 3);

  // Session confirmateur (fonction 6) : uniquement certains états en phase 2 et phase 3 (phase 3 = uniquement "Signer")
  if (user?.fonction === 6) {
    etatsPhase0 = [];
    etatsPhase1 = [];
    etatsPhase2 = etatsPhase2.filter(e => isEtatAllowedForConfirmateur(e, CONFIRMATEUR_ETATS_PHASE2));
    etatsPhase3 = etatsPhase3.filter(e => isEtatAllowedForConfirmateurPhase3(e));
    // « Annuler à reprogrammer » (id 8) est souvent en phase 0/1 en base : il était exclu du filtre. On l’ajoute pour la recherche.
    const etatAnnulerRepro = (etats || []).find((e) => Number(e.id) === 8);
    if (etatAnnulerRepro && !etatsPhase2.some((e) => Number(e.id) === 8)) {
      etatsPhase2 = [etatAnnulerRepro, ...etatsPhase2];
    }
  }

  const sousEtatsForSelectedEtat = (sousEtatsData || []).filter(
    s => Number(s.id_etat) === Number(filters.id_etat_final)
  );
  const showSousEtatFilter = filters.id_etat_final && sousEtatsForSelectedEtat.length > 0;

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
    const nextValue =
      key === 'critere' || key === 'nom' || key === 'prenom' || key === 'cp'
        ? normalizeText(value)
        : value;
    setFilters(prev => ({
      ...prev,
      [key]: nextValue,
      ...(key === 'id_etat_final' ? { id_sous_etat: '', annuler_repro_type: '' } : {}),
      page: key === 'page' ? value : 1
    }));
    // Pagination et limite : mettre à jour appliedFilters pour lancer la requête
    if (key === 'page' || key === 'limit') {
      setAppliedFilters(prev => ({
        ...prev,
        [key]: key === 'page' ? value : nextValue,
        ...(key === 'limit' ? { page: 1 } : {})
      }));
    }
  };

  const handlePageChange = (newPage) => {
    handleFilterChange('page', newPage);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    // Afficher la confirmation uniquement si la recherche n'est pas affinée (risque de recherche lourde)
    const hasRefinedSearch = !!(
      (filters.critere || '').trim() ||
      filters.id_etat_final ||
      filters.date_champ ||
      filters.date_debut ||
      filters.date_fin ||
      filters.id_confirmateur ||
      filters.id_commercial ||
      filters.id_centre ||
      (filters.cp || '').trim() ||
      filters.produit
    );
    if (!hasRefinedSearch && !window.confirm('Cette recherche peut prendre plusieurs secondes. Confirmer la recherche ?')) {
      return;
    }
    setIsSearching(true);
    const newFilters = { ...filters, fiche_search: true, page: 1 };
    
    if (newFilters.critere) {
      const today = new Date().toISOString().split('T')[0];
      if (newFilters.date_debut === today && newFilters.date_fin === today) {
        delete newFilters.date_debut;
        delete newFilters.date_fin;
        delete newFilters.date_champ;
        delete newFilters.time_debut;
        delete newFilters.time_fin;
      }
    }
    
    setFilters(newFilters);
    setAppliedFilters(newFilters);
  };

  const handleReset = () => {
    const initial = getFiltersForUser(user);
    setFilters(initial);
    setAppliedFilters(initial);
  };

  // Réinitialiser isSearching quand la requête est terminée
  useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false);
    }
  }, [isFetching, isSearching]);

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

  // Obtenir la couleur de l'état : priorité à etat_color renvoyé par l'API (couvre tous les états dont ceux hors filtre confirmateur), sinon etatsData
  const getEtatColor = (etatId, fiche) => {
    if (fiche?.etat_color) return fiche.etat_color;
    const etat = (etatsData || []).find(e => e.id === etatId || e.id === Number(etatId));
    return etat?.color || '#cccccc';
  };

  // Obtenir le nom du produit
  const getProduitName = (produitId) => {
    return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
  };

  // Obtenir la couleur du produit
  const getProduitColor = (produitId) => {
    return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#FFE441' : '#cccccc';
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

  // Libellé d'état à afficher : priorité au etat_titre renvoyé par l'API (affiche tous les états en session confirmateur, ex. en attente)
  const getEtatDisplayName = (fiche) => (fiche?.etat_titre || getEtatName(fiche?.id_etat_final) || '').trim();

  // Bulle au survol : nom prénom client, téléphone, puis commentaire. Si état changé par compte rendu → commentaire commercial, sinon commentaire confirmateur.
  const getTooltipComment = (fiche) => {
    const nom = (fiche?.nom ?? '').trim();
    const prenom = (fiche?.prenom ?? '').trim();
    const tel = (fiche?.tel ?? '').trim();
    const useCommentaireCommercial = fiche?.has_etat_changed_by_compte_rendu === true;
    const commentaire = (useCommentaireCommercial
      ? (fiche?.commentaire_commercial ?? '')
      : (fiche?.conf_commentaire_produit ?? '')
    ).trim();
    const commentaireStr = commentaire.length > 500 ? commentaire.slice(0, 497) + '...' : commentaire;
    const lignes = [
      [nom, prenom].filter(Boolean).join(' '),
      tel,
      commentaireStr
    ].filter(Boolean);
    return lignes.join('\n');
  };

  // id_etat 8 = Annuler à reprogrammer : afficher <CR> uniquement si l'état ACTUEL vient d'un compte rendu
  const ID_ETAT_ANNULER_A_REPROGRAMMER = 8;
  const showCRPrefix = (fiche) =>
    Number(fiche?.id_etat_final) === ID_ETAT_ANNULER_A_REPROGRAMMER &&
    fiche?.current_state_from_compte_rendu === true;

  // Confirmateur affiché : pseudos depuis dernière ligne fiches_histo (API), sinon table fiches — ordre confirmateur 1 | 2 | 3
  const getConfirmateursFormatted = (fiche) => {
    if (fiche.histo_confirmateurs_pseudo && String(fiche.histo_confirmateurs_pseudo).trim() !== '') {
      return fiche.histo_confirmateurs_pseudo;
    }
    const conf1 = fiche.id_confirmateur ? getUserName(fiche.id_confirmateur) : '';
    const conf2 = fiche.id_confirmateur_2 ? getUserName(fiche.id_confirmateur_2) : '';
    const conf3 = fiche.id_confirmateur_3 ? getUserName(fiche.id_confirmateur_3) : '';
    const parts = [conf1, conf2, conf3].filter(Boolean);
    return parts.length > 0 ? parts.join(' | ') : '';
  };

  // Quand "Inclure 2ème confirmateur" est coché et un confirmateur est sélectionné : afficher Confirmateur 1 | Confirmateur 2 | Confirmateur 3, avec le sélectionné mis en avant
  const renderConfirmateurCell = (fiche) => {
    const selectedId = appliedFilters.id_confirmateur ? String(appliedFilters.id_confirmateur) : null;
    const includeSecond = appliedFilters.include_confirmateur_2;

    if (includeSecond && selectedId) {
      const c1 = fiche.id_confirmateur ? getUserName(fiche.id_confirmateur) : null;
      const c2 = fiche.id_confirmateur_2 ? getUserName(fiche.id_confirmateur_2) : null;
      const c3 = fiche.id_confirmateur_3 ? getUserName(fiche.id_confirmateur_3) : null;
      const isSelected = (id) => id && String(id) === selectedId;
      const parts = [];
      if (c1) parts.push({ key: '1', id: fiche.id_confirmateur, name: c1 });
      if (c2) parts.push({ key: '2', id: fiche.id_confirmateur_2, name: c2 });
      if (c3) parts.push({ key: '3', id: fiche.id_confirmateur_3, name: c3 });
      if (parts.length === 0) return '-';
      return (
        <>
          {parts.map((p, i) => (
            <span key={p.key}>
              {i > 0 && ' | '}
              <span className={isSelected(p.id) ? 'confirmateur-selected' : ''}>{p.name}</span>
            </span>
          ))}
        </>
      );
    }
    return getConfirmateursFormatted(fiche);
  };

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
      console.log(`[PERF] Recherche rapide active: ${debouncedQuickSearch.trim() !== '' ? 'Oui (' + debouncedQuickSearch + ')' : 'Non'}`);
      console.log(`[PERF] Tri actif: ${sortConfig.key ? sortConfig.key + ' (' + sortConfig.direction + ')' : 'Non'}`);
      console.log(`[PERF] ========================`);
    }
  }, [processedFichesCount, debouncedQuickSearch, sortConfig.key, sortConfig.direction]);

  const isLoadingList = isLoading && !data;
  const errorList = error;
  const refetchList = refetch;
  const isFetchingList = isLoading || isFetching || isSearching;

  if (errorList) {
    return (
      <div className="dashboard-error">
        <p>Erreur lors du chargement des fiches</p>
        <button onClick={() => refetchList()}>Réessayer</button>
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
      return getEtatDisplayName(fiche).toLowerCase();
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
  const filteredFiches = debouncedQuickSearch.trim() === '' 
    ? sortedFiches 
    : sortedFiches.filter(fiche => {
        const searchLower = debouncedQuickSearch.trim().toLowerCase();
        // Rechercher dans tous les champs
        const searchFields = [
          fiche.nom || '',
          fiche.prenom || '',
          fiche.tel || '',
          fiche.cp || '',
          fiche.ville || '',
          fiche.adresse || '',
          formatDate(fiche.date_insert_time),
          formatRdvDateTime(fiche.date_rdv_time),
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
  if (debouncedQuickSearch.trim() !== '' && sortedFiches.length > 0) {
    console.log(`[PERF] Filtrage de ${sortedFiches.length} fiches avec "${debouncedQuickSearch}" effectué en ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    console.log(`[PERF] Résultats après filtrage: ${filteredFiches.length} fiches (${((filteredFiches.length / sortedFiches.length) * 100).toFixed(1)}%)`);
  }

  const fiches = filteredFiches;

  return (
    <div className="dashboard">
      <SystemMessageBanner />
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 9) && (
            <button 
              className="btn-search-modal"
              onClick={() => setShowSearchModal(true)}
              title="Ouvrir la recherche avancée"
            >
              <FaSearch /> Recherche
            </button>
          )}
          <div>
            <h1><FaHome /> Tableau de bord</h1>
            <p>Bienvenue, {user?.pseudo || 'Utilisateur'}</p>
          </div>
        </div>
      </div>

      {/* Section des statistiques RDV - visible immédiatement */}
      {isLoadingStats ? (
        <div className="dashboard-stats-section">
          <div className="stats-cards">
            {[1, 2, 3].map((i) => (
              <div key={i} className="stat-card stat-card-skeleton">
                <div className="stat-card-icon"></div>
                <div className="stat-card-content">
                  <div className="stat-card-value stat-card-skeleton-pulse"></div>
                  <div className="stat-card-label stat-card-skeleton-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : dashboardStats && (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // URL pour "confirmer de la journée" (fiches + fiches_histo id_etat=7, pas table confirmations)
        const confirmesUrl = `/dashboard?fiche_search=1&id_etat_final=7&date_champ=fiches_histo_confirmation&date_debut=${todayStr}&date_fin=${todayStr}&time_debut=00:00:00&time_fin=23:59:59`;
        
        const isConfirmateur = user?.fonction === 6;
        return (
          <div className="dashboard-stats-section">
            <div className="stats-cards">
              {/* Confirmer de la journée */}
              {isConfirmateur ? (
                <div className="stat-card stat-card-success">
                  <div className="stat-card-icon">
                    <FaCalendarCheck />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.rdvTodayConfirmed || 0}</div>
                    <div className="stat-card-label">Confirmer de la journée</div>
                  </div>
                </div>
              ) : (
                <Link to={confirmesUrl} className="stat-card stat-card-success">
                  <div className="stat-card-icon">
                    <FaCalendarCheck />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.rdvTodayConfirmed || 0}</div>
                    <div className="stat-card-label">Confirmer de la journée</div>
                  </div>
                </Link>
              )}

              {/* Signatures (aujourd'hui) */}
              {isConfirmateur ? (
                <div className="stat-card stat-card-warning">
                  <div className="stat-card-icon">
                    <FaSignature />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.signaturesToday || 0}</div>
                    <div className="stat-card-label">Signatures</div>
                  </div>
                </div>
              ) : (
                <Link to="/signatures" className="stat-card stat-card-warning">
                  <div className="stat-card-icon">
                    <FaSignature />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.signaturesToday || 0}</div>
                    <div className="stat-card-label">Signatures</div>
                  </div>
                </Link>
              )}

              {/* RDV à venir */}
              {isConfirmateur ? (
                <div className="stat-card stat-card-info">
                  <div className="stat-card-icon">
                    <FaCalendarAlt />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.rdvUpcoming || 0}</div>
                    <div className="stat-card-label">RDV à venir</div>
                  </div>
                </div>
              ) : (
                <Link to={`/dashboard?fiche_search=1&id_etat_final=7&date_champ=date_rdv_time&date_debut=${todayStr}&time_debut=00:00:00`} className="stat-card stat-card-info">
                  <div className="stat-card-icon">
                    <FaCalendarAlt />
                  </div>
                  <div className="stat-card-content">
                    <div className="stat-card-value">{dashboardStats.rdvUpcoming || 0}</div>
                    <div className="stat-card-label">RDV à venir</div>
                  </div>
                </Link>
              )}
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
            <div className="search-form-two-columns">
              {/* Colonne de gauche */}
              <div className="search-form-left">
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
                      {etatsPhase0.length > 0 && (
                        <optgroup label="PHASE 0">
                          {etatsPhase0.map(etat => (
                            <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                              {etat.titre}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                          {user?.fonction !== 6 && (
                            <option value="t_s" style={{ backgroundColor: '#FF3380' }}>TOUT SIGNER</option>
                          )}
                          {etatsPhase3.map(etat => (
                            <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                              {etat.titre}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {/* Si aucun état n'est trouvé dans les phases, afficher tous les états */}
                      {etatsPhase0.length === 0 && etatsPhase1.length === 0 && etatsPhase2.length === 0 && etatsPhase3.length === 0 && etats.length > 0 && (
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

                {/* Sous-état (affiché uniquement si l'état sélectionné a des sous-états) */}
                {showSousEtatFilter && (
                  <div className="form-group">
                    <label>Sous-état</label>
                    <select
                      value={filters.id_sous_etat || ''}
                      onChange={(e) => handleFilterChange('id_sous_etat', e.target.value)}
                    >
                      <option value="">Tout</option>
                      {sousEtatsForSelectedEtat.map(se => (
                        <option key={se.id} value={se.id}>{se.titre}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Affiner Annuler à reprogrammer : COMPTE RENDU ou REPRO CONFIRMATEURS */}
                {Number(filters.id_etat_final) === 8 && (
                  <div className="form-group">
                    <label>Source</label>
                    <select
                      value={filters.annuler_repro_type || ''}
                      onChange={(e) => handleFilterChange('annuler_repro_type', e.target.value)}
                    >
                      <option value="">Tous</option>
                      <option value="compte_rendu">COMPTE RENDU</option>
                      <option value="repro_confirmateurs">REPRO CONFIRMATEURS</option>
                    </select>
                  </div>
                )}

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

                {/* Inclure archives */}
                <div className="form-group">
                  <label>Archives</label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={!!filters.include_archive}
                      onChange={(e) => handleFilterChange('include_archive', e.target.checked)}
                    />
                    Inclure les fiches archivées
                  </label>
                </div>

                {/* Boutons d'action */}
                <div className="search-form-actions-left">
                  <button type="submit" className="btn-search">
                    <FaSearch /> RECHERCHE
                  </button>
                  <button type="button" onClick={handleReset} className="btn-reset">
                    Réinitialiser
                  </button>
                </div>
              </div>

              {/* Colonne de droite */}
              <div className="search-form-right">
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

                {/* Type de critère (inclut Nom, Prénom, Téléphone, CP, Commentaire) */}
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
                        <option value="nom">Nom</option>
                        <option value="prenom">Prénom</option>
                        <option value="cp">Code Postal</option>
                        <option value="commentaire">Commentaire</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Confirmateur (masqué pour confirmateur connecté : toujours lui) */}
                {user?.fonction !== 5 && user?.fonction !== 3 && user?.fonction !== 6 && (
                  <>
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
                    {filters.id_confirmateur && (
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="include_confirmateur_2"
                          checked={!!filters.include_confirmateur_2}
                          onChange={(e) => handleFilterChange('include_confirmateur_2', e.target.checked)}
                        />
                        <label htmlFor="include_confirmateur_2" style={{ marginBottom: 0 }}>Inclure 2ème confirmateur</label>
                      </div>
                    )}
                  </>
                )}

                {/* Centre */}
                {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 9) && (
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

                {/* Commercial (aligné avec Date fin) */}
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
                    <option value="fiches_histo">Mes actions sur la fiche (fiches_histo)</option>
                    <option value="fiches_histo_confirmation">Date confirmation (fiches_histo)</option>
                  </select>
                </div>

                {/* Confirmateur : inclure fiches en 2e / 3e slot — uniquement après recherche (param envoyé si coché) */}
                {user?.fonction === 6 && (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="include_confirmateur_2_session"
                      checked={!!filters.include_confirmateur_2}
                      onChange={(e) => handleFilterChange('include_confirmateur_2', e.target.checked)}
                    />
                    <label htmlFor="include_confirmateur_2_session" style={{ marginBottom: 0 }}>
                      Inclure 2ème confirmateur
                    </label>
                  </div>
                )}
              </div>
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
          <div className="results-header-title-block">
            <h2>
              {debouncedQuickSearch.trim() !== '' 
                ? `Résultats de la recherche rapide: ${fiches.length} fiche${fiches.length > 1 ? 's' : ''}`
                : filters.fiche_search 
                  ? `Résultats de la recherche ${pagination.total}` 
                  : `${pagination.total}`}
            </h2>
          </div>
          {(isFetchingList) && (
            <div className="search-loading-indicator">
              <div className="spinner-small"></div>
              <span>Recherche en cours...</span>
            </div>
          )}
        </div>

        {(isLoading || isSearching || isFetching) && fiches.length === 0 ? (
          <div className="dashboard-loading">
            <div className="spinner"></div>
            <p>Chargement des résultats de recherche...</p>
            <div className="table-skeleton" style={{ marginTop: '24px', width: '100%' }}>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="table-skeleton-row" style={{ marginBottom: '8px', height: '45px' }}></div>
              ))}
            </div>
          </div>
        ) : !isFetchingList && fiches.length === 0 ? (
          <div className="no-results">
            {!appliedFilters.fiche_search ? (
              <p>
                Utilisez les filtres puis cliquez sur <strong>RECHERCHE</strong> pour charger les fiches. Un chargement
                sans critère serait trop long pour tous les profils.
              </p>
            ) : (
              <p>Aucune fiche trouvée{debouncedQuickSearch ? ` pour "${debouncedQuickSearch}"` : ''}</p>
            )}
          </div>
        ) : (
          <>
            <div className={`fiches-table-container ${isFetchingList ? 'loading' : ''}`}>
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
                      {isConfirmateurOrRE ? 'État actuel' : 'État Final'} {getSortIcon('État Final')}
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
                    const etatColor = getEtatColor(fiche.id_etat_final, fiche);
                    const produitColor = getProduitColor(fiche.produit);
                    
                    return (
                      <tr 
                        key={fiche.hash}
                        className="fiche-row-by-etat"
                        style={{ 
                          backgroundColor: `${etatColor}40`,
                          borderLeft: `4px solid ${etatColor}`
                        }}
                        title={getTooltipComment(fiche) || undefined}
                      >
                        <td data-label="">{fiche.nom || ''}</td>
                        <td data-label="Prénom:">{fiche.prenom || ''}</td>
                        <td data-label="Téléphone:">{fiche.tel || ''}</td>
                        <td data-label="CP:">{fiche.cp || ''}</td>
                        <td data-label="Date Insertion:" style={{ textAlign: 'left' }}>{formatDate(fiche.date_insert_time)}</td>
                        <td data-label="Date RDV:" style={{ textAlign: 'left' }}>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                        <td data-label={isConfirmateurOrRE ? 'État actuel:' : 'État:'}>
                          <span 
                            className="etat-badge"
                            style={{ backgroundColor: etatColor }}
                          >
                            {showCRPrefix(fiche) && <span style={{ marginRight: '4px', fontWeight: 'bold' }}>&lt;CR&gt;</span>}
                            {getEtatDisplayName(fiche)}
                            {(fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') && (
                              <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '0.77em' }}>
                                (RDV_URGENT)
                              </span>
                            )}
                          </span>
                        </td>
                        <td data-label="Confirmateur:">{renderConfirmateurCell(fiche)}</td>
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

      {/* Modal de recherche */}
      {showSearchModal && (
        <div className="search-modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <h2>
                <FaSearch /> Recherche et Filtres
              </h2>
              <button 
                className="search-modal-close"
                onClick={() => setShowSearchModal(false)}
                title="Fermer"
              >
                <FaTimes />
              </button>
            </div>
            <form className="search-modal-form" onSubmit={(e) => {
              e.preventDefault();
              handleSearch(e);
              setShowSearchModal(false);
            }}>
              <div className="search-modal-fields">
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

                {/* Critère de recherche */}
                <div className="form-group">
                  <label>Critère</label>
                  <input
                    ref={searchModalCritereRef}
                    type="text"
                    value={filters.critere || ''}
                    onChange={(e) => handleFilterChange('critere', e.target.value)}
                    placeholder="Critère"
                    required={user?.fonction === 5}
                  />
                </div>

                {/* Type de critère (inclut Nom, Prénom, Téléphone, CP, Commentaire) */}
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
                        <option value="nom">Nom</option>
                        <option value="prenom">Prénom</option>
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

                {/* Confirmateur (masqué pour confirmateur connecté : toujours lui) */}
                {user?.fonction !== 5 && user?.fonction !== 3 && user?.fonction !== 6 && (
                  <>
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
                    {filters.id_confirmateur && (
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="include_confirmateur_2_mobile"
                          checked={!!filters.include_confirmateur_2}
                          onChange={(e) => handleFilterChange('include_confirmateur_2', e.target.checked)}
                        />
                        <label htmlFor="include_confirmateur_2_mobile" style={{ marginBottom: 0 }}>Inclure 2ème confirmateur</label>
                      </div>
                    )}
                  </>
                )}

                {/* Centre */}
                {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 9) && (
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
                      value={filters.id_etat_final !== undefined && filters.id_etat_final !== null ? filters.id_etat_final : ''}
                      onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Tous</option>
                      {etatsPhase0.length > 0 && (
                        <optgroup label="PHASE 0">
                          {etatsPhase0.map(etat => (
                            <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                              {etat.titre}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                          {user?.fonction !== 6 && (
                            <option value="t_s" style={{ backgroundColor: '#FF3380' }}>TOUT SIGNER</option>
                          )}
                          {etatsPhase3.map(etat => (
                            <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                              {etat.titre}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {etatsPhase0.length === 0 && etatsPhase1.length === 0 && etatsPhase2.length === 0 && etatsPhase3.length === 0 && etats.length > 0 && (
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

                {showSousEtatFilter && (
                  <div className="form-group">
                    <label>Sous-état</label>
                    <select
                      value={filters.id_sous_etat || ''}
                      onChange={(e) => handleFilterChange('id_sous_etat', e.target.value)}
                    >
                      <option value="">Tout</option>
                      {sousEtatsForSelectedEtat.map(se => (
                        <option key={se.id} value={se.id}>{se.titre}</option>
                      ))}
                    </select>
                  </div>
                )}

                {Number(filters.id_etat_final) === 8 && (
                  <div className="form-group">
                    <label>Source</label>
                    <select
                      value={filters.annuler_repro_type || ''}
                      onChange={(e) => handleFilterChange('annuler_repro_type', e.target.value)}
                    >
                      <option value="">Tous</option>
                      <option value="compte_rendu">COMPTE RENDU</option>
                      <option value="repro_confirmateurs">REPRO CONFIRMATEURS</option>
                    </select>
                  </div>
                )}

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
                    <option value="fiches_histo">Mes actions sur la fiche (fiches_histo)</option>
                    <option value="fiches_histo_confirmation">Date confirmation (fiches_histo)</option>
                  </select>
                </div>

                {user?.fonction === 6 && (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="include_confirmateur_2_session_mobile"
                      checked={!!filters.include_confirmateur_2}
                      onChange={(e) => handleFilterChange('include_confirmateur_2', e.target.checked)}
                    />
                    <label htmlFor="include_confirmateur_2_session_mobile" style={{ marginBottom: 0 }}>
                      Inclure 2ème confirmateur
                    </label>
                  </div>
                )}

                {/* Date début */}
                <div className="form-group">
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

                {/* Commercial (aligné avec Date fin) */}
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

                {/* Date fin */}
                <div className="form-group">
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

              <div className="search-modal-actions">
                <button type="submit" className="btn-search">
                  <FaSearch /> RECHERCHE
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    handleReset();
                    setShowSearchModal(false);
                  }} 
                  className="btn-reset"
                >
                  Réinitialiser
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowSearchModal(false)} 
                  className="btn-cancel"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ScrollToTopButton />
    </div>
  );
};


export default Dashboard;
