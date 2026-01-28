import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../config/api';
import './SystemMessageModal.css';

const SystemMessageModal = () => {
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (messagesData && messagesData.length > 0) {
      setMessages(messagesData);
      setCurrentIndex(0);
      // Marquer le premier message comme lu s'il doit être affiché une seule fois
      if (messagesData[0].afficher_une_seule_fois === 1) {
        markAsReadMutation.mutate(messagesData[0].id);
      }
    }
  }, [messagesData]);

  const handleClose = () => {
    setMessages([]);
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (currentIndex < messages.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Marquer le message suivant comme lu s'il doit être affiché une seule fois
      if (messages[nextIndex].afficher_une_seule_fois === 1) {
        markAsReadMutation.mutate(messages[nextIndex].id);
      }
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!messages || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentIndex];
  if (!currentMessage) {
    return null;
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="type-icon type-success" />;
      case 'warning':
        return <FaExclamationTriangle className="type-icon type-warning" />;
      case 'error':
        return <FaTimesCircle className="type-icon type-error" />;
      default:
        return <FaInfoCircle className="type-icon type-info" />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'success':
        return 'message-success';
      case 'warning':
        return 'message-warning';
      case 'error':
        return 'message-error';
      default:
        return 'message-info';
    }
  };

  return (
    <div className="system-message-modal-overlay">
      <div className={`system-message-modal ${getTypeClass(currentMessage.type)}`}>
        <div className="system-message-header">
          <div className="system-message-icon">
            {getTypeIcon(currentMessage.type)}
          </div>
          <div className="system-message-title-section">
            {currentMessage.titre && (
              <h3>{currentMessage.titre}</h3>
            )}
            {messages.length > 1 && (
              <span className="message-counter">
                {currentIndex + 1} / {messages.length}
              </span>
            )}
          </div>
          <button
            className="system-message-close"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <FaTimes />
          </button>
        </div>

        <div className="system-message-body">
          <p>{currentMessage.message}</p>
        </div>

        <div className="system-message-footer">
          <div className="system-message-actions">
            {currentIndex > 0 && (
              <button
                className="btn-secondary"
                onClick={handlePrevious}
              >
                Précédent
              </button>
            )}
            {currentIndex < messages.length - 1 ? (
              <button
                className="btn-primary"
                onClick={handleNext}
              >
                Suivant
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={handleClose}
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMessageModal;
