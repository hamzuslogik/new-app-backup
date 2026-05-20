import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { FaTimes, FaRoute, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './TrackingModal.css';

const TrackingModal = ({ compteRenduId, onClose }) => {
  const queryClient = useQueryClient();
  const [rappelClient, setRappelClient] = useState(false);
  const [commentaireClient, setCommentaireClient] = useState('');
  const [constat, setConstat] = useState('');

  const { data, isLoading, error } = useQuery(
    ['tracking-context', compteRenduId],
    async () => {
      const res = await api.get(`/tracking/context/compte-rendu/${compteRenduId}`);
      if (!res.data?.success) throw new Error(res.data?.message || 'Erreur');
      return res.data.data;
    },
    { enabled: !!compteRenduId }
  );

  useEffect(() => {
    if (!data) return;
    const t = data.tracking;
    if (t) {
      setRappelClient(!!t.rappel_client);
      setCommentaireClient(t.commentaire_client || '');
      setConstat(t.constat || '');
    } else {
      setRappelClient(false);
      setCommentaireClient('');
      setConstat('');
    }
  }, [data]);

  const saveMutation = useMutation(
    async (body) => {
      const res = await api.put(`/tracking/compte-rendu/${compteRenduId}`, body);
      return res.data;
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries(['tracking-context', compteRenduId]);
        queryClient.invalidateQueries(['tracking-list']);
        toast.success(res?.message || 'Tracking enregistré');
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || err.message || 'Erreur');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      rappel_client: rappelClient,
      commentaire_client: commentaireClient,
      constat,
    });
  };

  const fiche = data?.fiche;
  const cr = data?.compte_rendu;
  const isEdit = !!data?.tracking;

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

  return (
    <div className="modal-overlay tracking-modal-overlay" onClick={onClose}>
      <div className="modal-content tracking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tracking-modal-header">
          <h2>
            <FaRoute /> Tracking RDV {isEdit ? '(modification)' : '(création)'}
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            <FaTimes />
          </button>
        </div>

        {isLoading ? (
          <p className="tracking-modal-loading">Chargement…</p>
        ) : error ? (
          <p className="tracking-modal-error">Impossible de charger les données.</p>
        ) : (
          <>
            <div className="tracking-readonly-block">
              <h3>Identité client</h3>
              <p>
                <strong>{fiche?.nom || '—'} {fiche?.prenom || ''}</strong>
                <br />
                Tél. {fiche?.tel || '—'}
                {fiche?.cp ? ` · ${fiche.cp} ${fiche.ville || ''}` : ''}
              </p>
              <p>
                <span className="tracking-label">Date RDV :</span> {formatDate(fiche?.date_rdv_time)}
              </p>
            </div>

            <div className="tracking-readonly-grid">
              <div>
                <span className="tracking-label">Commercial</span>
                <p>{cr?.commercial_pseudo || '—'}</p>
              </div>
              <div>
                <span className="tracking-label">Confirmateur</span>
                <p>{fiche?.confirmateur_pseudo || '—'}</p>
              </div>
              <div>
                <span className="tracking-label">État actuel</span>
                <p>{fiche?.etat_titre || '—'}{fiche?.sous_etat_titre ? ` / ${fiche.sous_etat_titre}` : ''}</p>
              </div>
            </div>

            <div className="tracking-readonly-block">
              <span className="tracking-label">Compte rendu (commentaire commercial)</span>
              <p className="tracking-cr-comment">{cr?.commentaire?.trim() || '—'}</p>
            </div>

            <form className="tracking-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Rappel client</label>
                <div className="tracking-rappel-options">
                  <label>
                    <input
                      type="radio"
                      name="rappel_client"
                      checked={!rappelClient}
                      onChange={() => setRappelClient(false)}
                    />
                    Non
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="rappel_client"
                      checked={rappelClient}
                      onChange={() => setRappelClient(true)}
                    />
                    Oui
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="tracking-commentaire-client">Commentaire client</label>
                <textarea
                  id="tracking-commentaire-client"
                  rows={3}
                  value={commentaireClient}
                  onChange={(e) => setCommentaireClient(e.target.value)}
                  placeholder="Saisir le commentaire client…"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tracking-constat">Constat</label>
                <textarea
                  id="tracking-constat"
                  rows={4}
                  value={constat}
                  onChange={(e) => setConstat(e.target.value)}
                  placeholder="Saisir le constat…"
                />
              </div>
              <div className="tracking-form-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Annuler
                </button>
                <button type="submit" className="btn-save" disabled={saveMutation.isLoading}>
                  <FaSave /> {saveMutation.isLoading ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le tracking'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default TrackingModal;
