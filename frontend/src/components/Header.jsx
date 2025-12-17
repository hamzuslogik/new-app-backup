import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { FaBars, FaBell, FaUser, FaSignOutAlt, FaTimes, FaCheck, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../config/api';
import './Header.css';

const Header = () => {
  const { toggleSidebar, sidebarCollapsed } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const previousCountRef = useRef(0);

  // Récupérer les notifications (pour les admins, backoffice, confirmateurs et RE Confirmation)
  const { data: notificationsData } = useQuery(
    'notifications',
    async () => {
      const res = await api.get('/notifications');
      return res.data.data || [];
    },
    {
      enabled: user && ([1, 2, 7, 11].includes(user.fonction) || user.fonction === 6 || user.fonction === 14),
      refetchInterval: 20000, // Rafraîchir toutes les 20 secondes
    }
  );

  // Compter les notifications non lues (pour tous les utilisateurs)
  const { data: notificationsCount } = useQuery(
    'notifications-count',
    async () => {
      const res = await api.get('/notifications/count');
      return res.data.count || 0;
    },
    {
      enabled: !!user, // Activer pour tous les utilisateurs connectés
      refetchInterval: 20000, // Rafraîchir toutes les 20 secondes
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
        queryClient.invalidateQueries('notifications-count');
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
        queryClient.invalidateQueries('notifications-count');
        queryClient.invalidateQueries('fiche');
        queryClient.invalidateQueries('planning-week');
        queryClient.invalidateQueries('planning-availability');
        queryClient.invalidateQueries('planning-modal');
        queryClient.invalidateQueries('availability-modal');
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
        queryClient.invalidateQueries('notifications-count');
        queryClient.invalidateQueries('fiche');
        queryClient.invalidateQueries('planning-week');
        queryClient.invalidateQueries('planning-availability');
        queryClient.invalidateQueries('planning-modal');
        queryClient.invalidateQueries('availability-modal');
      }
    }
  );

  // Fermer le menu de notifications si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    markAsReadMutation.mutate(notification.id);
    // Vérifier que la fiche existe et a un hash valide avant de naviguer
    if (notification.fiche_id && notification.hash) {
      navigate(`/fiches/${notification.hash}`);
      setShowNotifications(false);
    } else {
      console.warn('Impossible de naviguer vers la fiche : fiche_id ou hash manquant', notification);
      // Afficher un message à l'utilisateur
      alert('La fiche associée à cette notification n\'est plus disponible.');
    }
  };

  const notifications = notificationsData || [];
  const unreadCount = notificationsCount || 0;
  const isAdmin = user && ([1, 2, 7].includes(user.fonction));
  const isBackoffice = user && (user.fonction === 11);
  const isConfirmateur = user && (user.fonction === 6);
  const isREConfirmation = user && (user.fonction === 14);
  const canSeeNotifications = isAdmin || isBackoffice || isConfirmateur || isREConfirmation;
  // Afficher le badge pour tous les utilisateurs qui ont des notifications non lues
  const shouldShowBadge = unreadCount > 0;

  // Détecter quand une nouvelle notification arrive
  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current > 0) {
      // Une nouvelle notification est arrivée
      setIsBlinking(true);
      // Arrêter le clignotement après 5 secondes
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  // Arrêter le clignotement quand l'utilisateur ouvre les notifications
  useEffect(() => {
    if (showNotifications) {
      setIsBlinking(false);
    }
  }, [showNotifications]);

  return (
    <header className="header">
      <div className="header-left">
        <button 
          className="menu-toggle" 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Menu toggle clicked, current state:', sidebarCollapsed);
            toggleSidebar();
          }}
        >
          <FaBars />
        </button>
        <Link to="/dashboard" className="header-logo-container">
          <img src="/logo/logo.png" alt="JWS Group Logo" className="header-logo" />
        </Link>
        <h1 className="header-title">CRM JWS Group</h1>
      </div>
      <div className="header-right">
        {/* Afficher le bouton de notifications pour tous les utilisateurs */}
        <div className="notification-container" ref={notificationRef}>
          <button 
            className="notification-btn"
            onClick={() => {
              if (canSeeNotifications) {
                setShowNotifications(!showNotifications);
              } else {
                // Rediriger vers la page notifications si l'utilisateur ne peut pas voir le dropdown
                navigate('/notifications');
              }
            }}
            title={canSeeNotifications ? 'Notifications' : (unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Notifications')}
          >
            <FaBell />
            {shouldShowBadge && (
              <span className={`badge ${isBlinking ? 'blinking' : ''}`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && canSeeNotifications && (
            <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h3>Notifications</h3>
                  <div className="notifications-header-actions">
                    <Link 
                      to="/notifications" 
                      className="view-all-notifications-btn"
                      onClick={() => setShowNotifications(false)}
                      title="Voir toutes les notifications"
                    >
                      Voir tout
                    </Link>
                    {unreadCount > 0 && (
                      <button
                        className="mark-all-read-btn"
                        onClick={() => markAllAsReadMutation.mutate()}
                        title="Marquer tout comme lu"
                      >
                        <FaCheck /> Tout marquer comme lu
                      </button>
                    )}
                  </div>
                </div>
                <div className="notifications-list">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const isRdvApproval = notification.type === 'rdv_approval';
                      const isDecalageRequest = notification.type === 'decalage_request';
                      const isPending = !notification.action || notification.action === 'pending';
                      const canAction = isRdvApproval && isPending && isAdmin; // Seuls les admins peuvent approuver/refuser les RDV
                      
                      // Pour les notifications de décalage, afficher les métadonnées si disponibles
                      let decalageInfo = null;
                      if (isDecalageRequest && notification.metadata) {
                        try {
                          decalageInfo = typeof notification.metadata === 'string' 
                            ? JSON.parse(notification.metadata) 
                            : notification.metadata;
                        } catch (e) {
                          console.error('Erreur lors du parsing des métadonnées:', e);
                        }
                      }

                      return (
                        <div
                          key={notification.id}
                          className={`notification-item ${notification.lu === 0 ? 'unread' : ''} ${canAction ? 'has-actions' : ''} ${!notification.fiche_id || !notification.hash ? 'no-fiche' : ''}`}
                          onClick={() => !canAction && notification.fiche_id && notification.hash && handleNotificationClick(notification)}
                          style={!notification.fiche_id || !notification.hash ? { cursor: 'default', opacity: 0.7 } : {}}
                        >
                          <div className="notification-content">
                            <p className="notification-message">{notification.message}</p>
                            {isDecalageRequest && decalageInfo && (
                              <div className="notification-metadata" style={{ 
                                marginTop: '8px', 
                                padding: '8px', 
                                background: '#f0f0f0', 
                                borderRadius: '4px',
                                fontSize: '10.2px'
                              }}>
                                {decalageInfo.date_rdv_original && (
                                  <div><strong>RDV original :</strong> {new Date(decalageInfo.date_rdv_original).toLocaleString('fr-FR')}</div>
                                )}
                                {decalageInfo.date_rdv_nouvelle && (
                                  <div><strong>Nouveau RDV :</strong> {new Date(decalageInfo.date_rdv_nouvelle).toLocaleString('fr-FR')}</div>
                                )}
                              </div>
                            )}
                            <span className="notification-date">
                              {notification.date_creation
                                ? new Date(notification.date_creation).toLocaleString('fr-FR')
                                : ''}
                            </span>
                            {canAction && (
                              <div className="notification-actions">
                                <button
                                  className="accept-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Approuver cette demande de RDV ?')) {
                                      acceptRdvMutation.mutate(notification.id);
                                    }
                                  }}
                                  disabled={acceptRdvMutation.isLoading || refuseRdvMutation.isLoading}
                                  title="Approuver la demande"
                                >
                                  <FaCheckCircle /> Approuver
                                </button>
                                <button
                                  className="refuse-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Refuser cette demande de RDV ? La fiche passera en état REFUS-ADMIN.')) {
                                      refuseRdvMutation.mutate(notification.id);
                                    }
                                  }}
                                  disabled={acceptRdvMutation.isLoading || refuseRdvMutation.isLoading}
                                  title="Refuser la demande"
                                >
                                  <FaTimesCircle /> Refuser
                                </button>
                              </div>
                            )}
                          </div>
                          {notification.lu === 0 && !canAction && (
                            <button
                              className="mark-read-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(notification.id);
                              }}
                              title="Marquer comme lu"
                            >
                              <FaTimes />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        <div className="user-menu">
          <div className="user-info">
            <span className="user-name" style={{ color: '#ffffff' }}>{user?.pseudo || 'Utilisateur'}</span>
            <span className="user-role" style={{ color: '#ffffff' }}>{user?.fonction_titre || ''}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FaSignOutAlt /> Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

