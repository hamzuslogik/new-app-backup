import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import GlobalKeyboardShortcuts from './common/GlobalKeyboardShortcuts';
import { FicheDetailModalProvider } from '../contexts/FicheDetailModalContext';
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext';
import { FORCE_DESKTOP_VIEWPORT } from '../config/viewport';
import { isMobileNativeExtranetPage } from '../utils/applyForceDesktopViewport';
import { useAuth } from '../contexts/AuthContext';
import { usesTopNavLayout } from '../utils/adminMenuUrls';
import {
  getRestrictedBackofficeHomePath,
  isBackofficeNavAsRpQualif,
  isPathAllowedForRestrictedBackofficeNav,
} from '../utils/backofficeNavRestriction';
import api from '../config/api';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import './Layout.css';

const LayoutContent = () => {
  const { sidebarCollapsed, isMobile, isTablet, closeSidebar, mobileExtranetActive } = useSidebar();
  const { user } = useAuth();
  const topNavLayout = usesTopNavLayout(user);
  const location = useLocation();

  React.useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (topNavLayout) {
      root.classList.add('admin-topnav');
      body.classList.add('admin-topnav');
    } else {
      root.classList.remove('admin-topnav');
      body.classList.remove('admin-topnav');
    }
    return () => {
      root.classList.remove('admin-topnav');
      body.classList.remove('admin-topnav');
    };
  }, [topNavLayout]);
  const extranetMobile = mobileExtranetActive || isMobileNativeExtranetPage();
  const useMobileSidebar = !FORCE_DESKTOP_VIEWPORT || extranetMobile;
  const mobileLayout = extranetMobile || isMobile || isTablet;
  const overlayRef = React.useRef(null);
  const [overlayReady, setOverlayReady] = React.useState(false);
  const prevPathnameRef = React.useRef(location.pathname);
  const isInitialMountRef = React.useRef(true);
  const lastLoggedPathRef = React.useRef('');

  // Journal d’activité : chaque changement de page → user_activity.detail + activity_events
  React.useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`;
    if (!path || path === lastLoggedPathRef.current) return;
    const t = setTimeout(() => {
      // Dédupe si l’effet se rejoue avant la fin du délai (Strict Mode / search inchangé)
      if (path === lastLoggedPathRef.current) return;
      lastLoggedPathRef.current = path;
      api
        .post('/user-activity/log', {
          nature: 'navigation',
          detail: { path }
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [location.pathname, location.search]);

  // Fermer automatiquement la sidebar sur mobile/tablet lors du changement de page
  React.useEffect(() => {
    // Ignorer le montage initial
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPathnameRef.current = location.pathname;
      return;
    }

    // Ne fermer que si le pathname a réellement changé et qu'on est sur mobile/tablet
    if (
      useMobileSidebar &&
      mobileLayout &&
      location.pathname !== prevPathnameRef.current
    ) {
      closeSidebar();
    }
    
    // Mettre à jour la référence du pathname
    prevPathnameRef.current = location.pathname;
  }, [location.pathname, isMobile, isTablet, closeSidebar]);

  // Délai avant que l'overlay ne devienne cliquable pour éviter qu'il capture le clic d'ouverture
  React.useEffect(() => {
    if (useMobileSidebar && !sidebarCollapsed && mobileLayout) {
      // Réinitialiser l'état
      setOverlayReady(false);
      // Activer l'overlay après un court délai
      const timer = setTimeout(() => {
        setOverlayReady(true);
      }, 100); // 100ms de délai
      return () => clearTimeout(timer);
    } else {
      setOverlayReady(false);
    }
  }, [sidebarCollapsed, mobileLayout, useMobileSidebar]);

  const handleOverlayClick = (e) => {
    // Empêcher le clic si l'overlay n'est pas prêt
    if (!overlayReady) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    closeSidebar();
  };

  // Backoffice restreint : bloquer aussi les routes hors ProtectedRoute
  if (
    isBackofficeNavAsRpQualif(user) &&
    !isPathAllowedForRestrictedBackofficeNav(location.pathname)
  ) {
    return <Navigate to={getRestrictedBackofficeHomePath()} replace />;
  }

  return (
    <FicheDetailModalProvider>
      <div className={`app ${topNavLayout ? 'app-admin-topnav' : ''}`}>
        <GlobalKeyboardShortcuts />
        {!topNavLayout && useMobileSidebar && !sidebarCollapsed && mobileLayout && (
          <div 
            ref={overlayRef}
            className={`sidebar-overlay active ${overlayReady ? 'ready' : ''}`} 
            onClick={handleOverlayClick}
            style={{ pointerEvents: overlayReady ? 'auto' : 'none' }}
          ></div>
        )}
        {!topNavLayout && <Sidebar collapsed={sidebarCollapsed} />}
        <div className={`main-content ${sidebarCollapsed || topNavLayout ? 'sidebar-collapsed' : ''}`}>
          <Header />
          <div className="content-wrapper">
            <Outlet />
          </div>
        </div>
      </div>
      <ForcePasswordChangeModal />
    </FicheDetailModalProvider>
  );
};

const Layout = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default Layout;

