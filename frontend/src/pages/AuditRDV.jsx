import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { FaCalendarCheck, FaSave, FaTimes, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './AuditRDV.css';

const AuditRDV = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [editingComment, setEditingComment] = useState({ hash: null, value: '' });

  const { data, isLoading, error, refetch } = useQuery(
    ['audit-rdv', date],
    async () => {
      const res = await api.get('/fiches/audit-rdv', { params: { date, limit: 200 } });
      if (res.data?.success) return res.data;
      throw new Error(res.data?.message || 'Erreur chargement');
    },
    {
      enabled: !!date,
      onError: (err) => toast.error(err.response?.data?.message || err.message || 'Erreur chargement audit RDV'),
    }
  );

  const updateCommentMutation = useMutation(
    async ({ hash, commentaire_qualite }) => {
      const res = await api.patch(`/fiches/${hash}/field`, {
        field: 'commentaire_qualite',
        value: commentaire_qualite,
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['audit-rdv', date]);
        refetch();
        setEditingComment({ hash: null, value: '' });
        toast.success('Commentaire qualité enregistré');
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Erreur enregistrement'),
    }
  );

  const fiches = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 100, total: 0, pages: 1 };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSaveComment = (hash) => {
    const val = editingComment.hash === hash ? editingComment.value : '';
    updateCommentMutation.mutate({ hash, commentaire_qualite: val });
  };

  const handleKeyDown = (e, hash) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveComment(hash);
    } else if (e.key === 'Escape') {
      setEditingComment({ hash: null, value: '' });
    }
  };

  const allowedFonctions = [4, 13]; // Qualité Confirmation, RP Confirmation
  if (!allowedFonctions.includes(Number(user?.fonction))) {
    return (
      <div className="audit-rdv">
        <div className="audit-rdv-forbidden">
          <h2>Accès réservé</h2>
          <p>Cette page est réservée à la Qualité Confirmation (fonction 4) et au RP Confirmation (fonction 13).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-rdv">
      <div className="page-header">
        <h1><FaCalendarCheck /> Audit Rendez-vous</h1>
      </div>

      <div className="audit-rdv-filters">
        <label htmlFor="audit-date">Journée :</label>
        <input
          id="audit-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="audit-rdv-date-input"
        />
      </div>

      <div className="results-info">
        <p>
          Total : <strong>{pagination.total}</strong> RDV créé(s) le {date}
          {pagination.pages > 1 && (
            <> | Page <strong>{pagination.page}</strong> / <strong>{pagination.pages}</strong></>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement...</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement</p>
          <button onClick={() => refetch()}>Réessayer</button>
        </div>
      ) : fiches.length === 0 ? (
        <div className="no-results">Aucun RDV créé à cette date.</div>
      ) : (
        <div className="audit-rdv-table-wrap">
          <table className="audit-rdv-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone</th>
                <th>CP</th>
                <th>Ville</th>
                <th>Agent</th>
                <th>Centre</th>
                <th>Date création RDV</th>
                <th>Date / Heure RDV</th>
                <th>État</th>
                <th>Commentaire Qualité</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {fiches.map((fiche) => {
                const isEditing = editingComment.hash === fiche.hash;
                const displayVal = isEditing ? editingComment.value : (fiche.commentaire_qualite || '');
                const hasChanges = isEditing && displayVal !== (fiche.commentaire_qualite || '');
                return (
                  <tr key={fiche.hash}>
                    <td>{fiche.nom || '-'}</td>
                    <td>{fiche.prenom || '-'}</td>
                    <td>{fiche.tel || '-'}</td>
                    <td>{fiche.cp || '-'}</td>
                    <td>{fiche.ville || '-'}</td>
                    <td>{fiche.agent_pseudo || '-'}</td>
                    <td>{fiche.centre_nom || '-'}</td>
                    <td>{formatDate(fiche.date_creation_rdv)}</td>
                    <td>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                    <td>{fiche.etat_titre || '-'}</td>
                    <td>
                      <div className="comment-quick-edit-container">
                        {hasChanges && (
                          <div className="comment-quick-actions">
                            <button
                              type="button"
                              className="btn-save-comment-quick"
                              onClick={() => handleSaveComment(fiche.hash)}
                              disabled={updateCommentMutation.isLoading}
                              title="Enregistrer (Ctrl+Enter)"
                            >
                              <FaSave />
                            </button>
                            <button
                              type="button"
                              className="btn-cancel-comment-quick"
                              onClick={() => setEditingComment({ hash: null, value: '' })}
                              title="Annuler"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        )}
                        <textarea
                          value={displayVal}
                          onChange={(e) => {
                            if (!isEditing) setEditingComment({ hash: fiche.hash, value: e.target.value });
                            else setEditingComment({ ...editingComment, value: e.target.value });
                          }}
                          onFocus={() => {
                            if (!isEditing) setEditingComment({ hash: fiche.hash, value: fiche.commentaire_qualite || '' });
                          }}
                          onKeyDown={(e) => handleKeyDown(e, fiche.hash)}
                          className="comment-textarea-quick"
                          placeholder="Commentaire qualité..."
                          rows={2}
                        />
                      </div>
                    </td>
                    <td>
                      <FicheDetailLink ficheHash={fiche.hash} className="btn-detail-icon" title="Voir la fiche">
                        <FaSearch />
                      </FicheDetailLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditRDV;
