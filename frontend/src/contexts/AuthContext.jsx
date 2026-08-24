import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../config/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Charger les permissions de l'utilisateur
  const loadPermissions = async () => {
    try {
      const response = await api.get('/permissions/user');
      if (response.data.success) {
        setPermissions(response.data.data || {});
        return response.data.data || {};
      }
    } catch (error) {
      console.error('Erreur lors du chargement des permissions:', error);
      // En cas d'erreur, retourner un objet vide (toutes permissions autorisées par défaut)
      return {};
    }
    return {};
  };

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedPermissions = localStorage.getItem('permissions');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedPermissions) {
        setPermissions(JSON.parse(savedPermissions));
      }
      // Vérifier si le token est toujours valide et charger les permissions
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await api.get('/auth/verify');
      if (response.data.success) {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        // Charger les permissions
        const perms = await loadPermissions();
        setPermissions(perms);
        localStorage.setItem('permissions', JSON.stringify(perms));
      } else {
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (login, password, codeSecours = null) => {
    try {
      const payload = { login, password };
      if (codeSecours != null && String(codeSecours).trim() !== '') {
        payload.code_secours = codeSecours;
      }
      const response = await api.post('/auth/login', payload);
      if (response.data.success) {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        // Charger les permissions après la connexion
        const perms = await loadPermissions();
        setPermissions(perms);
        localStorage.setItem('permissions', JSON.stringify(perms));
        return { success: true };
      }
      return {
        success: false,
        message: response.data.message,
        requiresBackupCode: response.data.requiresBackupCode === true,
        code: response.data.code
      };
    } catch (error) {
      const data = error.response?.data;
      return {
        success: false,
        message: data?.message || 'Erreur de connexion',
        requiresBackupCode: data?.requiresBackupCode === true,
        code: data?.code
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    setUser(null);
    setPermissions({});
  };

  /** Recharge l’utilisateur depuis le serveur (ex. après mise à jour du profil) */
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/verify');
      if (response.data.success && response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        return response.data.user;
      }
    } catch (e) {
      console.error('refreshUser:', e);
    }
    return null;
  };

  // Helper pour vérifier une permission
  const hasPermission = (code) => {
    // Administrateur (1) et Admin technique (7) : accès complet même si la matrice
    // fonction_permissions a été vidée / mal configurée.
    const f = Number(user?.fonction);
    if (f === 1 || f === 7) {
      return true;
    }
    // Si les permissions ne sont pas chargées, autoriser par défaut (rétrocompatibilité)
    if (!permissions || Object.keys(permissions).length === 0) {
      return true;
    }
    return permissions[code] === true;
  };

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    refreshUser,
    hasPermission,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

