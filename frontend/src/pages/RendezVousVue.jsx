import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import {
  FaCalendarDay,
  FaUserCheck,
  FaUserSlash,
  FaChartLine,
  FaHistory,
  FaCalendarPlus,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaExpand,
  FaCompress,
} from 'react-icons/fa';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import { useSidebar } from '../contexts/SidebarContext';
import FicheDetailModal from '../components/FicheDetailModal';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import {
  applyForceDesktopViewport,
  applyMobileNativeViewport,
  applyRdvVueMobileView,
  applyRdvVueTableDesktopView,
  applyRdvVueTableDesktopViewForFicheModal,
  isTouchMobileDevice,
} from '../utils/applyForceDesktopViewport';
import {
  stashPendingRdvVueFicheModal,
  clearPendingRdvVueFicheModal,
  resolvePendingRdvVueFicheModal,
} from '../utils/rdvVueFicheModalSession';
import './RendezVousVue.css';

const RDV_VUE_PAGE_CLASS = 'rdv-vue-page';
const RDV_VUE_MOBILE_NATIVE_CLASS = 'rdv-vue-page--mobile-native';
const RDV_VUE_EXTRANET_SCROLL_CLASS = 'rdv-vue-page--extranet-scroll';
const RDV_VUE_OPEN_FICHE_PARAM = 'openFiche';

const VALID_TABS = [
  'jour',
  'affilie',
  'non_affilie',
  'production_rdv',
  'confirmer_veille',
  'confirmer_lendemain',
];

const TAB_DEFS = [
  { id: 'jour', Icon: FaCalendarDay, label: 'Rendez-vous du jour' },
  { id: 'affilie', Icon: FaUserCheck, label: 'Rendez-vous affiliés' },
  { id: 'non_affilie', Icon: FaUserSlash, label: 'Rendez-vous non affiliés' },
  { id: 'production_rdv', Icon: FaChartLine, label: 'Production RDV' },
  { id: 'confirmer_veille', Icon: FaHistory, label: 'Confirmer de la veille' },
  { id: 'confirmer_lendemain', Icon: FaCalendarPlus, label: 'Confirmer de lendemain' },
];

const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysToDateStr = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getYesterdayStr = () => addDaysToDateStr(getLocalDateStr(), -1);

/** RDV du lendemain ; vendredi → lundi (comme planning commercial). */
const getTomorrowRdvStr = () => {
  const today = new Date();
  if (today.getDay() === 5) {
    return addDaysToDateStr(getLocalDateStr(), 3);
  }
  return addDaysToDateStr(getLocalDateStr(), 1);
};

const RELATIVE_DATE_TABS = new Set(['confirmer_veille', 'confirmer_lendemain']);

function getFicheModalStateFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const openFiche = params.get(RDV_VUE_OPEN_FICHE_PARAM);
  if (!openFiche) return null;
  return {
    hash: openFiche,
    focusHistoriqueEtats: params.get('ficheFocusHisto') === '1',
    initialTab: params.get('ficheTab') || undefined,
  };
}

function clearFicheModalUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get(RDV_VUE_OPEN_FICHE_PARAM)) return;
  params.delete(RDV_VUE_OPEN_FICHE_PARAM);
  params.delete('tableModal');
  params.delete('ficheFocusHisto');
  params.delete('ficheTab');
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

function resolveInitialTab() {
  if (typeof window === 'undefined') return 'jour';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return VALID_TABS.includes(tab) ? tab : 'jour';
}

function resolveInitialDate() {
  if (typeof window === 'undefined') return getLocalDateStr();
  const date = new URLSearchParams(window.location.search).get('date');
  return date || getLocalDateStr();
}

const fetchRdvVue = async (type, date) => {
  const res = await api.get('/planning/rdv-vue', {
    params: { type, date },
  });
  return res.data.data || [];
};

