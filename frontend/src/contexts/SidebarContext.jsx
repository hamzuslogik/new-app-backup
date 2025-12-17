import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext(null);

// Fonction pour déterminer l'état initial du sidebar selon la taille d'écran
const getInitialSidebarState = () => {
  const width = window.innerWidth;
  const isDesktop = width > 1024;
  // Sur mobile/tablet, le sidebar est fermé par défaut
  // Sur desktop, il est ouvert par défaut
  return !isDesktop;
};

export const SidebarProvider = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [autoHideEnabled, setAutoHideEnabled] = useState(false); // Pour masquer automatiquement quand il y a des données
  const userToggleRef = React.useRef(false); // Flag pour savoir si l'utilisateur a ouvert manuellement

  // Détecter la taille de l'écran
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width <= 768;
      const tablet = width > 768 && width <= 1024;
      const desktop = width > 1024;
      const wasDesktop = isDesktop;
      
      setIsMobile(mobile);
      setIsTablet(tablet);
      setIsDesktop(desktop);
      
      // Sur desktop, le sidebar est toujours visible sauf si auto-hide est activé
      if (desktop) {
        // Utiliser la valeur actuelle de autoHideEnabled depuis la closure
        setSidebarCollapsed(prev => {
          // Si auto-hide est activé, masquer le sidebar
          // Sinon, l'afficher
          return autoHideEnabled;
        });
        userToggleRef.current = false;
      } else if (mobile || tablet) {
        // Sur mobile/tablet, forcer le sidebar à être masqué par défaut
        // Le sidebar ne s'affiche que via le bouton hamburger
        // Désactiver l'auto-hide quand on passe sur mobile/tablet
        if (autoHideEnabled) {
          setAutoHideEnabled(false);
        }
        // Forcer le sidebar à être collapsed sur mobile/tablet
        // Si on passe de desktop à mobile, fermer le sidebar
        // Sur mobile, le sidebar doit toujours être masqué par défaut
        if (wasDesktop) {
          setSidebarCollapsed(true);
        }
        // Note: Si on est déjà sur mobile, le sidebar reste dans son état actuel
        // (il sera fermé automatiquement lors du changement de page via Layout.jsx)
      }
    };

    window.addEventListener('resize', handleResize);
    // Ne pas appeler handleResize au montage, l'état initial est déjà correct

    return () => window.removeEventListener('resize', handleResize);
  }, [autoHideEnabled, isDesktop]);

  const toggleSidebar = () => {
    // Utiliser une fonction de callback pour s'assurer que l'état est à jour
    setSidebarCollapsed(prevCollapsed => {
      const newState = !prevCollapsed;
      const width = window.innerWidth;
      const mobile = width <= 768;
      const tablet = width > 768 && width <= 1024;
      console.log('Sidebar toggle:', { prevCollapsed, newState, mobile, tablet });
      // Si on ouvre manuellement, désactiver l'auto-hide et marquer comme toggle manuel
      if (newState === false) {
        setAutoHideEnabled(false);
        userToggleRef.current = true;
        // Réinitialiser le flag après un délai (pour permettre le resize normal)
        setTimeout(() => {
          userToggleRef.current = false;
        }, 500);
      } else {
        userToggleRef.current = false;
      }
      return newState;
    });
  };

  const closeSidebar = () => {
    setSidebarCollapsed(true);
    userToggleRef.current = false;
  };

  const openSidebar = () => {
    setSidebarCollapsed(false);
    setAutoHideEnabled(false); // Désactiver l'auto-hide quand on ouvre manuellement
    userToggleRef.current = true;
    // Réinitialiser le flag après un délai
    setTimeout(() => {
      userToggleRef.current = false;
    }, 500);
  };

  const setAutoHide = React.useCallback((enabled) => {
    // Ne pas activer l'auto-hide sur mobile/tablet, seulement sur desktop
    // Sur mobile/tablet, le sidebar doit rester contrôlé manuellement par l'utilisateur
    if (!isDesktop) {
      return; // Ignorer l'auto-hide sur mobile/tablet
    }
    
    setAutoHideEnabled(enabled);
    if (enabled && isDesktop) {
      setSidebarCollapsed(true); // Masquer automatiquement sur desktop uniquement
    } else if (!enabled && isDesktop && !sidebarCollapsed) {
      // Si auto-hide est désactivé et qu'on n'a pas fermé manuellement, réafficher
      setSidebarCollapsed(false);
    }
  }, [isDesktop, sidebarCollapsed]);

  return (
    <SidebarContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        closeSidebar,
        openSidebar,
        setAutoHide,
        isMobile,
        isTablet,
        isDesktop,
        autoHideEnabled,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

