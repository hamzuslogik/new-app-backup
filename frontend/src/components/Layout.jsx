import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import GlobalKeyboardShortcuts from './common/GlobalKeyboardShortcuts';
import { FicheDetailModalProvider } from '../contexts/FicheDetailModalContext';
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext';
import './Layout.css';

const LayoutContent = () => {
  const { sidebarCollapsed, isMobile, isTablet, closeSidebar } = useSidebar();
  const location = useLocation();
  const overlayRef = React.useRef(null);
  const [overlayReady, setOverlayReady] = React.useState(false);
  const prevPathnameRef = React.useRef(location.pathname);
  const isInitialMountRef = React.useRef(true);

  // Fermer automatiquement la sidebar sur mobile/tablet lors du changement de page
  React.useEffect(() => {
    // Ignorer le montage initial
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPathnameRef.current = location.pathname;
      return;
    }

    // Ne fermer que si le pathname a réellement changé et qu'on est sur mobile/tablet
    if ((isMobile || isTablet) && location.pathname !== prevPathnameRef.current) {
      closeSidebar();
    }
    
    // Mettre à jour la référence du pathname
    prevPathnameRef.current = location.pathname;
  }, [location.pathname, isMobile, isTablet, closeSidebar]);

  // Délai avant que l'overlay ne devienne cliquable pour éviter qu'il capture le clic d'ouverture
  React.useEffect(() => {
    if (!sidebarCollapsed && (isMobile || isTablet)) {
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
  }, [sidebarCollapsed, isMobile, isTablet]);

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
        {!sidebarCollapsed && (isMobile || isTablet) && (
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

