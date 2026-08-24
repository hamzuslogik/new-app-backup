import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, permission, excludeFunctions = [], allowFunctions = [], customCheck }) => {
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

  const userFonction = user?.fonction != null ? Number(user.fonction) : null;

  // Vérifier si l'utilisateur a une fonction exclue
  if (excludeFunctions.length > 0 && userFonction != null && excludeFunctions.map(Number).includes(userFonction)) {
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
  // Admin (1, 7) et Backoffice (11) ont accès aux pages permissions/gestion ; Superviseur qualification (2) uniquement si permission accordée
  const isAdminOrBackoffice = [1, 7, 11].includes(userFonction);
  const isPermissionsOrManagementPage = permission === 'config_permissions' || permission === 'management_view';
  // allowFunctions : accès direct pour certains rôles (ex. Mes rappels pour Confirmateur 6, RE Confirmation 14, RP Confirmation 13)
  const isAllowedByFunction = allowFunctions.length > 0 && userFonction != null && allowFunctions.map(Number).includes(userFonction);

  if (typeof customCheck === 'function' && !customCheck(null, user)) {
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
        <p>Cette page n'est pas accessible pour votre compte.</p>
        <button onClick={() => window.history.back()}>Retour</button>
      </div>
    );
  }

  // Page réservée à certaines fonctions uniquement (sans permission) : ex. Mon profil
  if (!permission && allowFunctions.length > 0 && !customCheck && !isAllowedByFunction) {
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

  if (permission && !hasPermission(permission) && !isAllowedByFunction) {
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

