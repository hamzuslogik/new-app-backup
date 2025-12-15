import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaSave, FaTrash, FaCopy, FaPlus, FaTimes } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import './PermissionTemplates.css';

const PermissionTemplates = ({ 
  selectedFonction, 
  currentPermissions, 
  onApplyTemplate,
  onClose 
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(true);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery(
    'permission-templates',
    async () => {
      const res = await api.get('/permissions/templates');
      return res.data.data || [];
    }
  );

  const createTemplateMutation = useMutation(
    async (data) => {
      const res = await api.post('/permissions/templates', data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('permission-templates');
        toast.success('Template créé avec succès');
        setShowCreateForm(false);
        setTemplateName('');
        setTemplateDescription('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création');
      }
    }
  );

  const applyTemplateMutation = useMutation(
    async ({ templateId, fonctionId }) => {
      const res = await api.post(`/permissions/templates/${templateId}/apply`, {
        id_fonction: fonctionId
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['permissions', 'fonction', selectedFonction]);
        toast.success('Template appliqué avec succès');
        if (onApplyTemplate) onApplyTemplate();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'application');
      }
    }
  );

  const deleteTemplateMutation = useMutation(
    async (id) => {
      const res = await api.delete(`/permissions/templates/${id}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('permission-templates');
        toast.success('Template supprimé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  const handleCreateTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Le nom du template est requis');
      return;
    }

    const permissionsArray = Object.entries(currentPermissions).map(([id_permission, autorise]) => ({
      id_permission: parseInt(id_permission),
      autorise: autorise
    }));

    createTemplateMutation.mutate({
      nom: templateName,
      description: templateDescription,
      permissions: permissionsArray
    });
  };

  const handleApplyTemplate = (templateId) => {
    if (!selectedFonction) {
      toast.error('Veuillez sélectionner une fonction');
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir appliquer ce template ? Les permissions actuelles seront remplacées.')) {
      applyTemplateMutation.mutate({
        templateId,
        fonctionId: selectedFonction
      });
    }
  };

  const handleDeleteTemplate = (templateId, templateName) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le template "${templateName}" ?`)) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Chargement des templates..." />;
  }

  return (
    <div className="permission-templates-modal">
      <div className="templates-modal-content">
        <div className="templates-modal-header">
          <h2>Templates de Permissions</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="templates-content">
          {!showCreateForm ? (
            <>
              <div className="templates-actions">
                <button
                  className="btn-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  <FaPlus /> Créer un template depuis les permissions actuelles
                </button>
              </div>

              <div className="templates-list">
                {templates && templates.length > 0 ? (
                  templates.map(template => (
                    <div key={template.id} className="template-item">
                      <div className="template-info">
                        <h3>{template.nom}</h3>
                        {template.description && (
                          <p className="template-description">{template.description}</p>
                        )}
                        <div className="template-meta">
                          <span>Créé par: {template.created_by_name || 'Système'}</span>
                          <span>Le: {new Date(template.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <div className="template-actions">
                        <button
                          className="btn-apply"
                          onClick={() => handleApplyTemplate(template.id)}
                          disabled={!selectedFonction || applyTemplateMutation.isLoading}
                          title="Appliquer ce template à la fonction sélectionnée"
                        >
                          <FaCopy /> Appliquer
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteTemplate(template.id, template.nom)}
                          disabled={deleteTemplateMutation.isLoading}
                          title="Supprimer ce template"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-templates">
                    <p>Aucun template disponible. Créez-en un pour sauvegarder une configuration de permissions.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="create-template-form">
              <h3>Créer un nouveau template</h3>
              <div className="form-group">
                <label>Nom du template *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Commercial Standard, Administrateur Complet"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Description du template (optionnel)"
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleCreateTemplate}
                  disabled={createTemplateMutation.isLoading || !templateName.trim()}
                >
                  <FaSave /> {createTemplateMutation.isLoading ? 'Création...' : 'Créer le template'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTemplateName('');
                    setTemplateDescription('');
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionTemplates;

