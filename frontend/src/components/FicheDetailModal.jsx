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

  // Utiliser le hook pour bloquer le scroll du body
  useModalScrollLock(!!ficheHash);

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
    // Sauvegarder le chemin actuel
    previousPath.current = location.pathname;
    
    // Naviguer temporairement vers la route de la fiche (sans changer l'URL visible)
    // On utilise replace: true pour ne pas ajouter d'entrée dans l'historique
    window.history.pushState(null, '', `/fiches/${ficheHash}`);
    
    return () => {
      // Restaurer le chemin précédent quand le modal se ferme
      window.history.pushState(null, '', previousPath.current);
    };
  }, [ficheHash]);

  // Focuser le modal à l'ouverture
  useEffect(() => {
    if (modalContentRef.current && ficheHash) {
      modalContentRef.current.focus();
    }
  }, [ficheHash]);

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
        onKeyDown={(e) => {
          // Empêcher la fermeture du modal avec Escape si on est en train de scroller
          if (e.key === 'Escape') {
            onClose();
          }
        }}
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

