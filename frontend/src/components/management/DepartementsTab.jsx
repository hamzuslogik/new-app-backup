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

const DepartementsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_departements_search', '');
  const [formData, setFormData] = useState({
    departement_code: '',
    departement_nom: '',
    departement_nom_uppercase: '',
    etat: 1
  });
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ departement_code: '', departement_nom: '', departement_nom_uppercase: '', etat: 1 });
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

  const { data, isLoading } = useQuery('departements', async () => {
    const response = await api.get('/management/departements');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.departement_code?.toLowerCase().includes(term) ||
      item.departement_nom?.toLowerCase().includes(term) ||
      item.departement_nom_uppercase?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/departements', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departements');
        toast.success('Département créé avec succès');
        setShowForm(false);
        setFormData({ departement_code: '', departement_nom: '', departement_nom_uppercase: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du département';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/departements/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departements');
        toast.success('Département mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ departement_code: '', departement_nom: '', departement_nom_uppercase: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du département';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/departements/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departements');
        toast.success('Département supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du département';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (dep) => {
    setEditingId(dep.id);
    setFormData({
      departement_code: dep.departement_code || '',
      departement_nom: dep.departement_nom || '',
      departement_nom_uppercase: dep.departement_nom_uppercase || '',
      etat: dep.etat || 1
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      departement_nom_uppercase: formData.departement_nom_uppercase || formData.departement_nom.toUpperCase()
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le département "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des départements..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Départements</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ departement_code: '', departement_nom: '', departement_nom_uppercase: '', etat: 1 }); }}>
          <FaPlus /> Ajouter un département
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par code, nom ou ID..."
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un département</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Code *
                  <Tooltip text="Code du département français (ex: 01, 75, 13). Maximum 3 caractères. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.departement_code}
                  onChange={(e) => setFormData({ ...formData, departement_code: e.target.value })}
                  required
                  maxLength="3"
                  placeholder="Ex: 01, 75, 13"
                />
              </div>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Nom complet du département. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.departement_nom}
                  onChange={(e) => setFormData({ ...formData, departement_nom: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  Nom en majuscules
                  <Tooltip text="Nom du département en majuscules. Si laissé vide, il sera généré automatiquement à partir du nom.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.departement_nom_uppercase}
                  onChange={(e) => setFormData({ ...formData, departement_nom_uppercase: e.target.value })}
                  placeholder="Généré automatiquement si vide"
                />
              </div>
              <div className="form-group">
                <label>
                  État
                  <Tooltip text="Définit si le département est actif (visible) ou inactif (masqué) dans le système.">
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
              <th>Code</th>
              <th>Nom</th>
              <th>Nom (MAJ)</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((dep) => (
                <tr key={dep.id}>
                  <td data-label="">{dep.id}</td>
                  <td data-label="Code:">{dep.departement_code}</td>
                  <td data-label="Nom:">{dep.departement_nom}</td>
                  <td data-label="Nom majuscules:">{dep.departement_nom_uppercase}</td>
                  <td data-label="État:">
                    <span className={`badge ${dep.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {dep.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(dep)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(dep.id, dep.departement_nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun département trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepartementsTab;

