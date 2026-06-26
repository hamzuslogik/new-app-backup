import { useLayoutEffect } from 'react';
import PlanningHebdomadaire from './PlanningHebdomadaire';
import { applyMobileNativeViewport, isTouchMobileDevice } from '../utils/applyForceDesktopViewport';
import './PlanningHebdoIos.css';

const PAGE_CLASS = 'planning-hebdo-ios-page';

/** Planning hebdomadaire en affichage mobile (formulaire + cartes) — route admin iOS. */
const PlanningHebdoIos = () => {
  useLayoutEffect(() => {
    document.documentElement.classList.add(PAGE_CLASS);
    document.body.classList.add(PAGE_CLASS);

    if (isTouchMobileDevice()) {
      applyMobileNativeViewport();
    }

    return () => {
      document.documentElement.classList.remove(PAGE_CLASS);
      document.body.classList.remove(PAGE_CLASS);
    };
  }, []);

  return <PlanningHebdomadaire variant="ios-mobile" />;
};

export default PlanningHebdoIos;
