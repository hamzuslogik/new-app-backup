import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaCheck, FaTimes, FaEye, FaFilter, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './Notifications.css';

const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'

  // Récupérer toutes les notifications (lues et non lues)
  const { data: notificationsData, isLoading } = useQuery(
    ['notifications-all', filter],
    async () => {
      // Récupérer toutes les notifications (lues et non lues)
      const res = await api.get('/notifications', { params: { all: 'true' } });
      let notifications = res.data.data || [];
      
      // Filtrer selon le filtre sélectionné
      if (filter === 'unread') {
        notifications = notifications.filter(n => n.lu === 0);
      } else if (filter === 'read') {
        notifications = notifications.filter(n => n.lu === 1);
      }
      // Si filter === 'all', on garde toutes les notifications
      
      return notifications;
    },
    {
      refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    }
  );

  // Compter les notifications non lues
  const { data: unreadCount } = useQuery(
    'notifications-count',
    async () => {
      const res = await api.get('/notifications/count');
      return res.data.count || 0;
    }
  );

  const markAsReadMutation = useMutation(
    async (id) => {
      const res = await api.patch(`/notifications/${id}/read`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('notifications-all');
        queryClient.invalidateQueries('notifications-count');
        toast.success('Notification marquée comme lue');
      }
    }
  );

  const markAllAsReadMutation = useMutation(
    async () => {
      const res = await api.patch('/notifications/read-all');
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('notifications-all');
        queryClient.invalidateQueries('notifications-count');
        toast.success('Toutes les notifications marquées comme lues');
      }
    }
  );

  const acceptRdvMutation = useMutation(
    async (notificationId) => {
      const res = await api.post(`/notifications/${notificationId}/accept`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('notifications-all');
        queryClient.invalidateQueries('notifications-count');
        queryClient.invalidateQueries('fiche');
        queryClient.invalidateQueries('planning-week');
        toast.success('Demande de RDV approuvée');
      }
    }
  );

  const refuseRdvMutation = useMutation(
    async (notificationId) => {
      const res = await api.post(`/notifications/${notificationId}/refuse`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('notifications-all');
        queryClient.invalidateQueries('notifications-count');
        queryClient.invalidateQueries('fiche');
        queryClient.invalidateQueries('planning-week');
        toast.success('Demande de RDV refusée');
      }
    }
  );

  const handleNotificationClick = (notification) => {
    if (notification.lu === 0) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Naviguer vers la fiche si disponible
    if (notification.fiche_id && notification.hash) {
      navigate(`/fiches/${notification.hash}`);
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'rdv_approval':
        return 'Demande d\'approbation RDV';
      case 'decalage_request':
        return 'Demande de décalage';
      case 'demande_insertion_acceptee':
        return 'Demande d\'insertion acceptée';
      case 'demande_insertion_refusee':
        return 'Demande d\'insertion refusée';
      default:
        return type;
    }
  };

  const getNotificationTypeClass = (type) => {
    switch (type) {
      case 'demande_insertion_acceptee':
        return 'type-success';
      case 'demande_insertion_refusee':
        return 'type-danger';
      case 'decalage_request':
        return 'type-warning';
      case 'rdv_approval':
        return 'type-info';
      default:
        return 'type-default';
    }
  };

  const notifications = notificationsData || [];
  const { user } = useAuth();
  const isAdmin = user && ([1, 2, 7].includes(user.fonction));

  if (isLoading) {
    return <LoadingSpinner text="Chargement des notifications..." />;
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div className="header-left">
          <h1>
            <FaBell /> Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} non lue(s)</span>
          )}
        </div>
        <div className="header-actions">
          <div className="filter-group">
            <FaFilter />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Toutes</option>
              <option value="unread">Non lues</option>
              <option value="read">Lues</option>
            </select>
          </div>
          {unreadCount > 0 && (
            <button
              className="btn-mark-all-read"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isLoading}
            >
              <FaCheck /> Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <FaBell size={64} />
          <p>Aucune notification</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const isRdvApproval = notification.type === 'rdv_approval';
            const isDecalageRequest = notification.type === 'decalage_request';
            const isDemandeInsertion = notification.type?.startsWith('demande_insertion_');
            const isPending = !notification.action || notification.action === 'pending';
            const canAction = isRdvApproval && isPending && isAdmin;

            // Parser les métadonnées
            let metadata = null;
            if (notification.metadata) {
              try {
                metadata = typeof notification.metadata === 'string'
                  ? JSON.parse(notification.metadata)
                  : notification.metadata;
              } catch (e) {
                console.error('Erreur lors du parsing des métadonnées:', e);
              }
            }

            return (
              <div
                key={notification.id}
                className={`notification-card ${notification.lu === 0 ? 'unread' : ''} ${getNotificationTypeClass(notification.type)}`}
              >
                <div className="notification-header">
                  <div className="notification-type">
                    <span className="type-badge">{getNotificationTypeLabel(notification.type)}</span>
                    {notification.lu === 0 && <span className="unread-indicator">Non lue</span>}
                  </div>
                  <div className="notification-date">
                    {notification.date_creation
                      ? new Date(notification.date_creation).toLocaleString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </div>
                </div>

                <div className="notification-body">
                  <p className="notification-message">{notification.message}</p>

                  {/* Métadonnées pour les décalages */}
                  {isDecalageRequest && metadata && (
                    <div className="notification-metadata">
                      {metadata.date_rdv_original && (
                        <div>
                          <strong>RDV original :</strong>{' '}
                          {new Date(metadata.date_rdv_original).toLocaleString('fr-FR')}
                        </div>
                      )}
                      {metadata.date_rdv_nouvelle && (
                        <div>
                          <strong>Nouveau RDV :</strong>{' '}
                          {new Date(metadata.date_rdv_nouvelle).toLocaleString('fr-FR')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Métadonnées pour les demandes d'insertion */}
                  {isDemandeInsertion && metadata && (
                    <div className="notification-metadata">
                      {metadata.commentaire && (
                        <div>
                          <strong>Commentaire :</strong> {metadata.commentaire}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="notification-footer">
                  <div className="notification-actions">
                    {canAction && (
                      <>
                        <button
                          className="btn-accept"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Approuver cette demande de RDV ?')) {
                              acceptRdvMutation.mutate(notification.id);
                            }
                          }}
                          disabled={acceptRdvMutation.isLoading || refuseRdvMutation.isLoading}
                        >
                          <FaCheckCircle /> Approuver
                        </button>
                        <button
                          className="btn-refuse"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Refuser cette demande de RDV ?')) {
                              refuseRdvMutation.mutate(notification.id);
                            }
                          }}
                          disabled={acceptRdvMutation.isLoading || refuseRdvMutation.isLoading}
                        >
                          <FaTimesCircle /> Refuser
                        </button>
                      </>
                    )}
                    {notification.hash && (
                      <button
                        className="btn-view"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <FaEye /> Voir la fiche
                      </button>
                    )}
                    {notification.lu === 0 && !canAction && (
                      <button
                        className="btn-mark-read"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        disabled={markAsReadMutation.isLoading}
                      >
                        <FaCheck /> Marquer comme lu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;

