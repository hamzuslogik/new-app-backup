import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { RouteParamsProvider } from '../contexts/RouteParamsContext';
import FicheDetail from '../pages/FicheDetail';
import { FaTimes } from 'react-icons/fa';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import usePreventOverscrollBounce from '../hooks/usePreventOverscrollBounce';
import { getHomePage } from '../utils/getHomePage';
import '../pages/Dashboard.css';

const FicheDetailModal = ({ ficheHash, onClose, options = {} }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = React.useRef(`${location.pathname}${location.search}`);
  const userRef = React.useRef(user);
  userRef.current = user;
  const modalContentRef = React.useRef(null);
  const modalOverlayRef = React.useRef(null);
  const isDirectAccess = React.useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const lockedFromOption = options?.closeMode === '0';
  // Mode verrouille uniquement en manuel: ?overlay=1&close=0
  // (pas de fermeture via clic exterieur/Echap)
  const isOverlayLocked =
    lockedFromOption ||
    (searchParams.get('overlay') === '1' && searchParams.get('close') === '0');
  // Session commercial : éviter la fermeture accidentelle au clic extérieur
  const isBackdropCloseLocked = isOverlayLocked || Number(user?.fonction) === 5;

  usePreventOverscrollBounce(modalOverlayRef, !!ficheHash);

  // Bloquer le scroll du body ; le scroll vertical est dans .fiche-detail-modal-content
  useEffect(() => {
    if (!ficheHash) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [ficheHash]);

  // Récupérer les données de la fiche pour obtenir la couleur de l'état
  const { data: ficheData } = useQuery(
    ['fiche', ficheHash],
    async () => {
      const res = await api.get(`/fiches/${ficheHash}`);
      return res.data.data;
    },
    {
      enabled: !!ficheHash,
      staleTime: 30000, // 30 secondes
    }
  );

  // Récupérer la liste des états pour obtenir la couleur si nécessaire
  const { data: etatsData } = useQuery(
    'etats',
    async () => {
      const res = await api.get('/management/etats');
      return res.data.data;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  useEffect(() => {
    // Détecter si on est déjà sur la route /fiches/:id (accès direct, sans overlay)
    const isOnFicheRoute = location.pathname === `/fiches/${ficheHash}`;
    const isAnotherFicheRoute = location.pathname.startsWith('/fiches/') && !isOnFicheRoute;
    isDirectAccess.current = isOnFicheRoute;
    
    // Si l'utilisateur navigue déjà vers une autre fiche (/fiches/:autreHash),
    // ne pas écraser l'URL avec l'ancien hash du modal en cours.
    if (isAnotherFicheRoute) {
      return undefined;
    }

    // Sauvegarder le chemin actuel seulement si on n'est pas déjà sur /fiches/:id
    if (!isOnFicheRoute) {
      previousPath.current = `${location.pathname}${location.search}`;

      // Preserver d'eventuels parametres manuels (overlay=1&close=0), sinon fallback overlay=auto.
      const nextSearchParams = new URLSearchParams(location.search);
      if (!nextSearchParams.get('overlay')) {
        nextSearchParams.set('overlay', 'auto');
      }
      if (options?.closeMode === '0') {
        nextSearchParams.set('close', '0');
      }

      const nextSearch = nextSearchParams.toString();
      const nextUrl = nextSearch
        ? `/fiches/${ficheHash}?${nextSearch}`
        : `/fiches/${ficheHash}`;

      window.history.pushState(null, '', nextUrl);
    }
    
    return undefined;
  }, [ficheHash, location.pathname, location.search, navigate, options?.closeMode]);

  // Cleanup uniquement au démontage du modal (pas à chaque changement de hash),
  // pour éviter d'écraser l'URL lors d'une navigation fiche -> autre fiche.
  useEffect(() => {
    return () => {
      if (!isDirectAccess.current && previousPath.current) {
        window.history.pushState(null, '', previousPath.current);
      } else if (isDirectAccess.current) {
        // Accès direct (URL /fiches/:id?overlay=...) : revenir à la page d'accueil
        // de l'utilisateur (ex. commercial -> /planning-commercial) plutôt que
        // /dashboard sur lequel certaines fonctions n'ont pas accès.
        const home = getHomePage(userRef.current) || '/dashboard';
        navigate(home, { replace: true });
      }
    };
  }, [navigate]);

  // Focuser le modal à l'ouverture
  useEffect(() => {
    if (modalContentRef.current && ficheHash) {
      modalContentRef.current.focus();
    }
  }, [ficheHash]);

  // Écouter la touche Escape pour fermer le modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && ficheHash && !isOverlayLocked) {
        onClose();
      }
    };

    if (ficheHash) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [ficheHash, onClose, isOverlayLocked]);

  // Déterminer la couleur du border selon l'état de la fiche
  // Applique aussi la logique "Signer Complet" (état SIGNER + sous-état COMPLETE → couleur de l'état 45)
  const getEtatColor = () => {
    if (!ficheData) return '#3498db'; // Couleur par défaut
    if (ficheData.etat_final_color) return ficheData.etat_final_color;
    const etat = (etatsData || []).find((e) => Number(e.id) === Number(ficheData.id_etat_final));
    return etat?.color || '#3498db';
  };

  const etatColor = getEtatColor();


  const modalContent = (
    <div
      ref={modalOverlayRef}
      className="fiche-detail-modal-overlay"
      onClick={isBackdropCloseLocked ? undefined : onClose}
    >
      <div 
        ref={modalContentRef}
        className="fiche-detail-modal-content" 
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          border: `8px solid ${etatColor}`,
          outline: 'none',
          ['--etat-color']: etatColor,
        }}
      >
        <button className="fiche-detail-modal-close" onClick={onClose} aria-label="Fermer">
          <FaTimes />
        </button>
        <div
          className="fiche-detail-modal-banner"
          style={{ height: '72px', minHeight: '72px', maxHeight: '72px', flex: '0 0 72px' }}
        >
          <img src="/logo/logo.png" alt="Logo" className="fiche-detail-modal-banner-logo" />
          <span className="fiche-detail-modal-banner-title">DETAILS FICHE</span>
        </div>
        <RouteParamsProvider params={{ id: ficheHash }} navigate={navigate}>
          <FicheDetail
            ficheHash={ficheHash}
            onClose={onClose}
            isModal={true}
            initialFocusHistoriqueEtats={options?.focusHistoriqueEtats === true}
            initialTab={options?.initialTab || null}
          />
        </RouteParamsProvider>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FicheDetailModal;

