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

const EtatsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_etats_search', '');
  const [formData, setFormData] = useState({
    titre: '',
    color: '#3498db',
    groupe: '',
    ordre: 0,
    taux: 'NEUTRE',
    abbreviation: ''
  });
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ titre: '', color: '#3498db', groupe: '', ordre: 0, taux: 'NEUTRE', abbreviation: '' });
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

  const { data, isLoading } = useQuery('etats', async () => {
    const response = await api.get('/management/etats');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.titre?.toLowerCase().includes(term) ||
      item.abbreviation?.toLowerCase().includes(term) ||
      item.groupe?.toLowerCase().includes(term) ||
      item.taux?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/etats', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('etats');
        toast.success('État créé avec succès');
        setShowForm(false);
        setFormData({
          titre: '',
          color: '#3498db',
          groupe: '',
          ordre: 0,
          taux: 'NEUTRE',
          abbreviation: ''
        });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création de l\'état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/etats/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('etats');
        toast.success('État mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          titre: '',
          color: '#3498db',
          groupe: '',
          ordre: 0,
          taux: 'NEUTRE',
          abbreviation: ''
        });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour de l\'état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/etats/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('etats');
        toast.success('État supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression de l\'état';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (etat) => {
    setEditingId(etat.id);
    setFormData({
      titre: etat.titre || '',
      color: etat.color || '#3498db',
      groupe: etat.groupe || '',
      ordre: etat.ordre || 0,
      taux: etat.taux || 'NEUTRE',
      abbreviation: etat.abbreviation || ''
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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'état "${titre}" ? Cette action est irréversible.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des états..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des États</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ titre: '', color: '#3498db', groupe: '', ordre: 0, taux: 'NEUTRE', abbreviation: '' }); }}>
          <FaPlus /> Ajouter un état
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par titre, abréviation, groupe, taux ou ID..."
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un état</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Titre *
                  <Tooltip text="Nom de l'état. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  required
                  placeholder="Ex: Confirmé, Annulé, En attente"
                />
              </div>
              <div className="form-group">
                <label>
                  Couleur
                  <Tooltip text="Couleur d'affichage de l'état dans le système. Format hexadécimal (ex: #3498db).">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={{ width: '60px', height: '40px' }}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3498db"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>
                  Groupe
                  <Tooltip text="Groupe de classification de l'état (ex: Groupe 0, Groupe 1). Utilisé pour organiser les états.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.groupe}
                  onChange={(e) => setFormData({ ...formData, groupe: e.target.value })}
                  placeholder="Ex: Groupe 1, Groupe 2"
                />
              </div>
              <div className="form-group">
                <label>
                  Ordre
                  <Tooltip text="Ordre d'affichage de l'état. Plus le nombre est petit, plus l'état apparaît en premier.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="number"
                  value={formData.ordre}
                  onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>
                  Taux
                  <Tooltip text="Impact de l'état : POSITIVE (favorable), NEGATIVE (défavorable), ou NEUTRE (neutre).">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.taux}
                  onChange={(e) => setFormData({ ...formData, taux: e.target.value })}
                >
                  <option value="NEUTRE">NEUTRE</option>
                  <option value="POSITIVE">POSITIVE</option>
                  <option value="NEGATIVE">NEGATIVE</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  Abbréviation
                  <Tooltip text="Abréviation courte de l'état (maximum 10 caractères). Utilisée pour l'affichage compact.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
                  placeholder="Ex: CONF, ANNU"
                  maxLength="10"
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
              <th>Titre</th>
              <th>Couleur</th>
              <th>Groupe</th>
              <th>Ordre</th>
              <th>Taux</th>
              <th>Abbréviation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((etat) => (
                <tr key={etat.id}>
                  <td data-label="">{etat.id}</td>
                  <td data-label="Titre:">{etat.titre}</td>
                  <td data-label="Couleur:">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          backgroundColor: etat.color || '#3498db',
                          border: '1px solid #ddd',
                          borderRadius: '3px'
                        }}
                      />
                      <span>{etat.color || '-'}</span>
                    </div>
                  </td>
                  <td data-label="Groupe:">{etat.groupe || '-'}</td>
                  <td data-label="Ordre:">{etat.ordre || 0}</td>
                  <td data-label="Taux:">
                    <span className={`badge ${
                      etat.taux === 'POSITIVE' ? 'badge-success' :
                      etat.taux === 'NEGATIVE' ? 'badge-danger' :
                      'badge-secondary'
                    }`}>
                      {etat.taux || 'NEUTRE'}
                    </span>
                  </td>
                  <td data-label="Abréviation:">{etat.abbreviation || '-'}</td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(etat)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(etat.id, etat.titre)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun état trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EtatsTab;

