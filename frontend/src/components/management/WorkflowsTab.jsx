import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle, FaFileExport, FaPlay, FaToggleOn, FaToggleOff, FaHistory } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import Pagination from '../common/Pagination';
import { exportToCSV } from '../../utils/exportToCSV';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const WorkflowsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    actif: 1,
    priorite: 0,
    triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
    actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
  });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_workflows_search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('management_workflows_itemsPerPage', 25);
  const [showExecutions, setShowExecutions] = useState(null);
  const queryClient = useQueryClient();

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
    'workflows',
    async () => {
      const response = await api.get('/workflows');
      return response.data.data;
    }
  );

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.nom?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleExportCSV = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'nom', label: 'Nom' },
      { key: 'actif', label: 'État' },
      { key: 'priorite', label: 'Priorité' },
      { key: 'triggers_count', label: 'Déclencheurs' },
      { key: 'actions_count', label: 'Actions' }
    ];
    exportToCSV(filteredData.map(item => ({
      ...item,
      actif: item.actif === 1 ? 'Actif' : 'Inactif'
    })), columns, 'workflows');
    toast.success('Export CSV réussi');
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/workflows', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow créé avec succès');
        setShowForm(false);
        setFormData({
          nom: '',
          description: '',
          actif: 1,
          priorite: 0,
          triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
          actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/workflows/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/workflows/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow supprimé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  const toggleMutation = useMutation(
    async (id) => {
      const response = await api.patch(`/workflows/${id}/toggle`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow modifié avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  );

  const testMutation = useMutation(
    async (id) => {
      const response = await api.post(`/workflows/${id}/test`, { test_data: { fiche: { id: 1, nom: 'Test', prenom: 'Test' } } });
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success(`Workflow testé: ${data.data.actions_to_execute.length} action(s) à exécuter`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du test');
      }
    }
  );

  const handleEdit = (workflow) => {
    setEditingId(workflow.id);
    setFormData({
      nom: workflow.nom,
      description: workflow.description || '',
      actif: workflow.actif,
      priorite: workflow.priorite || 0,
      triggers: workflow.triggers || [{ type: 'fiche_created', config: {}, conditions: [] }],
      actions: workflow.actions || [{ type: 'notification', config: {}, conditions: [], ordre: 0, delay_seconds: 0 }]
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

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le workflow "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  const addTrigger = () => {
    setFormData({
      ...formData,
      triggers: [...formData.triggers, { type: 'fiche_created', config: {}, conditions: [] }]
    });
  };

  const removeTrigger = (index) => {
    setFormData({
      ...formData,
      triggers: formData.triggers.filter((_, i) => i !== index)
    });
  };

  const updateTrigger = (index, field, value) => {
    const newTriggers = [...formData.triggers];
    newTriggers[index] = { ...newTriggers[index], [field]: value };
    setFormData({ ...formData, triggers: newTriggers });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'notification', config: {}, conditions: [], ordre: formData.actions.length, delay_seconds: 0 }]
    });
  };

  const removeAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index, field, value) => {
    const newActions = [...formData.actions];
    if (field === 'config' && typeof value === 'object') {
      newActions[index] = { ...newActions[index], config: { ...newActions[index].config, ...value } };
    } else {
      newActions[index] = { ...newActions[index], [field]: value };
    }
    setFormData({ ...formData, actions: newActions });
  };

  if (isLoading) return <LoadingSpinner text="Chargement des workflows..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Workflows</h2>
        <div className="tab-header-actions">
          <button className="btn-secondary" onClick={handleExportCSV} title="Exporter en CSV">
            <FaFileExport /> Exporter CSV
          </button>
          <button className="btn-primary" onClick={() => { 
            setShowForm(true); 
            setEditingId(null); 
            setFormData({
              nom: '',
              description: '',
              actif: 1,
              priorite: 0,
              triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
              actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
            });
          }}>
            <FaPlus /> Créer un workflow
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, description ou ID..."
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
          <div className="form-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{editingId ? 'Modifier' : 'Créer'} un workflow</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nom *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Rappel RDV 24h avant"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  placeholder="Description du workflow..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Actif</label>
                  <select
                    value={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: parseInt(e.target.value) })}
                  >
                    <option value={1}>Oui</option>
                    <option value={0}>Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priorité</label>
                  <input
                    type="number"
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Déclencheurs</h4>
                {formData.triggers.map((trigger, index) => (
                  <div key={index} style={{ border: '1px solid #ddd', padding: '16px', marginBottom: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong>Déclencheur {index + 1}</strong>
                      {formData.triggers.length > 1 && (
                        <button type="button" className="btn-danger" onClick={() => removeTrigger(index)}>
                          <FaTrash /> Supprimer
                        </button>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Type d'événement *</label>
                      <select
                        value={trigger.type}
                        onChange={(e) => updateTrigger(index, 'type', e.target.value)}
                        required
                      >
                        <option value="fiche_created">Fiche créée</option>
                        <option value="fiche_updated">Fiche modifiée</option>
                        <option value="etat_changed">État changé</option>
                        <option value="rdv_created">RDV créé</option>
                        <option value="rdv_validated">RDV validé</option>
                        <option value="compte_rendu_created">Compte rendu créé</option>
                        <option value="compte_rendu_approved">Compte rendu approuvé</option>
                        <option value="scheduled">Programmé (cron)</option>
                      </select>
                    </div>
                    {trigger.type === 'etat_changed' && (
                      <div className="form-group">
                        <label>État cible (optionnel)</label>
                        <input
                          type="number"
                          placeholder="ID de l'état"
                          value={trigger.config?.etat_id || ''}
                          onChange={(e) => updateTrigger(index, 'config', { ...trigger.config, etat_id: e.target.value ? parseInt(e.target.value) : null })}
                        />
                      </div>
                    )}
                    {trigger.type === 'scheduled' && (
                      <div className="form-group">
                        <label>Expression Cron</label>
                        <input
                          type="text"
                          placeholder="0 * * * * (toutes les heures)"
                          value={trigger.config?.cron || ''}
                          onChange={(e) => updateTrigger(index, 'config', { ...trigger.config, cron: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addTrigger}>
                  <FaPlus /> Ajouter un déclencheur
                </button>
              </div>

              <div className="form-section">
                <h4>Actions</h4>
                {formData.actions.map((action, index) => (
                  <div key={index} style={{ border: '1px solid #ddd', padding: '16px', marginBottom: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong>Action {index + 1}</strong>
                      <button type="button" className="btn-danger" onClick={() => removeAction(index)}>
                        <FaTrash /> Supprimer
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label>Type d'action *</label>
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(index, 'type', e.target.value)}
                          required
                        >
                          <option value="notification">Notification interne</option>
                          <option value="sms">SMS</option>
                          <option value="email">Email</option>
                          <option value="update_field">Mettre à jour un champ</option>
                          <option value="change_etat">Changer l'état</option>
                          <option value="webhook">Webhook HTTP</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Délai (secondes)</label>
                        <input
                          type="number"
                          value={action.delay_seconds || 0}
                          onChange={(e) => updateAction(index, 'delay_seconds', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                    </div>

                    {action.type === 'notification' && (
                      <>
                        <div className="form-group">
                          <label>Type de notification</label>
                          <input
                            type="text"
                            value={action.config?.type || 'workflow'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, type: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="2"
                            placeholder="Message de notification. Variables: {fiche.nom}, {fiche.prenom}, {fiche.id}"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Destinataire</label>
                          <select
                            value={action.config?.destination || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, destination: e.target.value })}
                          >
                            <option value="id_confirmateur">Confirmateur de la fiche</option>
                            <option value="id_agent">Agent de la fiche</option>
                            <option value="id_commercial">Commercial de la fiche</option>
                            <option value="">Tous les admins</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'sms' && (
                      <>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="2"
                            placeholder="Message SMS. Variables: {fiche.nom}, {fiche.prenom}, {fiche.tel}"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Champ téléphone</label>
                          <select
                            value={action.config?.tel_field || 'tel'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, tel_field: e.target.value })}
                          >
                            <option value="tel">tel</option>
                            <option value="gsm1">gsm1</option>
                            <option value="gsm2">gsm2</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'update_field' && (
                      <>
                        <div className="form-group">
                          <label>Champ à mettre à jour *</label>
                          <input
                            type="text"
                            value={action.config?.field || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, field: e.target.value })}
                            placeholder="Ex: id_confirmateur, id_agent"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Valeur *</label>
                          <input
                            type="text"
                            value={action.config?.value || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, value: e.target.value })}
                            placeholder="Valeur ou variable: {user.id}, {fiche.id_confirmateur}"
                            required
                          />
                        </div>
                      </>
                    )}

                    {action.type === 'change_etat' && (
                      <div className="form-group">
                        <label>ID de l'état *</label>
                        <input
                          type="number"
                          value={action.config?.etat_id || ''}
                          onChange={(e) => updateAction(index, 'config', { ...action.config, etat_id: e.target.value ? parseInt(e.target.value) : null })}
                          required
                        />
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <>
                        <div className="form-group">
                          <label>URL *</label>
                          <input
                            type="url"
                            value={action.config?.url || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, url: e.target.value })}
                            placeholder="https://example.com/webhook"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Méthode HTTP</label>
                          <select
                            value={action.config?.method || 'POST'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, method: e.target.value })}
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addAction}>
                  <FaPlus /> Ajouter une action
                </button>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
                  {editingId ? 'Modifier' : 'Créer'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Annuler
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
              <th>Description</th>
              <th>Déclencheurs</th>
              <th>Actions</th>
              <th>Priorité</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                  Aucun workflow trouvé
                </td>
              </tr>
            ) : (
              paginatedData.map((workflow) => (
                <tr key={workflow.id}>
                  <td>{workflow.id}</td>
                  <td><strong>{workflow.nom}</strong></td>
                  <td>{workflow.description || '-'}</td>
                  <td>{workflow.triggers_count || 0}</td>
                  <td>{workflow.actions_count || 0}</td>
                  <td>{workflow.priorite}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => toggleMutation.mutate(workflow.id)}
                      title={workflow.actif === 1 ? 'Désactiver' : 'Activer'}
                    >
                      {workflow.actif === 1 ? <FaToggleOn style={{ color: '#4CAF50' }} /> : <FaToggleOff style={{ color: '#999' }} />}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => testMutation.mutate(workflow.id)}
                        title="Tester le workflow"
                      >
                        <FaPlay />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setShowExecutions(showExecutions === workflow.id ? null : workflow.id)}
                        title="Voir l'historique"
                      >
                        <FaHistory />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(workflow)}
                        title="Modifier"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(workflow.id, workflow.nom)}
                        title="Supprimer"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showExecutions && (
        <ExecutionsModal workflowId={showExecutions} onClose={() => setShowExecutions(null)} />
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredData.length}
        />
      )}
    </div>
  );
};

// Composant modal pour l'historique d'exécution
const ExecutionsModal = ({ workflowId, onClose }) => {
  const { data, isLoading } = useQuery(
    ['workflow-executions', workflowId],
    async () => {
      const response = await api.get(`/workflows/${workflowId}/executions`);
      return response.data.data;
    },
    { enabled: !!workflowId }
  );

  if (!workflowId) return null;

  return (
    <div className="form-modal" onClick={onClose}>
      <div className="form-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <h3>Historique d'exécution</h3>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Fiche</th>
                  <th>Utilisateur</th>
                  <th>Erreur</th>
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((exec) => (
                    <tr key={exec.id}>
                      <td>{exec.id}</td>
                      <td>{exec.started_at ? new Date(exec.started_at).toLocaleString('fr-FR') : '-'}</td>
                      <td>
                        <span className={`badge badge-${exec.status}`}>
                          {exec.status}
                        </span>
                      </td>
                      <td>{exec.fiche_nom && exec.fiche_prenom ? `${exec.fiche_nom} ${exec.fiche_prenom}` : exec.id_fiche || '-'}</td>
                      <td>{exec.user_pseudo || '-'}</td>
                      <td>{exec.error_message || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>Aucune exécution</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsTab;

