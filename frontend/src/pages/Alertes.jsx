import React, { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { FaBell, FaFilter } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Alertes.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';

const Alertes = () => {
  useForceDesktopViewport('alertes-page');
  const { user, hasPermission } = useAuth();
  const [showFilters, setShowFilters] = useState(true);
  const fonction = Number(user?.fonction);
  const isAdmin = [1, 7].includes(fonction);
  const hasControleQualite = hasPermission('controle_qualite_view');
  // Agent qualification (fonction 3) : alertes reçues
  const isAgentQualif = fonction === 3;
  // Agent qualité qualification (fonction 8, etc.) : alertes qu'il a envoyées
  const isQualiteQualifSession =
    fonction === 8 || (hasControleQualite && !isAdmin && ![2, 3, 12].includes(fonction));
  const hideIdQualite = isAgentQualif || isQualiteQualifSession;
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    date_debut: getFirstOfMonthLocal(),
    date_fin: getTodayLocal(),
    id_agent: ''
  });

  const { data: agentsData } = useQuery(
    'alertes-agents-list',
    async () => {
      const res = await api.get('/alertes/agents');
      return res.data.data || [];
    },
    { staleTime: 60000 }
  );

  const { data, isLoading, error, refetch } = useQuery(
    ['alertes', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (params[key] === '' || params[key] == null) delete params[key];
      });
      const res = await api.get('/alertes', { params });
      if (res.data && res.data.success) return res.data;
      throw new Error(res.data?.message || 'Erreur');
    },
    {
      onError: (err) => {
        toast.error(err.response?.data?.message || err.message || 'Erreur lors du chargement des alertes');
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const alertes = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };
  const alertesStats = data?.stats || null;
  const agents = agentsData || [];

  return (
    <div className="page-alertes">
      <div className="page-header">
        <h1><FaBell /> Alertes</h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="search-form">
          <div className="form-grid">
            {agents.length > 1 && (
              <div className="form-group">
                <label>Agent</label>
                <select
                  value={filters.id_agent}
                  onChange={(e) => handleFilterChange('id_agent', e.target.value)}
                >
                  <option value="">Tous les agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.pseudo}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Date début</label>
              <input
                type="date"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Date fin</label>
              <input
                type="date"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {isAgentQualif && alertesStats && (
        <div className="alertes-summary-cards">
          <div className="alertes-summary-card alertes-summary-card--perso">
            <h3>Alerte perso</h3>
            <span className="alertes-summary-count">{alertesStats.perso}</span>
          </div>
          <div className="alertes-summary-card alertes-summary-card--technique">
            <h3>Alerte technique</h3>
            <span className="alertes-summary-count">{alertesStats.technique}</span>
          </div>
        </div>
      )}

      <div className="results-info">
        {isQualiteQualifSession && (
          <p className="alertes-scope-hint">Affichage de vos alertes envoyées uniquement.</p>
        )}
        <p>
          Total : <strong>{pagination.total}</strong> alerte{pagination.total !== 1 ? 's' : ''}
          {pagination.pages > 1 && (
            <> | Page <strong>{pagination.page}</strong> sur <strong>{pagination.pages}</strong></>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement des alertes...</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement</p>
          <button type="button" className="btn-retry" onClick={() => refetch()}>Réessayer</button>
        </div>
      ) : alertes.length === 0 ? (
        <div className="no-results">Aucune alerte trouvée</div>
      ) : (
        <>
          <div className="alertes-table-container">
            <table className="alertes-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Agent</th>
                  {!hideIdQualite && <th>Envoyée par</th>}
                  <th>Type d'alerte</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {alertes.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.date_alerte)}</td>
                    <td>{(a.nom || '').trim()} {(a.prenom || '').trim() || '-'}</td>
                    <td>{a.tel || '-'}</td>
                    <td>{a.agent_pseudo || '-'}</td>
                    {!hideIdQualite && <td>{a.qualite_pseudo || '-'}</td>}
                    <td>{a.type_alerte || '-'}</td>
                    <td className="comment-cell">{a.commentaire ? String(a.commentaire).slice(0, 80) + (a.commentaire.length > 80 ? '…' : '') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Précédent
              </button>
              <span>Page {pagination.page} sur {pagination.pages}</span>
              <button
                type="button"
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
  );
};

export default Alertes;
