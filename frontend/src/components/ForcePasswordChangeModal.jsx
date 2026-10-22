import React, { useState } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import './ForcePasswordChangeModal.css';

function validateNewPassword(value) {
  if (!value || value.length < 6) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Le mot de passe doit contenir au moins une majuscule.';
  }
  if (!/[0-9]/.test(value)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }
  if (value === '1234') {
    return 'Choisissez un mot de passe différent de 1234.';
  }
  return '';
}

const ForcePasswordChangeModal = () => {
  const { user, refreshUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user?.mustChangePassword) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: '1234',
        newPassword,
      });
      if (!res.data?.success) {
        setError(res.data?.message || 'Impossible de modifier le mot de passe.');
        return;
      }
      await refreshUser();
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="force-password-overlay" role="dialog" aria-modal="true" aria-labelledby="force-password-title">
      <form className="force-password-modal" onSubmit={handleSubmit}>
        <h2 id="force-password-title">Changement de mot de passe</h2>
        <p>
          Votre mot de passe est encore le mot de passe par défaut. Choisissez-en un nouveau pour continuer.
        </p>
        <label htmlFor="force-new-password">Nouveau mot de passe</label>
        <input
          id="force-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <label htmlFor="force-confirm-password">Confirmation</label>
        <input
          id="force-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <p className="force-password-hint">Au moins 6 caractères, une majuscule et un chiffre.</p>
        {error ? <p className="force-password-error">{error}</p> : null}
        <div className="force-password-actions">
          <button type="button" className="force-password-logout" onClick={logout} disabled={saving}>
            Se déconnecter
          </button>
          <button type="submit" className="force-password-submit" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForcePasswordChangeModal;
