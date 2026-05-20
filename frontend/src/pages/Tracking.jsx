import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaRoute, FaFilter } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import './Tracking.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import { canAccessTrackingPage } from '../utils/trackingAccess';

const Tracking = () => {
  useForceDesktopViewport('tracking-page');
  const { user } = useAuth();

  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    date_debut: '',
    date_fin: '',
    search: '',
  });

  if (!canAccessTrackingPage(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data, isLoading, error, refetch } = useQuery(
    ['tracking-list', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] == null) delete params[k];
      });
      const res = await api.get('/tracking', { params });
      if (!res.data?.success) throw new Error(res.data?.message || 'Erreur');
      return res.data;
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const rows = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };

  return (
    <div className="page-tracking">
      <div className="page-header">
        <h1>
          <FaRoute /> Tracking RDV
        </h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="search-form tracking-filters">
          <div className="form-grid">
            <div className="form-group">
              <label>Date début (création)</label>
              <input
                type="date"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Date fin (création)</label>
              <input
                type="date"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
            <div className="form-group form-group-search">
              <label>Recherche</label>
              <input
                type="text"
                placeholder="Nom, tél., constat…"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="results-info">
        <p>
          Total : <strong>{pagination.total}</strong> tracking{pagination.total !== 1 ? 's' : ''}
          {pagination.pages > 1 && (
            <> — page <strong>{pagination.page}</strong> / {pagination.pages}</>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement…</div>
      ) : error ? (
        <div className="error">
          <p>{error.response?.data?.message || error.message}</p>
          <button type="button" onClick={() => refetch()}>
            Réessayer
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="no-results">Aucun tracking enregistré</div>
      ) : (
        <>
          <div className="tracking-table-wrap">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Date création</th>
                  <th>Date RDV tracking</th>
                  <th>Compte rendu</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Commercial</th>
                  <th>Confirmateur</th>
                  <th>État</th>
                  <th>Rappel client</th>
                  <th>Constat</th>
                  <th>Saisi par</th>
                  <th>Fiche</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date_creation)}</td>
                    <td>{formatDate(row.date_rdv)}</td>
                    <td>{row.compte_rendu_id ? `n°${row.compte_rendu_id}` : '—'}</td>
                    <td>
                      {row.fiche_nom} {row.fiche_prenom}
                    </td>
                    <td>{row.fiche_tel || '—'}</td>
                    <td>{row.commercial_pseudo || '—'}</td>
                    <td>{row.confirmateur_pseudo || '—'}</td>
                    <td>{row.etat_titre || '—'}</td>
                    <td>
                      <span className={`tracking-badge ${row.rappel_client ? 'oui' : 'non'}`}>
                        {row.rappel_client_label}
                      </span>
                    </td>
                    <td className="tracking-cell-multiline" title={row.constat || ''}>
                      {row.constat ? String(row.constat).slice(0, 60) + (row.constat.length > 60 ? '…' : '') : '—'}
                    </td>
                    <td>{row.editor_pseudo || '—'}</td>
                    <td>
                      {row.fiche_hash ? (
                        <FicheDetailLink ficheHash={row.fiche_hash} ficheId={row.id_fiche} className="btn-link-fiche">
                          Voir
                        </FicheDetailLink>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => handleFilterChange('page', pagination.page - 1)}
              >
                Précédent
              </button>
              <span>
                Page {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => handleFilterChange('page', pagination.page + 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Tracking;