const RendezVousVue = () => {
  const { closeSidebar } = useSidebar();
  const isRdvVueTouchMobile = isTouchMobileDevice();

  useEffect(() => {
    document.body.classList.add(RDV_VUE_PAGE_CLASS);
    document.documentElement.classList.add(RDV_VUE_PAGE_CLASS);
    return () => {
      document.body.classList.remove(RDV_VUE_PAGE_CLASS);
      document.documentElement.classList.remove(RDV_VUE_PAGE_CLASS);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    const params = new URLSearchParams(window.location.search);
    const openFiche = params.get(RDV_VUE_OPEN_FICHE_PARAM);
    if (!openFiche) return undefined;

    applyRdvVueTableDesktopViewForFicheModal();
    return undefined;
  }, []);

  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    const params = new URLSearchParams(window.location.search);
    if (params.get(RDV_VUE_OPEN_FICHE_PARAM)) return undefined;

    document.documentElement.classList.add(RDV_VUE_MOBILE_NATIVE_CLASS);
    document.body.classList.add(RDV_VUE_MOBILE_NATIVE_CLASS);

    applyMobileNativeViewport();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(applyMobileNativeViewport);
    });

    return () => {
      cancelAnimationFrame(id);
      document.documentElement.classList.remove(RDV_VUE_MOBILE_NATIVE_CLASS);
      document.body.classList.remove(RDV_VUE_MOBILE_NATIVE_CLASS);
      applyForceDesktopViewport();
    };
  }, []);

  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    document.documentElement.classList.add(RDV_VUE_EXTRANET_SCROLL_CLASS);
    document.body.classList.add(RDV_VUE_EXTRANET_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(RDV_VUE_EXTRANET_SCROLL_CLASS);
      document.body.classList.remove(RDV_VUE_EXTRANET_SCROLL_CLASS);
    };
  }, []);

  const [activeTab, setActiveTab] = useState(resolveInitialTab);
  const [dateJour, setDateJour] = useState(resolveInitialDate);
  const [sortConfig, setSortConfig] = useState({ key: 'date_rdv_time', direction: 'asc' });
  const [quickSearchDep, setQuickSearchDep] = useState('');
  const [ficheContextMenu, setFicheContextMenu] = useState(null);
  const [ficheDetailModal, setFicheDetailModal] = useState(() =>
    resolvePendingRdvVueFicheModal(getFicheModalStateFromUrl())
  );
  const [isTableDesktopView, setIsTableDesktopView] = useState(() => Boolean(getFicheModalStateFromUrl()));
  const { lastViewedFicheHash, setLastViewedFicheHash } = useFicheDetailModal();

  const switchToMobileView = useCallback(() => {
    document.documentElement.classList.add(RDV_VUE_MOBILE_NATIVE_CLASS);
    document.body.classList.add(RDV_VUE_MOBILE_NATIVE_CLASS);
    applyRdvVueMobileView();
    window.dispatchEvent(new Event('viewport-layout-change'));
    closeSidebar();
    setIsTableDesktopView(false);
  }, [closeSidebar]);

  const switchToTableDesktopView = useCallback(() => {
    document.documentElement.classList.remove(RDV_VUE_MOBILE_NATIVE_CLASS);
    document.body.classList.remove(RDV_VUE_MOBILE_NATIVE_CLASS);
    applyRdvVueTableDesktopView();
    setIsTableDesktopView(true);
  }, []);

  const toggleRdvVueViewport = useCallback(() => {
    if (isTableDesktopView) switchToMobileView();
    else switchToTableDesktopView();
  }, [isTableDesktopView, switchToMobileView, switchToTableDesktopView]);

  const openRdvVueFicheDetail = useCallback(
    (modalState) => {
      if (!modalState?.hash) return;

      if (isRdvVueTouchMobile) {
        stashPendingRdvVueFicheModal(modalState);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', activeTab);
        params.set('date', dateJour);
        params.set(RDV_VUE_OPEN_FICHE_PARAM, modalState.hash);
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
    [isRdvVueTouchMobile, activeTab, dateJour, setLastViewedFicheHash]
  );

  useEffect(() => {
    if (!isRdvVueTouchMobile) return undefined;

    const fromUrl = getFicheModalStateFromUrl();
    const pending = resolvePendingRdvVueFicheModal(fromUrl);
    if (!pending?.hash) return undefined;

    setIsTableDesktopView(true);
    setFicheDetailModal(pending);
    setLastViewedFicheHash(pending.hash);
    if (fromUrl) clearFicheModalUrlParams();

    return undefined;
  }, [isRdvVueTouchMobile, setLastViewedFicheHash]);

  const closeRdvVueFicheDetail = useCallback(() => {
    clearPendingRdvVueFicheModal();
    setFicheDetailModal(null);
    if (isRdvVueTouchMobile) {
      switchToMobileView();
    } else {
      closeSidebar();
    }
  }, [isRdvVueTouchMobile, switchToMobileView, closeSidebar]);

  const autoRefreshOptions = {
    enabled: true,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };

  const { data: dataJour, isLoading: loadingJour } = useQuery(
    ['rdv-vue', 'jour', dateJour],
    () => fetchRdvVue('jour', dateJour),
    autoRefreshOptions
  );
  const { data: dataAffilie, isLoading: loadingAffilie } = useQuery(
    ['rdv-vue', 'affilie', dateJour],
    () => fetchRdvVue('affilie', dateJour),
    autoRefreshOptions
  );
  const { data: dataNonAffilie, isLoading: loadingNonAffilie } = useQuery(
    ['rdv-vue', 'non_affilie', dateJour],
    () => fetchRdvVue('non_affilie', dateJour),
    autoRefreshOptions
  );
  const { data: dataProductionRdv, isLoading: loadingProductionRdv } = useQuery(
    ['rdv-vue', 'production_rdv', dateJour],
    () => fetchRdvVue('production_rdv', dateJour),
    autoRefreshOptions
  );

  const dateVeille = getYesterdayStr();
  const dateLendemain = getTomorrowRdvStr();

  const { data: dataConfirmerVeille, isLoading: loadingConfirmerVeille } = useQuery(
    ['rdv-vue', 'production_rdv', dateVeille],
    () => fetchRdvVue('production_rdv', dateVeille),
    autoRefreshOptions
  );
  const { data: dataConfirmerLendemain, isLoading: loadingConfirmerLendemain } = useQuery(
    ['rdv-vue', 'jour', dateLendemain],
    () => fetchRdvVue('jour', dateLendemain),
    autoRefreshOptions
  );

  const tabCounts = useMemo(
    () => ({
      jour: (dataJour || []).length,
      affilie: (dataAffilie || []).length,
      non_affilie: (dataNonAffilie || []).length,
      production_rdv: (dataProductionRdv || []).length,
      confirmer_veille: (dataConfirmerVeille || []).length,
      confirmer_lendemain: (dataConfirmerLendemain || []).length,
    }),
    [dataJour, dataAffilie, dataNonAffilie, dataProductionRdv, dataConfirmerVeille, dataConfirmerLendemain]
  );

  const list =
    activeTab === 'jour'
      ? dataJour || []
      : activeTab === 'affilie'
        ? dataAffilie || []
        : activeTab === 'non_affilie'
          ? dataNonAffilie || []
          : activeTab === 'production_rdv'
            ? dataProductionRdv || []
            : activeTab === 'confirmer_veille'
              ? dataConfirmerVeille || []
              : activeTab === 'confirmer_lendemain'
                ? dataConfirmerLendemain || []
                : [];
  const isLoading =
    (activeTab === 'jour' && loadingJour) ||
    (activeTab === 'affilie' && loadingAffilie) ||
    (activeTab === 'non_affilie' && loadingNonAffilie) ||
    (activeTab === 'production_rdv' && loadingProductionRdv) ||
    (activeTab === 'confirmer_veille' && loadingConfirmerVeille) ||
    (activeTab === 'confirmer_lendemain' && loadingConfirmerLendemain);

  const showDatePicker = !RELATIVE_DATE_TABS.has(activeTab);
  const relativeDateLabel =
    activeTab === 'confirmer_veille'
      ? dateVeille
      : activeTab === 'confirmer_lendemain'
        ? dateLendemain
        : '';

  const { data: usersData } = useQuery('users-rdv-vue', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });
  const { data: centresData } = useQuery('centres-rdv-vue', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });
  const { data: etatsData } = useQuery('etats-rdv-vue', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const getSortValue = (fiche, key) => {
    switch (key) {
      case 'fiche':
        return `${fiche.nom || ''} ${fiche.prenom || ''}`.trim().toLowerCase();
      case 'adresse':
        return `${fiche.adresse || ''} ${fiche.cp || ''} ${fiche.ville || ''}`.trim().toLowerCase();
      case 'cp':
        return String(fiche.cp || '').toLowerCase();
      case 'ville':
        return String(fiche.ville || '').toLowerCase();
      case 'date_rdv_time':
        return fiche.date_rdv_time ? new Date(fiche.date_rdv_time).getTime() : 0;
      case 'commerciaux':
        return `${fiche.commercial_pseudo || ''} ${fiche.commercial2_pseudo || ''}`.trim().toLowerCase();
      case 'etat':
        return `${fiche.etat_titre || fiche.id_etat_final || ''}`.toString().toLowerCase();
      case 'date_insert_time':
        return fiche.date_insert_time ? new Date(fiche.date_insert_time).getTime() : 0;
      default:
        return '';
    }
  };

  const sortedList = useMemo(() => {
    const copied = [...list];
    copied.sort((a, b) => {
      const valA = getSortValue(a, sortConfig.key);
      const valB = getSortValue(b, sortConfig.key);
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return copied;
  }, [list, sortConfig]);

  const filteredList = useMemo(() => {
    const terms = quickSearchDep
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (terms.length === 0) return sortedList;
    return sortedList.filter((f) => {
      const cp = String(f.cp || '').trim().toUpperCase();
      if (!cp) return false;
      return terms.some((term) => cp.startsWith(term));
    });
  }, [sortedList, quickSearchDep]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    return sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  useEffect(() => {
    if (!ficheContextMenu) return undefined;
    const close = () => setFicheContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [ficheContextMenu]);

  const getUserName = (id) => {
    if (!id || !usersData) return '';
    const found = usersData.find((u) => Number(u.id) === Number(id));
    return found?.pseudo || '';
  };

  const getConfirmateursFormatted = (fiche) => {
    const c = [getUserName(fiche.id_confirmateur), getUserName(fiche.id_confirmateur_2), getUserName(fiche.id_confirmateur_3)].filter(Boolean);
    return c.join(' | ');
  };

  const getCentreName = (id) => {
    if (!id || !centresData) return '';
    const found = centresData.find((c) => Number(c.id) === Number(id));
    return found?.titre || '';
  };

  const getProduitName = (produit) => (Number(produit) === 1 ? 'PAC' : Number(produit) === 2 ? 'PV' : '');
  const getProduitColor = (produit) => (Number(produit) === 1 ? '#66D5D4' : Number(produit) === 2 ? '#FFE441' : '#cccccc');

  const openFicheContextMenu = (e, fiche) => {
    e.preventDefault();
    e.stopPropagation();
    setFicheContextMenu({ x: e.clientX, y: e.clientY, fiche });
  };

  const copyFicheTelFromMenu = (tel) => {
    const t = (tel || '').trim();
    if (!t) return;
    navigator.clipboard.writeText(t).finally(() => setFicheContextMenu(null));
  };

  const openFicheHistoriqueOverlay = () => {
    if (!ficheContextMenu?.fiche?.hash) return;
    openRdvVueFicheDetail({ hash: ficheContextMenu.fiche.hash, focusHistoriqueEtats: true });
    setFicheContextMenu(null);
  };

  const openFicheSmsFromMenu = () => {
    if (!ficheContextMenu?.fiche?.hash) return;
    openRdvVueFicheDetail({ hash: ficheContextMenu.fiche.hash, initialTab: 'sms' });
    setFicheContextMenu(null);
  };

  const openFicheDetailNewTab = (hash) => {
    if (!hash) return;
    window.open(`/fiches/${encodeURIComponent(hash)}?overlay=auto`, '_blank', 'noopener,noreferrer');
    setFicheContextMenu(null);
  };

  const getEtatColor = (fiche) => {
    const etat = (etatsData || []).find((e) => Number(e.id) === Number(fiche.id_etat_final));
    return etat?.color || '#9cbfc8';
  };

  return (
    <div className="rdv-vue">
      <div className="page-header">
        <div className="rdv-vue-header-left">
          {isRdvVueTouchMobile && (
            <button
              type="button"
              className="btn-rdv-vue-view-toggle"
              onClick={toggleRdvVueViewport}
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
          <h1>Vue Rendez-vous</h1>
        </div>
      </div>

      {isRdvVueTouchMobile ? (
        <div className="rdv-vue-mobile-controls">
          <div className="rdv-vue-tab-select">
            <label htmlFor="rdv-vue-tab-select">Vue :</label>
            <select
              id="rdv-vue-tab-select"
              className="rdv-vue-tab-select-input"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
            >
              {TAB_DEFS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label} ({tabCounts[id]})
                </option>
              ))}
            </select>
          </div>
          <div className="rdv-vue-filters rdv-vue-filters--mobile">
            <div className="filter-group">
              <label>{showDatePicker ? 'Date (journée)' : 'Date'}</label>
              {showDatePicker ? (
                <input
                  type="date"
                  value={dateJour}
                  onChange={(e) => setDateJour(e.target.value)}
                  className="form-control"
                />
              ) : (
                <span className="filter-date-readonly">{relativeDateLabel}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="rdv-vue-tabs">
            {TAB_DEFS.map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                className={`tab-button ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon /> {label} <span className="tab-count">({tabCounts[id]})</span>
              </button>
            ))}
          </div>

          <div className="rdv-vue-filters">
            <div className="filter-group">
              <label>{showDatePicker ? 'Date (journée)' : 'Date'}</label>
              {showDatePicker ? (
                <input
                  type="date"
                  value={dateJour}
                  onChange={(e) => setDateJour(e.target.value)}
                  className="form-control"
                />
              ) : (
                <span className="filter-date-readonly">{relativeDateLabel}</span>
              )}
            </div>
          </div>
        </>
      )}

      <div className="rdv-vue-content">
        <div className="quick-search-container">
          <FaSearch />
          <input
            type="text"
            placeholder="Recherche rapide département (ex: 77 ou 77,45)"
            value={quickSearchDep}
            onChange={(e) => setQuickSearchDep(e.target.value)}
            className="quick-search-input"
          />
        </div>
        {isLoading ? (
          <div className="loading">Chargement...</div>
        ) : filteredList.length > 0 ? (
          <div className="fiches-table-container">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th className="sortable-header" onClick={() => handleSort('fiche')}>Nom {getSortIndicator('fiche')}</th>
                  <th>Prénom</th>
                  <th>Téléphone</th>
                  <th className="sortable-header" onClick={() => handleSort('cp')}>CP {getSortIndicator('cp')}</th>
                  <th className="sortable-header" onClick={() => handleSort('ville')}>Ville {getSortIndicator('ville')}</th>
                  <th className="sortable-header" onClick={() => handleSort('date_insert_time')}>Date Insertion {getSortIndicator('date_insert_time')}</th>
                  <th className="sortable-header" onClick={() => handleSort('date_rdv_time')}>Date RDV {getSortIndicator('date_rdv_time')}</th>
                  <th className="sortable-header" onClick={() => handleSort('etat')}>État actuel {getSortIndicator('etat')}</th>
                  <th>Confirmateur</th>
                  <th className="sortable-header" onClick={() => handleSort('commerciaux')}>Commercial {getSortIndicator('commerciaux')}</th>
                  <th>Centre</th>
                  <th className="produit-col">Produit</th>
                  <th>Validé</th>
                  <th className="rdv-vue-col-details">Détails</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((f) => {
                  const rowBackgroundColor = `${getEtatColor(f)}40`;
                  const rowBorderColor = getEtatColor(f);
                  return (
                  <tr key={f.id} className="fiche-row-by-etat" onContextMenu={(e) => openFicheContextMenu(e, f)} style={{ backgroundColor: rowBackgroundColor, borderLeft: `4px solid ${rowBorderColor}` }}>
                    <td>{f.nom || ''}</td>
                    <td>{f.prenom || ''}</td>
                    <td>{f.tel || ''}</td>
                    <td>{f.cp || '—'}</td>
                    <td>{f.ville || '—'}</td>
                    <td>{f.date_insert_time ? new Date(f.date_insert_time).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{formatRdvDateTime(f.date_rdv_time)}</td>
                    <td>
                      <span className="etat-badge" style={{ backgroundColor: getEtatColor(f) }}>
                        {f.etat_titre || f.id_etat_final || '—'}
                      </span>
                    </td>
                    <td>{getConfirmateursFormatted(f) || '—'}</td>
                    <td>{[f.commercial_pseudo, f.commercial2_pseudo].filter(Boolean).join(' / ') || '—'}</td>
                    <td>{getCentreName(f.id_centre) || '—'}</td>
                    <td className="produit-col">
                      <span className="produit-indicator" style={{ backgroundColor: getProduitColor(f.produit), color: '#fff' }}>
                        {getProduitName(f.produit) || '—'}
                      </span>
                    </td>
                    <td>{Number(f.valider) > 0 ? '✓' : ''}</td>
                    <td className="rdv-vue-col-details" style={{ backgroundColor: rowBackgroundColor }}>
                      <div className="fiche-indicators">
                        {f.id_commercial_2 && Number(f.id_commercial_2) > 0 && <span className="indicator r2" title="R2 placé">R2</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => openRdvVueFicheDetail({ hash: f.hash })}
                        className="btn-detail"
                        title="Voir la fiche"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />
                          {lastViewedFicheHash === f.hash && (
                            <span
                              aria-hidden="true"
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
                                pointerEvents: 'none',
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
        ) : (
          <div className="no-data">Aucun rendez-vous pour ces critères.</div>
        )}
      </div>

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
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={() => copyFicheTelFromMenu(ficheContextMenu.fiche.tel)}>
            Copier le téléphone
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={openFicheHistoriqueOverlay}>
            Voir historique (modal)…
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={openFicheSmsFromMenu}>
            Envoyer un SMS…
          </button>
          <button type="button" className="dashboard-fiche-context-menu-item" onClick={() => openFicheDetailNewTab(ficheContextMenu.fiche.hash)}>
            Ouvrir dans un nouvel onglet
          </button>
        </div>
      )}

      {ficheDetailModal && (
        <FicheDetailModal
          ficheHash={ficheDetailModal.hash}
          onClose={closeRdvVueFicheDetail}
          options={{
            focusHistoriqueEtats: !!ficheDetailModal.focusHistoriqueEtats,
            initialTab: ficheDetailModal.initialTab || undefined,
            pinchZoom: isRdvVueTouchMobile,
            allowBackdropClose: true,
          }}
        />
      )}
    </div>
  );
};

export default RendezVousVue;
