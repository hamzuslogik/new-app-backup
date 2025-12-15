import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle, FaFileExport } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import Pagination from '../common/Pagination';
import { exportToCSV } from '../../utils/exportToCSV';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const CentresTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ titre: '', etat: 1 });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_centres_search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('management_centres_itemsPerPage', 25);
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
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

  const { data, isLoading } = useQuery(
    'centres',
    async () => {
      const response = await api.get('/management/centres');
      return response.data.data;
    }
  );

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.titre?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Réinitialiser la page si nécessaire
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleExportCSV = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'titre', label: 'Titre' },
      { key: 'etat', label: 'État' }
    ];
    exportToCSV(filteredData.map(item => ({
      ...item,
      etat: item.etat === 1 ? 'Actif' : 'Inactif'
    })), columns, 'centres');
    toast.success('Export CSV réussi');
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/centres', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('centres');
        toast.success('Centre créé avec succès');
        setShowForm(false);
        setFormData({ titre: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du centre';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/centres/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('centres');
        toast.success('Centre mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ titre: '', etat: 1 });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du centre';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/centres/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('centres');
        toast.success('Centre supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du centre';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (centre) => {
    setEditingId(centre.id);
    setFormData({ titre: centre.titre, etat: centre.etat });
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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le centre "${titre}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des centres..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Centres</h2>
        <div className="tab-header-actions">
          <button className="btn-secondary" onClick={handleExportCSV} title="Exporter en CSV">
            <FaFileExport /> Exporter CSV
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ titre: '', etat: 1 }); }}>
            <FaPlus /> Ajouter un centre
          </button>
        </div>
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un centre</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Titre *
                  <Tooltip text="Nom du centre d'activité. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  required
                  placeholder="Ex: Paris, Lyon, Marseille"
                />
              </div>
              <div className="form-group">
                <label>
                  État
                  <Tooltip text="Définit si le centre est actif (visible) ou inactif (masqué) dans le système.">
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
              <th>Titre</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData && paginatedData.length > 0 ? (
              paginatedData.map((centre) => (
                <tr key={centre.id}>
                  <td data-label="">{centre.id}</td>
                  <td data-label="Titre:">{centre.titre}</td>
                  <td data-label="État:">
                    <span className={`badge ${centre.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {centre.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(centre)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(centre.id, centre.titre)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun centre trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newItemsPerPage) => {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
};

export default CentresTab;

