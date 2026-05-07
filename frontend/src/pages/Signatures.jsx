import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FaSignature, FaChartLine, FaUsers, FaFileAlt, FaArrowUp, FaArrowDown, FaMinus, FaSearch } from 'react-icons/fa';
import api from '../config/api';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import './Signatures.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const Signatures = () => {
  useForceDesktopViewport('signatures-page');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdminSession = [1, 11].includes(Number(user?.fonction));
  const [dateDebut, setDateDebut] = useState(() => getFirstOfMonthLocal());
  const [dateFin, setDateFin] = useState(() => getTodayLocal());
  const [selectedConfirmateur, setSelectedConfirmateur] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date_planning');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeTab, setActiveTab] = useState('actives'); // actives | rejetees
  const limit = 50;
  const [modalState, setModalState] = useState({
    open: false,
    mode: null, // reject | editOwner | addConfirmateur
    signature: null
  });
  const [motifRejet, setMotifRejet] = useState('');
  const [selectedConfirmateurModal, setSelectedConfirmateurModal] = useState('');
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, signature: null });

  // Récupérer les KPI
  const { data: kpiData, isLoading: isLoadingKpi } = useQuery(
    ['signature-kpi', dateDebut, dateFin],
    async () => {
      const res = await api.get('/signature/kpi', {
        params: { date_debut: dateDebut, date_fin: dateFin }
      });
      return res.data.data;
    },
    { enabled: !!dateDebut && !!dateFin }
  );

  // Récupérer les statistiques
  const { data: statsData, isLoading: isLoadingStats } = useQuery(
    ['signature-stats', dateDebut, dateFin],
    async () => {
      const res = await api.get('/signature/stats', {
        params: { date_debut: dateDebut, date_fin: dateFin }
      });
      return res.data.data;
    },
    { enabled: !!dateDebut && !!dateFin }
  );

  // Récupérer la liste des signatures
  const { data: signaturesData, isLoading: isLoadingSignatures } = useQuery(
    ['signatures', dateDebut, dateFin, selectedConfirmateur, selectedCommercial, page, sortBy, sortOrder],
    async () => {
      const params = {
        date_debut: dateDebut,
        date_fin: dateFin,
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder
      };
      if (selectedConfirmateur) {
        params.id_confirmateur = selectedConfirmateur;
      }
      if (selectedCommercial) {
        params.id_commercial = selectedCommercial;
      }
      const res = await api.get('/signature', { params });
      return res.data;
    },
    { enabled: !!dateDebut && !!dateFin }
  );

  // Récupérer la liste des signatures rejetées
  const { data: rejectedData, isLoading: isLoadingRejected } = useQuery(
    ['signatures-rejetees', dateDebut, dateFin, selectedConfirmateur, selectedCommercial, page, isAdminSession],
    async () => {
      const params = {
        date_debut: dateDebut,
        date_fin: dateFin,
        page,
        limit
      };
      if (selectedConfirmateur) params.id_confirmateur = selectedConfirmateur;
      if (selectedCommercial) params.id_commercial = selectedCommercial;
      const res = await api.get('/signature/rejetees', { params });
      return res.data;
    },
    { enabled: !!dateDebut && !!dateFin && isAdminSession }
  );

  // Récupérer la liste des confirmateurs
  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });
  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5) || [];
  });
  const { data: etatsData } = useQuery('signatures-etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const signatures = signaturesData?.data || [];
  const pagination = signaturesData?.pagination || {};
  const rejectedSignatures = rejectedData?.data || [];
  const rejectedPagination = rejectedData?.pagination || {};
  const canSubmitReject = motifRejet.trim().length > 0;
  const canSubmitConfirmateur = selectedConfirmateurModal !== '';

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries('signatures'),
      queryClient.invalidateQueries('signatures-rejetees'),
      queryClient.invalidateQueries('signature-kpi'),
      queryClient.invalidateQueries('signature-stats')
    ]);
  };

  const rejectMutation = useMutation(
    async ({ signatureId, motif }) => api.post(`/signature/${signatureId}/rejeter`, { motif }),
    {
      onSuccess: async () => {
        await refreshAll();
        closeModal();
      },
      onError: (error) => {
        window.alert(error?.response?.data?.message || 'Erreur lors du rejet de la signature');
      }
    }
  );

  const updateOwnerMutation = useMutation(
    async ({ signatureId, idConfirmateur }) => api.patch(`/signature/${signatureId}/confirmateur`, { id_confirmateur: idConfirmateur }),
    {
      onSuccess: async () => {
        await refreshAll();
        closeModal();
      },
      onError: (error) => {
        window.alert(error?.response?.data?.message || 'Erreur lors de la modification du confirmateur');
      }
    }
  );

  const addConfirmateurMutation = useMutation(
    async ({ signatureId, idConfirmateur }) => api.post(`/signature/${signatureId}/confirmateurs`, { id_confirmateur: idConfirmateur }),
    {
      onSuccess: async () => {
        await refreshAll();
        closeModal();
      },
      onError: (error) => {
        window.alert(error?.response?.data?.message || 'Erreur lors de l’ajout du confirmateur');
      }
    }
  );

  const restoreRejectedMutation = useMutation(
    async ({ rejectedId }) => api.post(`/signature/rejetees/${rejectedId}/restaurer`),
    {
      onSuccess: async () => {
        await refreshAll();
      },
      onError: (error) => {
        window.alert(error?.response?.data?.message || 'Erreur lors de la restauration');
      }
    }
  );

  const loadingAction = rejectMutation.isLoading || updateOwnerMutation.isLoading || addConfirmateurMutation.isLoading || restoreRejectedMutation.isLoading;

  const confirmateursOptions = useMemo(() => confirmateursData || [], [confirmateursData]);

  function openModal(mode, signature) {
    setModalState({ open: true, mode, signature });
    setMotifRejet('');
    setSelectedConfirmateurModal(mode === 'editOwner' && signature?.confirmateur ? String(signature.confirmateur) : '');
  }

  function closeModal() {
    setModalState({ open: false, mode: null, signature: null });
    setMotifRejet('');
    setSelectedConfirmateurModal('');
  }

  function submitModal() {
    const signatureId = modalState?.signature?.id;
    if (!signatureId) return;
    if (modalState.mode === 'reject') {
      if (!canSubmitReject) return;
      rejectMutation.mutate({ signatureId, motif: motifRejet.trim() });
      return;
    }
    if (!canSubmitConfirmateur) return;
    const idConfirmateur = Number(selectedConfirmateurModal);
    if (modalState.mode === 'editOwner') {
      updateOwnerMutation.mutate({ signatureId, idConfirmateur });
    } else if (modalState.mode === 'addConfirmateur') {
      addConfirmateurMutation.mutate({ signatureId, idConfirmateur });
    }
  }

  function handleSort(nextSortBy) {
    if (sortBy === nextSortBy) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(nextSortBy);
      setSortOrder(nextSortBy === 'date_planning' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  const sortIndicator = (key) => {
    if (sortBy !== key) return '↕';
    return sortOrder === 'asc' ? '▲' : '▼';
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return parseFloat(num).toFixed(2);
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <FaArrowUp className="trend-up" />;
    if (trend === 'down') return <FaArrowDown className="trend-down" />;
    return <FaMinus className="trend-stable" />;
  };

  const getTrendColor = (trend, value) => {
    if (trend === 'up') return '#28a745';
    if (trend === 'down') return '#dc3545';
    return '#6c757d';
  };

  const getEtatColor = (etatId) => {
    const etat = (etatsData || []).find((e) => Number(e.id) === Number(etatId));
    return etat?.color || '#9cbfc8';
  };

  const getEtatLabel = (etatId) => {
    const etat = (etatsData || []).find((e) => Number(e.id) === Number(etatId));
    return etat?.titre || '-';
  };

  const openContextMenu = (event, signature) => {
    if (!isAdminSession) return;
    event.preventDefault();
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, signature });
  };

  const closeContextMenu = () => {
    if (!contextMenu.open) return;
    setContextMenu({ open: false, x: 0, y: 0, signature: null });
  };

  const applyCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const toLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    setDateDebut(toLocal(monday));
    setDateFin(toLocal(friday));
    setPage(1);
  };

  const applyCurrentMonth = () => {
    setDateDebut(getFirstOfMonthLocal());
    setDateFin(getTodayLocal());
    setPage(1);
  };

  return (
    <div className="signatures-page" onClick={closeContextMenu}>
      <div className="page-header">
        <h1><FaSignature /> Signatures et Statistiques</h1>
      </div>

      {/* Filtres */}
      <div className="filters-section">
        <div className="quick-access-row">
          <button type="button" className="btn-quick-access" onClick={applyCurrentWeek}>Signatures de la semaine</button>
          <button type="button" className="btn-quick-access" onClick={applyCurrentMonth}>Signatures du mois</button>
        </div>
        <div className="filter-group">
          <label>Date début :</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => {
              setDateDebut(e.target.value);
              setPage(1);
            }}
            className="form-control"
          />
        </div>
        <div className="filter-group">
          <label>Date fin :</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => {
              setDateFin(e.target.value);
              setPage(1);
            }}
            className="form-control"
          />
        </div>
        <div className="filter-group">
          <label>Confirmateur :</label>
          <select
            value={selectedConfirmateur}
            onChange={(e) => {
              setSelectedConfirmateur(e.target.value);
              setPage(1);
            }}
            className="form-control"
          >
            <option value="">Tous</option>
            {confirmateursData?.map(conf => (
              <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Commercial :</label>
          <select
            value={selectedCommercial}
            onChange={(e) => {
              setSelectedCommercial(e.target.value);
              setPage(1);
            }}
            className="form-control"
          >
            <option value="">Tous</option>
            {commerciauxData?.map(com => (
              <option key={com.id} value={com.id}>{com.pseudo}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoadingKpi ? (
        <div className="loading">Chargement des KPI...</div>
      ) : kpiData && (
        <div className="kpi-section">
          <h2>Indicateurs Clés (KPI)</h2>
          <div className="kpi-grid">
            {/* KPI 1: Total Signatures */}
            <div className="kpi-card">
              <div className="kpi-header">
                <FaSignature className="kpi-icon" />
                <h3>Total Signatures</h3>
              </div>
              <div className="kpi-value">{formatNumber(kpiData.totalSignatures?.current)}</div>
              <div className="kpi-evolution">
                <span style={{ color: getTrendColor(kpiData.totalSignatures?.trend, kpiData.totalSignatures?.evolution) }}>
                  {getTrendIcon(kpiData.totalSignatures?.trend)}
                  {kpiData.totalSignatures?.evolution > 0 ? '+' : ''}{formatNumber(kpiData.totalSignatures?.evolution)}%
                </span>
                <span className="kpi-previous">vs {formatNumber(kpiData.totalSignatures?.previous)}</span>
              </div>
            </div>

            {/* KPI 2: Nombre de Signatures */}
            <div className="kpi-card">
              <div className="kpi-header">
                <FaUsers className="kpi-icon" />
                <h3>Nombre de Signatures</h3>
              </div>
              <div className="kpi-value">{kpiData.nombreSignatures?.current || 0}</div>
              <div className="kpi-evolution">
                <span style={{ color: getTrendColor(kpiData.nombreSignatures?.trend, kpiData.nombreSignatures?.evolution) }}>
                  {getTrendIcon(kpiData.nombreSignatures?.trend)}
                  {kpiData.nombreSignatures?.evolution > 0 ? '+' : ''}{formatNumber(kpiData.nombreSignatures?.evolution)}%
                </span>
                <span className="kpi-previous">vs {kpiData.nombreSignatures?.previous || 0}</span>
              </div>
            </div>

            {/* KPI 3: Fiches Signées */}
            <div className="kpi-card">
              <div className="kpi-header">
                <FaFileAlt className="kpi-icon" />
                <h3>Fiches Signées</h3>
              </div>
              <div className="kpi-value">{kpiData.fichesSignees?.current || 0}</div>
              <div className="kpi-evolution">
                <span style={{ color: getTrendColor(kpiData.fichesSignees?.trend, kpiData.fichesSignees?.evolution) }}>
                  {getTrendIcon(kpiData.fichesSignees?.trend)}
                  {kpiData.fichesSignees?.evolution > 0 ? '+' : ''}{formatNumber(kpiData.fichesSignees?.evolution)}%
                </span>
                <span className="kpi-previous">vs {kpiData.fichesSignees?.previous || 0}</span>
              </div>
            </div>

            {/* KPI 4: Moyenne par Jour */}
            <div className="kpi-card">
              <div className="kpi-header">
                <FaChartLine className="kpi-icon" />
                <h3>Moyenne par Jour</h3>
              </div>
              <div className="kpi-value">{formatNumber(kpiData.moyenneParJour)}</div>
              <div className="kpi-info">
                Sur {kpiData.periode?.jours || 0} jours
              </div>
            </div>

            {/* KPI 5: Top Confirmateur */}
            {kpiData.top3Confirmateurs && kpiData.top3Confirmateurs.length > 0 && (
              <div className="kpi-card">
                <div className="kpi-header">
                  <FaUsers className="kpi-icon" />
                  <h3>Top Confirmateur</h3>
                </div>
                <div className="kpi-value">{kpiData.top3Confirmateurs[0]?.pseudo || '-'}</div>
                <div className="kpi-info">
                  Score: {formatNumber(kpiData.top3Confirmateurs[0]?.score || 0)}
                </div>
              </div>
            )}
          </div>

          {/* Top 3 Confirmateurs */}
          {kpiData.top3Confirmateurs && kpiData.top3Confirmateurs.length > 0 && (
            <div className="top-confirmateurs-section">
              <h3>Top 3 Confirmateurs</h3>
              <div className="top-confirmateurs-list">
                {kpiData.top3Confirmateurs.map((conf, index) => (
                  <div key={conf.id} className="top-confirmateur-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="confirmateur-info">
                      <div className="confirmateur-name">{conf.pseudo}</div>
                      <div className="confirmateur-score">Score: {formatNumber(conf.score)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistiques */}
      {isLoadingStats ? (
        <div className="loading">Chargement des statistiques...</div>
      ) : statsData && (
        <div className="stats-section">
          <h2>Statistiques Détaillées</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Signatures (Score)</div>
              <div className="stat-value">{formatNumber(statsData.totalSignatures)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Fiches Signées Uniques</div>
              <div className="stat-value">{statsData.fichesUniques || 0}</div>
            </div>
          </div>

          {/* Tous les confirmateurs (confirmés = table confirmations, par date RDV) */}
          {statsData.allConfirmateurs && statsData.allConfirmateurs.length > 0 && (
            <div className="top-10-section">
              <h3>Tous les confirmateurs</h3>
              <div className="table-container">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Rang</th>
                      <th>Confirmateur</th>
                      <th>Score Total</th>
                      <th>Fiches confirmées (RDV)</th>
                      <th>Signatures</th>
                      <th>Taux de signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsData.allConfirmateurs.map((conf, index) => (
                      <tr key={conf.confirmateur}>
                        <td>{index + 1}</td>
                        <td>{conf.confirmateur_pseudo || 'Inconnu'}</td>
                        <td>{formatNumber(conf.total_score)}</td>
                        <td>{conf.nb_fiches_confirmees ?? conf.nb_fiches ?? 0}</td>
                        <td>{conf.nb_signatures || 0}</td>
                        <td>{conf.taux_signature != null ? `${conf.taux_signature.toFixed(1)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liste des Signatures */}
      <div className="signatures-list-section">
        <div className="signatures-tabs">
          <button
            type="button"
            className={`signatures-tab ${activeTab === 'actives' ? 'active' : ''}`}
            onClick={() => { setActiveTab('actives'); setPage(1); }}
          >
            Signatures
          </button>
          {isAdminSession && (
            <button
              type="button"
              className={`signatures-tab ${activeTab === 'rejetees' ? 'active' : ''}`}
              onClick={() => { setActiveTab('rejetees'); setPage(1); }}
            >
              Signatures rejetées
            </button>
          )}
        </div>

        <h2>{activeTab === 'actives' ? 'Liste des Signatures' : 'Liste des Signatures rejetées'}</h2>
        {activeTab === 'actives' && (
          <div className="list-filter-row">
            <label>Filtre confirmateur :</label>
            <select
              value={selectedConfirmateur}
              onChange={(e) => {
                setSelectedConfirmateur(e.target.value);
                setPage(1);
              }}
              className="form-control"
            >
              <option value="">Tous</option>
              {confirmateursData?.map(conf => (
                <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
              ))}
            </select>
          </div>
        )}

        {(activeTab === 'actives' ? isLoadingSignatures : isLoadingRejected) ? (
          <div className="loading">Chargement des signatures...</div>
        ) : (activeTab === 'actives' ? signatures.length > 0 : rejectedSignatures.length > 0) ? (
          <>
            <div className="fiches-table-container table-container">
              <table className="fiches-table signatures-table">
                <thead>
                  {activeTab === 'actives' ? (
                    <tr>
                      <th className="sortable-header" onClick={() => handleSort('date_planning')}>
                        Date planning (RDV) <span>{sortIndicator('date_planning')}</span>
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('date_heure')}>
                        Date / heure signature <span>{sortIndicator('date_heure')}</span>
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('confirmateur')}>
                        Confirmateur <span>{sortIndicator('confirmateur')}</span>
                      </th>
                      <th>Centre</th>
                      <th>État</th>
                      <th>Fiche</th>
                      <th className="sortable-header" onClick={() => handleSort('telephone')}>
                        Téléphone <span>{sortIndicator('telephone')}</span>
                      </th>
                      <th className="sortable-header" onClick={() => handleSort('score')}>
                        Score <span>{sortIndicator('score')}</span>
                      </th>
                      {isAdminSession && <th>Actions</th>}
                    </tr>
                  ) : (
                    <tr>
                      <th>Date rejet</th>
                      <th>Confirmateur</th>
                      <th>Centre</th>
                      <th>État</th>
                      <th>Fiche</th>
                      <th>Téléphone</th>
                      <th>Score</th>
                      <th>Motif</th>
                      <th>Rejetée par</th>
                      <th>Action</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeTab === 'actives' ? signatures.map(sig => (
                      <tr
                        key={sig.id}
                        className="fiche-row-by-etat"
                        onContextMenu={(e) => openContextMenu(e, sig)}
                        style={{
                          backgroundColor: `${getEtatColor(sig.fiche_id_etat_final)}40`,
                          borderLeft: `4px solid ${getEtatColor(sig.fiche_id_etat_final)}`
                        }}
                      >
                        <td>
                          {sig.date_planning
                            ? formatRdvDateTime(sig.date_planning)
                            : (sig.date_heure ? formatRdvDateTime(sig.date_heure) : '-')}
                        </td>
                        <td>{sig.date_heure ? formatRdvDateTime(sig.date_heure) : '-'}</td>
                        <td>{sig.confirmateur_pseudo || 'Inconnu'}</td>
                        <td>{sig.centre_titre || '-'}</td>
                        <td>
                          <span className="etat-badge" style={{ backgroundColor: getEtatColor(sig.fiche_id_etat_final) }}>
                            {getEtatLabel(sig.fiche_id_etat_final)}
                          </span>
                        </td>
                        <td>
                          {sig.id_fiche ? (
                            <FicheDetailLink ficheId={sig.id_fiche}>
                              <FaSearch className="search-icon" />
                            </FicheDetailLink>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td>{sig.tel || sig.fiche_tel || '-'}</td>
                        <td>{formatNumber(sig.ajoute)}</td>
                        {isAdminSession && (
                          <td className="signature-actions-cell">Clic droit</td>
                        )}
                      </tr>
                    ))
                    : rejectedSignatures.map(sig => (
                      <tr
                        key={`rejected-${sig.id}`}
                        className="fiche-row-by-etat"
                        onContextMenu={(e) => openContextMenu(e, sig)}
                        style={{
                          backgroundColor: `${getEtatColor(sig.fiche_id_etat_final)}40`,
                          borderLeft: `4px solid ${getEtatColor(sig.fiche_id_etat_final)}`
                        }}
                      >
                        <td>{sig.date_rejet ? formatRdvDateTime(sig.date_rejet) : '-'}</td>
                        <td>{sig.confirmateur_pseudo || 'Inconnu'}</td>
                        <td>{sig.centre_titre || '-'}</td>
                        <td>
                          <span className="etat-badge" style={{ backgroundColor: getEtatColor(sig.fiche_id_etat_final) }}>
                            {getEtatLabel(sig.fiche_id_etat_final)}
                          </span>
                        </td>
                        <td>
                          {sig.id_fiche ? (
                            <FicheDetailLink ficheId={sig.id_fiche}>
                              <FaSearch className="search-icon" />
                            </FicheDetailLink>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td>{sig.tel || sig.fiche_tel || '-'}</td>
                        <td>{formatNumber(sig.ajoute)}</td>
                        <td>{sig.motif || '-'}</td>
                        <td>{sig.rejete_par_pseudo || '-'}</td>
                        <td>{isAdminSession ? 'Clic droit' : '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(activeTab === 'actives' ? pagination.totalPages : rejectedPagination.totalPages) > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-pagination"
                >
                  Précédent
                </button>
                <span className="pagination-info">
                  Page {(activeTab === 'actives' ? pagination.page : rejectedPagination.page)} sur {(activeTab === 'actives' ? pagination.totalPages : rejectedPagination.totalPages)} ({(activeTab === 'actives' ? pagination.total : rejectedPagination.total)} signatures)
                </span>
                <button
                  onClick={() => setPage(p => Math.min((activeTab === 'actives' ? pagination.totalPages : rejectedPagination.totalPages), p + 1))}
                  disabled={page >= (activeTab === 'actives' ? pagination.totalPages : rejectedPagination.totalPages)}
                  className="btn-pagination"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-data">
            {activeTab === 'actives'
              ? 'Aucune signature trouvée pour cette période'
              : 'Aucune signature rejetée trouvée pour cette période'}
          </div>
        )}
      </div>

      {modalState.open && (
        <div className="signature-modal-overlay" onClick={closeModal}>
          <div className="signature-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {modalState.mode === 'reject' && 'Ne pas comptabiliser la signature'}
              {modalState.mode === 'editOwner' && 'Modifier le propriétaire de signature'}
              {modalState.mode === 'addConfirmateur' && 'Ajouter un confirmateur'}
            </h3>
            <p className="signature-modal-context">
              Fiche: {modalState.signature?.id_fiche || '-'} | Confirmateur actuel: {modalState.signature?.confirmateur_pseudo || 'Inconnu'}
            </p>

            {modalState.mode === 'reject' ? (
              <div className="signature-modal-field">
                <label>Motif du rejet *</label>
                <textarea
                  value={motifRejet}
                  onChange={(e) => setMotifRejet(e.target.value)}
                  rows={4}
                  placeholder="Saisir le motif du rejet..."
                />
              </div>
            ) : (
              <div className="signature-modal-field">
                <label>Confirmateur *</label>
                <select
                  value={selectedConfirmateurModal}
                  onChange={(e) => setSelectedConfirmateurModal(e.target.value)}
                >
                  <option value="">Sélectionner un confirmateur</option>
                  {confirmateursOptions.map(conf => (
                    <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="signature-modal-actions">
              <button type="button" className="btn-modal-cancel" onClick={closeModal} disabled={loadingAction}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={submitModal}
                disabled={loadingAction || (modalState.mode === 'reject' ? !canSubmitReject : !canSubmitConfirmateur)}
              >
                {loadingAction ? 'Traitement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
      {contextMenu.open && isAdminSession && (
        <div
          className="signature-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeTab === 'actives' ? (
            <>
              <button
                type="button"
                className="signature-context-menu-item"
                onClick={() => {
                  openModal('editOwner', contextMenu.signature);
                  closeContextMenu();
                }}
              >
                Modifier propriétaire
              </button>
              <button
                type="button"
                className="signature-context-menu-item"
                onClick={() => {
                  openModal('addConfirmateur', contextMenu.signature);
                  closeContextMenu();
                }}
              >
                Ajouter confirmateur
              </button>
              <button
                type="button"
                className="signature-context-menu-item"
                onClick={() => {
                  openModal('reject', contextMenu.signature);
                  closeContextMenu();
                }}
              >
                Ne pas comptabiliser
              </button>
            </>
          ) : (
            <button
              type="button"
              className="signature-context-menu-item"
              onClick={() => {
                if (contextMenu.signature?.id) {
                  restoreRejectedMutation.mutate({ rejectedId: contextMenu.signature.id });
                }
                closeContextMenu();
              }}
            >
              Rendre
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Signatures;

