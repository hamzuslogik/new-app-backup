import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { RouteParamsProvider } from '../contexts/RouteParamsContext';
import FicheDetail from '../pages/FicheDetail';
import { FaTimes } from 'react-icons/fa';
import api from '../config/api';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import '../pages/Dashboard.css';

const FicheDetailModal = ({ ficheHash, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = React.useRef(location.pathname);
  const modalContentRef = React.useRef(null);
  const isDirectAccess = React.useRef(false);

  // Ne plus bloquer le scroll du body - le modal utilise le scroll de la page
  // useModalScrollLock(!!ficheHash);

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
    // Détecter si on est déjà sur la route /fiches/:id (accès direct)
    const isOnFicheRoute = location.pathname === `/fiches/${ficheHash}`;
    isDirectAccess.current = isOnFicheRoute;
    
    // Sauvegarder le chemin actuel seulement si on n'est pas déjà sur /fiches/:id
    if (!isOnFicheRoute) {
      previousPath.current = location.pathname;
      // Mettre à jour l'URL pour refléter le hash de la fiche
      window.history.pushState(null, '', `/fiches/${ficheHash}`);
    }
    
    return () => {
      // Restaurer le chemin précédent quand le modal se ferme
      // Seulement si on n'était pas déjà sur /fiches/:id (pas d'accès direct)
      if (!isDirectAccess.current && previousPath.current && previousPath.current !== `/fiches/${ficheHash}`) {
        window.history.pushState(null, '', previousPath.current);
      } else if (isDirectAccess.current) {
        // Si accès direct, naviguer vers le dashboard quand on ferme
        navigate('/dashboard', { replace: true });
      }
    };
  }, [ficheHash, location.pathname, navigate]);

  // Focuser le modal à l'ouverture
  useEffect(() => {
    if (modalContentRef.current && ficheHash) {
      modalContentRef.current.focus();
    }
  }, [ficheHash]);

  // Écouter la touche Escape pour fermer le modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && ficheHash) {
        onClose();
      }
    };

    if (ficheHash) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [ficheHash, onClose]);

  // Déterminer la couleur du border selon l'état de la fiche
  const getEtatColor = () => {
    if (!ficheData) return '#3498db'; // Couleur par défaut
    
    if (ficheData.etat_final_color) {
      return ficheData.etat_final_color;
    }
    
    // Si pas de couleur dans les données, chercher dans la liste des états
    if (etatsData && ficheData.id_etat_final) {
      const etat = etatsData.find(e => e.id === ficheData.id_etat_final);
      return etat?.color || '#3498db';
    }
    
    return '#3498db'; // Couleur par défaut
  };

  const etatColor = getEtatColor();

  const modalContent = (
    <div className="fiche-detail-modal-overlay" onClick={onClose}>
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
        <button className="fiche-detail-modal-close" onClick={onClose}>
          <FaTimes />
        </button>
        <RouteParamsProvider params={{ id: ficheHash }} navigate={navigate}>
          <FicheDetail ficheHash={ficheHash} onClose={onClose} isModal={true} />
        </RouteParamsProvider>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FicheDetailModal;

