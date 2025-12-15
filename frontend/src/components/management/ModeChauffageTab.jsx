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

const ModeChauffageTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nom: '' });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_mode-chauffage_search', '');
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '' });
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

  const { data, isLoading } = useQuery('mode-chauffage', async () => {
    const response = await api.get('/management/mode-chauffage');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.nom?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/mode-chauffage', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mode-chauffage');
        toast.success('Mode de chauffage créé avec succès');
        setShowForm(false);
        setFormData({ nom: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du mode de chauffage';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/mode-chauffage/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mode-chauffage');
        toast.success('Mode de chauffage mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du mode de chauffage';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/mode-chauffage/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('mode-chauffage');
        toast.success('Mode de chauffage supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du mode de chauffage';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (mode) => {
    setEditingId(mode.id);
    setFormData({ nom: mode.nom });
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

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le mode de chauffage "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des modes de chauffage..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Modes de Chauffage</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ nom: '' }); }}>
          <FaPlus /> Ajouter un mode de chauffage
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ID..."
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un mode de chauffage</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Nom du mode de chauffage. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Électricité, Gaz, Fioul"
                />
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
              <th>Nom</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((mode) => (
                <tr key={mode.id}>
                  <td data-label="">{mode.id}</td>
                  <td data-label="Nom:">{mode.nom}</td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(mode)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(mode.id, mode.nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun mode de chauffage trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModeChauffageTab;

