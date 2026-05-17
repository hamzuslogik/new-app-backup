import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaCheck, FaTimes, FaEye, FaFilter, FaCheckCircle, FaTimesCircle, FaArchive } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getNotificationClickPath } from '../utils/notificationNavigation';
import './Notifications.css';

const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const notificationsListRef = useRef(null);
  const markedOnScrollRef = useRef(new Set());

  // Forcer le viewport à 1400px pour désactiver la responsivité mobile (même méthode que Dashboard)
  useEffect(() => {
    const originalViewport = document.querySelector('meta[name="viewport"]');
    const originalContent = originalViewport?.getAttribute('content') || '';

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1400');

    document.body.classList.add('notifications-page');
    document.documentElement.classList.add('notifications-page');

    document.documentElement.style.minWidth = '1400px';
    document.documentElement.style.width = 'auto';
    document.documentElement.style.maxWidth = 'none';
    document.documentElement.style.overflowX = 'auto';
    document.body.style.minWidth = '1400px';
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'auto';

    return () => {
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }

      document.body.classList.remove('notifications-page');
      document.documentElement.classList.remove('notifications-page');

      document.documentElement.style.minWidth = '';
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.minWidth = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';
    };
  }, []);

  const notificationsQueryOpts = {
    staleTime: 0,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  };

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
      // Si filter === 'all', on garde toutes les notifications. Les plus récentes en premier.
      return [...notifications].sort((a, b) => new Date(b.date_creation || 0) - new Date(a.date_creation || 0));
    },
    notificationsQueryOpts
  );

  // Compter les notifications non lues
  const { data: unreadCount } = useQuery(
    'notifications-count',
    async () => {
      const res = await api.get('/notifications/count');
      return res.data.count || 0;
    },
    notificationsQueryOpts
  );

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      queryClient.invalidateQueries(['notifications-all']);
      queryClient.invalidateQueries('notifications-count');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [queryClient]);

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

  const archiveOldMutation = useMutation(
    async () => {
      const res = await api.patch('/notifications/archive-old');
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('notifications-all');
        queryClient.invalidateQueries('notifications-count');
        const n = data?.archived ?? 0;
        if (n > 0) toast.success(`${n} notification(s) archivée(s)`);
      }
    }
  );

  const notifications = notificationsData || [];

  const handleNotificationClick = (notification) => {
    if (notification.lu === 0) {
      markAsReadMutation.mutate(notification.id);
    }
    const path = getNotificationClickPath(notification);
    if (path) {
      navigate(path);
      return;
    }
    if (notification.fiche_id && notification.hash) {
      navigate(`/fiches/${notification.hash}`);
    }
  };

  const handleCardClick = (e, notification) => {
    if (e.target.closest('button')) return;
    const path = getNotificationClickPath(notification);
    if (path) {
      if (notification.lu === 0) {
        markAsReadMutation.mutate(notification.id);
      }
      navigate(path);
      return;
    }
    if (notification.fiche_id && notification.hash) {
      if (notification.lu === 0) {
        markAsReadMutation.mutate(notification.id);
      }
      navigate(`/fiches/${notification.hash}`);
      return;
    }
    if (notification.lu === 0) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  // Marquer comme lu les notifications qui deviennent visibles au scroll dans la page
  useEffect(() => {
    const listEl = notificationsListRef.current;
    if (!listEl || !notifications.length) return;
    const unreadIds = notifications.filter((n) => n.lu === 0).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const options = { root: listEl, rootMargin: '0px', threshold: 0.2 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('data-notification-id');
        if (!id || markedOnScrollRef.current.has(id)) return;
        const numId = parseInt(id, 10);
        markedOnScrollRef.current.add(id);
        markAsReadMutation.mutate(numId);
      });
    }, options);

    const children = listEl.querySelectorAll('[data-notification-unread="true"]');
    children.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      unreadIds.forEach((id) => markedOnScrollRef.current.delete(String(id)));
    };
  }, [notifications]);

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
      case 'workflow':
        return 'Workflow / alerte';
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
      case 'workflow':
        return 'type-info';
      default:
        return 'type-default';
    }
  };

  const { user } = useAuth();
  const isAdmin = user && ([1, 2, 7].includes(user.fonction));

  if (isLoading) {
    return <LoadingSpinner text="Chargement des notifications..." />;
  }

  return (
    <div className="notifications">
      <div className="page-header">
        <div className="header-left">
          <h1>
            <FaBell /> Notifications
          </h1>
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
          <button
            className="btn-archive-old"
            onClick={() => archiveOldMutation.mutate()}
            disabled={archiveOldMutation.isLoading}
            title="Archiver les notifications lues de plus de 3 jours"
          >
            <FaArchive /> Archiver lues &gt; 3 jours
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <FaBell size={64} />
          <p>Aucune notification</p>
        </div>
      ) : (
        <div className="notifications-list" ref={notificationsListRef}>
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

            const clickPath = getNotificationClickPath(notification);
            const canOpenFiche = notification.hash && user?.fonction !== 5 && user?.fonction !== 3;

            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                data-notification-id={notification.id}
                data-notification-unread={notification.lu === 0}
                onClick={(e) => handleCardClick(e, notification)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(e, notification); } }}
                className={`notification-card ${notification.lu === 0 ? 'unread' : ''} ${getNotificationTypeClass(notification.type)}`}
                style={{ cursor: clickPath || (notification.hash && notification.fiche_id) ? 'pointer' : undefined }}
                aria-label={
                  clickPath || (notification.hash && notification.fiche_id)
                    ? 'Cliquer pour ouvrir la page ou la fiche'
                    : notification.lu === 0
                      ? 'Cliquer pour marquer comme lu'
                      : ''
                }
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
                  {notification.afficher_expediteur !== 0 && notification.expediteur_pseudo && (
                    <p className="notification-expediteur">De : {notification.expediteur_pseudo}</p>
                  )}
                  <p className="notification-message">{notification.message}</p>

                  {/* Métadonnées pour les décalages */}
                  {isDecalageRequest && metadata && (
                    <div className="notification-metadata">
                      {metadata.date_rdv_original && (
                        <div>
                          <strong>RDV original :</strong>{' '}
                          {formatRdvDateTime(metadata.date_rdv_original)}
                        </div>
                      )}
                      {metadata.date_rdv_nouvelle && (
                        <div>
                          <strong>Nouveau RDV :</strong>{' '}
                          {formatRdvDateTime(metadata.date_rdv_nouvelle)}
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
                    {(clickPath || canOpenFiche) && (
                      <button
                        className="btn-view"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationClick(notification);
                        }}
                      >
                        <FaEye /> {clickPath ? 'Ouvrir la page' : 'Voir la fiche'}
                      </button>
                    )}
                    {notification.lu === 0 && (
                      <button
                        className="btn-mark-read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsReadMutation.mutate(notification.id);
                        }}
                        disabled={markAsReadMutation.isLoading}
                        title="Marquer cette notification comme lue"
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

