import React, { useState, useEffect } from 'react';
import api from '../config/api';
import './MonProfil.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const MonProfil = () => {
  useForceDesktopViewport('mon-profil-page');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data.success && res.data.data) {
          setProfile(res.data.data);
        } else {
          setError('Impossible de charger le profil');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordMessage({ type: '', text: '' });
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage({ type: 'error', text: 'Veuillez remplir le mot de passe actuel et le nouveau mot de passe.' });
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      setPasswordMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Le nouveau mot de passe et la confirmation ne correspondent pas.' });
      return;
    }
    setPasswordSubmitting(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      if (res.data.success) {
        setPasswordMessage({ type: 'success', text: 'Mot de passe modifié avec succès.' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMessage({ type: 'error', text: res.data.message || 'Erreur lors du changement.' });
      }
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.message || 'Erreur lors du changement de mot de passe.'
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mon-profil-page">
        <div className="mon-profil-loading">Chargement du profil...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mon-profil-page">
        <div className="mon-profil-error">{error}</div>
      </div>
    );
  }

  const displayValue = (v) => (v != null && v !== '' ? v : '—');

  return (
    <div className="mon-profil-page">
      <h1 className="mon-profil-title">Mon profil</h1>

      <section className="mon-profil-section mon-profil-info">
        <h2>Informations personnelles</h2>
        <div className="mon-profil-grid">
          <div className="mon-profil-field">
            <label>Login</label>
            <span>{displayValue(profile?.login)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Pseudo</label>
            <span>{displayValue(profile?.pseudo)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Nom</label>
            <span>{displayValue(profile?.nom)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Prénom</label>
            <span>{displayValue(profile?.prenom)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Fonction</label>
            <span>{displayValue(profile?.fonction_titre)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Centre</label>
            <span>{displayValue(profile?.centre_titre)}</span>
          </div>
          <div className="mon-profil-field">
            <label>E-mail</label>
            <span>{displayValue(profile?.mail)}</span>
          </div>
          <div className="mon-profil-field">
            <label>Téléphone</label>
            <span>{displayValue(profile?.tel)}</span>
          </div>
        </div>
      </section>

      <section className="mon-profil-section mon-profil-password">
        <h2>Changer le mot de passe</h2>
        <form onSubmit={handleSubmitPassword} className="mon-profil-password-form">
          <div className="mon-profil-field">
            <label htmlFor="currentPassword">Mot de passe actuel</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              autoComplete="current-password"
              disabled={passwordSubmitting}
            />
          </div>
          <div className="mon-profil-field">
            <label htmlFor="newPassword">Nouveau mot de passe</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              disabled={passwordSubmitting}
            />
          </div>
          <div className="mon-profil-field">
            <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              disabled={passwordSubmitting}
            />
          </div>
          {passwordMessage.text && (
            <div className={`mon-profil-message mon-profil-message--${passwordMessage.type}`}>
              {passwordMessage.text}
            </div>
          )}
          <button type="submit" className="mon-profil-btn-submit" disabled={passwordSubmitting}>
            {passwordSubmitting ? 'Modification…' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default MonProfil;
