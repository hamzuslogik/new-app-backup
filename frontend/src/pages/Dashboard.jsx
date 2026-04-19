import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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
import { generateFicheClientPdf } from '../utils/generateFicheClientPdf';
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
  /** Menu contextuel (clic droit) sur les lignes du tableau : admin (1), backoffice (11), RP (13), RE (14) */
  const canFicheContextMenu = [1, 11, 13, 14].includes(Number(user?.fonction));
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
    annuler_repro_type: '', // '' = tous, 'compte_rendu' ou 'repro_confirmateurs' (visible si état = Annuler à reprogrammer ou Client honoré à suivre)
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
      const { dateStr, timeStart, timeEnd } = getTodayDateRange();
      const emptyUiFilters = getFiltersForUser(user);
      // Confirmateur : liste du jour sans toucher au filtre (backend = dernière ligne fiches_histo).
      // Autres profils : fiches confirmées (état 7) du jour via fiches_histo_confirmation.
      if (user.fonction === 6) {
        const defaultApplied = {
          ...getInitialFilters(),
          page: 1,
          limit: 999999,
          fiche_search: true,
          id_etat_final: '',
          date_champ: 'fiches_histo',
          date_debut: dateStr,
          date_fin: dateStr,
          time_debut: timeStart,
          time_fin: timeEnd,
          include_confirmateur_2: false,
        };
        // UI vide, mais résultats par défaut conservés
        setFilters(emptyUiFilters);
        setAppliedFilters(defaultApplied);
      } else {
        const defaultApplied = {
          ...getInitialFilters(),
          page: 1,
          limit: 999999,
          fiche_search: true,
          id_etat_final: 7,
          date_champ: 'fiches_histo_confirmation',
          date_debut: dateStr,
          date_fin: dateStr,
          time_debut: timeStart,
          time_fin: timeEnd,
        };
        // UI vide, mais résultats par défaut conservés
        setFilters(emptyUiFilters);
        setAppliedFilters(defaultApplied);
      }
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

  /** null | { hash: string, focusHistoriqueEtats?: boolean } */
  const [ficheDetailModal, setFicheDetailModal] = useState(null);
  const [ficheContextMenu, setFicheContextMenu] = useState(null);
  const [etatModalFiche, setEtatModalFiche] = useState(null);
  const [etatModalNewId, setEtatModalNewId] = useState('');
  const [etatModalMotif, setEtatModalMotif] = useState('');
  const [etatModalSousEtat, setEtatModalSousEtat] = useState('');
  const [affectModalFiche, setAffectModalFiche] = useState(null);
  const [affectModalCommercialId, setAffectModalCommercialId] = useState('');
  const [validationModalFiche, setValidationModalFiche] = useState(null);
  const [validationConfRdvAvec, setValidationConfRdvAvec] = useState('');
  const [validationConfPresenceCouple, setValidationConfPresenceCouple] = useState('');
  const [lastViewedFicheHash, setLastViewedFicheHash] = useState(null);

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

  const updateEtatFromMenuMutation = useMutation(
    async ({ hash, body }) => {
      const res = await api.put(`/fiches/${hash}`, body);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fiches']);
        setEtatModalFiche(null);
        setEtatModalMotif('');
        setEtatModalSousEtat('');
      },
      onError: (err) => {
        alert(err.response?.data?.message || err.message || 'Erreur lors du changement d\'état');
      },
    }
  );

  const affectFromMenuMutation = useMutation(
    async ({ fiches_ids, id_commercial }) => {
      const res = await api.post('/affectations/affecter', {
        fiches_ids,
        id_commercial: parseInt(id_commercial, 10),
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['fiches']);
        setAffectModalFiche(null);
        setAffectModalCommercialId('');
        const errs = data?.data?.erreurs;
        if (errs?.length) {
          alert(errs.map((e) => `${e.fiche_id}: ${e.error}`).join('\n'));
        }
      },
      onError: (err) => {
        alert(err.response?.data?.message || err.message || 'Erreur lors de l\'affectation');
      },
    }
  );

  const desaffectFromMenuMutation = useMutation(
    async ({ fiches_ids }) => {
      const res = await api.post('/affectations/desaffecter', { fiches_ids });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fiches']);
        setAffectModalFiche(null);
        setAffectModalCommercialId('');
      },
      onError: (err) => {
        alert(err.response?.data?.message || err.message || 'Erreur lors de la désaffectation');
      },
    }
  );

  const validateFromMenuMutation = useMutation(
    async ({ hash, type_valid, conf_rdv_avec, conf_presence_couple }) => {
      const payload = { type_valid };
      if (String(type_valid) !== '0') {
        payload.conf_rdv_avec = conf_rdv_avec ?? null;
        payload.conf_presence_couple = conf_presence_couple ?? null;
      }
      const res = await api.post(`/fiches/${hash}/valider`, payload);
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['fiches']);
        setValidationModalFiche(null);
        setValidationConfRdvAvec('');
        setValidationConfPresenceCouple('');
        alert(data?.message || 'Enregistré.');
      },
      onError: (err) => {
        alert(err.response?.data?.message || err.message || 'Erreur lors de la validation');
      },
    }
  );

  const generatePdfFromMenuMutation = useMutation(
    async (hash) => {
      const [ficheRes, profRes, tcRes] = await Promise.all([
        api.get(`/fiches/${encodeURIComponent(hash)}`),
        api.get('/management/professions'),
        api.get('/management/type-contrat'),
      ]);
      const fiche = ficheRes.data?.data;
      if (!fiche) throw new Error('Fiche introuvable');
      const users = usersData || [];
      const agents = users.filter((u) => Number(u.fonction) === 3);
      const commerciauxList = users.filter((u) => Number(u.fonction) === 5 && u.etat > 0);
      const confirmateursList = users.filter(
        (u) => Number(u.fonction) === 6 && (u.etat > 0 || u.etat == null)
      );
      const centresList = centresData ? centresData.filter((c) => c.etat > 0) : [];
      generateFicheClientPdf(fiche, {
        professions: profRes.data?.data || [],
        typeContrat: tcRes.data?.data || [],
        centres: centresList,
        agents,
        commerciaux: commerciauxList,
        confirmateurs: confirmateursList,
      });
    },
    {
      onError: (err) => {
        alert(err.response?.data?.message || err.message || 'Impossible de générer le PDF');
      },
    }
  );

  // Filtrer les utilisateurs par fonction
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const centres = centresData ? centresData.filter(c => c.etat > 0) : [];
  /** Profils multi-centres / gestion : même liste qu’en recherche avancée (excl. commercial seul). */
  const showCentreDashboardFilter =
    [1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 14].includes(Number(user?.fonction)) && centres.length > 0;
  // Groupe 0 visible uniquement par RE qualification (2), Agent qualification (3), Qualité qualification (8), RP qualification (12)
  const canSeeGroupe0 = [2, 3, 8, 12].includes(Number(user?.fonction));
  const etats = (etatsData || []).filter(e => {
    if (String(e.groupe) === '0' || e.groupe === 0) return canSeeGroupe0;
    return true;
  });

  // Grouper les états par phase
  const normalizeTitre = (t) => (!t ? '' : String(t).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim());
  const CONFIRMATEUR_ETATS_PHASE2 = [
    'confirmer',
    'annuler a reprogrammer',
    'annuler et a reprogrammer', // libellé base « ANNULER ET A REPROGRAMMER »
    'client honore a suivre',
    'honore hors cible confirmateurs',
    'rdv annuler',
    'refuser'
  ];
  const isEtatAllowedForConfirmateur = (e, allowedList) => {
    const id = Number(e.id);
    if (id === 8) return true; // Annuler à reprogrammer — toujours proposé en session confirmateur
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
    const etatHonoreASuivre = (etats || []).find((e) => Number(e.id) === 9);
    if (etatHonoreASuivre && !etatsPhase2.some((e) => Number(e.id) === 9)) {
      etatsPhase2 = [etatHonoreASuivre, ...etatsPhase2];
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

  useEffect(() => {
    if (!ficheContextMenu) return undefined;
    const onMouseDown = (ev) => {
      if (ev.target.closest?.('.dashboard-fiche-context-menu')) return;
      setFicheContextMenu(null);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') setFicheContextMenu(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ficheContextMenu]);

  const sousEtatsForEtatModal = (sousEtatsData || []).filter(
    (s) => etatModalNewId && Number(s.id_etat) === Number(etatModalNewId)
  );

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
  const checkIndicators = (histoString, fiche = {}) => {
    if (!histoString || !etatsData) {
      const presenceCouple = String(fiche?.conf_presence_couple || '').toUpperCase().trim();
      const hasRdvSeul = [
        'MME SEULE SANS MR',
        'MME SEUL SANS MR',
        'MR SEUL SANS MME',
        'NON',
      ].includes(presenceCouple) || String(fiche?.conf_rdv_avec || '').toUpperCase().trim() === 'SEUL';
      return { r2: false, rf: false, an: false, rs: hasRdvSeul };
    }
    
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
    
    const presenceCouple = String(fiche?.conf_presence_couple || '').toUpperCase().trim();
    const hasRdvSeul = [
      'MME SEULE SANS MR',
      'MME SEUL SANS MR',
      'MR SEUL SANS MME',
      'NON',
    ].includes(presenceCouple) || String(fiche?.conf_rdv_avec || '').toUpperCase().trim() === 'SEUL';

    return {
      r2: hasR2,
      rf: hasRefuser,
      an: hasAnnuler,
      rs: hasRdvSeul,
    };
  };

  // Obtenir le nom de l'utilisateur
  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  // Affichage commercial dans le tableau: "commercial 1 | commercial 2"
  // Si commercial 1 est vide mais commercial 2 existe: "| commercial 2"
  const getCommercialsFormatted = (fiche) => {
    const c1 = getUserName(fiche?.id_commercial);
    const c2 = getUserName(fiche?.id_commercial_2);
    if (c1 && c2) return `${c1} | ${c2}`;
    if (!c1 && c2) return `| ${c2}`;
    if (c1 && !c2) return c1;
    return '';
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

  // Bulle au survol : nom, téléphone, puis commentaire.
  // — État actuel issu d’un compte rendu (dernière ligne fiches_histo.from_compte_rendu) → commentaire commercial (fiches).
  // — Sinon, si état ≠ Confirmer (7) → commentaire saisi au changement d’état (conf_commentaire_produit de la dernière ligne fiches_histo).
  // — Sinon (Confirmer) → conf_commentaire_produit sur la fiche.
  const getTooltipComment = (fiche) => {
    const nom = (fiche?.nom ?? '').trim();
    const prenom = (fiche?.prenom ?? '').trim();
    const tel = (fiche?.tel ?? '').trim();
    const etatCr = fiche?.current_state_from_compte_rendu === true;
    const idEtat = Number(fiche?.id_etat_final);
    const isConfirmer = idEtat === 7;
    let commentaire = '';
    if (etatCr) {
      commentaire = (fiche?.commentaire_commercial ?? '').trim();
    } else if (!isConfirmer) {
      commentaire = (fiche?.histo_last_conf_commentaire ?? '').trim();
    } else {
      commentaire = (fiche?.conf_commentaire_produit ?? '').trim();
    }
    const commentaireStr = commentaire.length > 500 ? commentaire.slice(0, 497) + '...' : commentaire;
    const lignes = [
      [nom, prenom].filter(Boolean).join(' '),
      tel,
      commentaireStr
    ].filter(Boolean);
    return lignes.join('\n');
  };

  // id_etat 8 = Annuler à reprogrammer, 9 = Client honoré à suivre : <CR> si l'état ACTUEL vient d'un compte rendu
  const ID_ETAT_ANNULER_A_REPROGRAMMER = 8;
  const ID_ETAT_HONORE_A_SUIVRE = 9;
  const showCRPrefix = (fiche) =>
    (Number(fiche?.id_etat_final) === ID_ETAT_ANNULER_A_REPROGRAMMER ||
      Number(fiche?.id_etat_final) === ID_ETAT_HONORE_A_SUIVRE) &&
    fiche?.current_state_from_compte_rendu === true;

  /** Aligné détails fiche : Confirmer, Honoré à suivre, Signer → confirmateurs 1, 2 et 3 sur la fiche ; sinon dernière ligne histo puis fiche. */
  const ETATS_DASHBOARD_CONF123 = [7, 9, 13, 16, 44, 45];
  const getConfirmateursFormatted = (fiche) => {
    const etatId = Number(fiche?.id_etat_final);
    const conf123FromFiche = () => {
      const conf1 = fiche.id_confirmateur ? getUserName(fiche.id_confirmateur) : '';
      const conf2 = fiche.id_confirmateur_2 ? getUserName(fiche.id_confirmateur_2) : '';
      const conf3 = fiche.id_confirmateur_3 ? getUserName(fiche.id_confirmateur_3) : '';
      const parts = [conf1, conf2, conf3].filter(Boolean);
      return parts.length > 0 ? parts.join(' | ') : '';
    };
    if (ETATS_DASHBOARD_CONF123.includes(etatId)) {
      const fromFiche = conf123FromFiche();
      if (fromFiche) return fromFiche;
      if (fiche.histo_confirmateurs_pseudo && String(fiche.histo_confirmateurs_pseudo).trim() !== '') {
        return fiche.histo_confirmateurs_pseudo;
      }
      return '';
    }
    if (fiche.histo_confirmateurs_pseudo && String(fiche.histo_confirmateurs_pseudo).trim() !== '') {
      return fiche.histo_confirmateurs_pseudo;
    }
    return conf123FromFiche();
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
      return getCommercialsFormatted(fiche).toLowerCase();
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
          getCommercialsFormatted(fiche),
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

  const openFicheContextMenu = (e, fiche) => {
    if (!canFicheContextMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setFicheContextMenu({ x: e.clientX, y: e.clientY, fiche });
  };

  const copyFicheTelFromMenu = (tel) => {
    const t = (tel || '').trim();
    if (!t) {
      alert('Aucun numéro à copier');
      return;
    }
    navigator.clipboard.writeText(t).then(() => setFicheContextMenu(null)).catch(() => alert('Copie impossible'));
  };

  const openFicheDetailNewTab = (hash) => {
    if (!hash) return;
    window.open(`/fiches/${hash}`, '_blank', 'noopener,noreferrer');
    setFicheContextMenu(null);
  };

  const openEtatModalFromMenu = () => {
    if (!ficheContextMenu?.fiche) return;
    const f = ficheContextMenu.fiche;
    setEtatModalFiche(f);
    setEtatModalNewId(f.id_etat_final != null ? String(f.id_etat_final) : '');
    setEtatModalMotif('');
    setEtatModalSousEtat(f.id_sous_etat != null ? String(f.id_sous_etat) : '');
    setFicheContextMenu(null);
  };

  const submitEtatModal = (ev) => {
    ev.preventDefault();
    if (!etatModalFiche || !etatModalNewId) return;
    const body = { id_etat_final: parseInt(etatModalNewId, 10) };
    if (etatModalMotif.trim()) body.motif_qualif = etatModalMotif.trim();
    const sousList = (sousEtatsData || []).filter((s) => Number(s.id_etat) === Number(etatModalNewId));
    if (sousList.length > 0) {
      if (!etatModalSousEtat) {
        alert('Veuillez sélectionner un sous-état.');
        return;
      }
      body.id_sous_etat = parseInt(etatModalSousEtat, 10);
    }
    updateEtatFromMenuMutation.mutate({ hash: etatModalFiche.hash, body });
  };

  const openAffectModalFromMenu = () => {
    if (!ficheContextMenu?.fiche) return;
    const f = ficheContextMenu.fiche;
    setAffectModalFiche(f);
    const cid = f.id_commercial != null && Number(f.id_commercial) > 0 ? String(f.id_commercial) : '';
    setAffectModalCommercialId(cid);
    setFicheContextMenu(null);
  };

  const submitAffectModal = (ev) => {
    ev.preventDefault();
    if (!affectModalFiche?.id) return;
    if (Number(affectModalFiche.id_etat_final) !== 7) {
      alert('L\'affectation n\'est possible que pour les fiches à l\'état « Confirmer » (confirmées).');
      return;
    }
    if (!affectModalCommercialId) {
      alert('Veuillez sélectionner un commercial.');
      return;
    }
    affectFromMenuMutation.mutate({
      fiches_ids: [affectModalFiche.id],
      id_commercial: affectModalCommercialId,
    });
  };

  const handleDesaffectFromModal = () => {
    if (!affectModalFiche?.id) return;
    if (!window.confirm('Retirer l\'affectation commercial de cette fiche ?')) return;
    desaffectFromMenuMutation.mutate({ fiches_ids: [affectModalFiche.id] });
  };

  const affectModalBusy =
    affectFromMenuMutation.isLoading || desaffectFromMenuMutation.isLoading;

  const openValidationModalFromMenu = () => {
    if (!ficheContextMenu?.fiche) return;
    const f = ficheContextMenu.fiche;
    setValidationModalFiche(f);
    setValidationConfRdvAvec(f.conf_rdv_avec != null && String(f.conf_rdv_avec).trim() !== '' ? String(f.conf_rdv_avec) : '');
    setValidationConfPresenceCouple(
      f.conf_presence_couple != null && String(f.conf_presence_couple).trim() !== ''
        ? String(f.conf_presence_couple)
        : ''
    );
    setFicheContextMenu(null);
  };

  const submitValidationModal = (ev) => {
    ev.preventDefault();
    if (!validationModalFiche?.hash) return;
    if (Number(validationModalFiche.id_etat_final) !== 7) {
      alert('Seules les fiches confirmées (état Confirmer) peuvent être validées.');
      return;
    }
    if (!validationConfPresenceCouple) {
      alert('Veuillez sélectionner la présence du couple.');
      return;
    }
    validateFromMenuMutation.mutate({
      hash: validationModalFiche.hash,
      type_valid: `1${validationConfRdvAvec ? `-${validationConfRdvAvec}` : ''}`,
      conf_rdv_avec: validationConfRdvAvec || null,
      conf_presence_couple: validationConfPresenceCouple || null,
    });
  };

  const handleCancelValidationFromModal = () => {
    if (!validationModalFiche?.hash) return;
    if (!window.confirm('Voulez-vous annuler la validation de cette fiche ?')) return;
    validateFromMenuMutation.mutate({
      hash: validationModalFiche.hash,
      type_valid: '0',
    });
  };

  const runGeneratePdfFromMenu = (hash) => {
    if (!hash) return;
    setFicheContextMenu(null);
    generatePdfFromMenuMutation.mutate(hash);
  };

  const openFicheHistoriqueOverlay = () => {
    if (!ficheContextMenu?.fiche?.hash) return;
    setFicheDetailModal({ hash: ficheContextMenu.fiche.hash, focusHistoriqueEtats: true });
    setLastViewedFicheHash(ficheContextMenu.fiche.hash);
    setFicheContextMenu(null);
  };

  const validationModalBusy = validateFromMenuMutation.isLoading;

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

                {/* Affiner Annuler à reprogrammer / Honoré à suivre : COMPTE RENDU ou REPRO CONFIRMATEURS */}
                {(Number(filters.id_etat_final) === 8 || Number(filters.id_etat_final) === 9) && (
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
                {showCentreDashboardFilter && (
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
            <p>Aucune fiche trouvée{debouncedQuickSearch ? ` pour "${debouncedQuickSearch}"` : ''}</p>
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
                    const indicators = checkIndicators(fiche.id_etat_histo, fiche);
                    const etatColor = getEtatColor(fiche.id_etat_final, fiche);
                    const produitColor = getProduitColor(fiche.produit);
                    
                    return (
                      <tr 
                        key={fiche.hash}
                        className="fiche-row-by-etat"
                        onContextMenu={(e) => openFicheContextMenu(e, fiche)}
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
                        <td data-label="Commercial:">{getCommercialsFormatted(fiche) || '-'}</td>
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
                            {indicators.rs && <span className="indicator rs" title="SEUL">SEUL</span>}
                          </div>
                          <button
                            onClick={() => {
                              setFicheDetailModal({ hash: fiche.hash });
                              setLastViewedFicheHash(fiche.hash);
                            }}
                            className="btn-detail"
                            title="Voir les détails"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FaSearch style={{ color: '#ffffff', fontSize: '11.9px' }} />
                              {lastViewedFicheHash === fiche.hash && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '28px',
                                    height: '28px',
                                    border: '3px solid #9e9e9e',
                                    borderRadius: '1px',
                                    backgroundColor: 'transparent',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              )}
                            </span>
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
      {ficheDetailModal && (
        <FicheDetailModal
          ficheHash={ficheDetailModal.hash}
          onClose={() => setFicheDetailModal(null)}
          options={{ focusHistoriqueEtats: !!ficheDetailModal.focusHistoriqueEtats }}
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
                {showCentreDashboardFilter && (
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

                {(Number(filters.id_etat_final) === 8 || Number(filters.id_etat_final) === 9) && (
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
      {ficheContextMenu && (
        <div
          className="dashboard-fiche-context-menu"
          style={{
            position: 'fixed',
            left: Math.min(ficheContextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 224 : ficheContextMenu.x),
            top: Math.min(ficheContextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 340 : ficheContextMenu.y),
            zIndex: 10050,
          }}
          role="menu"
        >
          <button
            type="button"
            className="dashboard-fiche-context-menu-item"
            onClick={() => copyFicheTelFromMenu(ficheContextMenu.fiche.tel)}
          >
            Copier le téléphone
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={openEtatModalFromMenu}>
            Changer l&apos;état…
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={openAffectModalFromMenu}>
            Affectation…
          </button>
          {hasPermission('fiche_validate') && (
            <button type="button" className="dashboard-fiche-context-menu-item" onClick={openValidationModalFromMenu}>
              Validation…
            </button>
          )}
          <button
            type="button"
            className="dashboard-fiche-context-menu-item"
            onClick={() => runGeneratePdfFromMenu(ficheContextMenu.fiche.hash)}
            disabled={generatePdfFromMenuMutation.isLoading}
          >
            {generatePdfFromMenuMutation.isLoading ? 'Génération PDF…' : 'Impression PDF…'}
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={openFicheHistoriqueOverlay}>
            Voir historique (modal)…
          </button>
          <button
            type="button"
            className="dashboard-fiche-context-menu-item"
            onClick={() => openFicheDetailNewTab(ficheContextMenu.fiche.hash)}
          >
            Ouvrir dans un nouvel onglet
          </button>
        </div>
      )}

      {etatModalFiche && (
        <div
          className="dashboard-etat-modal-overlay"
          onClick={() => !updateEtatFromMenuMutation.isLoading && setEtatModalFiche(null)}
        >
          <div className="dashboard-etat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="dashboard-etat-modal-title">
            <h3 id="dashboard-etat-modal-title">Changer l&apos;état</h3>
            <p className="dashboard-etat-modal-fiche">
              {etatModalFiche.nom} {etatModalFiche.prenom} — {etatModalFiche.tel || '—'}
            </p>
            <form onSubmit={submitEtatModal}>
              <div className="dashboard-etat-modal-field">
                <label htmlFor="dashboard-etat-select">Nouvel état</label>
                <select
                  id="dashboard-etat-select"
                  value={etatModalNewId}
                  onChange={(e) => {
                    setEtatModalNewId(e.target.value);
                    setEtatModalSousEtat('');
                  }}
                  required
                  disabled={isLoadingEtats || !!etatsError}
                >
                  <option value="">— Sélectionner —</option>
                  {etatsPhase0.length > 0 && (
                    <optgroup label="PHASE 0">
                      {etatsPhase0.map((etat) => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase1.length > 0 && (
                    <optgroup label="PHASE 1">
                      {etatsPhase1.map((etat) => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase2.length > 0 && (
                    <optgroup label="PHASE 2">
                      {etatsPhase2.map((etat) => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase3.length > 0 && (
                    <optgroup label="PHASE 3">
                      {etatsPhase3.map((etat) => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase0.length === 0 &&
                    etatsPhase1.length === 0 &&
                    etatsPhase2.length === 0 &&
                    etatsPhase3.length === 0 &&
                    etats.length > 0 &&
                    etats.map((etat) => (
                      <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                        {etat.titre}
                      </option>
                    ))}
                </select>
              </div>
              {sousEtatsForEtatModal.length > 0 && (
                <div className="dashboard-etat-modal-field">
                  <label htmlFor="dashboard-sous-etat-select">Sous-état</label>
                  <select
                    id="dashboard-sous-etat-select"
                    value={etatModalSousEtat}
                    onChange={(e) => setEtatModalSousEtat(e.target.value)}
                    required
                  >
                    <option value="">— Sélectionner —</option>
                    {sousEtatsForEtatModal.map((se) => (
                      <option key={se.id} value={se.id}>
                        {se.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="dashboard-etat-modal-field">
                <label htmlFor="dashboard-etat-motif">Commentaire (optionnel)</label>
                <textarea
                  id="dashboard-etat-motif"
                  value={etatModalMotif}
                  onChange={(e) => setEtatModalMotif(e.target.value)}
                  rows={3}
                  placeholder="Motif du changement d'état"
                />
              </div>
              <div className="dashboard-etat-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEtatModalFiche(null)}
                  disabled={updateEtatFromMenuMutation.isLoading}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-search" disabled={updateEtatFromMenuMutation.isLoading}>
                  {updateEtatFromMenuMutation.isLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {affectModalFiche && (
        <div
          className="dashboard-etat-modal-overlay"
          onClick={() => !affectModalBusy && setAffectModalFiche(null)}
        >
          <div
            className="dashboard-etat-modal dashboard-affect-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-affect-modal-title"
          >
            <h3 id="dashboard-affect-modal-title">Affectation commercial</h3>
            <p className="dashboard-etat-modal-fiche">
              {affectModalFiche.nom} {affectModalFiche.prenom} — {affectModalFiche.tel || '—'}
            </p>
            <p className="dashboard-affect-modal-hint">
              Commercial actuel :{' '}
              {affectModalFiche.id_commercial && Number(affectModalFiche.id_commercial) > 0
                ? affectModalFiche.commercial_pseudo || getUserName(affectModalFiche.id_commercial) || '—'
                : 'aucun'}
            </p>
            {Number(affectModalFiche.id_etat_final) !== 7 && (
              <p className="dashboard-affect-modal-warning">
                L&apos;affectation (assigner un commercial) n&apos;est autorisée par le serveur que pour les fiches à
                l&apos;état « Confirmer ». Vous pouvez toutefois désaffecter si un commercial est encore renseigné.
              </p>
            )}
            <form onSubmit={submitAffectModal}>
              <div className="dashboard-etat-modal-field">
                <label htmlFor="dashboard-affect-commercial">Commercial</label>
                <select
                  id="dashboard-affect-commercial"
                  value={affectModalCommercialId}
                  onChange={(e) => setAffectModalCommercialId(e.target.value)}
                  disabled={affectModalBusy || Number(affectModalFiche.id_etat_final) !== 7}
                >
                  <option value="">— Sélectionner —</option>
                  {commerciaux.map((com) => (
                    <option key={com.id} value={com.id}>
                      {com.pseudo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dashboard-etat-modal-actions dashboard-affect-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setAffectModalFiche(null)}
                  disabled={affectModalBusy}
                >
                  Annuler
                </button>
                {affectModalFiche.id_commercial != null && Number(affectModalFiche.id_commercial) > 0 && (
                  <button
                    type="button"
                    className="btn-reset"
                    onClick={handleDesaffectFromModal}
                    disabled={affectModalBusy}
                  >
                    {desaffectFromMenuMutation.isLoading ? '…' : 'Désaffecter'}
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-search"
                  disabled={
                    affectModalBusy ||
                    Number(affectModalFiche.id_etat_final) !== 7 ||
                    !affectModalCommercialId
                  }
                >
                  {affectFromMenuMutation.isLoading ? 'Enregistrement…' : 'Affecter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {validationModalFiche && (
        <div
          className="dashboard-etat-modal-overlay"
          onClick={() => !validationModalBusy && setValidationModalFiche(null)}
        >
          <div
            className="dashboard-etat-modal dashboard-validation-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-validation-modal-title"
          >
            <h3 id="dashboard-validation-modal-title">Validation RDV</h3>
            <p className="dashboard-etat-modal-fiche">
              {validationModalFiche.nom} {validationModalFiche.prenom} — {validationModalFiche.tel || '—'}
            </p>
            {Number(validationModalFiche.id_etat_final) !== 7 && (
              <p className="dashboard-affect-modal-warning">
                La validation n&apos;est gérée par le serveur que pour les fiches à l&apos;état « Confirmer ».
              </p>
            )}
            {Number(validationModalFiche.valider) > 0 ? (
              <>
                <p className="dashboard-affect-modal-hint">Cette fiche est déjà validée.</p>
                <div className="dashboard-etat-modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setValidationModalFiche(null)}
                    disabled={validationModalBusy}
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    className="btn-search"
                    onClick={handleCancelValidationFromModal}
                    disabled={validationModalBusy || Number(validationModalFiche.id_etat_final) !== 7}
                  >
                    {validationModalBusy ? '…' : 'Annuler la validation'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submitValidationModal}>
                <div className="dashboard-etat-modal-field">
                  <label htmlFor="dashboard-validation-avec">Avec qui le RDV a-t-il été validé ? (optionnel)</label>
                  <select
                    id="dashboard-validation-avec"
                    value={validationConfRdvAvec}
                    onChange={(e) => setValidationConfRdvAvec(e.target.value)}
                    disabled={validationModalBusy || Number(validationModalFiche.id_etat_final) !== 7}
                  >
                    <option value="">Sélectionner…</option>
                    <option value="MR">Mr</option>
                    <option value="MME">Mme</option>
                    <option value="MR et MME">Mr et Mme</option>
                  </select>
                </div>
                <div className="dashboard-etat-modal-field">
                  <label htmlFor="dashboard-validation-presence">Présence du couple *</label>
                  <select
                    id="dashboard-validation-presence"
                    value={validationConfPresenceCouple}
                    onChange={(e) => setValidationConfPresenceCouple(e.target.value)}
                    disabled={validationModalBusy || Number(validationModalFiche.id_etat_final) !== 7}
                  >
                    <option value="">Sélectionner…</option>
                    <option value="RAS PRESENCE CLIENT(S)">RAS PRESENCE CLIENT(S)</option>
                    <option value="MME SEULE SANS MR">MME SEULE SANS MR</option>
                    <option value="MR SEUL SANS MME">MR SEUL SANS MME</option>
                  </select>
                </div>
                <div className="dashboard-etat-modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setValidationModalFiche(null)}
                    disabled={validationModalBusy}
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    className="btn-search"
                    disabled={
                      validationModalBusy ||
                      Number(validationModalFiche.id_etat_final) !== 7 ||
                      !validationConfPresenceCouple
                    }
                  >
                    {validationModalBusy ? '…' : 'Valider la fiche'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
};


export default Dashboard;
