import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { FaBullhorn, FaEdit, FaTrash, FaPlus, FaSave, FaTimes, FaCheck, FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../config/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import './SystemMessages.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const SystemMessages = () => {
  useForceDesktopViewport('system-messages-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    titre: '',
    message: '',
    type: 'info',
    priorite: 1,
    date_debut: '',
    date_fin: '',
    actif: 1,
    afficher_une_seule_fois: 0,
    cibles_fonctions: [],
    cibles_utilisateurs: []
  });

  // Récupérer tous les messages
  const { data: messagesData, isLoading } = useQuery(
    'system-messages-all',
    async () => {
      const res = await api.get('/system-messages/all');
      return res.data.data || [];
    }
  );

  // Récupérer les fonctions pour le sélecteur
  const { data: fonctionsData } = useQuery('fonctions', async () => {
    const res = await api.get('/management/fonctions');
    return res.data.data || [];
  });

  // Récupérer les utilisateurs pour le sélecteur
  const { data: utilisateursData } = useQuery('utilisateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });

  const messages = messagesData || [];
  const fonctions = fonctionsData || [];
  const utilisateurs = utilisateursData || [];

  const saveMutation = useMutation(
    async (data) => {
      if (editingId) {
        const res = await api.put(`/system-messages/${editingId}`, data);
        return res.data;
      } else {
        const res = await api.post('/system-messages', data);
        return res.data;
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-messages-all');
        queryClient.invalidateQueries('system-messages');
        setShowForm(false);
        setEditingId(null);
        resetForm();
        toast.success(editingId ? 'Message mis à jour avec succès' : 'Message créé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const res = await api.delete(`/system-messages/${id}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-messages-all');
        queryClient.invalidateQueries('system-messages');
        toast.success('Message supprimé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      titre: '',
      message: '',
      type: 'info',
      priorite: 1,
      date_debut: '',
      date_fin: '',
      actif: 1,
      afficher_une_seule_fois: 0,
      cibles_fonctions: [],
      cibles_utilisateurs: []
    });
  };

  const handleEdit = (message) => {
    setEditingId(message.id);
    setFormData({
      titre: message.titre || '',
      message: message.message || '',
      type: message.type || 'info',
      priorite: message.priorite || 1,
      date_debut: message.date_debut ? message.date_debut.split('T')[0] + 'T' + message.date_debut.split('T')[1]?.substring(0, 5) : '',
      date_fin: message.date_fin ? message.date_fin.split('T')[0] + 'T' + message.date_fin.split('T')[1]?.substring(0, 5) : '',
      actif: message.actif !== undefined ? message.actif : 1,
      afficher_une_seule_fois: message.afficher_une_seule_fois !== undefined ? message.afficher_une_seule_fois : 0,
      cibles_fonctions: message.cibles_fonctions ? JSON.parse(message.cibles_fonctions) : [],
      cibles_utilisateurs: message.cibles_utilisateurs ? JSON.parse(message.cibles_utilisateurs) : []
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      toast.error('Le message est requis');
      return;
    }

    // Vérifier qu'au moins un critère de ciblage est sélectionné
    if (formData.cibles_fonctions.length === 0 && 
        formData.cibles_utilisateurs.length === 0) {
      toast.error('Veuillez sélectionner au moins un critère de ciblage (fonctions ou utilisateurs)');
      return;
    }

    const dataToSend = {
      ...formData,
      date_debut: formData.date_debut || null,
      date_fin: formData.date_fin || null,
      cibles_fonctions: formData.cibles_fonctions.length > 0 ? formData.cibles_fonctions : null,
      cibles_utilisateurs: formData.cibles_utilisateurs.length > 0 ? formData.cibles_utilisateurs : null
    };

    saveMutation.mutate(dataToSend);
  };

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

  const getTypeLabel = (type) => {
    switch (type) {
      case 'success':
        return 'Succès';
      case 'warning':
        return 'Avertissement';
      case 'error':
        return 'Erreur';
      default:
        return 'Information';
    }
  };

  const getPrioriteLabel = (priorite) => {
    switch (priorite) {
      case 3:
        return 'Urgent';
      case 2:
        return 'Important';
      default:
        return 'Normal';
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Chargement des messages système..." />;
  }

  return (
    <div className="system-messages-page">
      <div className="page-header">
        <div className="header-left">
          <h1><FaBullhorn /> Messages Système</h1>
          <p>Gérez les messages affichés aux utilisateurs lors de leur connexion</p>
        </div>
        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <FaPlus /> Nouveau message
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-content">
            <div className="form-header">
              <h2>{editingId ? 'Modifier le message' : 'Nouveau message'}</h2>
              <button
                className="btn-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  resetForm();
                }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Titre (optionnel)</label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  placeholder="Titre du message"
                />
              </div>

              <div className="form-group">
                <label>Message <span className="required">*</span></label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Contenu du message"
                  rows={5}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="info">Information</option>
                    <option value="success">Succès</option>
                    <option value="warning">Avertissement</option>
                    <option value="error">Erreur</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priorité</label>
                  <select
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: parseInt(e.target.value) })}
                  >
                    <option value={1}>Normal</option>
                    <option value={2}>Important</option>
                    <option value={3}>Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date de début (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Date de fin (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.actif === 1}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked ? 1 : 0 })}
                    />
                    Message actif
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.afficher_une_seule_fois === 1}
                      onChange={(e) => setFormData({ ...formData, afficher_une_seule_fois: e.target.checked ? 1 : 0 })}
                    />
                    Afficher une seule fois par utilisateur
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Fonctions ciblées
                  {formData.cibles_fonctions.length === 0 && formData.cibles_utilisateurs.length === 0 && (
                    <span className="warning-text"> (Au moins un critère requis)</span>
                  )}
                </label>
                <select
                  multiple
                  value={formData.cibles_fonctions.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setFormData({ ...formData, cibles_fonctions: selected });
                  }}
                  size={5}
                >
                  {fonctions.map(f => (
                    <option key={f.id} value={f.id}>{f.titre}</option>
                  ))}
                </select>
                <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs fonctions. Sélectionnez au moins une fonction ou un utilisateur.</small>
              </div>

              <div className="form-group">
                <label>
                  Utilisateurs ciblés
                  {formData.cibles_fonctions.length === 0 && formData.cibles_utilisateurs.length === 0 && (
                    <span className="warning-text"> (Au moins un critère requis)</span>
                  )}
                </label>
                <select
                  multiple
                  value={formData.cibles_utilisateurs.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setFormData({ ...formData, cibles_utilisateurs: selected });
                  }}
                  size={5}
                >
                  {utilisateurs.map(u => (
                    <option key={u.id} value={u.id}>{u.nom} {u.prenom} ({u.login})</option>
                  ))}
                </select>
                <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs. Sélectionnez au moins une fonction ou un utilisateur.</small>
              </div>
              
              <div className="form-info-box">
                <strong>⚠️ Important :</strong> Le message ne sera envoyé que si au moins un critère de ciblage est sélectionné (fonction ou utilisateur). 
                Si les deux critères sont sélectionnés, l'utilisateur doit correspondre aux deux (logique ET).
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  <FaTimes /> Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saveMutation.isLoading}
                >
                  <FaSave /> {saveMutation.isLoading ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="no-data">
          <FaBullhorn size={64} />
          <p>Aucun message système</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus /> Créer le premier message
          </button>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((message) => (
            <div key={message.id} className={`message-card ${message.actif === 1 ? 'active' : 'inactive'}`}>
              <div className="message-header">
                <div className="message-type">
                  {getTypeIcon(message.type)}
                  <span className="type-label">{getTypeLabel(message.type)}</span>
                  <span className={`priorite-badge priorite-${message.priorite}`}>
                    {getPrioriteLabel(message.priorite)}
                  </span>
                  {message.actif === 1 ? (
                    <span className="status-badge status-active">Actif</span>
                  ) : (
                    <span className="status-badge status-inactive">Inactif</span>
                  )}
                </div>
                <div className="message-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleEdit(message)}
                    title="Modifier"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(message.id)}
                    title="Supprimer"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="message-body">
                {message.titre && <h3>{message.titre}</h3>}
                <p>{message.message}</p>
              </div>

              <div className="message-footer">
                <div className="message-meta">
                  {message.date_debut && (
                    <span>Début: {new Date(message.date_debut).toLocaleString('fr-FR')}</span>
                  )}
                  {message.date_fin && (
                    <span>Fin: {new Date(message.date_fin).toLocaleString('fr-FR')}</span>
                  )}
                  {message.afficher_une_seule_fois === 1 && (
                    <span className="info-badge">Une seule fois</span>
                  )}
                </div>
                <div className="message-cibles">
                  {message.cibles_fonctions && (() => {
                    try {
                      const fonctions = JSON.parse(message.cibles_fonctions);
                      if (Array.isArray(fonctions) && fonctions.length > 0) {
                        return <span className="cible-badge">Fonctions ciblées ({fonctions.length})</span>;
                      }
                    } catch (e) {}
                    return null;
                  })()}
                  {message.cibles_utilisateurs && (() => {
                    try {
                      const utilisateurs = JSON.parse(message.cibles_utilisateurs);
                      if (Array.isArray(utilisateurs) && utilisateurs.length > 0) {
                        return <span className="cible-badge">Utilisateurs ciblés ({utilisateurs.length})</span>;
                      }
                    } catch (e) {}
                    return null;
                  })()}
                  {!message.cibles_fonctions && !message.cibles_utilisateurs && (
                    <span className="cible-badge cible-badge-warning">⚠️ Aucun ciblage - Message non envoyé</span>
                  )}
                </div>
                {message.createur_nom && (
                  <div className="message-creator">
                    Créé par {message.createur_nom} {message.createur_prenom} le {new Date(message.date_creation).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemMessages;
