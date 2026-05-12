import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FaCheckCircle, FaSearch } from 'react-icons/fa';
import api from '../config/api';
import FicheDetailModal from '../components/FicheDetailModal';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './CQSignatures.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return { dateDebut: toLocalDateString(monday), dateFin: toLocalDateString(now) };
}

function getYesterdayRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const d = toLocalDateString(yesterday);
  return { dateDebut: d, dateFin: d };
}

function getTodayRange() {
  const d = getTodayLocal();
  return { dateDebut: d, dateFin: d };
}

function getMonthRange() {
  return { dateDebut: getFirstOfMonthLocal(), dateFin: getTodayLocal() };
}

const TAB_DEFS = [
  { id: 'yesterday', label: 'Hier', getRange: getYesterdayRange },
  { id: 'today', label: "Aujourd'hui", getRange: getTodayRange },
  { id: 'week', label: 'Cette semaine', getRange: getCurrentWeekRange },
  { id: 'month', label: 'Ce mois', getRange: getMonthRange },
  { id: 'custom', label: 'Personnalisé' },
];

const ETAT_FILTER_DEFS = [
  { key: 'all', label: 'TOUS', fallbackId: null },
  { key: 'signer', label: 'SIGNER', fallbackId: 13, matchers: ['signer'] },
  { key: 'complet', label: 'COMPLET', fallbackId: 45, matchers: ['signer complet', 'complet'] },
  { key: 'pm', label: 'PM', fallbackId: 44, matchers: ['signer pm', 'pm'] },
  { key: 'retracter', label: 'RETRACTER', fallbackId: 16, matchers: ['signer retracter', 'retracter'] },
  { key: 'retracter_x2', label: 'RECTRACTER X2', fallbackId: 38, matchers: ['signer retracter 2 fois', 'retracter 2 fois', 'retracter x2'] },
];

