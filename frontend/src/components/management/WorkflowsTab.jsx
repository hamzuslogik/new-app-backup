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

  // Récupérer les états pour les sélecteurs
  const { data: etatsData } = useQuery('etats-workflows', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les fonctions pour les messages système
  const { data: fonctionsData } = useQuery('fonctions-workflows', async () => {
    const res = await api.get('/management/fonctions');
    return res.data.data || [];
  });

  // Récupérer tous les utilisateurs du système (actifs et inactifs) pour notification workflow et message système
  const { data: utilisateursData } = useQuery('utilisateurs-workflows', async () => {
    const res = await api.get('/management/utilisateurs', { params: { include_inactive: 1 } });
    return res.data.data || [];
  });

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

  const toDateTimeLocalValue = (value) => {
    if (!value || typeof value !== 'string') return '';
    // attend un datetime MySQL "YYYY-MM-DD HH:MM:SS" (ou sans secondes)
    const normalized = value.replace(' ', 'T');
    return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
  };

  const fromDateTimeLocalValue = (value) => {
    if (!value || typeof value !== 'string') return null;
    // input datetime-local => "YYYY-MM-DDTHH:MM"
    const normalized = value.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  };

  // Fonction pour formater l'affichage des déclencheurs
  const formatTriggerDetails = (trigger, etatsData) => {
    const parts = [];
    parts.push(trigger.type.replace('_', ' '));
    
    if (trigger.type === 'etat_changed') {
      const config = trigger.config || {};
      if (config.etat_from && Array.isArray(config.etat_from) && config.etat_from.length > 0) {
        const etatFrom = Array.isArray(config.etat_from) ? config.etat_from : [config.etat_from];
        const etatFromNames = etatFrom.map(id => {
          const etat = etatsData?.find(e => e.id === id);
          return etat ? `${etat.id}(${etat.titre})` : id;
        });
        parts.push(`de: ${etatFromNames.join(', ')}`);
      } else {
        parts.push('de: Tous les états');
      }
      if (config.etat_to || config.etat_id) {
        const etatTo = Array.isArray(config.etat_to) ? config.etat_to : (config.etat_to ? [config.etat_to] : (config.etat_id ? [config.etat_id] : []));
        if (etatTo.length > 0) {
          const etatToNames = etatTo.map(id => {
            const etat = etatsData?.find(e => e.id === id);
            return etat ? `${etat.id}(${etat.titre})` : id;
          });
          parts.push(`vers: ${etatToNames.join(', ')}`);
        } else {
          parts.push('vers: Tous les états');
        }
      } else {
        parts.push('vers: Tous les états');
      }
    } else if (trigger.type === 'scheduled' && trigger.config?.cron) {
      parts.push(`cron: ${trigger.config.cron}`);
    }
    
    return parts.join(' | ');
  };

  // Fonction pour formater l'affichage des actions
  const formatActionDetails = (action, fonctionsData, utilisateursData) => {
    const parts = [];
    parts.push(action.type.replace('_', ' '));
    
    const config = action.config || {};
    
    if (action.type === 'notification') {
      const hasFonctions = Array.isArray(config.destination_fonctions) && config.destination_fonctions.length > 0;
      const hasUtilisateurs = Array.isArray(config.destination_utilisateurs) && config.destination_utilisateurs.length > 0;
      if (hasFonctions || hasUtilisateurs) {
        if (hasFonctions) {
          const noms = config.destination_fonctions.map(id => fonctionsData?.find(f => f.id === id)?.titre || id);
          parts.push(`→ Fonctions: ${noms.join(', ')}`);
        }
        if (hasUtilisateurs) {
          parts.push(`→ ${config.destination_utilisateurs.length} utilisateur(s)`);
        }
      } else if (config.destination) {
        const destMap = {
          'id_insert': 'Agent créateur',
          'id_agent': 'Agent',
          'id_confirmateur': 'Confirmateur',
          'id_confirmateur_2': 'Confirmateur 2',
          'id_confirmateur_3': 'Confirmateur 3',
          'id_qualite': 'Agent qualité',
          'id_commercial': 'Commercial',
          'id_commercial_2': 'Commercial 2'
        };
        parts.push(`→ ${destMap[config.destination] || config.destination}`);
      } else {
        parts.push('→ Tous les admins');
      }
      if (config.afficher_expediteur === false) parts.push('(sans expéditeur)');
      if (config.message) {
        const msgPreview = config.message.substring(0, 30);
        parts.push(`"${msgPreview}${config.message.length > 30 ? '...' : ''}"`);
      }
    } else if (action.type === 'sms') {
      if (config.tel_field) {
        parts.push(`champ: ${config.tel_field}`);
      }
    } else if (action.type === 'update_field') {
      if (config.field) {
        parts.push(`champ: ${config.field}`);
      }
    } else if (action.type === 'change_etat') {
      if (config.etat_id) {
        parts.push(`état: ${config.etat_id}`);
      }
    } else if (action.type === 'webhook') {
      if (config.url) {
        const urlPreview = config.url.substring(0, 30);
        parts.push(`${config.method || 'POST'} ${urlPreview}${config.url.length > 30 ? '...' : ''}`);
      }
    } else if (action.type === 'system_message') {
      if (config.cibles_fonctions && Array.isArray(config.cibles_fonctions)) {
        const fonctionNames = config.cibles_fonctions.map(id => {
          const f = fonctionsData?.find(f => f.id === id);
          return f ? f.titre : id;
        });
        parts.push(`fonctions: ${fonctionNames.join(', ')}`);
      }
      if (config.cibles_utilisateurs && Array.isArray(config.cibles_utilisateurs)) {
        parts.push(`utilisateurs: ${config.cibles_utilisateurs.length}`);
      }
      if (config.type) {
        parts.push(`type: ${config.type}`);
      }
    }
    
    if (action.delay_seconds > 0) {
      parts.push(`délai: ${action.delay_seconds}s`);
    }
    
    return parts.join(' | ');
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
                      <>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(() => {
                                const cfg = trigger.config || {};
                                if (cfg.etat_from_any !== undefined) return !!cfg.etat_from_any;
                                // Compat: ancien comportement = null/undefined => tous
                                return cfg.etat_from === null || cfg.etat_from === undefined;
                              })()}
                              onChange={(e) => {
                                const newConfig = { ...trigger.config };
                                if (e.target.checked) {
                                  newConfig.etat_from_any = true;
                                  newConfig.etat_from = null;
                                } else {
                                  newConfig.etat_from_any = false;
                                  // mode sélection spécifique (liste vide au départ)
                                  newConfig.etat_from = [];
                                }
                                updateTrigger(index, 'config', newConfig);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            Depuis n'importe quel état (tous les états)
                          </label>
                          {(() => {
                            const cfg = trigger.config || {};
                            const fromAny = cfg.etat_from_any !== undefined ? !!cfg.etat_from_any : (cfg.etat_from === null || cfg.etat_from === undefined);
                            return fromAny;
                          })() ? (
                            <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
                              ✓ Le workflow se déclenchera depuis n'importe quel état
                            </div>
                          ) : (
                            <>
                              <select
                                multiple
                                value={Array.isArray(trigger.config?.etat_from) ? trigger.config.etat_from.map(String) : (trigger.config?.etat_from ? [String(trigger.config.etat_from)] : [])}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                                  updateTrigger(index, 'config', { ...trigger.config, etat_from_any: false, etat_from: selected.length > 0 ? selected : [] });
                                }}
                                size={5}
                                style={{ marginTop: '8px' }}
                              >
                                {etatsData?.map(e => (
                                  <option key={e.id} value={e.id}>{e.id} - {e.titre}</option>
                                ))}
                              </select>
                              <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs états sources. (Si aucun état n'est sélectionné, le trigger ne matchera pas.)</small>
                            </>
                          )}
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(() => {
                                const cfg = trigger.config || {};
                                if (cfg.etat_to_any !== undefined) return !!cfg.etat_to_any;
                                // Compat: ancien comportement = null/undefined => tous
                                const hasTo = cfg.etat_to !== null && cfg.etat_to !== undefined;
                                const hasId = cfg.etat_id !== null && cfg.etat_id !== undefined;
                                return !hasTo && !hasId;
                              })()}
                              onChange={(e) => {
                                const newConfig = { ...trigger.config };
                                if (e.target.checked) {
                                  newConfig.etat_to_any = true;
                                  newConfig.etat_to = null;
                                  delete newConfig.etat_id;
                                } else {
                                  newConfig.etat_to_any = false;
                                  newConfig.etat_to = [];
                                  delete newConfig.etat_id;
                                }
                                updateTrigger(index, 'config', newConfig);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            Vers n'importe quel état (tous les états)
                          </label>
                          {(() => {
                            const cfg = trigger.config || {};
                            const toAny = cfg.etat_to_any !== undefined
                              ? !!cfg.etat_to_any
                              : ((cfg.etat_to === null || cfg.etat_to === undefined) && (cfg.etat_id === null || cfg.etat_id === undefined));
                            return toAny;
                          })() ? (
                            <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
                              ✓ Le workflow se déclenchera vers n'importe quel état
                            </div>
                          ) : (
                            <>
                              <select
                                multiple
                                value={Array.isArray(trigger.config?.etat_to) ? trigger.config.etat_to.map(String) : (trigger.config?.etat_to ? [String(trigger.config.etat_to)] : (trigger.config?.etat_id ? [String(trigger.config.etat_id)] : []))}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                                  const newConfig = { ...trigger.config };
                                  if (selected.length > 0) {
                                    newConfig.etat_to = selected;
                                    newConfig.etat_to_any = false;
                                    delete newConfig.etat_id; // Supprimer l'ancien format pour compatibilité
                                  } else {
                                    newConfig.etat_to_any = false;
                                    newConfig.etat_to = [];
                                  }
                                  updateTrigger(index, 'config', newConfig);
                                }}
                                size={5}
                                style={{ marginTop: '8px' }}
                              >
                                {etatsData?.map(e => (
                                  <option key={e.id} value={e.id}>{e.id} - {e.titre}</option>
                                ))}
                              </select>
                              <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs états cibles. (Si aucun état n'est sélectionné, le trigger ne matchera pas.)</small>
                            </>
                          )}
                        </div>
                        <div style={{ padding: '8px', background: '#e3f2fd', borderRadius: '4px', fontSize: '12px' }}>
                          <strong>Configuration actuelle :</strong><br />
                          {(() => {
                            const cfg = trigger.config || {};
                            const fromAny = cfg.etat_from_any !== undefined ? !!cfg.etat_from_any : (cfg.etat_from === null || cfg.etat_from === undefined);
                            const toAny = cfg.etat_to_any !== undefined ? !!cfg.etat_to_any : ((cfg.etat_to === null || cfg.etat_to === undefined) && (cfg.etat_id === null || cfg.etat_id === undefined));
                            const fromLabel = fromAny
                              ? 'Tous les états'
                              : (Array.isArray(cfg.etat_from) && cfg.etat_from.length > 0)
                                ? cfg.etat_from.map(id => {
                                    const etat = etatsData?.find(e => e.id === id);
                                    return etat ? `${etat.id}(${etat.titre})` : id;
                                  }).join(', ')
                                : '(aucun état sélectionné)';
                            const toIds = Array.isArray(cfg.etat_to) ? cfg.etat_to : (cfg.etat_to ? [cfg.etat_to] : (cfg.etat_id ? [cfg.etat_id] : []));
                            const toLabel = toAny
                              ? 'Tous les états'
                              : (toIds.length > 0)
                                ? toIds.map(id => {
                                    const etat = etatsData?.find(e => e.id === id);
                                    return etat ? `${etat.id}(${etat.titre})` : id;
                                  }).join(', ')
                                : '(aucun état sélectionné)';
                            return (
                              <>
                                État source : {fromLabel}<br />
                                État cible : {toLabel}
                              </>
                            );
                          })()}
                        </div>
                      </>
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
                          <option value="system_message">Message système</option>
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

                        <div className="form-group" style={{ marginTop: '16px', padding: '10px', background: '#f5f5f5', borderRadius: '6px' }}>
                          <strong>Destinataires</strong>
                          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#555' }}>
                            Choisir <strong>un utilisateur</strong>, <strong>plusieurs utilisateurs</strong> et/ou <strong>une ou plusieurs fonctions</strong>. Si au moins un destinataire est choisi ci-dessous, il remplace l’option « Rôle sur la fiche ».
                          </p>
                        </div>

                        <div className="form-group">
                          <label>Un ou plusieurs utilisateurs</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.destination_utilisateurs) ? action.config.destination_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                              updateAction(index, 'config', { ...action.config, destination_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={6}
                          >
                            {utilisateursData?.map(u => (
                              <option key={u.id} value={u.id}>{u.pseudo || u.login} — {u.nom} {u.prenom}</option>
                            ))}
                          </select>
                          <small>Un utilisateur = sélectionner une ligne. Plusieurs = Ctrl/Cmd + clic. Peut être combiné avec les fonctions.</small>
                        </div>
                        <div className="form-group">
                          <label>Une ou plusieurs fonctions</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.destination_fonctions) ? action.config.destination_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                              updateAction(index, 'config', { ...action.config, destination_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} — {f.titre}</option>
                            ))}
                          </select>
                          <small>Envoi à tous les utilisateurs ayant cette fonction. Ctrl/Cmd pour multi-sélection.</small>
                        </div>

                        <div className="form-group">
                          <label>Sinon : rôle sur la fiche ou tous les admins</label>
                          <select
                            value={action.config?.destination || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, destination: e.target.value })}
                          >
                            <option value="">Tous les admins</option>
                            <option value="id_insert">Agent qui a créé la fiche ({'{fiche.id_insert}'})</option>
                            <option value="id_agent">Agent assigné à la fiche ({'{fiche.id_agent}'})</option>
                            <option value="id_confirmateur">Confirmateur principal ({'{fiche.id_confirmateur}'})</option>
                            <option value="id_confirmateur_2">Confirmateur secondaire ({'{fiche.id_confirmateur_2}'})</option>
                            <option value="id_confirmateur_3">Confirmateur tertiaire ({'{fiche.id_confirmateur_3}'})</option>
                            <option value="id_qualite">Agent qualité qui a audité ({'{fiche.id_qualite}'})</option>
                            <option value="id_commercial">Commercial principal ({'{fiche.id_commercial}'})</option>
                            <option value="id_commercial_2">Commercial secondaire ({'{fiche.id_commercial_2}'})</option>
                          </select>
                          <small>Utilisé uniquement si aucun utilisateur ni fonction n’est sélectionné ci-dessus.</small>
                        </div>
                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={action.config?.afficher_expediteur !== false}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_expediteur: e.target.checked })}
                            />
                            Afficher l&apos;expéditeur
                          </label>
                          <small>Si décoché, le nom de l&apos;expéditeur ne sera pas affiché dans la notification.</small>
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

                    {action.type === 'system_message' && (
                      <>
                        <div className="form-group">
                          <label>Titre (optionnel)</label>
                          <input
                            type="text"
                            value={action.config?.titre || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, titre: e.target.value })}
                            placeholder="Titre du message système"
                          />
                        </div>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="3"
                            placeholder="Message système. Variables: {fiche.nom}, {fiche.prenom}, {user.pseudo}"
                            required
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>Type</label>
                            <select
                              value={action.config?.type || 'info'}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, type: e.target.value })}
                            >
                              <option value="info">Information</option>
                              <option value="success">Succès</option>
                              <option value="warning">Avertissement</option>
                              <option value="error">Erreur</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Priorité</label>
                            <select
                              value={action.config?.priorite || 1}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, priorite: parseInt(e.target.value) })}
                            >
                              <option value={1}>Normal</option>
                              <option value={2}>Important</option>
                              <option value={3}>Urgent</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>Date début (optionnel)</label>
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalValue(action.config?.date_debut)}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, date_debut: fromDateTimeLocalValue(e.target.value) })}
                            />
                            <small>Si vide: affichage immédiat.</small>
                          </div>
                          <div className="form-group">
                            <label>Date fin (optionnel)</label>
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalValue(action.config?.date_fin)}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, date_fin: fromDateTimeLocalValue(e.target.value) })}
                            />
                            <small>Si vide: pas de date de fin.</small>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={(action.config?.actif ?? 1) === 1}
                                onChange={(e) => updateAction(index, 'config', { ...action.config, actif: e.target.checked ? 1 : 0 })}
                                style={{ marginRight: '8px' }}
                              />
                              Actif
                            </label>
                            <small>Si désactivé, le message ne s'affichera pas.</small>
                          </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(action.config?.afficher_une_seule_fois ?? 0) === 1}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_une_seule_fois: e.target.checked ? 1 : 0 })}
                              style={{ marginRight: '8px' }}
                            />
                            Afficher une seule fois
                          </label>
                          <small>Si coché, le message disparaît après lecture.</small>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={action.config?.afficher_expediteur !== false}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_expediteur: e.target.checked })}
                              style={{ marginRight: '8px' }}
                            />
                            Afficher l&apos;expéditeur
                          </label>
                          <small>Si décoché, le nom du créateur du message ne sera pas affiché.</small>
                        </div>
                        </div>

                        <div className="form-group">
                          <label>Fonctions ciblées</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_fonctions) ? action.config.cibles_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                              updateAction(index, 'config', { ...action.config, cibles_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} - {f.titre}</option>
                            ))}
                          </select>
                          <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs fonctions. Au moins une fonction ou un utilisateur doit être sélectionné.</small>
                        </div>
                        <div className="form-group">
                          <label>Utilisateurs ciblés</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_utilisateurs) ? action.config.cibles_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => {
                                const value = option.value;
                                // Si c'est une variable (commence par {), garder comme chaîne
                                if (value.startsWith('{')) {
                                  return value;
                                }
                                // Sinon, convertir en nombre
                                return parseInt(value);
                              });
                              updateAction(index, 'config', { ...action.config, cibles_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={8}
                          >
                            <optgroup label="Destinataires dynamiques (basés sur la fiche)">
                              <option value="{fiche.id_insert}">Agent qui a créé la fiche ({'{fiche.id_insert}'})</option>
                              <option value="{fiche.id_agent}">Agent assigné ({'{fiche.id_agent}'})</option>
                              <option value="{fiche.id_confirmateur}">Confirmateur principal ({'{fiche.id_confirmateur}'})</option>
                              <option value="{fiche.id_confirmateur_2}">Confirmateur secondaire ({'{fiche.id_confirmateur_2}'})</option>
                              <option value="{fiche.id_confirmateur_3}">Confirmateur tertiaire ({'{fiche.id_confirmateur_3}'})</option>
                              <option value="{fiche.id_qualite}">Agent qualité ({'{fiche.id_qualite}'})</option>
                              <option value="{fiche.id_commercial}">Commercial principal ({'{fiche.id_commercial}'})</option>
                              <option value="{fiche.id_commercial_2}">Commercial secondaire ({'{fiche.id_commercial_2}'})</option>
                            </optgroup>
                            <optgroup label="Utilisateurs spécifiques">
                              {utilisateursData?.map(u => (
                                <option key={u.id} value={u.id}>{u.nom} {u.prenom} ({u.login})</option>
                              ))}
                            </optgroup>
                          </select>
                          <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs. Les destinataires dynamiques seront résolus selon la fiche concernée. Au moins une fonction ou un utilisateur doit être sélectionné.</small>
                        </div>
                        {(action.config?.cibles_fonctions || action.config?.cibles_utilisateurs) && (
                          <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px' }}>
                            <strong>Destinataires :</strong><br />
                            {action.config?.cibles_fonctions && (
                              <>Fonctions : {Array.isArray(action.config.cibles_fonctions) ? action.config.cibles_fonctions.length : 1} sélectionnée(s)<br /></>
                            )}
                            {action.config?.cibles_utilisateurs && (
                              <>Utilisateurs : {Array.isArray(action.config.cibles_utilisateurs) ? action.config.cibles_utilisateurs.length : 1} sélectionné(s)</>
                            )}
                          </div>
                        )}
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
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      {workflow.triggers?.map((t, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', padding: '4px', background: '#f5f5f5', borderRadius: '3px' }}>
                          <strong>{t.type.replace('_', ' ')}</strong>
                          {t.type === 'etat_changed' && (t.config?.etat_from || t.config?.etat_to || t.config?.etat_id) && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {t.config?.etat_from && (
                                <>De: {Array.isArray(t.config.etat_from) ? t.config.etat_from.join(', ') : t.config.etat_from} </>
                              )}
                              {(t.config?.etat_to || t.config?.etat_id) && (
                                <>Vers: {Array.isArray(t.config?.etat_to) ? t.config.etat_to.join(', ') : (t.config?.etat_to || t.config?.etat_id)}</>
                              )}
                            </div>
                          )}
                          {t.type === 'scheduled' && t.config?.cron && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              Cron: {t.config.cron}
                            </div>
                          )}
                        </div>
                      ))}
                      {(!workflow.triggers || workflow.triggers.length === 0) && <span style={{ color: '#999' }}>-</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      {workflow.actions?.map((a, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', padding: '4px', background: '#e8f5e9', borderRadius: '3px' }}>
                          <strong>{a.type.replace('_', ' ')}</strong>
                          {a.type === 'notification' && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {a.config?.destination ? `→ ${a.config.destination}` : '→ Tous les admins'}
                            </div>
                          )}
                          {a.type === 'system_message' && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {a.config?.type && `Type: ${a.config.type} `}
                              {a.config?.cibles_fonctions && Array.isArray(a.config.cibles_fonctions) && (
                                <>Fonctions: {a.config.cibles_fonctions.length} </>
                              )}
                              {a.config?.cibles_utilisateurs && Array.isArray(a.config.cibles_utilisateurs) && (
                                <>Utilisateurs: {a.config.cibles_utilisateurs.length}</>
                              )}
                            </div>
                          )}
                          {a.delay_seconds > 0 && (
                            <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '2px' }}>
                              Délai: {a.delay_seconds}s
                            </div>
                          )}
                        </div>
                      ))}
                      {(!workflow.actions || workflow.actions.length === 0) && <span style={{ color: '#999' }}>-</span>}
                    </div>
                  </td>
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

