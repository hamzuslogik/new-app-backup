import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaCheck, FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const SMSCategoriesTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    code: '', 
    titre: '', 
    message: '', 
    ordre: 0,
    actif: 1 
  });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_sms_categories_search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('management_sms_categories_itemsPerPage', 25);
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        handleCancel();
      }
    },
    'ctrl+s': (e) => {
      if (showForm) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  }, [showForm]);

  const { data, isLoading, error } = useQuery(
    'sms_categories_all',
    async () => {
      try {
        const response = await api.get('/management/sms-categories/all');
        if (!response.data || !response.data.success) {
          throw new Error(response.data?.message || 'Erreur lors du chargement des catégories SMS');
        }
        return Array.isArray(response.data.data) ? response.data.data : [];
      } catch (err) {
        console.error('Erreur lors du chargement des catégories SMS:', err);
        throw err;
      }
    },
    {
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                           error.message || 
                           'Erreur lors du chargement des catégories SMS';
        toast.error(errorMessage);
      },
      retry: 1,
      refetchOnWindowFocus: false
    }
  );

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    const dataArray = Array.isArray(data) ? data : [];
    if (!searchTerm.trim()) {
      return dataArray;
    }
    const term = searchTerm.toLowerCase();
    return dataArray.filter(item => 
      item?.code?.toLowerCase().includes(term) ||
      item?.titre?.toLowerCase().includes(term) ||
      item?.message?.toLowerCase().includes(term) ||
      item?.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const createMutation = useMutation(
    async (newData) => {
      const response = await api.post('/management/sms-categories', newData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sms_categories_all');
        queryClient.invalidateQueries('sms_categories'); // Invalider aussi la liste active
        toast.success('Catégorie SMS créée avec succès');
        handleCancel();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la création';
        toast.error(errorMessage);
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, ...updateData }) => {
      const response = await api.put(`/management/sms-categories/${id}`, updateData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sms_categories_all');
        queryClient.invalidateQueries('sms_categories'); // Invalider aussi la liste active
        toast.success('Catégorie SMS mise à jour avec succès');
        handleCancel();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la mise à jour';
        toast.error(errorMessage);
      }
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/sms-categories/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sms_categories_all');
        queryClient.invalidateQueries('sms_categories'); // Invalider aussi la liste active
        toast.success('Catégorie SMS supprimée avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la suppression';
        toast.error(errorMessage);
      }
    }
  );

  const handleAdd = () => {
    setFormData({ code: '', titre: '', message: '', ordre: 0, actif: 1 });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({
      code: item.code || '',
      titre: item.titre || '',
      message: item.message || '',
      ordre: item.ordre || 0,
      actif: item.actif !== undefined ? item.actif : 1
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ code: '', titre: '', message: '', ordre: 0, actif: 1 });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.code || !formData.titre || !formData.message) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie SMS ?')) {
      deleteMutation.mutate(id);
    }
  };

  // Variables disponibles pour le message
  const availableVariables = [
    { var: '{{prenom}}', desc: 'Prénom du client' },
    { var: '{{nom}}', desc: 'Nom du client' },
    { var: '{{date_rdv}}', desc: 'Date du rendez-vous (format: DD/MM/YYYY)' },
    { var: '{{heure_rdv}}', desc: 'Heure du rendez-vous (format: HH:MM)' },
    { var: '{{civ}}', desc: 'Civilité (MR, MME)' }
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Erreur lors du chargement des catégories SMS</p>
      </div>
    );
  }

  return (
    <div className="management-tab">
      <div className="tab-header">
        <div className="header-left">
          <h2>Catégories de Messages SMS</h2>
          <p>Gérez les catégories de messages SMS prédéfinis</p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={handleAdd}>
            <FaPlus /> Ajouter une catégorie
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-overlay">
          <div className="form-content">
            <div className="form-header">
              <h3>{editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
              <button className="btn-close" onClick={handleCancel}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Code * <span className="help-text">(unique, ex: rappel_rdv)</span></label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  className="form-control"
                  required
                  disabled={!!editingId}
                  placeholder="rappel_rdv"
                />
              </div>

              <div className="form-group">
                <label>Titre * <span className="help-text">(affiché dans l'interface)</span></label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  className="form-control"
                  required
                  placeholder="RAPPEL RDV"
                />
              </div>

              <div className="form-group">
                <label>Message * <span className="help-text">(template avec variables)</span></label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="form-control"
                  rows="8"
                  required
                  placeholder="Cher(e) Mr/Mme {{prenom}} {{nom}}, ..."
                />
                <div className="variables-help">
                  <strong>Variables disponibles :</strong>
                  <ul>
                    {availableVariables.map(v => (
                      <li key={v.var}><code>{v.var}</code> - {v.desc}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ordre d'affichage</label>
                  <input
                    type="number"
                    value={formData.ordre}
                    onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                    className="form-control"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Statut</label>
                  <select
                    value={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: parseInt(e.target.value) })}
                    className="form-control"
                  >
                    <option value={1}>Actif</option>
                    <option value={0}>Inactif</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={handleCancel}>
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn-save"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                >
                  {createMutation.isLoading || updateMutation.isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tab-content">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par code, titre ou message..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
          />
        </div>

        {filteredData.length === 0 ? (
          <div className="no-data">
            <p>Aucune catégorie SMS trouvée</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Titre</th>
                    <th>Message (aperçu)</th>
                    <th>Ordre</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td><code>{item.code}</code></td>
                      <td><strong>{item.titre}</strong></td>
                      <td className="message-preview">
                        {item.message ? (item.message.length > 100 ? item.message.substring(0, 100) + '...' : item.message) : '-'}
                      </td>
                      <td>{item.ordre || 0}</td>
                      <td>
                        {item.actif === 1 ? (
                          <span className="badge badge-success"><FaCheck /> Actif</span>
                        ) : (
                          <span className="badge badge-danger"><FaTimes /> Inactif</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(item)}
                            title="Modifier"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(item.id)}
                            title="Supprimer"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-controls">
                <div className="pagination-info">
                  <span>
                    Page {currentPage} sur {totalPages} ({filteredData.length} catégorie{filteredData.length > 1 ? 's' : ''})
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="items-per-page"
                  >
                    <option value={10}>10 par page</option>
                    <option value={25}>25 par page</option>
                    <option value={50}>50 par page</option>
                    <option value={100}>100 par page</option>
                  </select>
                </div>
                <div className="pagination-buttons">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-pagination"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-pagination"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SMSCategoriesTab;

