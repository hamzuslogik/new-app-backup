import React, { createContext, useContext, useState, useEffect } from 'react';
import { FORCE_DESKTOP_VIEWPORT } from '../config/viewport';
import { isMobileNativeExtranetPage } from '../utils/applyForceDesktopViewport';

const SidebarContext = createContext(null);

const getInitialSidebarState = () => {
  if (FORCE_DESKTOP_VIEWPORT && !isMobileNativeExtranetPage()) {
    return false;
  }
  const width = window.innerWidth;
  const isDesktop = width > 1024;
  return !isDesktop;
};

export const SidebarProvider = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState());
  const [mobileExtranetActive, setMobileExtranetActive] = useState(isMobileNativeExtranetPage());
  const extranetActiveRef = React.useRef(isMobileNativeExtranetPage());
  const [isMobile, setIsMobile] = useState(
    mobileExtranetActive || (!FORCE_DESKTOP_VIEWPORT && window.innerWidth <= 768)
  );
  const [isTablet, setIsTablet] = useState(
    !mobileExtranetActive && !FORCE_DESKTOP_VIEWPORT && window.innerWidth > 768 && window.innerWidth <= 1024
  );
  const [isDesktop, setIsDesktop] = useState(
    FORCE_DESKTOP_VIEWPORT && !mobileExtranetActive ? true : window.innerWidth > 1024
  );
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const userToggleRef = React.useRef(false);
  const extranetActive = mobileExtranetActive || isMobileNativeExtranetPage();
  const forceDesktopSidebar = FORCE_DESKTOP_VIEWPORT && !extranetActive;

  useEffect(() => {
    const syncExtranetLayout = () => {
      const extranet = isMobileNativeExtranetPage();
      const wasExtranet = extranetActiveRef.current;
      extranetActiveRef.current = extranet;
      setMobileExtranetActive(extranet);
      if (extranet) {
        setIsMobile(true);
        setIsTablet(false);
        setIsDesktop(false);
        if (!wasExtranet) {
          setSidebarCollapsed(true);
        }
      }
    };

    syncExtranetLayout();
    window.addEventListener('viewport-layout-change', syncExtranetLayout);
    window.addEventListener('resize', syncExtranetLayout);
    return () => {
      window.removeEventListener('viewport-layout-change', syncExtranetLayout);
      window.removeEventListener('resize', syncExtranetLayout);
    };
  }, []);

  useEffect(() => {
    if (forceDesktopSidebar) {
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
    if (FORCE_DESKTOP_VIEWPORT && !isMobileNativeExtranetPage() && !mobileExtranetActive) {
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
    if (FORCE_DESKTOP_VIEWPORT && !isMobileNativeExtranetPage() && !mobileExtranetActive) {
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
    if (!forceDesktopSidebar && !isDesktop) {
      return;
    }

    setAutoHideEnabled(enabled);
    if (enabled && !forceDesktopSidebar) {
      setSidebarCollapsed(true);
    }
  }, [forceDesktopSidebar, isDesktop]);

  const effectiveCollapsed = forceDesktopSidebar ? false : sidebarCollapsed;

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
        mobileExtranetActive,
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
