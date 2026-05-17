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
 * Complétude fiche :
 * - Qualité Confirmation (4) : création uniquement
 * - Tous les confirmateurs (6), RE (14), RP (13) : consultation + bouton « Traité »
 */
const FicheCompletudeSection = ({ ficheHash, enabled, canCreate = false, canTreat = false }) => {
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState('');
  const [completes, setCompletes] = useState('');
  const [showForm, setShowForm] = useState(true);
  const queryKey = ['fiche-completude', ficheHash];

  const { data, isLoading } = useQuery(
    queryKey,
    async () => {
      const res = await api.get(`/fiches/${ficheHash}/completude`);
      return {
        list: res.data.data || [],
        permissions: res.data.permissions || {}
      };
    },
    { enabled: enabled && !!ficheHash }
  );

  const list = data?.list || [];
  const permissions = data?.permissions || {};
  const allowCreate = canCreate && (permissions.can_create !== false);
  /** canTreat côté page (RE/RP/confirmateur) ; permissions API en renfort si présentes */
  const allowTreat =
    Boolean(canTreat) &&
    (permissions.can_treat === undefined || permissions.can_treat === true);

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

  const traiterMutation = useMutation(
    async ({ id }) => {
      const res = await api.patch(`/fiches/${ficheHash}/completude/${id}`, {
        statut: 'traitee'
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        toast.success(data.message || 'Complétude marquée comme traitée');
        queryClient.invalidateQueries(queryKey);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors du traitement');
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

  const showCreateBlock = allowCreate;
  const showList = list.length > 0 || !allowCreate;
  const showEmptyForViewer = !allowCreate && !isLoading && list.length === 0;

  if (showEmptyForViewer) return null;

  return (
    <div className="fiche-section decalage-form fiche-completude-section" style={{ marginTop: '24px' }}>
      <h2 className="section-title">Complétude</h2>

      <div className="decalage-new-form">
        {showCreateBlock && (
          <>
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
                style={{ marginBottom: showList && list.length > 0 ? '16px' : 0 }}
                onClick={() => setShowForm(true)}
              >
                Nouvelle complétude
              </button>
            )}
          </>
        )}

        {isLoading ? (
          <p className="fiche-completude-hint">Chargement des complétudes…</p>
        ) : showList && list.length === 0 && allowCreate ? (
          <p className="fiche-completude-hint">Aucune complétude enregistrée pour cette fiche.</p>
        ) : list.length > 0 ? (
          <div className="fiche-completude-list">
            {list.map((item) => {
              const isPending = item.statut === 'en_attente';
              const statutClass = item.statut ? `fiche-completude-item--${item.statut}` : '';
              const showTreatActions = allowTreat && isPending;
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
                  {showTreatActions && (
                    <div className="form-actions" style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn-confirm"
                        disabled={traiterMutation.isLoading}
                        onClick={() => traiterMutation.mutate({ id: item.id })}
                      >
                        {traiterMutation.isLoading ? 'Traitement…' : 'Traité'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FicheCompletudeSection;
