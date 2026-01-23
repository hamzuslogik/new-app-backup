import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, permission, excludeFunctions = [] }) => {
  const { isAuthenticated, loading, hasPermission, user } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Vérifier si l'utilisateur a une fonction exclue
  if (excludeFunctions.length > 0 && user?.fonction && excludeFunctions.includes(user.fonction)) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>Accès refusé</h2>
        <p>Cette page n'est pas accessible pour votre rôle.</p>
        <button onClick={() => window.history.back()}>Retour</button>
      </div>
    );
  }

  // Si une permission est requise, vérifier qu'elle est accordée
  // Admin (1, 2, 7) et Backoffice (11) ont accès à toutes les pages de permissions et gestion
  const isAdminOrBackoffice = [1, 2, 7, 11].includes(user?.fonction);
  const isPermissionsOrManagementPage = permission === 'config_permissions' || permission === 'management_view';
  
  if (permission && !hasPermission(permission)) {
    // Autoriser Admin et Backoffice pour les pages Permissions et Management
    if (isAdminOrBackoffice && isPermissionsOrManagementPage) {
      // Autoriser l'accès
    } else {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h2>Accès refusé</h2>
          <p>Vous n'avez pas la permission d'accéder à cette page.</p>
          <button onClick={() => window.history.back()}>Retour</button>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;

