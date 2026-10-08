import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaPlus, FaArchive, FaBoxOpen, FaTimes, FaSearch, FaChevronDown, FaChevronUp, FaCheck, FaFileAlt, FaBan, FaSort, FaSortUp, FaSortDown, FaFilter } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getEtatsGroupedByPhase } from '../utils/etatsByPhase';
import { getEffectiveEtatColor, getEffectiveEtatTitle, getEtatTableAbbr, getEtatDisplayWithSousEtat } from '../utils/etatSignerComplet';
import { getCentreTableAbbr } from '../utils/tableAbbreviations';
import { getFicheRowByEtatClassName } from '../utils/etatColorContrast';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { generateFicheClientPdf } from '../utils/generateFicheClientPdf';
import {
  getFicheTableIndicators,
  ficheHasDecalageRequest,
  getDecalageDisplayInfo,
} from '../utils/ficheTableIndicators';
import { isAdminSession, isHonoreASuivreBadgeSession } from '../utils/adminMenuUrls';
import { formatFicheCommercialDisplay } from '../utils/ficheCommercialDisplay';
import {
  FicheAdminBadgeHeaders,
  FicheAdminValideCell,
  FicheAdminActionCell,
  FicheAdminIndicatorCells,
} from '../components/fiches/FicheAdminBadgeColumns';
import SystemMessageBanner from '../components/SystemMessageBanner';
import ScrollToTopButton from '../components/common/ScrollToTopButton';
import KoMotifModal from '../components/KoMotifModal';
import CreateFicheModal from '../components/CreateFicheModal';
import './Fiches.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const HEADER_FILTER_OPS = [
  { value: 'eq', label: 'Égal' },
  { value: 'neq', label: 'Différent' },
  { value: 'starts', label: 'Commence par' },
  { value: 'nstarts', label: 'Ne commence pas par' },
  { value: 'ends', label: 'Se termine par' },
  { value: 'nends', label: 'Ne se termine pas par' },
  { value: 'contains', label: 'Contient' },
  { value: 'ncontains', label: 'Ne contient pas' },
  { value: 'empty', label: 'Est vide' },
  { value: 'nempty', label: "N'est pas vide" },
];

const HEADER_FILTER_OPS_WITHOUT_VALUE = new Set(['empty', 'nempty']);

const isHeaderFilterActive = (filter) => {
  if (!filter?.op) return false;
  if (HEADER_FILTER_OPS_WITHOUT_VALUE.has(filter.op)) return true;
  return String(filter.value || '').trim() !== '';
};

const matchesHeaderFilter = (text, op, value) => {
  const t = String(text ?? '').toLowerCase().trim();
  const v = String(value ?? '').toLowerCase().trim();
  switch (op) {
    case 'eq':
      return t === v;
    case 'neq':
      return t !== v;
    case 'starts':
      return t.startsWith(v);
    case 'nstarts':
      return !t.startsWith(v);
    case 'ends':
      return t.endsWith(v);
    case 'nends':
      return !t.endsWith(v);
    case 'contains':
      return t.includes(v);
    case 'ncontains':
      return !t.includes(v);
    case 'empty':
      return t === '';
    case 'nempty':
      return t !== '';
    default:
      return true;
  }
};

