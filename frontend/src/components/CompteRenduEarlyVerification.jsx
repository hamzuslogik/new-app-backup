import React, { useState } from 'react';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import {
  generateFourDigitCode,
  normalizeFourDigitInput,
} from '../utils/compteRenduEarlyVerification';
import './CompteRenduEarlyVerification.css';

const CompteRenduEarlyVerification = ({ rdvDateTime, onVerified }) => {
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
    <div className="compte-rendu-early-verification" role="group" aria-labelledby="early-cr-verification-title">
      <p id="early-cr-verification-title" className="early-cr-verification-title">
        Compte rendu avant le rendez-vous
      </p>
      <p className="early-cr-verification-message">
        Le rendez-vous est prévu le <strong>{formatRdvDateTime(rdvDateTime)}</strong>.
        Pour accéder aux types de compte rendu, reproduisez le code à 4 chiffres ci-dessous.
      </p>
      <div className="early-cr-code-display" aria-hidden="true">
        {code}
      </div>
      <div className="form-group early-cr-input-group">
        <label htmlFor="early_cr_verification_input">Saisir le code à 4 chiffres :</label>
        <input
          id="early_cr_verification_input"
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
      <div className="early-cr-actions">
        <button type="button" className="btn-confirm early-cr-validate-btn" onClick={handleValidate}>
          Valider
        </button>
      </div>
    </div>
  );
};

export default CompteRenduEarlyVerification;
