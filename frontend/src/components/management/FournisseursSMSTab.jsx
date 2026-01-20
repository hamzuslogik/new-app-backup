import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle, FaFileExport, FaCheck, FaTimes } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import Pagination from '../common/Pagination';
import { exportToCSV } from '../../utils/exportToCSV';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const FournisseursSMSTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    nom: '', 
    login: '', 
    api_key: '', 
    api_url: 'https://api.octopush.com/v1/public',
    actif: 1 
  });
  const [showApiKey, setShowApiKey] = useState({});
  const [searchTerm, setSearchTerm] = useLocalStorage('management_fournisseurs_sms_search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('management_fournisseurs_sms_itemsPerPage', 25);
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setShowApiKey({});
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
    'fournisseurs_sms',
    async () => {
      const response = await api.get('/management/fournisseurs-sms');
      return response.data.data;
    }
  );

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.nom?.toLowerCase().includes(term) ||
      item.login?.toLowerCase().includes(term) ||
      item.api_url?.toLowerCase().includes(term) ||
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
      { key: 'nom', label: 'Nom' },
      { key: 'login', label: 'Login' },
      { key: 'api_url', label: 'URL API' },
      { key: 'actif', label: 'Actif' },
      { key: 'date_creation', label: 'Date création' }
    ];
    exportToCSV(filteredData.map(item => ({
      ...item,
      actif: item.actif === 1 ? 'Oui' : 'Non'
    })), columns, 'fournisseurs_sms');
    toast.success('Export CSV réussi');
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/fournisseurs-sms', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fournisseurs_sms');
        toast.success('Fournisseur SMS créé avec succès');
        setShowForm(false);
        setFormData({ 
          nom: '', 
          login: '', 
          api_key: '', 
          api_url: 'https://api.octopush.com/v1/public',
          actif: 1 
        });
        setShowApiKey({});
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du fournisseur SMS';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/fournisseurs-sms/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fournisseurs_sms');
        toast.success('Fournisseur SMS mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({ 
          nom: '', 
          login: '', 
          api_key: '', 
          api_url: 'https://api.octopush.com/v1/public',
          actif: 1 
        });
        setShowApiKey({});
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du fournisseur SMS';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/fournisseurs-sms/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fournisseurs_sms');
        toast.success('Fournisseur SMS supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du fournisseur SMS';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (fournisseur) => {
    setEditingId(fournisseur.id);
    setFormData({ 
      nom: fournisseur.nom || '', 
      login: fournisseur.login || '', 
      api_key: '', // Ne pas afficher la clé API existante pour des raisons de sécurité
      api_url: fournisseur.api_url || 'https://api.octopush.com/v1/public',
      actif: fournisseur.actif !== undefined ? fournisseur.actif : 1
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    // Si on modifie et que api_key est vide, ne pas l'envoyer (garder l'ancienne)
    if (editingId && !submitData.api_key.trim()) {
      delete submitData.api_key;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur SMS "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  const toggleApiKeyVisibility = (id) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return <LoadingSpinner text="Chargement des fournisseurs SMS..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Fournisseurs SMS</h2>
        <div className="tab-header-actions">
          <button className="btn-secondary" onClick={handleExportCSV} title="Exporter en CSV">
            <FaFileExport /> Exporter CSV
          </button>
          <button className="btn-primary" onClick={() => { 
            setShowForm(true); 
            setEditingId(null); 
            setFormData({ 
              nom: '', 
              login: '', 
              api_key: '', 
              api_url: 'https://api.octopush.com/v1/public',
              actif: 1 
            });
            setShowApiKey({});
          }}>
            <FaPlus /> Ajouter un fournisseur
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, login, URL ou ID..."
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un fournisseur SMS</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Nom *
                  <Tooltip text="Nom du fournisseur SMS (ex: Octopush, Twilio, etc.). Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Octopush"
                />
              </div>
              <div className="form-group">
                <label>
                  Login *
                  <Tooltip text="Identifiant de connexion fourni par le fournisseur SMS.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  required
                  placeholder="Ex: pro_c52@sub-accounts.com"
                />
              </div>
              <div className="form-group form-group-with-toggle">
                <label>
                  Clé API {editingId ? '(laisser vide pour conserver l\'actuelle)' : '*'}
                  <Tooltip text="Clé API fournie par le fournisseur SMS. En modification, laissez vide pour conserver la clé existante.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type={showApiKey[editingId || 'new'] ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  required={!editingId}
                  placeholder={editingId ? "Laisser vide pour conserver" : "Ex: GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh"}
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => toggleApiKeyVisibility(editingId || 'new')}
                  title={showApiKey[editingId || 'new'] ? 'Masquer' : 'Afficher'}
                >
                  {showApiKey[editingId || 'new'] ? <FaTimes /> : <FaCheck />}
                </button>
              </div>
              <div className="form-group">
                <label>
                  URL API *
                  <Tooltip text="URL de base de l'API du fournisseur SMS.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="url"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  required
                  placeholder="https://api.octopush.com/v1/public"
                />
              </div>
              <div className="form-group">
                <label>
                  Actif
                  <Tooltip text="Définit si le fournisseur SMS est actif (utilisable) ou inactif dans le système.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: parseInt(e.target.value) })}
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
                <button type="button" className="btn-secondary" onClick={() => { 
                  setShowForm(false); 
                  setEditingId(null);
                  setShowApiKey({});
                }}>
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
              <th>Login</th>
              <th>URL API</th>
              <th>Actif</th>
              <th>Date création</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData && paginatedData.length > 0 ? (
              paginatedData.map((fournisseur) => (
                <tr key={fournisseur.id}>
                  <td data-label="ID:">{fournisseur.id}</td>
                  <td data-label="Nom:">{fournisseur.nom}</td>
                  <td data-label="Login:">{fournisseur.login}</td>
                  <td data-label="URL API:">
                    <a href={fournisseur.api_url} target="_blank" rel="noopener noreferrer" className="link-external">
                      {fournisseur.api_url}
                    </a>
                  </td>
                  <td data-label="Actif:">
                    <span className={`badge ${fournisseur.actif === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {fournisseur.actif === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="Date création:">
                    {fournisseur.date_creation ? new Date(fournisseur.date_creation).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(fournisseur)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(fournisseur.id, fournisseur.nom)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun fournisseur SMS trouvé'}
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

export default FournisseursSMSTab;

