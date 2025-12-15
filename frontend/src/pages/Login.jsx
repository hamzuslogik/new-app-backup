import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { getHomePage } from '../utils/getHomePage';
import api from '../config/api';
import './Login.css';

const Login = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!login || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    const result = await loginUser(login, password);
    setLoading(false);

    if (result.success) {
      toast.success('Connexion réussie');
      
      // Récupérer l'utilisateur connecté pour déterminer la page d'accueil
      const savedUser = JSON.parse(localStorage.getItem('user'));
      
      // Récupérer les données de la fonction (avec page_accueil)
      let fonctionData = null;
      if (savedUser && savedUser.fonction) {
        try {
          const res = await api.get('/management/fonctions');
          fonctionData = res.data.data?.find(f => f.id === savedUser.fonction) || null;
        } catch (error) {
          console.error('Erreur lors de la récupération de la fonction:', error);
        }
      }
      
      // Pour RE Qualification, vérifier s'il a des agents sous sa responsabilité
      let agentsSousResponsabilite = [];
      if (savedUser && savedUser.fonction !== 3 && savedUser.fonction !== 4 && savedUser.fonction !== 5 && savedUser.fonction !== 12) {
        try {
          const res = await api.get('/management/utilisateurs');
          agentsSousResponsabilite = res.data.data?.filter(u => u.chef_equipe === savedUser.id && u.fonction === 3) || [];
        } catch (error) {
          console.error('Erreur lors de la récupération des agents:', error);
        }
      }
      
      // Déterminer la page d'accueil selon la fonction (avec page_accueil depuis la base de données)
      const homePage = getHomePage(savedUser, fonctionData, agentsSousResponsabilite);
      navigate(homePage);
    } else {
      toast.error(result.message || 'Erreur de connexion');
    }
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
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Connexion...' : "S'identifier"}
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

