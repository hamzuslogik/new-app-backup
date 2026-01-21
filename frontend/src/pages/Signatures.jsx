import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { FaSignature, FaChartLine, FaUsers, FaFileAlt, FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';
import api from '../config/api';
import FicheDetailLink from '../components/FicheDetailLink';
import './Signatures.css';

const Signatures = () => {
  const [dateDebut, setDateDebut] = useState(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return startOfMonth.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [selectedConfirmateur, setSelectedConfirmateur] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

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
    ['signatures', dateDebut, dateFin, selectedConfirmateur, page],
    async () => {
      const params = {
        date_debut: dateDebut,
        date_fin: dateFin,
        page,
        limit
      };
      if (selectedConfirmateur) {
        params.id_confirmateur = selectedConfirmateur;
      }
      const res = await api.get('/signature', { params });
      return res.data;
    },
    { enabled: !!dateDebut && !!dateFin }
  );

  // Récupérer la liste des confirmateurs
  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const signatures = signaturesData?.data || [];
  const pagination = signaturesData?.pagination || {};

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

  return (
    <div className="signatures-page">
      <div className="page-header">
        <h1><FaSignature /> Signatures et Statistiques</h1>
      </div>

      {/* Filtres */}
      <div className="filters-section">
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

            {/* KPI 2: Fiches Signées */}
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

            {/* KPI 3: Moyenne par Jour */}
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

            {/* KPI 4: Top Confirmateur */}
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

          {/* Top 10 Confirmateurs */}
          {statsData.topConfirmateurs && statsData.topConfirmateurs.length > 0 && (
            <div className="top-10-section">
              <h3>Top 10 Confirmateurs</h3>
              <div className="table-container">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Rang</th>
                      <th>Confirmateur</th>
                      <th>Score Total</th>
                      <th>Fiches</th>
                      <th>Signatures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsData.topConfirmateurs.map((conf, index) => (
                      <tr key={conf.confirmateur}>
                        <td>{index + 1}</td>
                        <td>{conf.confirmateur_pseudo || 'Inconnu'}</td>
                        <td>{formatNumber(conf.total_score)}</td>
                        <td>{conf.nb_fiches || 0}</td>
                        <td>{conf.nb_signatures || 0}</td>
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
        <h2>Liste des Signatures</h2>
        {isLoadingSignatures ? (
          <div className="loading">Chargement des signatures...</div>
        ) : signatures.length > 0 ? (
          <>
            <div className="table-container">
              <table className="signatures-table">
                <thead>
                  <tr>
                    <th>Date/Heure</th>
                    <th>Confirmateur</th>
                    <th>Fiche</th>
                    <th>Téléphone</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map(sig => (
                    <tr key={sig.id}>
                      <td>
                        {sig.date_heure 
                          ? new Date(sig.date_heure).toLocaleString('fr-FR')
                          : '-'}
                      </td>
                      <td>{sig.confirmateur_pseudo || 'Inconnu'}</td>
                      <td>
                        {sig.id_fiche ? (
                          <FicheDetailLink ficheId={sig.id_fiche}>
                            {sig.fiche_nom} {sig.fiche_prenom}
                          </FicheDetailLink>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td>{sig.tel || sig.fiche_tel || '-'}</td>
                      <td>{formatNumber(sig.ajoute)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-pagination"
                >
                  Précédent
                </button>
                <span className="pagination-info">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} signatures)
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="btn-pagination"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-data">Aucune signature trouvée pour cette période</div>
        )}
      </div>
    </div>
  );
};

export default Signatures;

