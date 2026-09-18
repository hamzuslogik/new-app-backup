import React, { useState } from 'react';
import {
  generateFourDigitCode,
  normalizeFourDigitInput,
} from '../utils/compteRenduEarlyVerification';
import './CompteRenduEarlyVerification.css';
import './CodeVerificationModal.css';

const CodeVerificationModal = ({
  title,
  message,
  confirmLabel = 'Valider',
  cancelLabel = 'Annuler',
  onVerified,
  onCancel,
}) => {
  const [code] = useState(() => generateFourDigitCode());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleValidate = () => {
    const normalized = normalizeFourDigitInput(input);
    if (normalized.length !== 4) {
      setError('Veuillez saisir les 4 chiffres du code.');
      return;
    }
    if (normalized !== code) {
      setError('Code incorrect. Veuillez réessayer.');
      return;
    }
    setError('');
    onVerified?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidate();
    }
  };

  return (
    <div className="code-verification-modal-overlay" role="dialog" aria-modal="true">
      <div className="code-verification-modal-content">
        <div className="compte-rendu-early-verification" role="group" aria-labelledby="code-verification-title">
          <p id="code-verification-title" className="early-cr-verification-title">
            {title}
          </p>
          <p className="early-cr-verification-message">{message}</p>
          <div className="early-cr-code-display" aria-hidden="true">
            {code}
          </div>
          <div className="form-group early-cr-input-group">
            <label htmlFor="slot_code_verification_input">Saisir le code à 4 chiffres :</label>
            <input
              id="slot_code_verification_input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className="form-control early-cr-code-input"
              value={input}
              onChange={(e) => {
                setInput(normalizeFourDigitInput(e.target.value));
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          {error && <p className="early-cr-verification-error">{error}</p>}
          <div className="early-cr-actions code-verification-modal-actions">
            {onCancel && (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                {cancelLabel}
              </button>
            )}
            <button type="button" className="btn-confirm early-cr-validate-btn" onClick={handleValidate}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeVerificationModal;