const CQSignatures = () => {
  useForceDesktopViewport('cq-signatures-page');
  const todayLocal = getTodayLocal();
  const [activeTab, setActiveTab] = useState('today');
  const [activeEtatKey, setActiveEtatKey] = useState('all');
  const [customDateDebut, setCustomDateDebut] = useState(todayLocal);
  const [customDateFin, setCustomDateFin] = useState(todayLocal);
  const [appliedCustomRange, setAppliedCustomRange] = useState({
    dateDebut: todayLocal,
    dateFin: todayLocal,
  });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('date_planning');
  const [sortDir, setSortDir] = useState('desc');
  const [ficheDetailModal, setFicheDetailModal] = useState(null);
  const [lastViewedFicheHash, setLastViewedFicheHash] = useState(null);
  const limit = 100;

  const activeRange = useMemo(() => {
    if (activeTab === 'custom') {
      return appliedCustomRange;
    }
    const found = TAB_DEFS.find((t) => t.id === activeTab) || TAB_DEFS[1];
    return found.getRange();
  }, [activeTab, appliedCustomRange]);

  const { data: etatsData } = useQuery('cq-signatures-etats', async () => {
    const res = await api.get('/management/etats');
    return res.data?.data || [];
  });

  const normalizeEtatLabel = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  const etatFiltersResolved = useMemo(() => {
    const etats = Array.isArray(etatsData) ? etatsData : [];
    return ETAT_FILTER_DEFS.map((def) => {
      if (def.key === 'all') return { ...def, id: null };
      const matched = etats.find((e) => {
        const titre = normalizeEtatLabel(e?.titre);
        return (def.matchers || []).some((matcher) => titre.includes(normalizeEtatLabel(matcher)));
      });
      return { ...def, id: matched?.id ?? def.fallbackId };
    });
  }, [etatsData]);

  const activeEtatFinal = useMemo(() => {
    const found = etatFiltersResolved.find((f) => f.key === activeEtatKey);
    return found?.id ?? null;
  }, [etatFiltersResolved, activeEtatKey]);

  const { data, isLoading } = useQuery(
    ['cq-signatures', activeTab, activeRange.dateDebut, activeRange.dateFin, activeEtatKey, activeEtatFinal, page],
    async () => {
      const res = await api.get('/signature', {
        params: {
          date_debut: activeRange.dateDebut,
          date_fin: activeRange.dateFin,
          page,
          limit,
          sort_by: 'date_planning',
          sort_order: 'desc',
          ...(activeEtatFinal !== null ? { id_etat_final: activeEtatFinal } : {}),
        },
      });
      return res.data;
    },
    { keepPreviousData: true }
  );

  const rows = data?.data || [];
  const pagination = data?.pagination || {};
  const getEtatColor = (etatId) => {
    const etat = (etatsData || []).find((e) => Number(e.id) === Number(etatId));
    return etat?.color || '#9cbfc8';
  };
  const getSortValue = (row, key) => {
    switch (key) {
      case 'nom':
        return String(row.nom || '').toLowerCase();
      case 'prenom':
        return String(row.prenom || '').toLowerCase();
      case 'cp':
        return String(row.cp || '').toLowerCase();
      case 'date_insert_time':
        return row.date_insert_time ? new Date(row.date_insert_time).getTime() : 0;
      case 'date_planning':
        return row.date_planning ? new Date(row.date_planning).getTime() : 0;
      case 'etat':
        return String(row.etat_titre || '').toLowerCase();
      case 'date_heure':
        return row.date_heure ? new Date(row.date_heure).getTime() : 0;
      case 'confirmateur':
        return String(row.confirmateur_pseudo || '').toLowerCase();
      case 'commercial':
        return String(`${row.commercial_pseudo || ''} ${row.commercial_2_pseudo || ''}`).toLowerCase();
      case 'produit':
        return Number(row.produit || 0);
      case 'centre':
        return String(row.centre_titre || '').toLowerCase();
      case 'cq_etat':
        return String(row.cq_etat_titre || '').toLowerCase();
      case 'cq_dossier':
        return String(row.cq_dossier_titre || '').toLowerCase();
      case 'installateur':
        return String(row.installateur_nom || '').toLowerCase();
      case 'fiche':
        return Number(row.id_fiche || 0);
      case 'telephone':
        return String(row.tel || row.fiche_tel || '').toLowerCase();
      case 'score':
        return Number(row.ajoute || 0);
      default:
        return '';
    }
  };
  const sortedRows = useMemo(() => {
    const copied = [...rows];
    copied.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copied;
  }, [rows, sortKey, sortDir]);
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date_planning' || key === 'date_heure' ? 'desc' : 'asc');
    }
  };
  const sortIndicator = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? 'ASC' : 'DESC';
  };
  const getProduitLabel = (value) => {
    if (value === 1 || value === '1') return 'PAC';
    if (value === 2 || value === '2') return 'PV';
    return '-';
  };
  const getProduitColor = (value) => {
    if (value === 1 || value === '1') return '#66D5D4';
    if (value === 2 || value === '2') return '#FFE441';
    return '#cccccc';
  };
  const getProduitTextColor = (value) => {
    if (value === 2 || value === '2') return '#111111';
    return '#ffffff';
  };
  const getCommercialsFormatted = (sig) => {
    const c1 = sig.commercial_pseudo || '';
    const c2 = sig.commercial_2_pseudo || '';
    if (c1 && c2) return `${c1} | ${c2}`;
    return c1 || c2 || '-';
  };

  return (
    <div className="cq-signatures-page">
      <div className="page-header">
        <h1><FaCheckCircle /> CQ Signatures</h1>
      </div>

      <div className="cq-filters-row">
        <div className="cq-tabs">
          {TAB_DEFS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`cq-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="cq-status-tabs">
          {etatFiltersResolved.map((etat) => (
            <button
              key={etat.key}
              type="button"
              className={`cq-tab ${activeEtatKey === etat.key ? 'active' : ''}`}
              onClick={() => {
                setActiveEtatKey(etat.key);
                setPage(1);
              }}
            >
              {etat.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === 'custom' && (
        <div className="cq-custom-range">
          <label className="cq-custom-range-label" htmlFor="cq-custom-date-debut">Date début</label>
          <input
            id="cq-custom-date-debut"
            type="date"
            value={customDateDebut}
            onChange={(e) => setCustomDateDebut(e.target.value)}
          />
          <label className="cq-custom-range-label" htmlFor="cq-custom-date-fin">Date fin</label>
          <input
            id="cq-custom-date-fin"
            type="date"
            value={customDateFin}
            onChange={(e) => setCustomDateFin(e.target.value)}
          />
          <button
            type="button"
            className="cq-tab"
            onClick={() => {
              if (!customDateDebut || !customDateFin) return;
              const dateDebut = customDateDebut <= customDateFin ? customDateDebut : customDateFin;
              const dateFin = customDateDebut <= customDateFin ? customDateFin : customDateDebut;
              setAppliedCustomRange({ dateDebut, dateFin });
              setPage(1);
            }}
            disabled={!customDateDebut || !customDateFin}
          >
            Rechercher
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Chargement des signatures...</div>
      ) : rows.length === 0 ? (
        <div className="no-data">Aucune signature trouvée.</div>
      ) : (
        <>
          <div className="cq-table-container">
            <table className="cq-table">
              <thead>
                <tr>
                  <th className="sortable-header" onClick={() => handleSort('nom')}>Nom <span>{sortIndicator('nom')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('prenom')}>Prénom <span>{sortIndicator('prenom')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('telephone')}>Téléphone <span>{sortIndicator('telephone')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('cp')}>CP <span>{sortIndicator('cp')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('date_insert_time')}>Date insertion <span>{sortIndicator('date_insert_time')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('date_planning')}>Date RDV <span>{sortIndicator('date_planning')}</span></th>
                  <th className="sortable-header etat-col" onClick={() => handleSort('etat')}>État <span>{sortIndicator('etat')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('confirmateur')}>Confirmateur <span>{sortIndicator('confirmateur')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('commercial')}>Commercial <span>{sortIndicator('commercial')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('centre')}>Centre <span>{sortIndicator('centre')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('installateur')}>Installateur <span>{sortIndicator('installateur')}</span></th>
                  <th className="sortable-header produit-col" onClick={() => handleSort('produit')}>Produit <span>{sortIndicator('produit')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('date_heure')}>Date signature <span>{sortIndicator('date_heure')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('cq_etat')}>CQ État <span>{sortIndicator('cq_etat')}</span></th>
                  <th className="sortable-header" onClick={() => handleSort('cq_dossier')}>CQ Dossier <span>{sortIndicator('cq_dossier')}</span></th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((sig) => (
                  <tr
                    key={sig.id_fiche || sig.id}
                    className="cq-table-row-by-etat"
                    style={{
                      backgroundColor: `${getEtatColor(sig.fiche_id_etat_final)}40`,
                      borderLeft: `4px solid ${getEtatColor(sig.fiche_id_etat_final)}`
                    }}
                  >
                    <td>{sig.nom || '-'}</td>
                    <td>{sig.prenom || '-'}</td>
                    <td>{sig.tel || sig.fiche_tel || '-'}</td>
                    <td>{sig.cp || '-'}</td>
                    <td>{sig.date_insert_time ? formatRdvDateTime(sig.date_insert_time) : '-'}</td>
                    <td>{sig.date_planning ? formatRdvDateTime(sig.date_planning) : '-'}</td>
                    <td className="etat-col">
                      <span className="etat-badge" style={{ backgroundColor: getEtatColor(sig.fiche_id_etat_final) }}>
                        {sig.etat_titre || '-'}
                      </span>
                    </td>
                    <td>{sig.confirmateur_pseudo || '-'}</td>
                    <td className="wrap-cell">{getCommercialsFormatted(sig)}</td>
                    <td className="wrap-cell">{sig.centre_titre || '-'}</td>
                    <td className="wrap-cell">{sig.installateur_nom || '-'}</td>
                    <td className="produit-col">
                      <span
                        className="cq-produit-indicator"
                        style={{
                          backgroundColor: getProduitColor(sig.produit),
                          color: getProduitTextColor(sig.produit),
                        }}
                      >
                        {getProduitLabel(sig.produit)}
                      </span>
                    </td>
                    <td>{sig.date_heure ? formatRdvDateTime(sig.date_heure) : '-'}</td>
                    <td className="wrap-cell">{sig.cq_etat_titre || '-'}</td>
                    <td className="wrap-cell">{sig.cq_dossier_titre || '-'}</td>
                    <td className="cq-details-cell">
                      {sig.id_fiche ? (
                        <button
                          type="button"
                          className="btn-detail"
                          title="Voir les détails"
                          onClick={() => {
                            const hash = sig.fiche_hash || sig.hash || sig.id_fiche;
                            setFicheDetailModal({ hash });
                            setLastViewedFicheHash(hash);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FaSearch className="cq-search-icon" />
                            {lastViewedFicheHash === (sig.fiche_hash || sig.hash || sig.id_fiche) && (
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
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn-pagination"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Précédent
              </button>
              <span className="pagination-info">
                Page {pagination.page} sur {pagination.totalPages} ({pagination.total} signatures)
              </span>
              <button
                type="button"
                className="btn-pagination"
                onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                disabled={page >= (pagination.totalPages || 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {ficheDetailModal && (
        <FicheDetailModal
          ficheHash={ficheDetailModal.hash}
          onClose={() => setFicheDetailModal(null)}
        />
      )}
    </div>
  );
};

export default CQSignatures;
