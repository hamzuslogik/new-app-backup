import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route accessible uniquement si login === "backoffice" (insensible à la casse).
 */
const BackofficeLoginRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Chargement...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const login = String(user?.login || '').trim().toLowerCase();
  if (login !== 'backoffice') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default BackofficeLoginRoute;
