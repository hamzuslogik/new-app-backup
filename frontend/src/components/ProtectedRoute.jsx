import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getNavUser,
  getRestrictedBackofficeHomePath,
  isBackofficeNavAsRpQualif,
  isPathAllowedForRestrictedBackofficeNav,
} from '../utils/backofficeNavRestriction';

const ProtectedRoute = ({ children, permission, excludeFunctions = [], allowFunctions = [], customCheck }) => {
  const { isAuthenticated, loading, hasPermission, user } = useAuth();
  const location = useLocation();

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

  // Backoffice restreint (4180) : uniquement les pages du menu RP Qualification
  if (
    isBackofficeNavAsRpQualif(user) &&
    !isPathAllowedForRestrictedBackofficeNav(location.pathname)
  ) {
    return <Navigate to={getRestrictedBackofficeHomePath()} replace />;
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
  // Admin (1, 7) et Backoffice (11) ont accès aux pages permissions/gestion ; Superviseur qualification (2) uniquement si permission accordée
  const isAdminOrBackoffice = [1, 7, 11].includes(user?.fonction);
  const isPermissionsOrManagementPage = permission === 'config_permissions' || permission === 'management_view';
  // allowFunctions : pour le backoffice restreint, évaluer comme RP Qualif (12) sur les pages autorisées
  const fonctionForAllow = Number(getNavUser(user)?.fonction ?? user?.fonction);
  const isAllowedByFunction = allowFunctions.length > 0 && allowFunctions.includes(fonctionForAllow);

  if (typeof customCheck === 'function' && !customCheck(null, getNavUser(user))) {
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
    // (sauf backoffice nav restreinte : pas d'accès hors allowlist, déjà filtré plus haut)
    if (isAdminOrBackoffice && isPermissionsOrManagementPage && !isBackofficeNavAsRpQualif(user)) {
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

