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

const InstallateursTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nom: '', etat: 1 });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_installateurs_search', '');
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '', etat: 1 });
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

  const { data, isLoading } = useQuery('installateurs', async () => {
    const response = await api.get('/management/installateurs');
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
      const response = await api.post('/management/installateurs', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('installateurs');
        toast.success('Installateur créé avec succès');
        setShowForm(false);
        setFormData({ nom: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création de l\'installateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/installateurs/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('installateurs');
        toast.success('Installateur mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour de l\'installateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/installateurs/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('installateurs');
        toast.success('Installateur supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression de l\'installateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (installateur) => {
    setEditingId(installateur.id);
    setFormData({ nom: installateur.nom, etat: installateur.etat || 1 });
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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'installateur "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des installateurs..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Installateurs</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ nom: '', etat: 1 }); }}>
          <FaPlus /> Ajouter un installateur
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un installateur</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Nom de l'installateur. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Installateur ABC, XYZ Installation"
                />
              </div>
              <div className="form-group">
                <label>
                  État
                  <Tooltip text="Définit si l'installateur est actif (visible) ou inactif (masqué) dans le système.">
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
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((installateur) => (
                <tr key={installateur.id}>
                  <td data-label="">{installateur.id}</td>
                  <td data-label="Nom:">{installateur.nom}</td>
                  <td data-label="État:">
                    <span className={`badge ${installateur.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {installateur.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(installateur)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(installateur.id, installateur.nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun installateur trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InstallateursTab;

