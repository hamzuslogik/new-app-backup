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

const SousEtatTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ id_etat: '', titre: '' });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_sous-etat_search', '');
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ id_etat: '', titre: '' });
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

  const { data, isLoading } = useQuery('sous-etat', async () => {
    const response = await api.get('/management/sous-etat');
    return response.data.data;
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const response = await api.get('/management/etats');
    return response.data.data || [];
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.titre?.toLowerCase().includes(term) ||
      item.etat_titre?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term) ||
      item.id_etat?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/sous-etat', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sous-etat');
        toast.success('Sous-état créé avec succès');
        setShowForm(false);
        setFormData({ id_etat: '', titre: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du sous-état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/sous-etat/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sous-etat');
        toast.success('Sous-état mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ id_etat: '', titre: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du sous-état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/sous-etat/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sous-etat');
        toast.success('Sous-état supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du sous-état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (sousEtat) => {
    setEditingId(sousEtat.id);
    setFormData({ id_etat: sousEtat.id_etat || '', titre: sousEtat.titre || '' });
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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le sous-état "${titre}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des sous-états..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Sous-états</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ id_etat: '', titre: '' }); }}>
          <FaPlus /> Ajouter un sous-état
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par titre, état ou ID..."
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un sous-état</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  État parent *
                  <Tooltip text="État principal auquel appartient ce sous-état. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.id_etat}
                  onChange={(e) => setFormData({ ...formData, id_etat: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Sélectionner un état...</option>
                  {etatsData && etatsData.map(etat => (
                    <option key={etat.id} value={etat.id}>
                      {etat.titre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  Titre *
                  <Tooltip text="Nom du sous-état. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  required
                  placeholder="Ex: Appel raccroché, Répondeur"
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
              <th>État parent</th>
              <th>Titre</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((sousEtat) => (
                <tr key={sousEtat.id}>
                  <td data-label="">{sousEtat.id}</td>
                  <td data-label="État:">{sousEtat.etat_titre || `État ${sousEtat.id_etat}`}</td>
                  <td data-label="Titre:">{sousEtat.titre}</td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(sousEtat)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(sousEtat.id, sousEtat.titre)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun sous-état trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SousEtatTab;

