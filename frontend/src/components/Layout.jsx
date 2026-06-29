import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import GlobalKeyboardShortcuts from './common/GlobalKeyboardShortcuts';
import { FicheDetailModalProvider } from '../contexts/FicheDetailModalContext';
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext';
import { FORCE_DESKTOP_VIEWPORT } from '../config/viewport';
import { isMobileNativeExtranetPage, isTouchExtranetMobileLayout } from '../utils/applyForceDesktopViewport';
import api from '../config/api';
import './Layout.css';

const LayoutContent = () => {
  const { sidebarCollapsed, isMobile, isTablet, closeSidebar, mobileExtranetActive } = useSidebar();
  const extranetMobile = mobileExtranetActive || isTouchExtranetMobileLayout();
  const useMobileSidebar = !FORCE_DESKTOP_VIEWPORT || extranetMobile;
  const mobileLayout = extranetMobile || isMobile || isTablet;
  const location = useLocation();
  const overlayRef = React.useRef(null);
  const [overlayReady, setOverlayReady] = React.useState(false);
  const prevPathnameRef = React.useRef(location.pathname);
  const isInitialMountRef = React.useRef(true);
  const isFirstNavLogRef = React.useRef(true);

  // Journal d’activité : navigation (après le premier rendu, pour ne pas logger l’URL d’entrée deux fois)
  React.useEffect(() => {
    if (isFirstNavLogRef.current) {
      isFirstNavLogRef.current = false;
      return;
    }
    const path = `${location.pathname}${location.search || ''}`;
    const t = setTimeout(() => {
      api
        .post('/user-activity/log', {
          nature: 'navigation',
          detail: JSON.stringify({ path })
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

  return (
    <FicheDetailModalProvider>
      <div className="app">
        <GlobalKeyboardShortcuts />
        {useMobileSidebar && !sidebarCollapsed && mobileLayout && (
          <div 
            ref={overlayRef}
            className={`sidebar-overlay active ${overlayReady ? 'ready' : ''}`} 
            onClick={handleOverlayClick}
            style={{ pointerEvents: overlayReady ? 'auto' : 'none' }}
          ></div>
        )}
        <Sidebar collapsed={sidebarCollapsed} />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Header />
          <div className="content-wrapper">
            <Outlet />
          </div>
        </div>
      </div>
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

