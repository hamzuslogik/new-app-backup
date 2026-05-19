import React from 'react';
import { createPortal } from 'react-dom';
import { FaBan, FaTimes } from 'react-icons/fa';
import { KO_MOTIFS } from '../constants/koMotifs';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './KoMotifModal.css';

/**
 * Modal de passage en KO : motif obligatoire (liste statique), commentaire complémentaire optionnel.
 */
const KoMotifModal = ({
  isOpen,
  title = 'Mettre en KO',
  submitLabel = 'Valider KO',
  isLoading = false,
  motifKo = '',
  commentaireComplement = '',
  onMotifChange,
  onCommentaireChange,
  onSubmit,
  onClose,
}) => {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay ko-motif-modal-overlay" onClick={onClose}>
      <div className="modal-content ko-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaBan /> {title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="modal-body">
          <p className="ko-modal-hint">
            Le motif est enregistré dans le commentaire qualité de la fiche. Le passage en KO active{' '}
            <strong>ko = 1</strong> (ce n&apos;est pas un changement d&apos;état final).
          </p>
          <div className="form-group">
            <label>Motif KO <span className="required">*</span></label>
            <select
              value={motifKo}
              onChange={(e) => onMotifChange(e.target.value)}
              className="ko-motif-select"
              required
            >
              <option value="">-- Sélectionner un motif --</option>
              {KO_MOTIFS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Commentaire complémentaire (optionnel)</label>
            <textarea
              value={commentaireComplement}
              onChange={(e) => onCommentaireChange(e.target.value)}
              className="ko-commentaire-textarea"
              placeholder="Précisions éventuelles…"
              rows={3}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-confirm-ko"
            onClick={onSubmit}
            disabled={isLoading || !motifKo}
          >
            {isLoading ? 'Enregistrement…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default KoMotifModal;
