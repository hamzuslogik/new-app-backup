import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../config/api';

const STATUT_LABELS = {
  en_attente: 'En attente',
  traitee: 'Traitée',
  non_traitee: 'Non traitée'
};

/**
 * Section Complétude — modal détail fiche, Qualité Confirmation (fonction 4) uniquement.
 * Même rendu visuel que la section « Demande de décalage » (.decalage-form).
 */
const FicheCompletudeSection = ({ ficheHash, enabled }) => {
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState('');
  const [completes, setCompletes] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [reponseById, setReponseById] = useState({});

  const queryKey = ['fiche-completude', ficheHash];

  const { data: list = [], isLoading } = useQuery(
    queryKey,
    async () => {
      const res = await api.get(`/fiches/${ficheHash}/completude`);
      return res.data.data || [];
    },
    { enabled: enabled && !!ficheHash }
  );

  const createMutation = useMutation(
    async (payload) => {
      const res = await api.post(`/fiches/${ficheHash}/completude`, payload);
      return res.data;
    },
    {
      onSuccess: () => {
        toast.success('Complétude créée');
        setMotif('');
        setCompletes('');
        setShowForm(false);
        queryClient.invalidateQueries(queryKey);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors de la création');
      }
    }
  );

  const statutMutation = useMutation(
    async ({ id, statut, reponse_traitement }) => {
      const res = await api.patch(`/fiches/${ficheHash}/completude/${id}`, {
        statut,
        reponse_traitement
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        toast.success(data.message || 'Statut mis à jour');
        queryClient.invalidateQueries(queryKey);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
      }
    }
  );

  const handleCreate = (e) => {
    e.preventDefault();
    createMutation.mutate({ motif: motif.trim(), completes: completes.trim() });
  };

  const handleCancelForm = () => {
    setMotif('');
    setCompletes('');
    setShowForm(false);
  };

  if (!enabled) return null;

  return (
    <div className="fiche-section decalage-form fiche-completude-section" style={{ marginTop: '24px' }}>
      <h2 className="section-title">Complétude</h2>

      <div className="decalage-new-form">
        {showForm ? (
          <form className="fiche-completude-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="completude-motif">Motif</label>
              <input
                id="completude-motif"
                type="text"
                className="form-control"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Motif de la demande de complétude"
                maxLength={500}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="completude-completes">Complétudes</label>
              <textarea
                id="completude-completes"
                className="form-control"
                rows={4}
                value={completes}
                onChange={(e) => setCompletes(e.target.value)}
                placeholder="Détail des éléments à compléter"
                required
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn-confirm"
                disabled={createMutation.isLoading}
              >
                {createMutation.isLoading ? 'Création…' : 'Créer'}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCancelForm}
                disabled={createMutation.isLoading}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-confirm"
            style={{ marginBottom: '16px' }}
            onClick={() => setShowForm(true)}
          >
            Nouvelle complétude
          </button>
        )}

        {isLoading ? (
          <p className="fiche-completude-hint">Chargement des complétudes…</p>
        ) : list.length === 0 ? (
          <p className="fiche-completude-hint">Aucune complétude enregistrée pour cette fiche.</p>
        ) : (
          <div className="fiche-completude-list">
            {list.map((item) => {
              const isPending = item.statut === 'en_attente';
              const statutClass = item.statut ? `fiche-completude-item--${item.statut}` : '';
              return (
                <div
                  key={item.id}
                  className={`decalage-existing-item fiche-completude-item ${statutClass}`.trim()}
                >
                  <div className="fiche-completude-item-header">
                    <strong className={`fiche-completude-statut fiche-completude-statut--${item.statut || 'en_attente'}`}>
                      {STATUT_LABELS[item.statut] || STATUT_LABELS.en_attente}
                    </strong>
                    <span className="fiche-completude-meta">
                      {item.date_creation
                        ? new Date(item.date_creation).toLocaleString('fr-FR')
                        : ''}
                      {item.created_by_pseudo ? ` — ${item.created_by_pseudo}` : ''}
                    </span>
                  </div>
                  <p className="fiche-completude-line">
                    <strong>Motif :</strong> {item.motif}
                  </p>
                  <p className="fiche-completude-line fiche-completude-line--multiline">
                    <strong>Complétudes :</strong> {item.completes}
                  </p>
                  {item.reponse_traitement && (
                    <p className="fiche-completude-line fiche-completude-line--multiline">
                      <strong>Réponse :</strong> {item.reponse_traitement}
                      {item.traite_par_pseudo ? ` (${item.traite_par_pseudo})` : ''}
                    </p>
                  )}
                  {isPending && (
                    <>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Réponse optionnelle au traitement"
                        value={reponseById[item.id] || ''}
                        onChange={(e) =>
                          setReponseById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        style={{ marginBottom: '8px' }}
                      />
                      <div className="form-actions" style={{ marginTop: 0 }}>
                        <button
                          type="button"
                          className="btn-confirm"
                          disabled={statutMutation.isLoading}
                          onClick={() =>
                            statutMutation.mutate({
                              id: item.id,
                              statut: 'traitee',
                              reponse_traitement: reponseById[item.id] || ''
                            })
                          }
                        >
                          Traitée
                        </button>
                        <button
                          type="button"
                          className="btn-cancel"
                          disabled={statutMutation.isLoading}
                          onClick={() =>
                            statutMutation.mutate({
                              id: item.id,
                              statut: 'non_traitee',
                              reponse_traitement: reponseById[item.id] || ''
                            })
                          }
                        >
                          Non traitée
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FicheCompletudeSection;
