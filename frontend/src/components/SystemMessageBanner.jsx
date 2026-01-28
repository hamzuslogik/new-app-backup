import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { getHomePage } from '../utils/getHomePage';
import api from '../config/api';
import './SystemMessageBanner.css';

const SystemMessageBanner = () => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedMessages, setDismissedMessages] = useState(new Set());

  // Récupérer les données de la fonction pour déterminer la page d'accueil
  const { data: fonctionData } = useQuery(
    ['fonction-data', user?.fonction],
    async () => {
      const res = await api.get('/management/fonctions');
      return res.data.data?.find(f => f.id === user?.fonction) || null;
    },
    { enabled: !!user && !!user.fonction }
  );

  // Pour RE Qualification, vérifier s'il a des agents sous sa responsabilité
  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite-banner',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter(u => u.chef_equipe === user?.id && u.fonction === 3) || [];
    },
    { 
      enabled: !!user && user?.fonction !== 3 && user?.fonction !== 4 && user?.fonction !== 5 && user?.fonction !== 12 
    }
  );

  // Récupérer les messages système pour l'utilisateur connecté
  const { data: messagesData } = useQuery(
    'system-messages',
    async () => {
      const res = await api.get('/system-messages');
      return res.data.data || [];
    },
    {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !!user
    }
  );

  const markAsReadMutation = useMutation(
    async (messageId) => {
      const res = await api.post(`/system-messages/${messageId}/marquer-lu`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-messages');
      }
    }
  );

  // Déterminer la page d'accueil de l'utilisateur
  // Attendre que les données de fonction soient chargées avant de déterminer la page d'accueil
  const userHomePage = user && fonctionData !== undefined 
    ? getHomePage(user, fonctionData, agentsSousResponsabilite || []) 
    : null;

  // Vérifier si on est sur la page d'accueil de l'utilisateur
  // Ne pas afficher si les données ne sont pas encore chargées
  const isOnHomePage = userHomePage && location.pathname === userHomePage;

  useEffect(() => {
    if (messagesData && messagesData.length > 0 && isOnHomePage) {
      // Filtrer les messages déjà fermés
      const visibleMessages = messagesData.filter(msg => !dismissedMessages.has(msg.id));
      setMessages(visibleMessages);
      if (visibleMessages.length > 0) {
        setCurrentIndex(0);
        // Marquer le premier message comme lu s'il doit être affiché une seule fois
        if (visibleMessages[0].afficher_une_seule_fois === 1) {
          markAsReadMutation.mutate(visibleMessages[0].id);
        }
      }
    } else {
      setMessages([]);
    }
  }, [messagesData, isOnHomePage, dismissedMessages]);

  const handleDismiss = (messageId) => {
    setDismissedMessages(prev => new Set([...prev, messageId]));
    // Marquer comme lu si nécessaire
    const message = messages.find(m => m.id === messageId);
    if (message && message.afficher_une_seule_fois === 1) {
      markAsReadMutation.mutate(messageId);
    }
  };

  const handleNext = () => {
    if (currentIndex < messages.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Marquer le message suivant comme lu s'il doit être affiché une seule fois
      if (messages[nextIndex].afficher_une_seule_fois === 1) {
        markAsReadMutation.mutate(messages[nextIndex].id);
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Ne pas afficher si on n'est pas sur la page d'accueil ou s'il n'y a pas de messages
  if (!isOnHomePage || !messages || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentIndex];
  if (!currentMessage) {
    return null;
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="banner-icon type-success" />;
      case 'warning':
        return <FaExclamationTriangle className="banner-icon type-warning" />;
      case 'error':
        return <FaTimesCircle className="banner-icon type-error" />;
      default:
        return <FaInfoCircle className="banner-icon type-info" />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'success':
        return 'banner-success';
      case 'warning':
        return 'banner-warning';
      case 'error':
        return 'banner-error';
      default:
        return 'banner-info';
    }
  };

  return (
    <div className={`system-message-banner ${getTypeClass(currentMessage.type)}`}>
      <div className="banner-content">
        <div className="banner-icon-container">
          {getTypeIcon(currentMessage.type)}
        </div>
        <div className="banner-text">
          {currentMessage.titre && (
            <div className="banner-title">{currentMessage.titre}</div>
          )}
          <div className="banner-message">{currentMessage.message}</div>
        </div>
        <div className="banner-actions">
          {messages.length > 1 && (
            <>
              <button
                className="banner-nav-btn"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                title="Message précédent"
              >
                <FaChevronLeft />
              </button>
              <span className="banner-counter">
                {currentIndex + 1} / {messages.length}
              </span>
              <button
                className="banner-nav-btn"
                onClick={handleNext}
                disabled={currentIndex === messages.length - 1}
                title="Message suivant"
              >
                <FaChevronRight />
              </button>
            </>
          )}
          <button
            className="banner-close-btn"
            onClick={() => handleDismiss(currentMessage.id)}
            title="Fermer"
            aria-label="Fermer"
          >
            <FaTimes />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemMessageBanner;
