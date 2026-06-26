import { useLayoutEffect } from 'react';
import { useSidebar } from '../contexts/SidebarContext';
import PlanningHebdomadaire from './PlanningHebdomadaire';
import {
  applyForceDesktopViewport,
  applyMobileNativeViewport,
} from '../utils/applyForceDesktopViewport';
import './PlanningHebdoIos.css';

const PAGE_CLASS = 'planning-hebdo-ios-page';
const MOBILE_NATIVE_CLASS = 'planning-hebdo-ios-page--mobile-native';
const EXTRANET_SCROLL_CLASS = 'planning-hebdo-ios-page--extranet-scroll';

/** Planning hebdomadaire en affichage mobile — route admin iOS. */
const PlanningHebdoIos = () => {
  const { closeSidebar } = useSidebar();

  useLayoutEffect(() => {
    document.documentElement.classList.add(PAGE_CLASS);
    document.body.classList.add(PAGE_CLASS);

    return () => {
      document.documentElement.classList.remove(PAGE_CLASS);
      document.body.classList.remove(PAGE_CLASS);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.add(MOBILE_NATIVE_CLASS);
    document.body.classList.add(MOBILE_NATIVE_CLASS);

    delete document.documentElement.dataset.desktopViewport;
    if (document.body) delete document.body.dataset.desktopViewport;

    applyMobileNativeViewport();
    window.dispatchEvent(new Event('viewport-layout-change'));
    closeSidebar();

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyMobileNativeViewport();
        window.dispatchEvent(new Event('viewport-layout-change'));
      });
    });

    return () => {
      cancelAnimationFrame(id);
      document.documentElement.classList.remove(MOBILE_NATIVE_CLASS);
      document.body.classList.remove(MOBILE_NATIVE_CLASS);
      applyForceDesktopViewport();
    };
  }, [closeSidebar]);

  useLayoutEffect(() => {
    document.documentElement.classList.add(EXTRANET_SCROLL_CLASS);
    document.body.classList.add(EXTRANET_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(EXTRANET_SCROLL_CLASS);
      document.body.classList.remove(EXTRANET_SCROLL_CLASS);
    };
  }, []);

  return <PlanningHebdomadaire variant="ios-mobile" />;
};

export default PlanningHebdoIos;
