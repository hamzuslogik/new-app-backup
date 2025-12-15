import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';

const FicheDetailRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { openFicheDetail } = useFicheDetailModal();

  useEffect(() => {
    if (id) {
      openFicheDetail(id);
      // Revenir à la page précédente si possible, sinon aller au dashboard
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [id, openFicheDetail, navigate]);

  // Ne rien afficher - le modal sera géré par le contexte
  return null;
};

export default FicheDetailRoute;

