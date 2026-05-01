import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import './MonProfil.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const emptyProfileForm = () => ({
  pseudo: '',
  nom: '',
  prenom: '',
  mail: '',
  tel: '',
  genre: ''
});

const MonProfil = () => {
  useForceDesktopViewport('mon-profil-page');
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

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

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      pseudo: profile.pseudo ?? '',
      nom: profile.nom ?? '',
      prenom: profile.prenom ?? '',
      mail: profile.mail ?? '',
      tel: profile.tel ?? '',
      genre:
        profile.genre != null && profile.genre !== ''
          ? String(profile.genre)
          : ''
    });
  }, [profile]);

  const handleProfileFieldChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    setProfileMessage({ type: '', text: '' });
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });
    const pseudo = profileForm.pseudo.trim();
    if (!pseudo) {
      setProfileMessage({ type: 'error', text: 'Le pseudo est obligatoire.' });
      return;
    }
    setProfileSubmitting(true);
    try {
      const payload = {
        pseudo,
        nom: profileForm.nom.trim() || null,
        prenom: profileForm.prenom.trim() || null,
        mail: profileForm.mail.trim() || null,
        tel: profileForm.tel.trim() || null,
        genre: profileForm.genre === '' ? null : parseInt(profileForm.genre, 10)
      };
      const res = await api.put('/auth/me', payload);
      if (res.data.success && res.data.data) {
        setProfile(res.data.data);
        setProfileMessage({ type: 'success', text: res.data.message || 'Informations enregistrées.' });
        await refreshUser();
      } else {
        setProfileMessage({ type: 'error', text: res.data.message || 'Erreur lors de l’enregistrement.' });
      }
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: err.response?.data?.message || 'Erreur lors de la mise à jour du profil.'
      });
    } finally {
      setProfileSubmitting(false);
    }
  };

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
        <p className="mon-profil-help">
          Modifiez vos coordonnées ci-dessous. Le login, la fonction et le centre sont gérés par l’administration.
        </p>

        <div className="mon-profil-readonly-block">
          <div className="mon-profil-grid">
            <div className="mon-profil-field">
              <label>Login</label>
              <span>{displayValue(profile?.login)}</span>
            </div>
            <div className="mon-profil-field">
              <label>Fonction</label>
              <span>{displayValue(profile?.fonction_titre)}</span>
            </div>
            <div className="mon-profil-field">
              <label>Centre</label>
              <span>{displayValue(profile?.centre_titre)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitProfile} className="mon-profil-info-form">
          <div className="mon-profil-grid">
            <div className="mon-profil-field">
              <label htmlFor="pseudo">Pseudo *</label>
              <input
                id="pseudo"
                name="pseudo"
                value={profileForm.pseudo}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
                autoComplete="nickname"
              />
            </div>
            <div className="mon-profil-field">
              <label htmlFor="nom">Nom</label>
              <input
                id="nom"
                name="nom"
                value={profileForm.nom}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
                autoComplete="family-name"
              />
            </div>
            <div className="mon-profil-field">
              <label htmlFor="prenom">Prénom</label>
              <input
                id="prenom"
                name="prenom"
                value={profileForm.prenom}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
                autoComplete="given-name"
              />
            </div>
            <div className="mon-profil-field">
              <label htmlFor="mail">E-mail</label>
              <input
                id="mail"
                name="mail"
                type="email"
                value={profileForm.mail}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
                autoComplete="email"
              />
            </div>
            <div className="mon-profil-field">
              <label htmlFor="tel">Téléphone</label>
              <input
                id="tel"
                name="tel"
                type="tel"
                value={profileForm.tel}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
                autoComplete="tel"
              />
            </div>
            <div className="mon-profil-field">
              <label htmlFor="genre">Genre</label>
              <select
                id="genre"
                name="genre"
                value={profileForm.genre}
                onChange={handleProfileFieldChange}
                disabled={profileSubmitting}
              >
                <option value="">—</option>
                <option value="1">Femme</option>
                <option value="2">Homme</option>
              </select>
            </div>
          </div>
          {profileMessage.text && (
            <div className={`mon-profil-message mon-profil-message--${profileMessage.type}`}>
              {profileMessage.text}
            </div>
          )}
          <button type="submit" className="mon-profil-btn-submit" disabled={profileSubmitting}>
            {profileSubmitting ? 'Enregistrement…' : 'Enregistrer les informations'}
          </button>
        </form>
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
