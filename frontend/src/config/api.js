import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Créer une instance axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de réponse
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401) {
      if (code === 'SESSION_IDLE_EXPIRED') {
        sessionStorage.setItem('logoutReason', 'idle');
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      window.location.href = '/login';
    } else if (status === 403 && code === 'IP_NON_AUTORISEE') {
      // Session encore valide mais IP hors liste (changement réseau / VPN) — forcer reconnexion
      sessionStorage.setItem('logoutReason', 'ip');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

