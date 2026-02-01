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

const FinancementTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_financement_search', '');
  const [formData, setFormData] = useState({ nom: '', ordre: 0, etat: 1 });
  const queryClient = useQueryClient();

  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '', ordre: 0, etat: 1 });
      }
    },
    'ctrl+s': (e) => {
      if (showForm) {
        e.preventDefault();
        const form = document.querySelector('.form-content form');
        if (form) form.requestSubmit();
      }
    }
  }, [showForm]);

  const { data, isLoading } = useQuery('financement', async () => {
    const response = await api.get('/management/financement');
    return response.data.data;
  });

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
    async (payload) => {
      const response = await api.post('/management/financement', payload);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('financement');
        toast.success('Type de financement créé avec succès');
        setShowForm(false);
        setFormData({ nom: '', ordre: 0, etat: 1 });
      },
      onError: (error) => {
        const msg = error.response?.data?.message || error.message || 'Erreur lors de la création';
        toast.error(msg, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data: payload }) => {
      const response = await api.put(`/management/financement/${id}`, payload);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('financement');
        toast.success('Type de financement mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '', ordre: 0, etat: 1 });
      },
      onError: (error) => {
        const msg = error.response?.data?.message || error.message || 'Erreur lors de la mise à jour';
        toast.error(msg, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/financement/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('financement');
        toast.success('Type de financement supprimé avec succès');
      },
      onError: (error) => {
        const msg = error.response?.data?.message || error.message || 'Erreur lors de la suppression';
        toast.error(msg, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      nom: item.nom || '',
      ordre: item.ordre != null ? item.ordre : 0,
      etat: item.etat != null ? Number(item.etat) : 1,
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nom: formData.nom.trim(),
      ordre: parseInt(formData.ordre, 10) || 0,
      etat: formData.etat ? 1 : 0,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le type de financement "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des types de financement..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion Financement</h2>
        <p className="tab-description">Types de financement proposés lors de la signature d&apos;une fiche.</p>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ nom: '', ordre: 0, etat: 1 }); }}>
          <FaPlus /> Ajouter un type de financement
        </button>
      </div>

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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un type de financement</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Libellé du type de financement (ex: Prêt 10 ans, Crédit immobilier). Saisi lors de la signature.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Prêt 10 ans, Crédit immobilier, Autofinancement"
                />
              </div>
              <div className="form-group">
                <label>Ordre d&apos;affichage</label>
                <input
                  type="number"
                  min="0"
                  value={formData.ordre}
                  onChange={(e) => setFormData({ ...formData, ordre: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!formData.etat}
                    onChange={(e) => setFormData({ ...formData, etat: e.target.checked ? 1 : 0 })}
                  />
                  Actif (proposé lors de la signature)
                </label>
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
              <th>Ordre</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr key={item.id}>
                  <td data-label="ID">{item.id}</td>
                  <td data-label="Nom">{item.nom}</td>
                  <td data-label="Ordre">{item.ordre != null ? item.ordre : 0}</td>
                  <td data-label="État">{item.etat === 1 ? 'Actif' : 'Inactif'}</td>
                  <td data-label="Actions">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(item)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(item.id, item.nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun type de financement. Ajoutez-en pour les proposer lors de la signature.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancementTab;
