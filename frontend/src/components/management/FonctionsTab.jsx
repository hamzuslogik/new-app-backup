import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const FonctionsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_fonctions_search', '');
  const [formData, setFormData] = useState({ titre: '', etat: 1, page_accueil: '/dashboard', groupes_messages_autorises: [] });
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ titre: '', etat: 1, page_accueil: '/dashboard', groupes_messages_autorises: [] });
      }
    },
    'ctrl+s': (e) => {
      if (showForm) {
        e.preventDefault();
        const form = document.querySelector('.form-content form');
        if (form) {
          form.requestSubmit();
        }
      }
    }
  }, [showForm]);

  const { data: fonctions, isLoading } = useQuery('fonctions', async () => {
    const response = await api.get('/management/fonctions?all=true');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!fonctions) return [];
    if (!searchTerm.trim()) return fonctions;
    const term = searchTerm.toLowerCase();
    return fonctions.filter(item => 
      item.titre?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [fonctions, searchTerm]);

  // Gérer la sélection/désélection des fonctions pour groupes_messages_autorises
  const handleToggleFonctionMessage = (fonctionId) => {
    const current = formData.groupes_messages_autorises || [];
    if (current.includes(fonctionId)) {
      setFormData({
        ...formData,
        groupes_messages_autorises: current.filter(id => id !== fonctionId)
      });
    } else {
      setFormData({
        ...formData,
        groupes_messages_autorises: [...current, fonctionId]
      });
    }
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/fonctions', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction créée avec succès');
        setShowForm(false);
        setFormData({ titre: '', etat: 1, page_accueil: '/dashboard', groupes_messages_autorises: [] });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      // Convertir groupes_messages_autorises en tableau si nécessaire
      const payload = {
        ...data,
        groupes_messages_autorises: data.groupes_messages_autorises && data.groupes_messages_autorises.length > 0
          ? data.groupes_messages_autorises
          : null
      };
      const response = await api.put(`/management/fonctions/${id}`, payload);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction mise à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ titre: '', etat: 1, page_accueil: '/dashboard', groupes_messages_autorises: [] });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/fonctions/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction supprimée avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (fonction) => {
    setEditingId(fonction.id);
    // Parser groupes_messages_autorises depuis JSON si présent
    let groupesMessages = [];
    if (fonction.groupes_messages_autorises) {
      try {
        groupesMessages = JSON.parse(fonction.groupes_messages_autorises);
        if (!Array.isArray(groupesMessages)) {
          groupesMessages = [];
        }
      } catch (e) {
        groupesMessages = [];
      }
    }
    setFormData({ 
      titre: fonction.titre, 
      etat: fonction.etat, 
      page_accueil: fonction.page_accueil || '/dashboard',
      groupes_messages_autorises: groupesMessages
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id, titre) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la fonction "${titre}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des fonctions..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Fonctions</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ titre: '', etat: 1, page_accueil: '/dashboard' }); }}>
          <FaPlus /> Ajouter une fonction
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par titre ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {searchTerm && (
          <span className="search-results-count">
            {filteredData.length} résultat(s) trouvé(s)
          </span>
        )}
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-content">
            <h3>{editingId ? 'Modifier' : 'Ajouter'} une fonction</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Titre *
                  <Tooltip text="Nom de la fonction/rôle dans le système. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  required
                  placeholder="Ex: Administrateur, Commercial, Agent"
                />
              </div>
              <div className="form-group">
                <label>
                  État
                  <Tooltip text="Définit si la fonction est active (visible) ou inactive (masquée) dans le système.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.etat}
                  onChange={(e) => setFormData({ ...formData, etat: parseInt(e.target.value) })}
                >
                  <option value={1}>Actif</option>
                  <option value={0}>Inactif</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  Page d'accueil
                  <Tooltip text="Page vers laquelle les utilisateurs de cette fonction seront redirigés après connexion.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.page_accueil}
                  onChange={(e) => setFormData({ ...formData, page_accueil: e.target.value })}
                >
                  <option value="/dashboard">Tableau de bord</option>
                  <option value="/fiches">Fiches</option>
                  <option value="/planning">Planning</option>
                  <option value="/planning-commercial">Planning Commercial</option>
                  <option value="/planning-dep">Planning Dép</option>
                  <option value="/statistiques">Statistiques</option>
                  <option value="/statistiques-rdv">Statistiques RDV</option>
                  <option value="/affectation">Affectation</option>
                  <option value="/suivi-telepro">Suivi Télépro</option>
                  <option value="/suivi-agents-qualif">Suivi Agents Qualif</option>
                  <option value="/suivi-agents">Suivi des Agents</option>
                  <option value="/production-qualif">Production Qualif</option>
                  <option value="/controle-qualite">Contrôle Qualité</option>
                  <option value="/compte-rendu">Compte Rendu</option>
                  <option value="/phase3">Phase 3</option>
                  <option value="/messages">Messages</option>
                  <option value="/decalages">Décalages</option>
                  <option value="/validation">Validation</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  Groupes autorisés pour les messages
                  <Tooltip text="Sélectionnez les fonctions auxquelles les utilisateurs de cette fonction peuvent envoyer des messages. Si aucune fonction n'est sélectionnée, tous les utilisateurs sont autorisés.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <div className="groupes-messages-container">
                  {fonctions && fonctions.length > 0 ? (
                    <div className="groupes-messages-checkboxes">
                      {fonctions
                        .filter(f => f.id !== editingId) // Exclure la fonction en cours d'édition
                        .map(fonction => (
                          <label key={fonction.id} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={(formData.groupes_messages_autorises || []).includes(fonction.id)}
                              onChange={() => handleToggleFonctionMessage(fonction.id)}
                            />
                            <span>{fonction.titre} (ID: {fonction.id})</span>
                          </label>
                        ))}
                    </div>
                  ) : (
                    <div className="no-fonctions">Aucune fonction disponible</div>
                  )}
                  {(formData.groupes_messages_autorises || []).length === 0 && (
                    <div className="info-message">
                      <small>Aucune fonction sélectionnée = tous les utilisateurs sont autorisés</small>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
                  {createMutation.isLoading || updateMutation.isLoading ? (
                    <>
                      <LoadingSpinner size="small" text="" />
                      {editingId ? 'Modification...' : 'Création...'}
                    </>
                  ) : (
                    <>
                      {editingId ? 'Modifier' : 'Créer'} <span className="shortcut-hint">(Ctrl+S)</span>
                    </>
                  )}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Annuler <span className="shortcut-hint">(Esc)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titre</th>
              <th>État</th>
              <th>Page d'accueil</th>
              <th>Groupes messages</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((fonction) => (
                <tr key={fonction.id}>
                  <td data-label="">{fonction.id}</td>
                  <td data-label="Titre:">{fonction.titre}</td>
                  <td data-label="État:">
                    <span className={`badge ${fonction.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {fonction.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="Page d'accueil:">
                    <span className="page-accueil-badge">
                      {fonction.page_accueil || '/dashboard'}
                    </span>
                  </td>
                  <td data-label="Groupes messages:">
                    {fonction.groupes_messages_autorises ? (
                      (() => {
                        try {
                          const groupes = JSON.parse(fonction.groupes_messages_autorises);
                          if (Array.isArray(groupes) && groupes.length > 0) {
                            // Récupérer les titres des fonctions
                            const groupesTitres = groupes.map(id => {
                              const f = fonctions?.find(f => f.id === id);
                              return f ? f.titre : `ID ${id}`;
                            });
                            return (
                              <span className="groupes-messages-badge" title={groupesTitres.join(', ')}>
                                {groupes.length} fonction{groupes.length > 1 ? 's' : ''}
                              </span>
                            );
                          }
                        } catch (e) {
                          // Ignorer les erreurs de parsing
                        }
                        return <span className="groupes-messages-badge">Tous</span>;
                      })()
                    ) : (
                      <span className="groupes-messages-badge all">Tous</span>
                    )}
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(fonction)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(fonction.id, fonction.titre)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucune fonction trouvée'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FonctionsTab;

