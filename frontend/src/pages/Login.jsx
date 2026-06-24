import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { getHomePage } from '../utils/getHomePage';
import api from '../config/api';
import { applyMobileNativeViewport, isTouchMobileDevice } from '../utils/applyForceDesktopViewport';
import './Login.css';

const Login = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [needsBackupCode, setNeedsBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();

  /** iOS / mobile : viewport natif (device-width) */
  useLayoutEffect(() => {
    if (!isTouchMobileDevice()) return undefined;

    document.documentElement.classList.add('login-page');
    document.body.classList.add('login-page');

    applyMobileNativeViewport();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(applyMobileNativeViewport);
    });

    return () => {
      cancelAnimationFrame(id);
      document.documentElement.classList.remove('login-page');
      document.body.classList.remove('login-page');
    };
  }, []);

  useEffect(() => {
    const reason = sessionStorage.getItem('logoutReason');
    if (reason === 'idle') {
      sessionStorage.removeItem('logoutReason');
      toast.info('Session expirée pour inactivité. Veuillez vous reconnecter.');
    }
  }, []);

  const navigateAfterLogin = async () => {
    const savedUser = JSON.parse(localStorage.getItem('user'));

    let fonctionData = null;
    if (savedUser && savedUser.fonction) {
      try {
        const res = await api.get('/management/fonctions');
        fonctionData = res.data.data?.find((f) => f.id === savedUser.fonction) || null;
      } catch (error) {
        console.error('Erreur lors de la récupération de la fonction:', error);
      }
    }

    let agentsSousResponsabilite = [];
    if (
      savedUser &&
      savedUser.fonction !== 3 &&
      savedUser.fonction !== 4 &&
      savedUser.fonction !== 5 &&
      savedUser.fonction !== 12
    ) {
      try {
        const res = await api.get('/management/utilisateurs');
        agentsSousResponsabilite =
          res.data.data?.filter((u) => u.chef_equipe === savedUser.id && u.fonction === 3) || [];
      } catch (error) {
        console.error('Erreur lors de la récupération des agents:', error);
      }
    }

    const homePage = getHomePage(savedUser, fonctionData, agentsSousResponsabilite);
    navigate(homePage);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!login || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (needsBackupCode) {
      const digits = backupCode.replace(/\D/g, '');
      if (digits.length !== 4) {
        toast.error('Le code de secours doit comporter 4 chiffres');
        return;
      }
    }

    setLoading(true);
    const codeToSend = needsBackupCode ? backupCode.replace(/\D/g, '').padStart(4, '0') : null;
    const result = await loginUser(login, password, codeToSend);
    setLoading(false);

    if (result.success) {
      toast.success('Connexion réussie');
      setNeedsBackupCode(false);
      setBackupCode('');
      await navigateAfterLogin();
      return;
    }

    if (result.requiresBackupCode) {
      setNeedsBackupCode(true);
      if (result.code === 'CODE_SECOURS_INVALIDE') {
        toast.error(result.message || 'Code de secours invalide ou déjà utilisé');
      } else {
        toast.warning(
          result.message ||
            'Adresse IP non autorisée. Saisissez un code de secours pour vous connecter.'
        );
      }
      return;
    }

    setNeedsBackupCode(false);
    setBackupCode('');
    toast.error(result.message || 'Erreur de connexion');
  };

  const handleBackupCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setBackupCode(digits);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src="/logo/logo.png" alt="JWS Group Logo" className="login-logo" />
          <h2>ESPACE ADMINISTRATEUR</h2>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="Login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {needsBackupCode && (
            <div className="backup-code-section">
              <p className="backup-code-hint">
                Votre adresse IP n&apos;est pas autorisée pour votre fonction. Entrez un code de
                secours à 4 chiffres (usage unique).
              </p>
              <div className="form-group">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="Code secours (4 chiffres)"
                  value={backupCode}
                  onChange={handleBackupCodeChange}
                  required
                  autoComplete="one-time-code"
                  className="backup-code-input"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading
              ? 'Connexion...'
              : needsBackupCode
                ? 'Valider avec le code secours'
                : "S'identifier"}
          </button>
        </form>
        <div className="login-footer">
          <p>© {new Date().getFullYear()} Yj Developpement. Tous les droits sont réservés</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
