import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { RouteParamsProvider } from '../contexts/RouteParamsContext';
import FicheDetail from '../pages/FicheDetail';
import { FaTimes } from 'react-icons/fa';
import api from '../config/api';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import '../pages/Dashboard.css';

const FicheDetailModal = ({ ficheHash, onClose, options = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = React.useRef(`${location.pathname}${location.search}`);
  const modalContentRef = React.useRef(null);
  const isDirectAccess = React.useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const lockedFromOption = options?.closeMode === '0';
  // Mode verrouille uniquement en manuel: ?overlay=1&close=0
  // (pas de fermeture via clic exterieur/Echap)
  const isOverlayLocked =
    lockedFromOption ||
    (searchParams.get('overlay') === '1' && searchParams.get('close') === '0');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

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
        navigate('/dashboard', { replace: true });
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

  const handlePhoneSearch = async (e) => {
    e.preventDefault();
    const value = (phoneSearch || '').trim();
    if (!value) return;

    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await api.get('/fiches', {
        params: {
          fiche_search: 1,
          critere: value,
          critere_champ: 'tel', // backend: tel => tel OR gsm1 OR gsm2
          page: 1,
          limit: 1,
          include_archive: 1
        }
      });

      const first = res?.data?.data?.[0];
      const targetHash = first?.hash;
      if (!targetHash) {
        setSearchError('Aucune fiche trouvée pour ce numéro.');
        return;
      }

      if (String(targetHash) === String(ficheHash)) {
        setSearchError('Cette fiche est déjà ouverte.');
        return;
      }

      navigate(`/fiches/${targetHash}?overlay=auto&close=0`);
      setPhoneSearch('');
    } catch (err) {
      setSearchError('Erreur lors de la recherche de fiche.');
    } finally {
      setSearchLoading(false);
    }
  };

  const modalContent = (
    <div
      className="fiche-detail-modal-overlay"
      onClick={isOverlayLocked ? undefined : onClose}
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
        <button className="fiche-detail-modal-close" onClick={onClose}>
          <FaTimes />
        </button>
        {isOverlayLocked && (
          <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', background: '#fafafa' }}>
            <form onSubmit={handlePhoneSearch} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="Rechercher par tel / gsm1 / gsm2"
                style={{ flex: 1, padding: '8px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button
                type="submit"
                disabled={searchLoading}
                style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', background: '#1976d2', color: '#fff', cursor: 'pointer' }}
              >
                {searchLoading ? 'Recherche...' : 'Rechercher'}
              </button>
            </form>
            {searchError && (
              <div style={{ marginTop: '6px', color: '#b42318', fontSize: '12px' }}>
                {searchError}
              </div>
            )}
          </div>
        )}
        <RouteParamsProvider params={{ id: ficheHash }} navigate={navigate}>
          <FicheDetail ficheHash={ficheHash} onClose={onClose} isModal={true} />
        </RouteParamsProvider>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FicheDetailModal;

