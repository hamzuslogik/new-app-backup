import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { FaBars, FaBell, FaUser, FaSignOutAlt, FaTimes, FaCheck, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../config/api';
import useLocalStorage from '../hooks/useLocalStorage';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './Header.css';

const Header = () => {
  const { toggleSidebar, sidebarCollapsed } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /** Sur /dashboard sans query : même effet que le logo sidebar — RDV du jour (Dashboard.jsx). */
  const goDashboardHome = (e) => {
    if (location.pathname !== '/dashboard') return;
    if (location.search) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('dashboard-reset-default'));
  };
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const previousCountRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useLocalStorage('notification-sound-enabled', true);
  const audioContextRef = useRef(null);

  // Récupérer les notifications (admins, backoffice, confirmateurs, RE Confirmation, commerciaux)
  const { data: notificationsData } = useQuery(
    'notifications',
    async () => {
      const res = await api.get('/notifications');
      return res.data.data || [];
    },
    {
      enabled: !!user,
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

  const handleNotificationClick = () => {
    setShowNotifications(false);
    navigate('/notifications');
  };

  const notificationsAll = notificationsData || [];
  const notifications = notificationsAll.filter((n) => n.lu === 0);
  const unreadCount = notificationsCount || 0;
  const userFonction = user ? Number(user.fonction) : null;
  const isAdmin = user && [1, 2, 7].includes(userFonction);
  const isBackoffice = user && userFonction === 11;
  const isConfirmateur = user && userFonction === 6;
  const isREConfirmation = user && userFonction === 14;
  const isCommercial = user && userFonction === 5;
  // Afficher le badge pour tous les utilisateurs qui ont des notifications non lues
  const shouldShowBadge = unreadCount > 0;

  // Fonction pour jouer un son de notification
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      // Créer un contexte audio si nécessaire
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      // Fonction pour créer et jouer le son
      const playSound = (frequency, delay = 0) => {
        setTimeout(() => {
          try {
            // Reprendre le contexte audio s'il est suspendu
            if (audioContext.state === 'suspended') {
              audioContext.resume().then(() => {
                createAndPlayTone(audioContext, frequency);
              }).catch(err => {
                console.warn('Impossible de reprendre le contexte audio:', err);
              });
            } else {
              createAndPlayTone(audioContext, frequency);
            }
          } catch (error) {
            console.warn('Erreur lors de la lecture du son:', error);
          }
        }, delay);
      };
      
      // Fonction pour créer et jouer une note
      const createAndPlayTone = (ctx, freq) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
      };
      
      // Jouer deux notes pour un effet "ding-dong"
      playSound(800, 0);
      playSound(600, 150);
    } catch (error) {
      console.warn('Impossible de jouer le son de notification:', error);
    }
  }, [soundEnabled]);

  // Détecter quand une nouvelle notification arrive
  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current > 0) {
      // Une nouvelle notification est arrivée
      setIsBlinking(true);
      // Jouer le son de notification
      playNotificationSound();
      // Arrêter le clignotement après 5 secondes
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount, playNotificationSound]);

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
        <Link to="/dashboard" className="header-logo-container" onClick={goDashboardHome}>
          <img src="/logo/logo.png" alt="JWS Group Logo" className="header-logo" />
        </Link>
        <h1 className="header-title">CRM JWS Group</h1>
      </div>
      <div className="header-right">
        {/* Afficher le bouton de notifications pour tous les utilisateurs */}
        <div className="notification-container" ref={notificationRef}>
          <button 
            className="notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title={unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Notifications'}
          >
            <FaBell />
            {shouldShowBadge && (
              <span className={`badge badge-pulse ${isBlinking ? 'blinking' : ''}`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h3>Notifications</h3>
                  <div className="notifications-header-actions">
                    <button
                      className="sound-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSoundEnabled(!soundEnabled);
                      }}
                      title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10.2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {soundEnabled ? '🔔' : '🔕'}
                    </button>
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
                      <p>Aucune notification non lue</p>
                      <Link to="/notifications" onClick={() => setShowNotifications(false)} className="view-all-link">Voir la page Notifications</Link>
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
                          className={`notification-item unread ${canAction ? 'has-actions' : ''}`}
                          onClick={(e) => {
                            if (e.target.closest('button')) return;
                            if (canAction) return;
                            handleNotificationClick();
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="notification-content">
                            <p className="notification-message">{notification.message}</p>
                            {isDecalageRequest && decalageInfo && (
                              <div className="notification-metadata" style={{ 
                                marginTop: '8px', 
                                padding: '8px', 
                                background: '#f0f0f0', 
                                borderRadius: '4px',
                                fontSize: '10.2px',
                                color: '#000000'
                              }}>
                                {decalageInfo.date_rdv_original && (
                                  <div><strong>RDV original :</strong> {formatRdvDateTime(decalageInfo.date_rdv_original)}</div>
                                )}
                                {decalageInfo.date_rdv_nouvelle && (
                                  <div><strong>Nouveau RDV :</strong> {formatRdvDateTime(decalageInfo.date_rdv_nouvelle)}</div>
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