const Fiches = () => {
  useForceDesktopViewport('fiches-page');
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAgentQualif = user?.fonction === 3;
  const isPartenaire = Number(user?.fonction) === 9;
  const isAdminFicheLayout = isAdminSession(user);
  const showHasBadge = isHonoreASuivreBadgeSession(user);
  /** Superviseur qualification (RE qualif) : chargement auto des fiches du jour (périmètre agents) */
  const isSuperviseurQualif = user?.fonction === 2;
  /** Backoffice : toutes les fiches créées le jour courant (pas de filtre id_agent par défaut) */
  const isBackoffice = user?.fonction === 11;
  const canArchiveFiche = [1, 2, 7, 11, 13].includes(Number(user?.fonction));
  const [showFilters, setShowFilters] = useState(!isAgentQualif); // Masquer pour agent qualif
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [koModal, setKoModal] = useState({ isOpen: false, ficheHash: null, motifKo: '', commentaireComplement: '' });
  const [quickSearch, setQuickSearch] = useState(''); // Recherche rapide
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 250);
  const getInitialFilters = () => ({
    page: 1,
    limit: 500,
    fiche_search: false,
    // Partenaire : fiches avec id_insert (onglet backoffice) ; sinon qualif par défaut
    fiche_source: isPartenaire ? 'backoffice' : 'qualif',
    include_archive: false,
    id_centre: '',
    id_sous_etat: '',
    id_agent: '',
    id_etat_final: '',
    annuler_repro_type: '', // '' = tous, 'compte_rendu' ou 'repro_confirmateurs' (Annuler à reprogrammer ou Client honoré à suivre)
    date_champ: '',
    date_debut: '',
    date_fin: '',
    time_debut: '',
    time_fin: '',
    critere: '',
    critere_champ: 'tel',
    cp: '',
    nom: '',
    prenom: '',
    produit: '',
    id_confirmateur: '',
    id_commercial: '',
  });
  const [filters, setFilters] = useState(getInitialFilters);
  // Filtres appliqués à la requête (mis à jour uniquement au clic sur Recherche, pagination ou reset)
  const [appliedFilters, setAppliedFilters] = useState(getInitialFilters);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
  const [headerFilters, setHeaderFilters] = useState({});
  const [openHeaderFilter, setOpenHeaderFilter] = useState(null);
  const [headerFilterPos, setHeaderFilterPos] = useState({ top: 0, left: 0 });
  const headerFilterRef = useRef(null);

  const normalizeText = (v) => (typeof v === 'string' ? v.trim() : v);
  const getLocalTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const { data: sousEtatsData } = useQuery('sous-etat', async () => {
    const res = await api.get('/management/sous-etat');
    return res.data.data || [];
  }, referenceDataOptions);

  const { data: professionsData } = useQuery('professions', async () => {
    const res = await api.get('/management/professions');
    return res.data.data;
  }, referenceDataOptions);

  const { data: modeChauffageData } = useQuery('mode-chauffage', async () => {
    const res = await api.get('/management/mode-chauffage');
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

  // Construire les paramètres de requête (utilise appliedFilters = filtres envoyés à l'API)
  const getQueryParams = (sourceFilters) => {
    const src = sourceFilters || appliedFilters;
    const isQuickSearchActive = debouncedQuickSearch.trim() !== '';
    const limitParam = isQuickSearchActive ? 999999 : (src.limit === 999999 ? 999999 : src.limit);
    const pageParam = isQuickSearchActive ? 1 : (src.page || 1);
    
    if (src.fiche_search) {
      const searchParams = { 
        ...src, 
        limit: limitParam,
        page: pageParam,
        fiche_search: 1,
        ...(sortConfig.key ? { sort_by: sortConfig.key, sort_dir: sortConfig.direction } : {})
      };

      // Normaliser la recherche par critère (enlever espaces avant/après)
      if (typeof searchParams.critere === 'string') {
        searchParams.critere = searchParams.critere.trim();
      }

      // Recherche ciblée (tél/nom/CP…) : ne pas restreindre à l'onglet Qualif/Backoffice
      // (comportement aligné sur le Dashboard, sinon un numéro d'import masse est introuvable sur Qualif)
      const hasLookupCriterion = !!(
        (searchParams.critere || '').trim() ||
        (searchParams.nom || '').trim() ||
        (searchParams.prenom || '').trim() ||
        (searchParams.cp || '').trim() ||
        (searchParams.tel || '').trim()
      );
      if (hasLookupCriterion) {
        delete searchParams.fiche_source;
      }
      
      // Nettoyer les paramètres vides (mais garder page, limit, fiche_search, critere, critere_champ)
      Object.keys(searchParams).forEach(key => {
        if (key === 'page' || key === 'limit' || key === 'fiche_search' || key === 'sort_by' || key === 'sort_dir') {
          return; // Ne pas supprimer ces paramètres
        }
        if (key === 'fiche_source' && !isAgentQualif && searchParams.fiche_source) {
          return;
        }
        // include_archive: n'envoyer au backend que si activé
        if (key === 'include_archive') {
          if (
            searchParams.include_archive === true ||
            searchParams.include_archive === 1 ||
            searchParams.include_archive === '1' ||
            searchParams.include_archive === 'true'
          ) {
            searchParams.include_archive = 1;
          } else {
            delete searchParams.include_archive;
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
        // Si recherche par critère/CP uniquement avec dates = aujourd'hui (défaut), les retirer pour une recherche globale
        if (key === 'date_debut' || key === 'date_fin' || key === 'date_champ' || key === 'time_debut' || key === 'time_fin') {
          if (hasLookupCriterion) {
            const today = getLocalTodayStr();
            const onlyDefaultToday =
              (!searchParams.date_debut || searchParams.date_debut === today) &&
              (!searchParams.date_fin || searchParams.date_fin === today);
            if (onlyDefaultToday) {
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
    
    // Sinon, par défaut : fiches créées aujourd'hui (date_insert_time)
    // - Agent qualification : uniquement ses fiches (id_agent = lui)
    // - Backoffice : toutes les fiches du jour (pas d'id_agent sauf si choisi dans les filtres)
    const { dateStr, timeStart, timeEnd } = getTodayDateRange();
    const defaultParams = {
      page: pageParam,
      limit: limitParam,
      date_champ: 'date_insert_time',
      date_debut: dateStr,
      date_fin: dateStr,
      time_debut: timeStart,
      time_fin: timeEnd,
      ...(sortConfig.key ? { sort_by: sortConfig.key, sort_dir: sortConfig.direction } : {})
    };

    if (src.include_archive === true || src.include_archive === 1 || src.include_archive === '1') {
      defaultParams.include_archive = 1;
    }
    if (!isAgentQualif && src.fiche_source) {
      defaultParams.fiche_source = src.fiche_source;
    }
    if (src.id_centre) {
      defaultParams.id_centre = src.id_centre;
    }
    if (src.id_agent && !isAgentQualif) {
      defaultParams.id_agent = src.id_agent;
    }
    if (isAgentQualif && user?.id) {
      defaultParams.id_agent = user.id;
    }
    
    return defaultParams;
  };

  // Récupérer les stats du mois pour agent qualification
  const { data: statsMoisResponse } = useQuery(
    ['fiches-stats-mois'],
    async () => {
      const res = await api.get('/fiches/stats/mois');
      return res.data;
    },
    { enabled: isAgentQualif }
  );

  const statsMoisEtatsAll = statsMoisResponse?.data || [];
  const statsMoisValidated = statsMoisEtatsAll.find((s) => s.etat_id === 'validated');
  const statsMoisEtats = statsMoisEtatsAll.filter((s) => s.etat_id !== 'validated');
  const statsMoisSummary = statsMoisResponse?.summary || null;
  const statsMoisPodium = statsMoisResponse?.podium || [];
  const podiumMaxCount =
    statsMoisPodium.length > 0
      ? Math.max(...statsMoisPodium.map((a) => Number(a.count) || 0), 1)
      : 1;

  // Récupérer les fiches : chargement auto agent qualif / superviseur qualif / backoffice / partenaire (jour courant) ; sinon au clic Recherche
  const fichesListEnabled =
    appliedFilters.fiche_search === true ||
    isAgentQualif ||
    isSuperviseurQualif ||
    isBackoffice ||
    isPartenaire;

  const { data, isLoading, isFetching, error, refetch } = useQuery(
    ['fiches', appliedFilters, debouncedQuickSearch, sortConfig],
    async () => {
      const params = getQueryParams();
      const response = await api.get('/fiches', { params });
      return response.data;
    },
    {
      keepPreviousData: true,
      enabled: fichesListEnabled
    }
  );

  const { data: sourceCountsData } = useQuery(
    ['fiches-source-counts', appliedFilters, debouncedQuickSearch],
    async () => {
      const fetchSourceTotal = async (source) => {
        const params = getQueryParams({
          ...appliedFilters,
          fiche_source: source,
          page: 1,
          limit: 1,
        });
        const response = await api.get('/fiches', { params });
        return response.data?.pagination?.total ?? 0;
      };
      const [qualif, backoffice] = await Promise.all([
        fetchSourceTotal('qualif'),
        fetchSourceTotal('backoffice'),
      ]);
      return { qualif, backoffice };
    },
    {
      keepPreviousData: true,
      enabled: !isAgentQualif && fichesListEnabled,
    }
  );

  useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false);
    }
  }, [isFetching, isSearching]);

  useEffect(() => {
    if (!openHeaderFilter) return undefined;
    const onPointerDown = (event) => {
      if (
        headerFilterRef.current?.contains(event.target) ||
        event.target.closest('.header-filter-btn')
      ) {
        return;
      }
      setOpenHeaderFilter(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenHeaderFilter(null);
    };
    const onViewportChange = () => setOpenHeaderFilter(null);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [openHeaderFilter]);

  // Mutation pour créer une fiche
  const createMutation = useMutation(
    async (ficheData) => {
      const response = await api.post('/fiches', ficheData);
      return response.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('fiches');
        queryClient.invalidateQueries('fiches-source-counts');
        if (isAgentQualif) {
          queryClient.invalidateQueries(['fiches-stats-mois']);
        }
        setShowCreateModal(false);
        if (data?.data?.autoApproved) {
          toast.success(
            data.message ||
              `Fiche acceptée automatiquement (${data.data.regleLibelle || 'règle'})`
          );
        } else if (data?.data?.demandeCreated) {
          toast.info(
            data.message ||
              'Une demande d\'insertion a été créée (doublon téléphone).'
          );
        } else if (data?.data?.alreadyInsertedToday) {
          toast.info(data.message || "Fiche déjà insérée aujourd'hui.");
        } else {
          toast.success(data?.message || 'Fiche créée avec succès');
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création de la fiche');
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
        queryClient.invalidateQueries('fiches-source-counts');
        toast.success(variables.archive ? 'Fiche archivée avec succès' : 'Fiche désarchivée avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'archivage de la fiche');
      }
    }
  );

  // Mutation pour mettre une fiche en KO
  const koMutation = useMutation(
    async ({ id, ko, motif_ko, commentaire_complement }) => {
      const body = { ko };
      if (ko) {
        body.motif_ko = motif_ko;
        if (commentaire_complement) body.commentaire_complement = commentaire_complement;
      }
      const response = await api.patch(`/fiches/${id}/ko`, body);
      return response.data;
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries('fiches');
        queryClient.invalidateQueries('fiches-source-counts');
        toast.success(variables.ko ? 'Fiche mise en KO avec succès' : 'Fiche retirée du KO avec succès');
        setKoModal({ isOpen: false, ficheHash: null, motifKo: '', commentaireComplement: '' });
        if (isAgentQualif) {
          queryClient.invalidateQueries(['fiches-stats-mois']);
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise en KO de la fiche');
      }
    }
  );

  // Filtrer les utilisateurs par fonction
  const confirmateurs = usersData ? usersData.filter(u => u.fonction === 6 && u.etat > 0) : [];
  const commerciaux = usersData ? usersData.filter(u => u.fonction === 5 && u.etat > 0) : [];
  const agents = usersData ? usersData.filter(u => u.fonction === 3 && u.etat > 0) : [];
  const partnerCentreIds = isPartenaire
    ? (Array.isArray(user?.centres_ids) && user.centres_ids.length > 0
        ? user.centres_ids.map(Number)
        : user?.centre
          ? [Number(user.centre)]
          : [])
    : null;
  const centres = centresData
    ? centresData.filter((c) => {
        if (!(c.etat > 0)) return false;
        if (partnerCentreIds) return partnerCentreIds.includes(Number(c.id));
        return true;
      })
    : [];
  const etats = etatsData || [];
  const { phase0: etatsPhase0, phase1: etatsPhase1, phase2: etatsPhase2, phase3: etatsPhase3 } = getEtatsGroupedByPhase(etats);

  const sousEtatsForSelectedEtat = (sousEtatsData || []).filter(
    s => Number(s.id_etat) === Number(filters.id_etat_final)
  );
  const showSousEtatFilter = filters.id_etat_final && sousEtatsForSelectedEtat.length > 0;

  const handleFilterChange = (key, value) => {
    const nextValue = key === 'critere' ? normalizeText(value) : value;
    setFilters(prev => ({
      ...prev,
      [key]: nextValue,
      page: 1,
      ...(key === 'id_etat_final' ? { id_sous_etat: '', annuler_repro_type: '' } : {})
    }));
    // Pagination, limite, archives : appliquer immédiatement à la requête
    if (key === 'page' || key === 'limit' || key === 'include_archive') {
      setIsSearching(true);
      const autoLoadProfile = isAgentQualif || isSuperviseurQualif || isBackoffice || isPartenaire;
      setAppliedFilters(prev => ({
        ...prev,
        [key]: key === 'page' ? value : nextValue,
        ...(key === 'limit' ? { page: 1 } : {}),
        ...(key === 'include_archive' && !autoLoadProfile ? { fiche_search: true } : {}),
      }));
    }
  };

  const handleSearch = (e) => {
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
      filters.id_agent ||
      (filters.cp || '').trim() ||
      filters.produit ||
      (filters.nom || '').trim() ||
      (filters.prenom || '').trim() ||
      filters.include_archive
    );
    if (!hasRefinedSearch && !window.confirm('Cette recherche peut prendre plusieurs secondes. Confirmer la recherche ?')) {
      return;
    }
    const newFilters = { ...filters, fiche_search: true, page: 1 };
    
    if (newFilters.critere || (newFilters.cp || '').trim() || (newFilters.nom || '').trim() || (newFilters.prenom || '').trim()) {
      const today = getLocalTodayStr();
      if (
        (!newFilters.date_debut || newFilters.date_debut === today) &&
        (!newFilters.date_fin || newFilters.date_fin === today)
      ) {
        delete newFilters.date_debut;
        delete newFilters.date_fin;
        delete newFilters.date_champ;
        delete newFilters.time_debut;
        delete newFilters.time_fin;
      }
    }
    
    setIsSearching(true);
    setFilters(newFilters);
    setAppliedFilters(newFilters);
  };

  const handleReset = () => {
    const initial = getInitialFilters();
    setFilters(initial);
    setAppliedFilters(initial);
  };

  const handleSourceTabChange = (source) => {
    if (source === appliedFilters.fiche_source) return;
    setIsSearching(true);
    setFilters((prev) => ({ ...prev, fiche_source: source, page: 1 }));
    setAppliedFilters((prev) => ({ ...prev, fiche_source: source, page: 1 }));
  };

  const handleArchive = (fiche) => {
    const isArchived = fiche.archive === 1 || fiche.archive === true;
    const nextArchive = !isArchived;
    if (!fiche.hash) {
      toast.error('Identifiant fiche manquant');
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir ${nextArchive ? 'archiver' : 'désarchiver'} cette fiche ?`)) {
      archiveMutation.mutate({ id: fiche.hash, archive: nextArchive });
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
    return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#818cf8' : '#cccccc';
  };

  const getProduitName = (produitId) => {
    return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
  };

  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  const getCommercialsFormatted = (fiche) =>
    formatFicheCommercialDisplay(fiche, getUserName, appliedFilters);

  const getCentreName = (centreId) => {
    if (!centreId || !centresData) return '';
    const centre = centresData.find(c => c.id === centreId);
    return centre?.titre || '';
  };

  const getCentreDisplay = (centreId) => getCentreTableAbbr(centreId, centresData);

  const getEtatName = (etatId) => {
    if (!etatId) return '';
    const etat = etats.find(e => e.id === etatId);
    return etat?.titre || '';
  };

  const getEtatAbbrById = (etatId) => {
    if (!etatId) return '';
    const etat = etats.find(e => e.id === etatId);
    return (etat?.abbreviation || etat?.titre || '').trim();
  };

  const getFicheEtatColor = (fiche) =>
    getEffectiveEtatColor(fiche, etats, sousEtatsData || [], getEtatColor(fiche?.id_etat_final));

  const getFicheEtatName = (fiche) =>
    getEtatTableAbbr(fiche, etats, sousEtatsData || []) ||
    getEffectiveEtatTitle(fiche, etats, sousEtatsData || []) ||
    getEtatName(fiche?.id_etat_final);

  const getFicheEtatFullLabel = (fiche) =>
    getEtatDisplayWithSousEtat(fiche, etats, sousEtatsData || []) ||
    getEffectiveEtatTitle(fiche, etats, sousEtatsData || []) ||
    getEtatName(fiche?.id_etat_final);

  // <CR> si état 8 ou 9 et dernière ligne historio = compte rendu (aligné Dashboard)
  const ID_ETAT_ANNULER_A_REPROGRAMMER = 8;
  const ID_ETAT_HONORE_A_SUIVRE = 9;
  const showCRPrefix = (fiche) =>
    (Number(fiche?.id_etat_final) === ID_ETAT_ANNULER_A_REPROGRAMMER ||
      Number(fiche?.id_etat_final) === ID_ETAT_HONORE_A_SUIVRE) &&
    fiche?.current_state_from_compte_rendu === true;

  // Agent qualification : si état dans groupe 0, afficher l'état, sinon "Validé"
  const isEtatGroupe0 = (etatId) => etatsPhase0.some(e => Number(e.id) === Number(etatId));
  const getEtatDisplayForAgentQualif = (etatId) =>
    isEtatGroupe0(etatId) ? getEtatAbbrById(etatId) : 'Validé';

  // Obtenir les confirmateurs formatés (avec confirmateur 2 et 3 si existent)
  // Priorité : jusqu'à 3 confirmateurs distincts fiches_histo (API), puis table fiches
  const getConfirmateursFormatted = (fiche) => {
    if (fiche.histo_confirmateurs_pseudo && String(fiche.histo_confirmateurs_pseudo).trim() !== '') {
      return fiche.histo_confirmateurs_pseudo;
    }
    const confirmateursList = [];
    
    if (fiche.id_confirmateur) {
      const conf1 = fiche.confirmateur_pseudo || getUserName(fiche.id_confirmateur);
      if (conf1) confirmateursList.push(conf1);
    }
    
    if (fiche.id_confirmateur_2) {
      const conf2 = fiche.confirmateur_2_pseudo || getUserName(fiche.id_confirmateur_2);
      if (conf2) confirmateursList.push(conf2);
    }
    
    if (fiche.id_confirmateur_3) {
      const conf3 = fiche.confirmateur_3_pseudo || getUserName(fiche.id_confirmateur_3);
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
  const qualifTabCount =
    sourceCountsData?.qualif ??
    (appliedFilters.fiche_source === 'qualif' ? pagination.total : null);
  const backofficeTabCount =
    sourceCountsData?.backoffice ??
    (appliedFilters.fiche_source === 'backoffice' ? pagination.total : null);
  const isFetchingList = isLoading || isFetching || isSearching;

  // Filtrer les fiches selon la recherche rapide
  const fiches = debouncedQuickSearch.trim() === '' 
    ? allFiches 
    : allFiches.filter(fiche => {
        const searchLower = debouncedQuickSearch.trim().toLowerCase();
        const searchDigits = searchLower.replace(/\D/g, '');
        // Rechercher dans tous les champs
        const searchFields = [
          fiche.nom || '',
          fiche.prenom || '',
          fiche.tel || '',
          fiche.gsm1 || '',
          fiche.gsm2 || '',
          fiche.cp || '',
          fiche.ville || '',
          fiche.adresse || '',
          formatDate(fiche.date_insert_time),
          formatRdvDateTime(fiche.date_rdv_time),
          formatDate(fiche.date_modif_time),
          isAgentQualif ? getEtatDisplayForAgentQualif(fiche.id_etat_final) : getFicheEtatName(fiche),
          getConfirmateursFormatted(fiche),
          getCommercialsFormatted(fiche),
          getCentreName(fiche.id_centre),
          getProduitName(fiche.produit),
          fiche.valider > 0 ? 'validé' : '',
        ];
        
        return searchFields.some(field => {
          const text = field.toString().toLowerCase();
          if (text.includes(searchLower)) return true;
          // Téléphone : match avec/sans 0 et sans espaces
          if (searchDigits.length >= 6) {
            const fieldDigits = text.replace(/\D/g, '');
            if (fieldDigits.includes(searchDigits)) return true;
            if (searchDigits.startsWith('0') && fieldDigits.includes(searchDigits.slice(1))) return true;
            if (!searchDigits.startsWith('0') && fieldDigits.includes(`0${searchDigits}`)) return true;
          }
          return false;
        });
      });

  const columnKeys = {
    'Nom': 'nom',
    'Prénom': 'prenom',
    'Téléphone': 'tel',
    'CP': 'cp',
    'Date Insertion': 'date_insert_time',
    'Date RDV': 'date_rdv_time',
    'Agent': 'id_agent',
    'État Final': 'id_etat_final',
    'Confirmateur': 'id_confirmateur',
    'Commercial': 'id_commercial',
    'Centre': 'id_centre',
    'Produit': 'produit',
    'Validé': 'valider',
  };

  const handleSort = (columnName) => {
    const key = columnKeys[columnName];
    if (!key) return;

    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setFilters((prev) => ({ ...prev, page: 1 }));
    setAppliedFilters((prev) => ({ ...prev, page: 1 }));
  };

  const getSortIcon = (columnName) => {
    const key = columnKeys[columnName];
    if (!key || sortConfig.key !== key) {
      return <FaSort className="sort-icon" />;
    }
    return sortConfig.direction === 'asc'
      ? <FaSortUp className="sort-icon sort-active" />
      : <FaSortDown className="sort-icon sort-active" />;
  };

  const getSortValue = (fiche, key) => {
    if (key === 'id_agent') {
      return (getUserName(fiche.id_agent) || fiche.agent_pseudo || '').toLowerCase();
    }
    if (key === 'id_commercial') {
      return (getCommercialsFormatted(fiche) || '').toLowerCase();
    }
    if (key === 'id_confirmateur') {
      return getConfirmateursFormatted(fiche).toLowerCase();
    }
    if (key === 'id_centre') {
      return getCentreName(fiche.id_centre).toLowerCase();
    }
    if (key === 'id_etat_final') {
      const etatLabel = isAgentQualif
        ? getEtatDisplayForAgentQualif(fiche.id_etat_final)
        : getFicheEtatName(fiche);
      return (etatLabel || '').toLowerCase();
    }
    if (key === 'produit') {
      return getProduitName(fiche.produit).toLowerCase();
    }
    if (key === 'valider') {
      return Number(fiche.valider) || 0;
    }

    let value = fiche[key];
    if (value == null) value = '';

    if (key.includes('date') || key.includes('time')) {
      return new Date(value || 0).getTime();
    }

    return String(value).toLowerCase();
  };

  const getFilterText = (fiche, key) => {
    if (key === 'date_insert_time') return formatDate(fiche.date_insert_time);
    if (key === 'valider') return fiche.valider > 0 ? 'validé' : '';
    if (key === 'id_agent') return getUserName(fiche.id_agent) || fiche.agent_pseudo || '';
    if (key === 'id_commercial') return getCommercialsFormatted(fiche) || '';
    if (key === 'id_confirmateur') return getConfirmateursFormatted(fiche);
    if (key === 'id_centre') return getCentreName(fiche.id_centre);
    if (key === 'date_rdv_time') return formatRdvDateTime(fiche.date_rdv_time);
    if (key === 'id_etat_final') {
      return isAgentQualif
        ? getEtatDisplayForAgentQualif(fiche.id_etat_final)
        : getFicheEtatName(fiche);
    }
    if (key === 'produit') return getProduitName(fiche.produit);
    return String(fiche[key] ?? '');
  };

  const hasHeaderFilters = Object.values(headerFilters).some(isHeaderFilterActive);

  const headerFilteredFiches = !hasHeaderFilters
    ? fiches
    : fiches.filter((fiche) =>
        Object.entries(headerFilters).every(([key, filter]) => {
          if (!isHeaderFilterActive(filter)) return true;
          return matchesHeaderFilter(getFilterText(fiche, key), filter.op, filter.value);
        })
      );

  const toggleHeaderFilter = (event, columnName) => {
    event.stopPropagation();
    const key = columnKeys[columnName];
    if (!key) return;
    if (openHeaderFilter === key) {
      setOpenHeaderFilter(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverWidth = 220;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 8) {
      left = window.innerWidth - popoverWidth - 8;
    }
    if (left < 8) left = 8;
    setHeaderFilterPos({ top: rect.bottom + 4, left });
    setOpenHeaderFilter(key);
  };

  const updateOpenHeaderFilter = (patch) => {
    if (!openHeaderFilter) return;
    setHeaderFilters((prev) => ({
      ...prev,
      [openHeaderFilter]: {
        op: 'eq',
        value: '',
        ...prev[openHeaderFilter],
        ...patch,
      },
    }));
  };

  const clearOpenHeaderFilter = () => {
    if (!openHeaderFilter) return;
    setHeaderFilters((prev) => {
      const next = { ...prev };
      delete next[openHeaderFilter];
      return next;
    });
  };

  const renderSortableHeader = (label) => {
    const key = columnKeys[label];
    const active = isHeaderFilterActive(headerFilters[key]);
    const colClass =
      label === 'Nom'
        ? ' fiche-col-nom'
        : label === 'Prénom'
          ? ' fiche-col-prenom'
          : label === 'Date RDV' || label === 'Date Insertion'
            ? ' fiche-col-date'
            : '';
    return (
      <th onClick={() => handleSort(label)} className={`sortable-header${colClass}`}>
        <span className="header-label-wrap">
          <button
            type="button"
            className={`header-filter-btn${active ? ' is-active' : ''}${openHeaderFilter === key ? ' is-open' : ''}`}
            onClick={(event) => toggleHeaderFilter(event, label)}
            title={`Filtrer ${label}`}
            aria-label={`Filtrer ${label}`}
          >
            <FaFilter />
          </button>
          <span className="header-col-title">{label}</span>
          {getSortIcon(label)}
        </span>
      </th>
    );
  };

  const sortedFiches = [...headerFilteredFiches].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const cmp = String(aValue ?? '').localeCompare(String(bValue ?? ''), 'fr', {
      numeric: true,
      sensitivity: 'base',
    });
    return sortConfig.direction === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="fiches-page">
      <SystemMessageBanner />
      <div className="fiches-header">
        <h1><FaFileAlt /> Gestion des Fiches</h1>
        {/* Permissions : Admin (1, 2), Agents (3), Qualité (4), Commerciaux (5), Confirmateurs (6), Dev (7), Autres (8) - pas de création pour agent qualification (3) */}
        {hasPermission('fiches_create') && user?.fonction !== 3 && (
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            title="Créer une nouvelle fiche client"
          >
            <FaPlus /> Créer une fiche
          </button>
        )}
      </div>

      {!isAgentQualif && (
        <div className="fiches-source-tabs" role="tablist" aria-label="Type de fiches">
          <button
            type="button"
            role="tab"
            aria-selected={appliedFilters.fiche_source === 'qualif'}
            className={`tab-button ${appliedFilters.fiche_source === 'qualif' ? 'active' : ''}`}
            onClick={() => handleSourceTabChange('qualif')}
          >
            Fiches qualif
            <span className="tab-count">{qualifTabCount ?? '…'}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={appliedFilters.fiche_source === 'backoffice'}
            className={`tab-button ${appliedFilters.fiche_source === 'backoffice' ? 'active' : ''}`}
            onClick={() => handleSourceTabChange('backoffice')}
          >
            Fiches backoffice
            <span className="tab-count">{backofficeTabCount ?? '…'}</span>
          </button>
        </div>
      )}

      {/* Cards de production du mois pour Agent Qualification */}
      {isAgentQualif && statsMoisResponse && (
        <div className="production-cards-container">
          <h2>Production du mois</h2>

          {statsMoisSummary && (
            <div className="production-summary-cards">
              <div className="production-card production-card--total">
                <div className="production-card-header">
                  <h3>Total production</h3>
                </div>
                <div className="production-card-count">{statsMoisSummary.total_production}</div>
              </div>
              <div className="production-card production-card--ko">
                <div className="production-card-header">
                  <h3>KO</h3>
                </div>
                <div className="production-card-count">{statsMoisSummary.ko}</div>
              </div>
              <div className="production-card production-card--hc">
                <div className="production-card-header">
                  <h3>HC</h3>
                </div>
                <div className="production-card-count">{statsMoisSummary.hc}</div>
              </div>
              <div className="production-card production-card--validated validated">
                <div className="production-card-header">
                  <h3>Validé</h3>
                </div>
                <div className="production-card-count">
                  {statsMoisValidated?.count ?? 0}
                </div>
              </div>
            </div>
          )}

          {statsMoisEtats.length > 0 && (
            <div className="production-cards">
            {statsMoisEtats.map((stat) => (
              <div 
                key={stat.etat_id} 
                className={`production-card${stat.etat_id === 'validated' ? ' validated' : ''}`}
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
          )}

          <div className="qualif-podium">
            <h3 className="qualif-podium-title">Top 3 agents qualification</h3>
            {statsMoisPodium.length === 0 ? (
              <p className="qualif-podium-empty">Aucune production sur le mois en cours.</p>
            ) : (
              <div className="qualif-podium-list">
                {statsMoisPodium.map((agent) => {
                  const count = Number(agent.count) || 0;
                  const barWidth = Math.round((count / podiumMaxCount) * 100);
                  const medal = agent.rank === 1 ? '🥇' : agent.rank === 2 ? '🥈' : '🥉';
                  return (
                    <div key={agent.agent_id || agent.rank} className="qualif-podium-row">
                      <div className="qualif-podium-rank">
                        <span className="qualif-podium-medal" aria-hidden>
                          {medal}
                        </span>
                        <span className="qualif-podium-rank-num">#{agent.rank}</span>
                      </div>
                      <div className="qualif-podium-agent">
                        {agent.photo ? (
                          <img src={agent.photo} alt="" className="qualif-podium-avatar" />
                        ) : (
                          <div className="qualif-podium-avatar placeholder">
                            {(agent.pseudo || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="qualif-podium-pseudo">{agent.pseudo}</span>
                      </div>
                      <div className="qualif-podium-bar-wrap">
                        <div
                          className="qualif-podium-bar-fill"
                          style={{ width: `${barWidth}%` }}
                          title={`${count} fiche${count > 1 ? 's' : ''}`}
                        />
                      </div>
                      <span className="qualif-podium-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
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

              {/* Agent qualification */}
              {user?.fonction !== 3 && (
                <div className="form-group">
                  <label>Agent qualification</label>
                  <select
                    value={filters.id_agent || ''}
                    onChange={(e) => handleFilterChange('id_agent', e.target.value)}
                  >
                    <option value="">Tous</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.pseudo}
                      </option>
                    ))}
                  </select>
                </div>
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

              {/* État final - regroupé par phase (0,1,2,3), ordre BDD, couleur BDD */}
              <div className="form-group">
                <label>État final</label>
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
                      {etatsPhase3.map(etat => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase0.length === 0 && etatsPhase1.length === 0 && etatsPhase2.length === 0 && etatsPhase3.length === 0 && etats.length > 0 && (
                    etats.map(etat => (
                      <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                        {etat.titre}
                      </option>
                    ))
                  )}
                </select>
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

              {/* Annuler à reprogrammer / Honoré à suivre : COMPTE RENDU ou REPRO CONFIRMATEURS */}
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
                  <option value="date_modif_time">Date Modification (état)</option>
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
            </div>

            <div className="search-form-actions">
              <button type="submit" className="btn-search" disabled={isFetchingList}>
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
          <div className="results-header-main">
            <h2>
              {quickSearch.trim() !== '' 
                ? `Résultats de la recherche rapide: ${fiches.length} fiche${fiches.length > 1 ? 's' : ''}`
                : filters.fiche_search 
                  ? `Résultats de la recherche ${pagination.total}` 
                  : appliedFilters.fiche_source === 'backoffice'
                    ? 'Fiches backoffice créées aujourd\'hui'
                    : 'Fiches qualif créées aujourd\'hui'}
            </h2>
            <p className="results-count">
              {hasHeaderFilters
                ? <>Affichage: <strong>{sortedFiches.length}</strong> / {fiches.length} fiches</>
                : quickSearch.trim() !== ''
                  ? <>Affichage: <strong>{fiches.length}</strong> fiches</>
                  : <>Total: <strong>{pagination.total}</strong> fiches</>}
            </p>
          </div>
          {isFetchingList && (
            <div className="search-loading-indicator">
              <div className="spinner-small"></div>
              <span>Recherche en cours...</span>
            </div>
          )}
        </div>

        {(isLoading || isSearching || isFetching) && fiches.length === 0 ? (
          <div className="fiches-loading fiches-loading--inline">
            <div className="spinner"></div>
            <p>Chargement des résultats de recherche...</p>
          </div>
        ) : !isFetchingList && fiches.length === 0 ? (
          <div className="no-results">
            <p>Aucune fiche trouvée{quickSearch ? ` pour "${quickSearch}"` : ''}</p>
          </div>
        ) : (
          <>
            <div className={`fiches-table-container${isFetchingList ? ' loading' : ''}`}>
<table className={`fiches-table${isAdminFicheLayout ? ' fiches-table--admin-layout' : ''}`}>
                <thead>
                  <tr>
                    {renderSortableHeader('Nom')}
                    {renderSortableHeader('Prénom')}
                    {renderSortableHeader('Téléphone')}
                    {renderSortableHeader('CP')}
                    {isAdminFicheLayout ? (
                      <>
                        {renderSortableHeader('Date RDV')}
                        {renderSortableHeader('Commercial')}
                        <FicheAdminBadgeHeaders
                          getSortIcon={getSortIcon}
                          onSortValide={() => handleSort('Validé')}
                          onSortProduit={() => handleSort('Produit')}
                        />
                        {renderSortableHeader('Centre')}
                        {renderSortableHeader('Date Insertion')}
                        <th className="sortable-header" onClick={() => handleSort('Confirmateur')}>
                          Conf {getSortIcon('Confirmateur')}
                        </th>
                        {renderSortableHeader('État Final')}
                      </>
                    ) : (
                      <>
                        {renderSortableHeader('Date Insertion')}
                        {renderSortableHeader('Agent')}
                        {renderSortableHeader('État Final')}
                        {renderSortableHeader('Centre')}
                        {renderSortableHeader('Produit')}
                        {renderSortableHeader('Validé')}
                        <th className="actions-header"><span>Actions</span></th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedFiches.length === 0 ? (
                    <tr>
                      <td colSpan={isAdminFicheLayout ? 20 : 11} className="header-filter-empty">
                        Aucune fiche pour ces filtres d&apos;en-tête
                      </td>
                    </tr>
                  ) : null}
                  {sortedFiches.map((fiche) => {
                    const etatColor = getFicheEtatColor(fiche);
                    const produitColor = getProduitColor(fiche.produit);
                    const isArchived = fiche.archive === 1 || fiche.archive === true;
                    const indicators =
                      isAdminFicheLayout || showHasBadge
                        ? getFicheTableIndicators(fiche.id_etat_histo, fiche, etatsData || [])
                        : null;

                    return (
                      <tr
                        key={fiche.hash}
                        className={getFicheRowByEtatClassName(etatColor, isArchived ? 'archived' : '')}
                        style={{ backgroundColor: etatColor }}
                      >
                        <td data-label="Nom:" className="fiche-col-nom">{fiche.nom || ''}</td>
                        <td data-label="Prénom:" className="fiche-col-prenom">{fiche.prenom || ''}</td>
                        <td data-label="Téléphone:">{fiche.tel || ''}</td>
                        <td data-label="CP:">{fiche.cp || ''}</td>
                        {isAdminFicheLayout ? (
                          <>
                            <td data-label="Date RDV:" className="fiche-col-date">{formatRdvDateTime(fiche.date_rdv_time)}</td>
                            <td data-label="Commercial:">{getCommercialsFormatted(fiche) || ''}</td>
                            <FicheAdminValideCell valider={fiche.valider} confRdvAvec={fiche.conf_rdv_avec} />
                            <FicheAdminActionCell
                              DetailButtonTag={FicheDetailLink}
                              detailButtonProps={{ ficheHash: fiche.hash }}
                              showDetail={!isAgentQualif}
                              extras={(
                                <div className="action-buttons fiche-badge-act-extras">
                                  {isArchived ? (
                                    <span className="indicator archive" title="Archivée">ARCH</span>
                                  ) : null}
                                  {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11 || user?.fonction === 12 || user?.fonction === 13) && (
                                    <button
                                      type="button"
                                      className={`btn-ko ${fiche.ko ? 'active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!fiche.hash) {
                                          toast.error('Identifiant fiche manquant');
                                          return;
                                        }
                                        if (fiche.ko) {
                                          if (window.confirm('Retirer le KO de cette fiche ?')) {
                                            koMutation.mutate({ id: fiche.hash, ko: false });
                                          }
                                          return;
                                        }
                                        setKoModal({
                                          isOpen: true,
                                          ficheHash: fiche.hash,
                                          motifKo: '',
                                          commentaireComplement: '',
                                        });
                                      }}
                                      title={fiche.ko ? 'Retirer KO' : 'Mettre en KO'}
                                    >
                                      <FaBan />
                                    </button>
                                  )}
                                  {canArchiveFiche && (
                                    <button
                                      type="button"
                                      className={`btn-archive${isArchived ? ' btn-archive--unarchive' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchive(fiche);
                                      }}
                                      title={isArchived ? 'Désarchiver' : 'Archiver'}
                                      disabled={archiveMutation.isLoading}
                                    >
                                      {isArchived ? <FaBoxOpen /> : <FaArchive />}
                                    </button>
                                  )}
                                </div>
                              )}
                            />
                            <FicheAdminIndicatorCells
                              indicators={indicators}
                              produitName={getProduitName(fiche.produit)}
                              produitColor={produitColor}
                              showPdf={!isAgentQualif}
                              onPdf={
                                isAgentQualif
                                  ? undefined
                                  : async () => {
                                      try {
                                        const [ficheRes, profRes, tcRes] = await Promise.all([
                                          api.get(`/fiches/${encodeURIComponent(fiche.hash)}`),
                                          api.get('/management/professions'),
                                          api.get('/management/type-contrat'),
                                        ]);
                                        const full = ficheRes.data?.data;
                                        if (!full) throw new Error('Fiche introuvable');
                                        generateFicheClientPdf(full, {
                                          professions: profRes.data?.data || [],
                                          typeContrat: tcRes.data?.data || [],
                                          centres: centres || [],
                                          agents: agents || [],
                                          commerciaux: commerciaux || [],
                                          confirmateurs: confirmateurs || [],
                                        });
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || err.message || 'Impossible de générer le PDF');
                                      }
                                    }
                              }
                            />
                            <td data-label="Centre:" className="fiche-col-centre" title={getCentreName(fiche.id_centre) || undefined}>{getCentreDisplay(fiche.id_centre)}</td>
                            <td data-label="Date Insertion:" className="fiche-col-date">{formatDate(fiche.date_insert_time)}</td>
                            <td data-label="Conf:">{getConfirmateursFormatted(fiche)}</td>
                            <td data-label="État:" className="etat-col-cell fiche-col-etat">
                              <span className="etat-text" title={getFicheEtatFullLabel(fiche) || undefined}>
                                {showCRPrefix(fiche) && <span className="etat-text-cr">&lt;CR&gt;</span>}
                                {isAgentQualif ? getEtatDisplayForAgentQualif(fiche.id_etat_final) : getFicheEtatName(fiche)}
                                {(fiche.ko === 1 || fiche.ko === '1') && (
                                  <span className="etat-text-urgent">(KO)</span>
                                )}
                                {(fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') && (
                                  <span className="etat-text-urgent">(RDV_URGENT)</span>
                                )}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td data-label="Date Insertion:" className="fiche-col-date">{formatDate(fiche.date_insert_time)}</td>
                            <td data-label="Agent:">{getUserName(fiche.id_agent) || (fiche.agent_pseudo || '')}</td>
                            <td data-label="État:" className="etat-col-cell fiche-col-etat">
                              <span className="etat-text" title={getFicheEtatFullLabel(fiche) || undefined}>
                                {showCRPrefix(fiche) && <span className="etat-text-cr">&lt;CR&gt;</span>}
                                {isAgentQualif ? getEtatDisplayForAgentQualif(fiche.id_etat_final) : getFicheEtatName(fiche)}
                                {(fiche.ko === 1 || fiche.ko === '1') && (
                                  <span className="etat-text-urgent">(KO)</span>
                                )}
                                {(fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') && (
                                  <span className="etat-text-urgent">(RDV_URGENT)</span>
                                )}
                              </span>
                            </td>
                            <td data-label="Centre:" className="fiche-col-centre" title={getCentreName(fiche.id_centre) || undefined}>{getCentreDisplay(fiche.id_centre)}</td>
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
                                  style={{ color: '#000000', fontSize: '15.3px', cursor: 'pointer' }}
                                  title={`Validée${fiche.conf_rdv_avec ? ` avec ${fiche.conf_rdv_avec}` : ''}`}
                                />
                              ) : null}
                            </td>
                            <td data-label="">
                              <div className="fiche-actions">
                                {(isArchived || (showHasBadge && indicators?.has)) ? (
                                  <div className="fiche-indicators">
                                    {isArchived ? (
                                      <span className="indicator archive" title="Archivée">ARCH</span>
                                    ) : null}
                                    {showHasBadge && indicators?.has ? (
                                      <span className="indicator has" title="Honoré à suivre">HAS</span>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div className="action-buttons">
                                  {!isAgentQualif && (
                                    <FicheDetailLink
                                      ficheHash={fiche.hash}
                                      className="btn-detail"
                                      title="Voir les détails"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <FaSearch />
                                    </FicheDetailLink>
                                  )}
                                  {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11 || user?.fonction === 12 || user?.fonction === 13) && (
                                    <button
                                      type="button"
                                      className={`btn-ko ${fiche.ko ? 'active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!fiche.hash) {
                                          toast.error('Identifiant fiche manquant');
                                          return;
                                        }
                                        if (fiche.ko) {
                                          if (window.confirm('Retirer le KO de cette fiche ?')) {
                                            koMutation.mutate({ id: fiche.hash, ko: false });
                                          }
                                          return;
                                        }
                                        setKoModal({
                                          isOpen: true,
                                          ficheHash: fiche.hash,
                                          motifKo: '',
                                          commentaireComplement: '',
                                        });
                                      }}
                                      title={fiche.ko ? 'Retirer KO' : 'Mettre en KO'}
                                    >
                                      <FaBan />
                                    </button>
                                  )}
                                  {canArchiveFiche && (
                                    <button
                                      type="button"
                                      className={`btn-archive${isArchived ? ' btn-archive--unarchive' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchive(fiche);
                                      }}
                                      title={isArchived ? 'Désarchiver' : 'Archiver'}
                                      disabled={archiveMutation.isLoading}
                                    >
                                      {isArchived ? <FaBoxOpen /> : <FaArchive />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </>
                        )}
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

      {/* Modal création — shell type détail fiche (close=0), onglet Fiches uniquement */}
      {showCreateModal && (
        <CreateFicheModal
          centres={centres}
          agents={agents}
          produits={produitsData || []}
          professions={professionsData || []}
          modeChauffage={modeChauffageData || []}
          typeContratData={typeContratData || []}
          partenaireMode={isPartenaire}
          onClose={() => setShowCreateModal(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isLoading}
        />
      )}

      <KoMotifModal
        isOpen={koModal.isOpen}
        title="Mettre en KO"
        submitLabel={koMutation.isLoading ? 'Enregistrement…' : 'Confirmer KO'}
        isLoading={koMutation.isLoading}
        motifKo={koModal.motifKo}
        commentaireComplement={koModal.commentaireComplement}
        onMotifChange={(v) => setKoModal((m) => ({ ...m, motifKo: v }))}
        onCommentaireChange={(v) => setKoModal((m) => ({ ...m, commentaireComplement: v }))}
        onSubmit={() => {
          if (!koModal.motifKo || !koModal.ficheHash) return;
          koMutation.mutate({
            id: koModal.ficheHash,
            ko: true,
            motif_ko: koModal.motifKo,
            commentaire_complement: koModal.commentaireComplement,
          });
        }}
        onClose={() => setKoModal({ isOpen: false, ficheHash: null, motifKo: '', commentaireComplement: '' })}
      />
      {openHeaderFilter && (
        <div
          ref={headerFilterRef}
          className="header-filter-popover"
          style={{ top: headerFilterPos.top, left: headerFilterPos.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="header-filter-title">
            {Object.keys(columnKeys).find((label) => columnKeys[label] === openHeaderFilter) || 'Filtrer'}
          </p>
          <label className="header-filter-label" htmlFor="header-filter-op">
            Condition
          </label>
          <select
            id="header-filter-op"
            className="header-filter-select"
            value={headerFilters[openHeaderFilter]?.op || 'eq'}
            onChange={(event) => updateOpenHeaderFilter({
              op: event.target.value,
              value: HEADER_FILTER_OPS_WITHOUT_VALUE.has(event.target.value)
                ? ''
                : (headerFilters[openHeaderFilter]?.value || ''),
            })}
          >
            {HEADER_FILTER_OPS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {!HEADER_FILTER_OPS_WITHOUT_VALUE.has(headerFilters[openHeaderFilter]?.op || 'eq') && (
            <>
              <label className="header-filter-label" htmlFor="header-filter-value">
                Valeur
              </label>
              <input
                id="header-filter-value"
                type="text"
                className="header-filter-input"
                value={headerFilters[openHeaderFilter]?.value || ''}
                placeholder="Saisir une valeur…"
                autoFocus
                onChange={(event) => updateOpenHeaderFilter({ value: event.target.value })}
              />
            </>
          )}
          <div className="header-filter-actions">
            <button type="button" className="header-filter-clear" onClick={clearOpenHeaderFilter}>
              Effacer
            </button>
          </div>
        </div>
      )}
      <ScrollToTopButton />
    </div>
  );
};

export default Fiches;
