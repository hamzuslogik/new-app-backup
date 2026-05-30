import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { FaClipboardCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../config/api';
import { isFicheAuditeeQualiteConfirmation } from '../utils/qualiteConfirmationAudit';
import './QualiteConfirmationAudit.css';

export function QualiteConfirmationAuditButton({ fiche, onClick, className = '' }) {
  const auditee = isFicheAuditeeQualiteConfirmation(fiche);
  return (
    <button
      type="button"
      className={`btn-audit-rdv ${className}`.trim()}
      onClick={onClick}
      title={auditee ? "Modifier l'audit" : 'Auditer ce RDV'}
    >
      <FaClipboardCheck /> Audit
    </button>
  );
}

export function QualiteConfirmationAuditModal({
  fiche,
  onClose,
  invalidateQueryKeys = [['fiches']],
}) {
  const queryClient = useQueryClient();
  const [observation, setObservation] = useState('');

  useEffect(() => {
    setObservation(fiche?.observation_qualite || '');
  }, [fiche]);

  const saveObservationMutation = useMutation(
    async ({ hash, observation_qualite }) => {
      const res = await api.patch(`/fiches/${hash}/field`, {
        field: 'observation_qualite',
        value: observation_qualite,
      });
      return res.data;
    },
    {
      onSuccess: async () => {
        await Promise.all(
          invalidateQueryKeys.map((key) => queryClient.invalidateQueries(key))
        );
        onClose();
        toast.success('Observation enregistrée — fiche auditée');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
      },
    }
  );

  const handleClose = () => {
    if (saveObservationMutation.isLoading) return;
    onClose();
  };

  const handleSubmit = () => {
    const hash = fiche?.hash || fiche?.id;
    if (!hash) {
      toast.error('Fiche introuvable');
      return;
    }
    saveObservationMutation.mutate({
      hash,
      observation_qualite: observation.trim(),
    });
  };

  if (!fiche) return null;

  return (
    <div
      className="qualite-confirmation-audit-modal-overlay"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="qualite-confirmation-audit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="qualite-confirmation-audit-modal-title"
      >
        <h3 id="qualite-confirmation-audit-modal-title">Audit RDV</h3>
        <p className="qualite-confirmation-audit-modal-subtitle">
          {fiche.nom} {fiche.prenom} — {fiche.tel || '—'}
        </p>
        <label htmlFor="qualite-confirmation-audit-observation">Observation</label>
        <textarea
          id="qualite-confirmation-audit-observation"
          rows={5}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Saisir votre observation d'audit..."
        />
        <div className="qualite-confirmation-audit-modal-actions">
          <button
            type="button"
            className="btn-audit-cancel"
            onClick={handleClose}
            disabled={saveObservationMutation.isLoading}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-audit-save"
            onClick={handleSubmit}
            disabled={saveObservationMutation.isLoading || !observation.trim()}
          >
            {saveObservationMutation.isLoading ? 'Enregistrement…' : "Enregistrer l'audit"}
          </button>
        </div>
      </div>
    </div>
  );
}
