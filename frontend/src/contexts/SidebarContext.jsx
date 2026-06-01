import React, { createContext, useContext, useState, useEffect } from 'react';
import { FORCE_DESKTOP_VIEWPORT } from '../config/viewport';

const SidebarContext = createContext(null);

const getInitialSidebarState = () => {
  if (FORCE_DESKTOP_VIEWPORT) {
    return false;
  }
  const width = window.innerWidth;
  const isDesktop = width > 1024;
  return !isDesktop;
};

export const SidebarProvider = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState());
  const [isMobile, setIsMobile] = useState(
    FORCE_DESKTOP_VIEWPORT ? false : window.innerWidth <= 768
  );
  const [isTablet, setIsTablet] = useState(
    FORCE_DESKTOP_VIEWPORT ? false : window.innerWidth > 768 && window.innerWidth <= 1024
  );
  const [isDesktop, setIsDesktop] = useState(
    FORCE_DESKTOP_VIEWPORT ? true : window.innerWidth > 1024
  );
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const userToggleRef = React.useRef(false);

  useEffect(() => {
    if (FORCE_DESKTOP_VIEWPORT) {
      return undefined;
    }

    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width <= 768;
      const tablet = width > 768 && width <= 1024;
      const desktop = width > 1024;
      const wasDesktop = isDesktop;

      setIsMobile(mobile);
      setIsTablet(tablet);
      setIsDesktop(desktop);

      if (desktop) {
        setSidebarCollapsed(prev => autoHideEnabled);
        userToggleRef.current = false;
      } else if (mobile || tablet) {
        if (autoHideEnabled) {
          setAutoHideEnabled(false);
        }
        if (wasDesktop && !userToggleRef.current) {
          setSidebarCollapsed(true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoHideEnabled, isDesktop]);

  const toggleSidebar = () => {
    if (FORCE_DESKTOP_VIEWPORT) {
      return;
    }

    setSidebarCollapsed(prevCollapsed => {
      const newState = !prevCollapsed;
      if (newState === false) {
        setAutoHideEnabled(false);
        userToggleRef.current = true;
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
    if (FORCE_DESKTOP_VIEWPORT) {
      return;
    }
    setSidebarCollapsed(true);
    userToggleRef.current = false;
  };

  const openSidebar = () => {
    setSidebarCollapsed(false);
    setAutoHideEnabled(false);
    userToggleRef.current = true;
    setTimeout(() => {
      userToggleRef.current = false;
    }, 500);
  };

  const setAutoHide = React.useCallback((enabled) => {
    if (!FORCE_DESKTOP_VIEWPORT && !isDesktop) {
      return;
    }

    setAutoHideEnabled(enabled);
    if (enabled && !FORCE_DESKTOP_VIEWPORT) {
      setSidebarCollapsed(true);
    }
  }, [isDesktop]);

  const effectiveCollapsed = FORCE_DESKTOP_VIEWPORT ? false : sidebarCollapsed;

  return (
    <SidebarContext.Provider
      value={{
        sidebarCollapsed: effectiveCollapsed,
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
