import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import api from '../config/api';
import { FaCalendarAlt, FaUser, FaFileAlt, FaMapMarkerAlt, FaSearch, FaChevronDown, FaChevronUp, FaExpand, FaCompress, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailModal from '../components/FicheDetailModal';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import { getEtatsGroupedByPhase } from '../utils/etatsByPhase';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import SystemMessageBanner from '../components/SystemMessageBanner';
import {
  applyForceDesktopViewport,
  applyMobileNativeViewport,
  applyPlanningCommercialMobileView,
  applyPlanningCommercialTableDesktopView,
  applyPlanningCommercialTableDesktopViewForFicheModal,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';
import {
  stashPendingPlanningCommercialFicheModal,
  clearPendingPlanningCommercialFicheModal,
  resolvePendingPlanningCommercialFicheModal,
} from '../utils/planningCommercialFicheModalSession';
import './PlanningCommercial.css';

const PLANNING_MOBILE_NATIVE_CLASS = 'planning-commercial-page--mobile-native';
const PLANNING_EXTRANET_SCROLL_CLASS = 'planning-commercial-page--extranet-scroll';
const PLANNING_OPEN_FICHE_PARAM = 'openFiche';
const PLANNING_DAY_OFFSET = 5;

const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function isPlanningDayTab(tab) {
  return /^\d{4}-\d{2}-\d{2}$/.test(tab || '');
}

function formatPlanningDayTabLabel(date) {
  const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${dayName} ${dayNum}`;
}

function parseLocalDate(yyyyMmDd) {
  if (!isPlanningDayTab(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildPlanningDayTabs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tabs = [];
  for (let offset = -PLANNING_DAY_OFFSET; offset <= PLANNING_DAY_OFFSET; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = toLocalDateString(d);
    tabs.push({
      dateStr,
      label: formatPlanningDayTabLabel(d),
      isToday: offset === 0,
    });
  }
  return tabs;
}

function resolveInitialPlanningTab(tab) {
  if (isPlanningDayTab(tab)) return tab;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (tab === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return toLocalDateString(d);
  }
  if (tab === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toLocalDateString(d);
  }
  return toLocalDateString(today);
}

function getFicheModalStateFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const openFiche = params.get(PLANNING_OPEN_FICHE_PARAM);
  if (!openFiche) return null;
  return {
    hash: openFiche,
    focusHistoriqueEtats: params.get('ficheFocusHisto') === '1',
    initialTab: params.get('ficheTab') || undefined,
  };
}

function clearFicheModalUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get(PLANNING_OPEN_FICHE_PARAM)) return;
  params.delete(PLANNING_OPEN_FICHE_PARAM);
  params.delete('tableModal');
  params.delete('ficheFocusHisto');
  params.delete('ficheTab');
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

function planningFiltersToUrlParams(f) {
  const out = {};
  const set = (key, value) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'boolean') {
      if (value) out[key] = '1';
      return;
    }
    const s = String(value).trim();
    if (s === '') return;
    out[key] = s;
  };
  set('fiche_search', true);
  set('page', f.page || 1);
  set('limit', f.limit);
  set('id_etat_final', f.id_etat_final);
  set('date_champ', f.date_champ);
  set('date_debut', f.date_debut);
  set('date_fin', f.date_fin);
  set('time_debut', f.time_debut);
  set('time_fin', f.time_fin);
  set('id_confirmateur', f.id_confirmateur);
  set('id_commercial', f.id_commercial);
  set('id_centre', f.id_centre);
  set('critere', f.critere);
  set('critere_champ', f.critere_champ);
  set('cp', f.cp);
  set('nom', f.nom);
  set('prenom', f.prenom);
  if (f.produit !== undefined && f.produit !== null && f.produit !== '') {
    const p = Array.isArray(f.produit) ? f.produit[0] : f.produit;
    set('produit', p);
  }
  return out;
}

// Date du jour en YYYY-MM-DD (heure locale) pour éviter le décalage UTC sur "RDV aujourd'hui"
const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PlanningCommercial = () => {
  const { user, hasPermission } = useAuth();
  const { closeSidebar } = useSidebar();

  useEffect(() => {
    document.body.classList.add('planning-commercial-page');
    document.documentElement.classList.add('planning-commercial-page');
    return () => {
      document.body.classList.remove('planning-commercial-page');
      document.documentElement.classList.remove('planning-commercial-page');
    };
  }, []);

  /** iOS : rechargement avec ?openFiche=… → tableau zoom out + modal */
  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    const params = new URLSearchParams(window.location.search);
    const openFiche = params.get(PLANNING_OPEN_FICHE_PARAM);
    if (!openFiche) return undefined;

    applyPlanningCommercialTableDesktopViewForFicheModal();

    return undefined;
  }, []);

  /** Mobile par défaut (device-width) — bascule vue tableau via le bouton */
  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    const params = new URLSearchParams(window.location.search);
    if (params.get(PLANNING_OPEN_FICHE_PARAM)) return undefined;

    document.documentElement.classList.add(PLANNING_MOBILE_NATIVE_CLASS);
    document.body.classList.add(PLANNING_MOBILE_NATIVE_CLASS);

    applyMobileNativeViewport();
    window.dispatchEvent(new Event('viewport-layout-change'));
    closeSidebar();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(applyMobileNativeViewport);
    });

    return () => {
      cancelAnimationFrame(id);
      document.documentElement.classList.remove(PLANNING_MOBILE_NATIVE_CLASS);
      document.body.classList.remove(PLANNING_MOBILE_NATIVE_CLASS);
      if (!isTouchMobileDevice()) {
        applyForceDesktopViewport();
      }
    };
  }, [closeSidebar]);

  /** Mobile : scroll page unique, tableau desktop (max-content) */
  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    document.documentElement.classList.add(PLANNING_EXTRANET_SCROLL_CLASS);
    document.body.classList.add(PLANNING_EXTRANET_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(PLANNING_EXTRANET_SCROLL_CLASS);
      document.body.classList.remove(PLANNING_EXTRANET_SCROLL_CLASS);
    };
  }, []);

  const queryClient = useQueryClient();
  const [ficheDetailModal, setFicheDetailModal] = useState(() =>
    resolvePendingPlanningCommercialFicheModal(getFicheModalStateFromUrl())
  );
  const { lastViewedFicheHash, setLastViewedFicheHash } = useFicheDetailModal();
  const [isTableDesktopView, setIsTableDesktopView] = useState(() => Boolean(getFicheModalStateFromUrl()));
  const isPlanningTouchMobile = isTouchMobileDevice();

  const initialTabFromUrl = (() => {
    if (typeof window === 'undefined') return toLocalDateString(new Date());
    const tab = new URLSearchParams(window.location.search).get('tab');
    return resolveInitialPlanningTab(tab);
  })();

  const [activeTab, setActiveTab] = useState(initialTabFromUrl);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 100,
    fiche_search: false,
    date_champ: 'date_rdv_time',
    date_debut: initialTabFromUrl,
    date_fin: initialTabFromUrl,
    time_debut: '00:00:00',
    time_fin: '23:59:59',
    id_etat_final: user?.fonction === 5 ? '7' : '',
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const switchToMobileView = useCallback(() => {
    document.documentElement.classList.add(PLANNING_MOBILE_NATIVE_CLASS);
    document.body.classList.add(PLANNING_MOBILE_NATIVE_CLASS);
    applyPlanningCommercialMobileView();
    window.dispatchEvent(new Event('viewport-layout-change'));
    closeSidebar();
    setIsTableDesktopView(false);
  }, [closeSidebar]);

  const switchToTableDesktopView = useCallback(() => {
    document.documentElement.classList.remove(PLANNING_MOBILE_NATIVE_CLASS);
    document.body.classList.remove(PLANNING_MOBILE_NATIVE_CLASS);
    applyPlanningCommercialTableDesktopView();
    setIsTableDesktopView(true);
  }, []);

  const togglePlanningViewport = useCallback(() => {
    if (isTableDesktopView) switchToMobileView();
    else switchToTableDesktopView();
  }, [isTableDesktopView, switchToMobileView, switchToTableDesktopView]);

  const openPlanningFicheDetail = useCallback(
    (modalState) => {
      if (!modalState?.hash) return;

      if (isPlanningTouchMobile) {
        stashPendingPlanningCommercialFicheModal(modalState);
        const params = new URLSearchParams(window.location.search);
        if (filtersRef.current?.fiche_search) {
          Object.entries(planningFiltersToUrlParams(filtersRef.current)).forEach(([key, value]) => {
            params.set(key, String(value));
          });
        } else if (activeTabRef.current && isPlanningDayTab(activeTabRef.current)) {
          params.set('tab', activeTabRef.current);
        }
        params.set(PLANNING_OPEN_FICHE_PARAM, modalState.hash);
        if (modalState.focusHistoriqueEtats) params.set('ficheFocusHisto', '1');
        if (modalState.initialTab) params.set('ficheTab', modalState.initialTab);
        params.set('tableModal', '1');
        const qs = params.toString();
        window.location.assign(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
        return;
      }

      setFicheDetailModal(modalState);
      if (modalState.hash) {
        setLastViewedFicheHash(modalState.hash);
      }
    },
    [isPlanningTouchMobile, setLastViewedFicheHash]
  );

  useEffect(() => {
    if (!isPlanningTouchMobile) return undefined;

    const fromUrl = getFicheModalStateFromUrl();
    const pending = resolvePendingPlanningCommercialFicheModal(fromUrl);
    if (!pending?.hash) return undefined;

    setIsTableDesktopView(true);
    setFicheDetailModal(pending);
    setLastViewedFicheHash(pending.hash);
    if (fromUrl) clearFicheModalUrlParams();

    return undefined;
  }, [isPlanningTouchMobile, setLastViewedFicheHash]);

  const closePlanningFicheDetail = useCallback(() => {
    clearPendingPlanningCommercialFicheModal();
    setFicheDetailModal(null);
    if (isPlanningTouchMobile) {
      switchToMobileView();
    } else {
      closeSidebar();
    }
  }, [isPlanningTouchMobile, switchToMobileView, closeSidebar]);

  // Plage d'un jour (onglet = date YYYY-MM-DD)
  const getDateRange = (period) => {
    const dateStr = isPlanningDayTab(period) ? period : toLocalDateString(new Date());
    return {
      date_debut: dateStr,
      date_fin: dateStr,
      time_debut: '00:00:00',
      time_fin: '23:59:59',
    };
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
  const { phase0: etatsPhase0, phase1: etatsPhase1, phase2: etatsPhase2, phase3: etatsPhase3 } = getEtatsGroupedByPhase(etats);
  const etatConfirmer = etats.find(e => e.id === 7); // CONFIRMER (état 7) - Phase 2
  const isCommercial = user?.fonction === 5;
  // Pour les commerciaux : uniquement CONFIRMER + Phase 3 (liste plate pour etatsFiltres, affichage par phase dans le select)
  const etatsFiltres = isCommercial
    ? [...(etatConfirmer ? [etatConfirmer] : []), ...etatsPhase3]
    : etats;

  // Pour les commerciaux : pré-sélectionner l'état CONFIRMER (7) par défaut
  const etatParDefaut = isCommercial ? '7' : '';

  const formatDateFr = (yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '';
    const [y, m, d] = yyyyMmDd.split('-');
    if (!y || !m || !d) return yyyyMmDd;
    return `${d}/${m}/${y}`;
  };

  /** Plage de dates selon l'onglet actif, ou les filtres si recherche manuelle (activeTab null). */
  const getTabDateRange = () => {
    if (activeTab) return getDateRange(activeTab);
    return {
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      time_debut: filters.time_debut || '00:00:00',
      time_fin: filters.time_fin || '23:59:59'
    };
  };

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
    
    const dateRange = getTabDateRange();
    
    const defaultParams = {
      page: filters.page || 1,
      limit: filters.limit || 100,
      date_champ: filters.date_champ || 'date_rdv_time',
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
    ['planning-commercial', activeTab, filters],
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
    const today = getLocalDateStr();
    setActiveTab(today);
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
    return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#FFE441' : '#cccccc';
  };

  // Obtenir le nom du commercial
  const getCommercialName = (fiche) => {
    const names = [];
    if (fiche.commercial_pseudo) names.push(fiche.commercial_pseudo);
    if (fiche.commercial_2_pseudo) names.push(fiche.commercial_2_pseudo);
    return names.length > 0 ? names.join(' / ') : '-';
  };
  
  // Vérifier si c'est un R2 (deuxième commercial assigné)
  const isR2 = (fiche) => {
    return user?.fonction === 5 && fiche && Number(fiche.id_commercial_2) === Number(user?.id);
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
  const planningDayTabs = buildPlanningDayTabs();
  const activeDayLabel = activeTab && parseLocalDate(activeTab)
    ? formatPlanningDayTabLabel(parseLocalDate(activeTab))
    : null;

  return (
    <div className="planning-commercial">
      <SystemMessageBanner />
      <div className="planning-commercial-header">
        <div className="planning-commercial-header-left">
          {isPlanningTouchMobile && (
            <button
              type="button"
              className="btn-planning-view-toggle"
              onClick={togglePlanningViewport}
              title={isTableDesktopView ? 'Revenir à la vue mobile' : 'Afficher le tableau en vue desktop'}
            >
              {isTableDesktopView ? (
                <>
                  <FaCompress /> Vue mobile
                </>
              ) : (
                <>
                  <FaExpand /> Vue tableau
                </>
              )}
            </button>
          )}
          <h1><FaCalendarAlt /> Planning Commercial</h1>
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

                {/* État final - regroupé par phase (0,1,2,3), ordre BDD, couleur BDD */}
                <div className="form-group">
                  <label>État final</label>
                  <select
                    value={filters.id_etat_final || ''}
                    onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {isCommercial ? (
                      <>
                        {etatConfirmer && (
                          <optgroup label="PHASE 2">
                            <option key={etatConfirmer.id} value={etatConfirmer.id} style={{ backgroundColor: etatConfirmer.color || '#cccccc' }}>
                              {etatConfirmer.titre}
                            </option>
                          </optgroup>
                        )}
                        {etatsPhase3.length > 0 && (
                          <optgroup label="PHASE 3">
                            {etatsPhase3.map(etat => (
                              <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                                {etat.titre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      <>
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
                            {etatsPhase3.map(etat => (
                              <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                                {etat.titre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
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

              <div className="form-actions search-form-actions-end">
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

      {/* Sélection du jour : 5 jours avant → 5 jours après */}
      <div className="planning-commercial-day-select">
        <label htmlFor="planning-day-select">Jour :</label>
        <select
          id="planning-day-select"
          className="planning-day-select"
          value={activeTab || getLocalDateStr()}
          onChange={(e) => handleTabChange(e.target.value)}
          disabled={filters.fiche_search}
        >
          {planningDayTabs.map((day) => (
            <option key={day.dateStr} value={day.dateStr}>
              {day.label}
              {day.isToday ? ' (aujourd\'hui)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Résultats */}
      <div className="planning-commercial-results">
        <div className="results-header">
          <h2>
            {filters.fiche_search
              ? 'Résultats de la recherche'
              : activeDayLabel
                ? `RDV confirmés du ${activeDayLabel}`
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
                    {isCommercial ? <th>Validé</th> : <th>Centre</th>}
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
                          <strong>{formatRdvDateTime(fiche.date_rdv_time)}</strong>
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
                            {isR2(fiche) && (
                              <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '0.85em',
                                color: '#e74c3c',
                                fontWeight: 'bold',
                                backgroundColor: '#fff',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                border: '1px solid #e74c3c'
                              }}>
                                R2
                              </span>
                            )}
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
                        {isCommercial ? (
                          <td data-label="Validé:" style={{ textAlign: 'center' }}>
                            {fiche.valider > 0 ? (
                              <FaCheck
                                style={{
                                  color: '#28a745',
                                  fontSize: '15.3px',
                                }}
                                title={`Validée${fiche.conf_rdv_avec ? ` avec ${fiche.conf_rdv_avec}` : ''}`}
                              />
                            ) : (
                              <span style={{ color: '#ccc' }}>-</span>
                            )}
                          </td>
                        ) : (
                          <td data-label="Centre:">{fiche.centre_titre || '-'}</td>
                        )}
                        <td data-label="">
                          <button
                            onClick={() => openPlanningFicheDetail({ hash: fiche.hash })}
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
                                    boxSizing: 'border-box',
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

      {ficheDetailModal && (
        <FicheDetailModal
          ficheHash={ficheDetailModal.hash}
          onClose={closePlanningFicheDetail}
          options={{
            focusHistoriqueEtats: !!ficheDetailModal.focusHistoriqueEtats,
            initialTab: ficheDetailModal.initialTab || undefined,
            pinchZoom: isPlanningTouchMobile,
            allowBackdropClose: true,
          }}
        />
      )}
    </div>
  );
};

export default PlanningCommercial;

