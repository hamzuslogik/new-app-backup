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

const ProduitsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_produits_search', '');
  const [formData, setFormData] = useState({ nom: '' });
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

  const { data, isLoading } = useQuery('produits', async () => {
    const response = await api.get('/management/produits');
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
      const response = await api.post('/management/produits', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('produits');
        toast.success('Produit créé avec succès');
        setShowForm(false);
        setFormData({ nom: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du produit';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/produits/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('produits');
        toast.success('Produit mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '' });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du produit';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/produits/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('produits');
        toast.success('Produit supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du produit';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (produit) => {
    setEditingId(produit.id);
    setFormData({ nom: produit.nom });
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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le produit "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des produits..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Produits</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ nom: '' }); }}>
          <FaPlus /> Ajouter un produit
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un produit</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Nom du produit. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: PAC, PV"
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
              filteredData.map((produit) => (
                <tr key={produit.id}>
                  <td data-label="">{produit.id}</td>
                  <td data-label="Nom:">{produit.nom}</td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(produit)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(produit.id, produit.nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun produit trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProduitsTab;

