import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCommentDots, FaFilter, FaPaperPlane } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getTodayLocal } from '../utils/dateUtils';
import './Remarques.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const NATURES_OPTIONS = [
  'Discours non conforme',
  'Traitement',
  'Fausse information',
  'Coordonnées',
  'Autres'
];

const Remarques = () => {
  useForceDesktopViewport('remarques-page');
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(true);
  const today = getTodayLocal();

  const fonction = Number(user?.fonction);
  const isAdmin = [1, 7].includes(fonction);
  const isReOrRp = [2, 12].includes(fonction);
  const canSend = hasPermission('controle_qualite_view') || isAdmin;
  const isQualiteQualifSession =
    fonction === 8 || (canSend && !isAdmin && ![2, 3, 12].includes(fonction));

  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    id_destinataire: '',
    nature_remarque: '',
    recherche: '',
    date_debut: today,
    date_fin: today
  });

  const [sendForm, setSendForm] = useState({
    nature_remarque: '',
    id_destinataire: '',
    commentaire: ''
  });

  const { data: agentsData } = useQuery(
    'remarques-agents-list',
    async () => {
      const res = await api.get('/remarques/agents');
      return res.data.data || [];
    },
    { staleTime: 60000 }
  );

  const { data, isLoading, error, refetch } = useQuery(
    ['remarques', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (params[key] === '' || params[key] == null) delete params[key];
      });
      const res = await api.get('/remarques', { params });
      if (res.data?.success) return res.data;
      throw new Error(res.data?.message || 'Erreur');
    },
    {
      onError: (err) => {
        toast.error(err.response?.data?.message || err.message || 'Erreur lors du chargement des remarques');
      }
    }
  );

  const sendMutation = useMutation(
    async (body) => {
      const res = await api.post('/remarques', body);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['remarques']);
        toast.success('Remarque envoyée.');
        setSendForm({ nature_remarque: '', id_destinataire: '', commentaire: '' });
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message)
    }
  );

  const { data: agentsSendData } = useQuery(
    'remarques-agents-send-list',
    async () => {
      const res = await api.get('/remarques/agents', { params: { for_send: 1 } });
      return res.data.data || [];
    },
    { enabled: canSend, staleTime: 60000 }
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSendSubmit = (e) => {
    e.preventDefault();
    if (!sendForm.nature_remarque || !sendForm.id_destinataire) {
      toast.warning('Veuillez sélectionner la nature et le destinataire.');
      return;
    }
    sendMutation.mutate({
      nature_remarque: sendForm.nature_remarque,
      commentaire: sendForm.commentaire || null,
      id_destinataire: parseInt(sendForm.id_destinataire, 10)
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const remarques = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };
  const agents = agentsData || [];
  const agentsSend = agentsSendData || [];

  const listTitle = isQualiteQualifSession
    ? 'Mes remarques envoyées'
    : isReOrRp
      ? 'Remarques adressées aux agents de votre équipe'
      : 'Liste des remarques';

  return (
    <div className="page-remarques">
      <div className="page-header">
        <h1><FaCommentDots /> Remarques</h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters((v) => !v)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {canSend && (
        <form className="remarques-send-form" onSubmit={handleSendSubmit}>
          <h3 className="remarques-send-title">Envoyer une remarque</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Nature <span className="required">*</span></label>
              <select
                value={sendForm.nature_remarque}
                onChange={(e) => setSendForm((f) => ({ ...f, nature_remarque: e.target.value }))}
                required
              >
                <option value="">-- Sélectionner --</option>
                {NATURES_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Destinataire (agent qualification) <span className="required">*</span></label>
              <select
                value={sendForm.id_destinataire}
                onChange={(e) => setSendForm((f) => ({ ...f, id_destinataire: e.target.value }))}
                required
              >
                <option value="">-- Sélectionner --</option>
                {agentsSend.map((a) => (
                  <option key={a.id} value={a.id}>{a.pseudo}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Commentaire</label>
            <textarea
              value={sendForm.commentaire}
              onChange={(e) => setSendForm((f) => ({ ...f, commentaire: e.target.value }))}
              rows={2}
              placeholder="Commentaire ou détail..."
            />
          </div>
          <button type="submit" className="btn-send-remarque" disabled={sendMutation.isLoading}>
            <FaPaperPlane /> {sendMutation.isLoading ? 'Envoi...' : 'Envoyer'}
          </button>
        </form>
      )}

      {showFilters && (
        <div className="search-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Recherche</label>
              <input
                type="text"
                value={filters.recherche}
                onChange={(e) => handleFilterChange('recherche', e.target.value)}
                placeholder="Nature, commentaire, expéditeur, agent..."
              />
            </div>
            {agents.length > 0 && (
              <div className="form-group">
                <label>Agent destinataire</label>
                <select
                  value={filters.id_destinataire}
                  onChange={(e) => handleFilterChange('id_destinataire', e.target.value)}
                >
                  <option value="">Tous les agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.pseudo}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Nature</label>
              <select
                value={filters.nature_remarque}
                onChange={(e) => handleFilterChange('nature_remarque', e.target.value)}
              >
                <option value="">Toutes</option>
                {NATURES_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
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
        <h2 className="list-section-title">{listTitle}</h2>
        {isReOrRp && (
          <p className="remarques-scope-hint">
            Remarques envoyées par la qualité aux agents qualification de votre périmètre.
          </p>
        )}
        {isQualiteQualifSession && (
          <p className="remarques-scope-hint">Affichage de vos remarques envoyées uniquement.</p>
        )}
        <p>
          Total : <strong>{pagination.total}</strong> remarque{pagination.total !== 1 ? 's' : ''}
          {pagination.pages > 1 && (
            <> | Page <strong>{pagination.page}</strong> sur <strong>{pagination.pages}</strong></>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement des remarques...</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement</p>
          <button type="button" className="btn-retry" onClick={() => refetch()}>Réessayer</button>
        </div>
      ) : remarques.length === 0 ? (
        <div className="no-results">Aucune remarque trouvée pour cette période.</div>
      ) : (
        <>
          <div className="remarques-table-container">
            <table className="remarques-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nature</th>
                  <th>Expéditeur</th>
                  <th>Destinataire</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {remarques.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date_remarque)}</td>
                    <td>{r.nature_remarque}</td>
                    <td>{r.expediteur_pseudo || '-'}</td>
                    <td>{r.destinataire_pseudo || '-'}</td>
                    <td className="comment-cell">
                      {r.commentaire
                        ? String(r.commentaire).slice(0, 120) + (r.commentaire.length > 120 ? '…' : '')
                        : '-'}
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
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page <= 1}
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

export default Remarques;
