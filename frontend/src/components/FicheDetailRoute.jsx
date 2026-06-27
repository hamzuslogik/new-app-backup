import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import { useAuth } from '../contexts/AuthContext';
import { getHomePage } from '../utils/getHomePage';
import FicheDetail from '../pages/FicheDetail';
import {
  parseFicheRouteIdentifier,
  mergeFicheRouteQueries,
  buildCanonicalFichePath
} from '../utils/ficheRouteIdentifier';

const FicheDetailRoute = () => {
  const { id: rawRouteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { openFicheDetail } = useFicheDetailModal();
  const { user } = useAuth();
  const lastHandledRef = useRef('');
  const [isDirectAccess, setIsDirectAccess] = useState(false);

  const { identifier: ficheId, embeddedQuery } = parseFicheRouteIdentifier(rawRouteId);
  const routeSearchKey = mergeFicheRouteQueries(embeddedQuery, location.search).toString();

  useEffect(() => {
    if (!ficheId) return;

    const routeKey = `${ficheId}|${routeSearchKey}`;
    if (lastHandledRef.current === routeKey) return;
    lastHandledRef.current = routeKey;

    const routeSearchParams = new URLSearchParams(routeSearchKey);

    // Corriger /fiches/PHONE&overlay=1 → /fiches/PHONE?overlay=1 (intégrations externes)
    if (embeddedQuery && rawRouteId !== ficheId) {
      const canonical = buildCanonicalFichePath(ficheId, routeSearchParams);
      if (`${location.pathname}${location.search}` !== canonical) {
        navigate(canonical, { replace: true });
      }
    }

    const overlayMode = routeSearchParams.get('overlay');
    if (overlayMode === '1' || overlayMode === 'auto') {
      const closeMode = routeSearchParams.get('close');
      openFicheDetail(ficheId, { closeMode });
      return;
    }

    const referrer = document.referrer;
    const currentOrigin = window.location.origin;

    const directAccess = !referrer ||
                        !referrer.startsWith(currentOrigin) ||
                        (referrer.startsWith(currentOrigin) &&
                         !referrer.match(/\/(dashboard|fiches|planning|statistiques|kpis|compte-rendu|validation|notifications|signatures)/));

    setIsDirectAccess(directAccess);

    if (directAccess) {
      return;
    }

    openFicheDetail(ficheId);
    setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        const home = getHomePage(user) || '/dashboard';
        navigate(home, { replace: true });
      }
    }, 100);
  }, [
    ficheId,
    rawRouteId,
    embeddedQuery,
    openFicheDetail,
    navigate,
    location.pathname,
    location.search,
    routeSearchKey,
    user
  ]);

  if (isDirectAccess && ficheId) {
    return <FicheDetail ficheHash={ficheId} isModal={false} />;
  }

  return null;
};

export default FicheDetailRoute;
