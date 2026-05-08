import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaCalendarDay, FaUserCheck, FaUserSlash, FaChartLine, FaSearch, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import FicheDetailModal from '../components/FicheDetailModal';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './RendezVousVue.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const fetchRdvVue = async (type, date) => {
  const res = await api.get('/planning/rdv-vue', {
    params: { type, date }
  });
  return res.data.data || [];
};

const RendezVousVue = () => {
  useForceDesktopViewport('rendezvous-vue-page');
  const today = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('jour');
  const [dateJour, setDateJour] = useState(today);
  const [sortConfig, setSortConfig] = useState({ key: 'date_rdv_time', direction: 'asc' });
  const [quickSearchDep, setQuickSearchDep] = useState('');
  const [ficheContextMenu, setFicheContextMenu] = useState(null);
  const [ficheDetailModal, setFicheDetailModal] = useState(null);

  const { data: dataJour, isLoading: loadingJour } = useQuery(
    ['rdv-vue', 'jour', dateJour],
    () => fetchRdvVue('jour', dateJour),
    { enabled: true }
  );
  const { data: dataAffilie, isLoading: loadingAffilie } = useQuery(
    ['rdv-vue', 'affilie', dateJour],
    () => fetchRdvVue('affilie', dateJour),
    { enabled: true }
  );
  const { data: dataNonAffilie, isLoading: loadingNonAffilie } = useQuery(
    ['rdv-vue', 'non_affilie', dateJour],
    () => fetchRdvVue('non_affilie', dateJour),
    { enabled: true }
  );
  const { data: dataProductionRdv, isLoading: loadingProductionRdv } = useQuery(
    ['rdv-vue', 'production_rdv', dateJour],
    () => fetchRdvVue('production_rdv', dateJour),
    { enabled: true }
  );

  const countJour = (dataJour || []).length;
  const countAffilie = (dataAffilie || []).length;
  const countNonAffilie = (dataNonAffilie || []).length;
  const countProductionRdv = (dataProductionRdv || []).length;
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

  const list =
    activeTab === 'jour'
      ? dataJour || []
      : activeTab === 'affilie'
        ? dataAffilie || []
        : activeTab === 'non_affilie'
          ? dataNonAffilie || []
          : dataProductionRdv || [];
  const isLoading =
    (activeTab === 'jour' && loadingJour) ||
    (activeTab === 'affilie' && loadingAffilie) ||
    (activeTab === 'non_affilie' && loadingNonAffilie) ||
    (activeTab === 'production_rdv' && loadingProductionRdv);

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
    setFicheDetailModal({ hash: ficheContextMenu.fiche.hash, focusHistoriqueEtats: true });
    setFicheContextMenu(null);
  };

  const openFicheSmsFromMenu = () => {
    if (!ficheContextMenu?.fiche?.hash) return;
    setFicheDetailModal({ hash: ficheContextMenu.fiche.hash, initialTab: 'sms' });
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
    <div className="rdv-vue-page">
      <div className="page-header">
        <h1>Vue Rendez-vous</h1>
      </div>

      <div className="rdv-vue-tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === 'jour' ? 'active' : ''}`}
          onClick={() => setActiveTab('jour')}
        >
          <FaCalendarDay /> Rendez-vous du jour <span className="tab-count">({countJour})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('affilie')}
        >
          <FaUserCheck /> Rendez-vous affiliés <span className="tab-count">({countAffilie})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'non_affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('non_affilie')}
        >
          <FaUserSlash /> Rendez-vous non affiliés <span className="tab-count">({countNonAffilie})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'production_rdv' ? 'active' : ''}`}
          onClick={() => setActiveTab('production_rdv')}
        >
          <FaChartLine /> Production RDV <span className="tab-count">({countProductionRdv})</span>
        </button>
      </div>

      <div className="rdv-vue-filters">
        <div className="filter-group">
          <label>Date (journée)</label>
          <input
            type="date"
            value={dateJour}
            onChange={(e) => setDateJour(e.target.value)}
            className="form-control"
          />
        </div>
      </div>

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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((f) => (
                  <tr key={f.id} className="fiche-row-by-etat" onContextMenu={(e) => openFicheContextMenu(e, f)} style={{ backgroundColor: `${getEtatColor(f)}40`, borderLeft: `4px solid ${getEtatColor(f)}` }}>
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
                    <td>{Number(f.valider) > 0 ? '✓' : '—'}</td>
                    <td>
                      <div className="fiche-indicators">
                        {f.id_commercial_2 && Number(f.id_commercial_2) > 0 && <span className="indicator r2" title="R2 placé">R2</span>}
                      </div>
                      <FicheDetailLink ficheId={f.id} className="btn-detail" title="Voir la fiche" />
                    </td>
                  </tr>
                ))}
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
          onClose={() => setFicheDetailModal(null)}
          options={{
            focusHistoriqueEtats: !!ficheDetailModal.focusHistoriqueEtats,
            initialTab: ficheDetailModal.initialTab || undefined,
          }}
        />
      )}
    </div>
  );
};

export default RendezVousVue;
