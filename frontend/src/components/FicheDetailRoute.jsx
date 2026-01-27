import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import FicheDetail from '../pages/FicheDetail';

const FicheDetailRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { openFicheDetail } = useFicheDetailModal();
  const hasOpened = useRef(false);
  const [isDirectAccess, setIsDirectAccess] = useState(false);

  useEffect(() => {
    if (id && !hasOpened.current) {
      hasOpened.current = true;

      // Si l'URL contient ?overlay=1, c'était un modal avant refresh → rouvrir en modal sur le dashboard
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('overlay') === '1') {
        openFicheDetail(id);
        navigate('/dashboard', { replace: true });
        return;
      }

      // Vérifier si on accède directement à l'URL (tape dans la barre d'adresse ou lien externe)
      // vs depuis un lien dans l'application
      const referrer = document.referrer;
      const currentOrigin = window.location.origin;

      // Si pas de referrer OU referrer externe OU referrer ne contient pas de route de l'app
      // => accès direct (page plein écran)
      const directAccess = !referrer ||
                          !referrer.startsWith(currentOrigin) ||
                          (referrer.startsWith(currentOrigin) &&
                           !referrer.match(/\/(dashboard|fiches|planning|statistiques|kpis|compte-rendu|validation|notifications|signatures)/));

      setIsDirectAccess(directAccess);

      if (directAccess) {
        // Si accès direct, ne pas ouvrir le modal, afficher directement la page
        // L'URL reste /fiches/:id et la page s'affiche normalement
        return;
      } else {
        // Si accès depuis une autre page de l'app (clic sur lien),
        // ouvrir le modal puis naviguer en arrière
        openFicheDetail(id);
        setTimeout(() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 100);
      }
    }
  }, [id, openFicheDetail, navigate, location.search]);

  // Si accès direct (sans overlay=1), afficher la page FicheDetail directement (pas en modal)
  if (isDirectAccess && id) {
    return <FicheDetail ficheHash={id} isModal={false} />;
  }

  // Sinon, ne rien afficher - le modal sera rendu par le contexte (ou on redirige)
  return null;
};

export default FicheDetailRoute;

