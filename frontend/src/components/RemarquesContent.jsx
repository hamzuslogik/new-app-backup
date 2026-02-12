import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCommentDots, FaFilter, FaTimes, FaPaperPlane } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './RemarquesContent.css';

const NATURES_OPTIONS = [
  'Discours non conforme',
  'Traitement',
  'Fausse information',
  'Coordonnées',
  'Autres'
];

const RemarquesContent = ({ inModal = false, onClose }) => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const fonction = Number(user?.fonction);
  const isAdmin = [1, 2, 7].includes(fonction);
  const canSend = hasPermission('controle_qualite_view') || isAdmin;

  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    id_destinataire: '',
    id_expediteur: '',
    date_debut: '',
    date_fin: ''
  });
  const [showFilters, setShowFilters] = useState(!inModal);
  const [form, setForm] = useState({
    nature_remarque: '',
    id_destinataire: '',
    commentaire: ''
  });

  const { data: agentsData } = useQuery(
    'alertes-agents-list',
    async () => {
      const res = await api.get('/alertes/agents');
      return res.data.data || [];
    },
    { enabled: canSend, staleTime: 60000 }
  );

  const { data: listData, isLoading, refetch } = useQuery(
    ['remarques', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] == null) delete params[k];
      });
      const res = await api.get('/remarques', { params });
      if (res.data?.success) return res.data;
      throw new Error(res.data?.message || 'Erreur');
    },
    { onError: (err) => toast.error(err.response?.data?.message || err.message) }
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
        setForm({ nature_remarque: '', id_destinataire: '', commentaire: '' });
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message)
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nature_remarque || !form.id_destinataire) {
      toast.warning('Veuillez sélectionner la nature et le destinataire.');
      return;
    }
    sendMutation.mutate({
      nature_remarque: form.nature_remarque,
      commentaire: form.commentaire || null,
      id_destinataire: parseInt(form.id_destinataire, 10)
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

  const remarques = listData?.data || [];
  const pagination = listData?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };
  const agents = agentsData || [];

  return (
    <div className={`remarques-content ${inModal ? 'remarques-content--modal' : ''}`}>
      {inModal && onClose && (
        <div className="remarques-modal-header">
          <h3><FaCommentDots /> Remarques</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><FaTimes /></button>
        </div>
      )}

      {canSend && (
        <form className="remarques-form" onSubmit={handleSubmit}>
          <div className="remarques-form-grid">
            <div className="form-group">
              <label>Nature de la remarque <span className="required">*</span></label>
              <select
                value={form.nature_remarque}
                onChange={(e) => setForm((f) => ({ ...f, nature_remarque: e.target.value }))}
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
                value={form.id_destinataire}
                onChange={(e) => setForm((f) => ({ ...f, id_destinataire: e.target.value }))}
                required
              >
                <option value="">-- Sélectionner --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.pseudo}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Commentaire</label>
            <textarea
              value={form.commentaire}
              onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
              rows={3}
              placeholder="Commentaire ou détail de la remarque..."
            />
          </div>
          <button type="submit" className="btn-send-remarque" disabled={sendMutation.isLoading}>
            <FaPaperPlane /> {sendMutation.isLoading ? 'Envoi...' : 'Envoyer la remarque'}
          </button>
        </form>
      )}

      <div className="remarques-list-section">
        <div className="remarques-list-header">
          <h4>Liste des remarques</h4>
          {canSend && (
            <button
              type="button"
              className="filter-toggle-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
            </button>
          )}
        </div>

        {canSend && showFilters && (
          <div className="remarques-filters">
            <div className="form-grid">
              <div className="form-group">
                <label>Destinataire</label>
                <select
                  value={filters.id_destinataire}
                  onChange={(e) => handleFilterChange('id_destinataire', e.target.value)}
                >
                  <option value="">Tous</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.pseudo}</option>
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

        {isLoading ? (
          <div className="remarques-loading">Chargement des remarques...</div>
        ) : remarques.length === 0 ? (
          <div className="remarques-empty">Aucune remarque.</div>
        ) : (
          <>
            <div className="remarques-table-wrap">
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
                      <td className="comment-cell">{r.commentaire ? String(r.commentaire).slice(0, 120) + (r.commentaire.length > 120 ? '…' : '') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="remarques-pagination">
                <button
                  type="button"
                  onClick={() => handleFilterChange('page', pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Précédent
                </button>
                <span>Page {pagination.page} sur {pagination.pages} (Total : {pagination.total})</span>
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
    </div>
  );
};

export default RemarquesContent;
