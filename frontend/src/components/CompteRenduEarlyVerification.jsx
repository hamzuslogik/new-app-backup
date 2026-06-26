import React, { useEffect, useMemo, useState } from 'react';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import {
  generateFourDigitCode,
  normalizeFourDigitInput,
} from '../utils/compteRenduEarlyVerification';
import './CompteRenduEarlyVerification.css';

const CompteRenduEarlyVerification = ({ rdvDateTime, onVerifiedChange }) => {
  const [code] = useState(() => generateFourDigitCode());
  const [input, setInput] = useState('');

  const verified = useMemo(
    () => normalizeFourDigitInput(input) === code,
    [input, code]
  );

  useEffect(() => {
    onVerifiedChange?.(verified);
  }, [verified, onVerifiedChange]);

  return (
    <div className="compte-rendu-early-verification" role="group" aria-labelledby="early-cr-verification-title">
      <p id="early-cr-verification-title" className="early-cr-verification-title">
        Compte rendu avant le rendez-vous
      </p>
      <p className="early-cr-verification-message">
        Le rendez-vous est prévu le <strong>{formatRdvDateTime(rdvDateTime)}</strong>.
        Pour rédiger un compte rendu avant cette date et heure, reproduisez le code à 4 chiffres
        ci-dessous.
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
          placeholder="0000"
          value={input}
          onChange={(e) => setInput(normalizeFourDigitInput(e.target.value))}
        />
      </div>
      {verified ? (
        <p className="early-cr-verification-success">Code validé — vous pouvez rédiger le compte rendu.</p>
      ) : (
        <p className="early-cr-verification-hint">Le champ compte rendu sera débloqué une fois le code saisi.</p>
      )}
    </div>
  );
};

export default CompteRenduEarlyVerification;
