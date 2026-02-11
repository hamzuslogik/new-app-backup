import React, { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaBell, FaFilter } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Alertes.css';

const Alertes = () => {
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    date_debut: '',
    date_fin: '',
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

      <div className="results-info">
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
                  <th>Envoyée par</th>
                  <th>État / Sous-état</th>
                  <th>N° alerte</th>
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
                    <td>{a.qualite_pseudo || '-'}</td>
                    <td>
                      {[a.etat_titre, a.sous_etat_titre].filter(Boolean).join(' / ') || '-'}
                    </td>
                    <td><span className="num-alerte">{a.num_alerte}/3</span></td>
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
