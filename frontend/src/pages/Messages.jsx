import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaPaperPlane, FaUser, FaSearch, FaComments, FaCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Messages.css';

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllUsers, setShowAllUsers] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Mettre à jour l'activité de l'utilisateur actuel
  useEffect(() => {
    const updateActivity = async () => {
      try {
        await api.post('/messages/activity');
      } catch (error) {
        // Ignorer les erreurs silencieusement
      }
    };

    // Mettre à jour immédiatement
    updateActivity();

    // Puis toutes les 2 minutes
    const interval = setInterval(updateActivity, 120000);
    return () => clearInterval(interval);
  }, []);

  // Récupérer la liste des conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery(
    'conversations',
    async () => {
      const res = await api.get('/messages/conversations');
      return res.data.data || [];
    },
    {
      refetchInterval: 5000, // Rafraîchir toutes les 5 secondes
    }
  );

  // Récupérer les utilisateurs pour démarrer une nouvelle conversation
  const { data: allUsers, isLoading: loadingUsers } = useQuery(
    'message-users',
    async () => {
      const res = await api.get('/messages/users');
      return res.data.data || [];
    },
    {
      refetchInterval: 10000, // Rafraîchir toutes les 10 secondes pour mettre à jour le statut
    }
  );

  // Récupérer les messages de la conversation sélectionnée
  const { data: messages, isLoading: loadingMessages } = useQuery(
    ['messages', selectedUser],
    async () => {
      if (!selectedUser) return [];
      const res = await api.get(`/messages/conversation/${selectedUser.id}`);
      return res.data.data || [];
    },
    {
      enabled: !!selectedUser,
      refetchInterval: 3000, // Rafraîchir toutes les 3 secondes
    }
  );

  // Mutation pour envoyer un message
  const sendMessageMutation = useMutation(
    async ({ destination, message }) => {
      const res = await api.post('/messages', { destination, message });
      return res.data;
    },
    {
      onSuccess: () => {
        setMessageText('');
        queryClient.invalidateQueries(['messages', selectedUser]);
        queryClient.invalidateQueries('conversations');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'envoi du message');
      },
    }
  );

  // Filtrer les conversations selon le terme de recherche
  const filteredConversations = conversations?.filter(conv =>
    conv.pseudo?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Filtrer les utilisateurs pour nouvelle conversation
  const filteredUsers = allUsers?.filter(u =>
    u.pseudo?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Créer une liste combinée : conversations existantes + autres utilisateurs
  const allContacts = useMemo(() => {
    const conversationIds = new Set(conversations?.map(c => c.id) || []);
    const otherUsers = allUsers?.filter(u => !conversationIds.has(u.id)) || [];
    
    return [
      ...(conversations || []),
      ...(showAllUsers ? otherUsers : [])
    ];
  }, [conversations, allUsers, showAllUsers]);

  // Scroll automatique vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser) return;

    sendMessageMutation.mutate({
      destination: selectedUser.id,
      message: messageText.trim(),
    });
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchTerm('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getDefaultAvatar = (genre) => {
    return genre === 1 
      ? 'https://ui-avatars.com/api/?name=User&background=e91e63&color=fff&size=128'
      : 'https://ui-avatars.com/api/?name=User&background=2196f3&color=fff&size=128';
  };

  return (
    <div className="messages-container">
      <div className="messages-sidebar">
        <div className="messages-header">
          <h2>
            <FaComments /> Messages
          </h2>
          <div className="messages-search">
            <FaSearch />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="conversations-list">
          {loadingConversations && loadingUsers ? (
            <div className="loading">Chargement...</div>
          ) : (
            <>
              {/* Bouton pour afficher/masquer tous les utilisateurs */}
              {!searchTerm && (
                <button
                  className="toggle-users-button"
                  onClick={() => setShowAllUsers(!showAllUsers)}
                >
                  {showAllUsers ? 'Masquer' : 'Afficher'} tous les utilisateurs
                </button>
              )}

              {/* Liste des contacts */}
              {searchTerm ? (
                // Mode recherche : afficher les résultats filtrés
                filteredUsers.length === 0 ? (
                  <div className="no-conversations">Aucun résultat</div>
                ) : (
                  filteredUsers.map((u) => {
                    const isConversation = conversations?.some(c => c.id === u.id);
                    const conv = isConversation ? conversations.find(c => c.id === u.id) : null;
                    const contact = conv || u;
                    
                    return (
                      <div
                        key={contact.id}
                        className={`conversation-item ${selectedUser?.id === contact.id ? 'active' : ''} ${!isConversation ? 'new-conversation' : ''}`}
                        onClick={() => handleSelectUser(contact)}
                      >
                        <div className="conversation-avatar">
                          <img
                            src={contact.photo || getDefaultAvatar(contact.genre)}
                            alt={contact.pseudo}
                            onError={(e) => {
                              e.target.src = getDefaultAvatar(contact.genre);
                            }}
                          />
                          {contact.is_online === 1 && (
                            <span className="online-indicator" title="En ligne">
                              <FaCircle />
                            </span>
                          )}
                          {conv && conv.unread_count > 0 && (
                            <span className="unread-badge">{conv.unread_count}</span>
                          )}
                        </div>
                        <div className="conversation-info">
                          <div className="conversation-header">
                            <span className="conversation-name">
                              {contact.pseudo}
                              {contact.is_online === 1 && (
                                <span className="online-text"> • En ligne</span>
                              )}
                            </span>
                            {conv && conv.last_message_date && (
                              <span className="conversation-time">
                                {formatDate(conv.last_message_date)}
                              </span>
                            )}
                          </div>
                          <div className="conversation-preview">
                            {conv && conv.last_message && (
                              <span className="last-message">
                                {conv.last_message.length > 50
                                  ? `${conv.last_message.substring(0, 50)}...`
                                  : conv.last_message}
                              </span>
                            )}
                            {contact.fonction_titre && (
                              <span className="conversation-role">{contact.fonction_titre}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                // Mode normal : afficher les conversations + optionnellement tous les utilisateurs
                allContacts.length === 0 ? (
                  <div className="no-conversations">Aucune conversation</div>
                ) : (
                  <>
                    {conversations && conversations.length > 0 && (
                      <>
                        {conversations.map((conv) => {
                          const userInfo = allUsers?.find(u => u.id === conv.id);
                          return (
                            <div
                              key={conv.id}
                              className={`conversation-item ${selectedUser?.id === conv.id ? 'active' : ''}`}
                              onClick={() => handleSelectUser(conv)}
                            >
                              <div className="conversation-avatar">
                                <img
                                  src={conv.photo || getDefaultAvatar(conv.genre)}
                                  alt={conv.pseudo}
                                  onError={(e) => {
                                    e.target.src = getDefaultAvatar(conv.genre);
                                  }}
                                />
                                {userInfo?.is_online === 1 && (
                                  <span className="online-indicator" title="En ligne">
                                    <FaCircle />
                                  </span>
                                )}
                                {conv.unread_count > 0 && (
                                  <span className="unread-badge">{conv.unread_count}</span>
                                )}
                              </div>
                              <div className="conversation-info">
                                <div className="conversation-header">
                                  <span className="conversation-name">
                                    {conv.pseudo}
                                    {userInfo?.is_online === 1 && (
                                      <span className="online-text"> • En ligne</span>
                                    )}
                                  </span>
                                  <span className="conversation-time">
                                    {formatDate(conv.last_message_date)}
                                  </span>
                                </div>
                                <div className="conversation-preview">
                                  {conv.last_message && (
                                    <span className="last-message">
                                      {conv.last_message.length > 50
                                        ? `${conv.last_message.substring(0, 50)}...`
                                        : conv.last_message}
                                    </span>
                                  )}
                                  {conv.fonction_titre && (
                                    <span className="conversation-role">{conv.fonction_titre}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {showAllUsers && allUsers && (
                      <>
                        {conversations && conversations.length > 0 && (
                          <div className="conversations-divider">Autres utilisateurs</div>
                        )}
                        {allUsers
                          .filter(u => !conversations?.some(c => c.id === u.id))
                          .map((u) => (
                            <div
                              key={u.id}
                              className={`conversation-item new-conversation ${selectedUser?.id === u.id ? 'active' : ''}`}
                              onClick={() => handleSelectUser(u)}
                            >
                              <div className="conversation-avatar">
                                <img
                                  src={u.photo || getDefaultAvatar(u.genre)}
                                  alt={u.pseudo}
                                  onError={(e) => {
                                    e.target.src = getDefaultAvatar(u.genre);
                                  }}
                                />
                                {u.is_online === 1 && (
                                  <span className="online-indicator" title="En ligne">
                                    <FaCircle />
                                  </span>
                                )}
                              </div>
                              <div className="conversation-info">
                                <div className="conversation-header">
                                  <span className="conversation-name">
                                    {u.pseudo}
                                    {u.is_online === 1 && (
                                      <span className="online-text"> • En ligne</span>
                                    )}
                                  </span>
                                </div>
                                <div className="conversation-preview">
                                  {u.fonction_titre && (
                                    <span className="conversation-role">{u.fonction_titre}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                  </>
                )
              )}
            </>
          )}
        </div>
      </div>

      <div className="messages-chat">
        {!selectedUser ? (
          <div className="no-chat-selected">
            <FaComments size={64} />
            <h3>Sélectionnez une conversation</h3>
            <p>Choisissez une conversation dans la liste pour commencer à discuter</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <img
                  src={selectedUser.photo || getDefaultAvatar(selectedUser.genre)}
                  alt={selectedUser.pseudo}
                  onError={(e) => {
                    e.target.src = getDefaultAvatar(selectedUser.genre);
                  }}
                />
                <div>
                  <h3>{selectedUser.pseudo}</h3>
                  {selectedUser.fonction_titre && (
                    <span className="chat-user-role">{selectedUser.fonction_titre}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-messages" ref={messagesContainerRef}>
              {loadingMessages ? (
                <div className="loading">Chargement des messages...</div>
              ) : messages?.length === 0 ? (
                <div className="no-messages">
                  Aucun message. Commencez la conversation !
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.expediteur === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`message ${isOwn ? 'own' : 'other'}`}
                    >
                      {!isOwn && (
                        <img
                          src={msg.expediteur_photo || getDefaultAvatar(msg.expediteur_genre)}
                          alt={msg.expediteur_pseudo}
                          className="message-avatar"
                          onError={(e) => {
                            e.target.src = getDefaultAvatar(msg.expediteur_genre);
                          }}
                        />
                      )}
                      <div className="message-content">
                        {!isOwn && (
                          <span className="message-sender">{msg.expediteur_pseudo}</span>
                        )}
                        <div className="message-bubble">
                          <p>{msg.message}</p>
                          <span className="message-time">
                            {formatDate(msg.date_modif)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder="Tapez votre message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={sendMessageMutation.isLoading}
              />
              <button
                type="submit"
                className="chat-send-button"
                disabled={!messageText.trim() || sendMessageMutation.isLoading}
              >
                <FaPaperPlane />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Messages;
