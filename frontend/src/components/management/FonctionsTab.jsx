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
import { PAGE_ACCUEIL_OPTIONS, PAGE_ACCUEIL_KNOWN_PATHS } from '../../constants/pageAccueilOptions';

function pageAccueilLabel(path) {
  const p = (path || '').trim() || '/dashboard';
  const hit = PAGE_ACCUEIL_OPTIONS.find((o) => o.value === p);
  return hit ? hit.label : p;
}

const defaultFormData = () => ({
  titre: '',
  etat: 1,
  page_accueil: '/dashboard',
  groupes_messages_autorises: [],
  ip_acces_tous: true,
  ips_text: ''
});

const FonctionsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_fonctions_search', '');
  const [formData, setFormData] = useState(defaultFormData);
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData(defaultFormData());
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

  const { data: fonctions, isLoading } = useQuery('fonctions', async () => {
    const response = await api.get('/management/fonctions?all=true');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!fonctions) return [];
    if (!searchTerm.trim()) return fonctions;
    const term = searchTerm.toLowerCase();
    return fonctions.filter((item) => {
      const ipStr = (item.ips_autorisees || []).join(' ');
      return (
        item.titre?.toLowerCase().includes(term) ||
        item.id?.toString().includes(term) ||
        ipStr.toLowerCase().includes(term)
      );
    });
  }, [fonctions, searchTerm]);

  // Gérer la sélection/désélection des fonctions pour groupes_messages_autorises
  const handleToggleFonctionMessage = (fonctionId) => {
    const current = formData.groupes_messages_autorises || [];
    if (current.includes(fonctionId)) {
      setFormData({
        ...formData,
        groupes_messages_autorises: current.filter(id => id !== fonctionId)
      });
    } else {
      setFormData({
        ...formData,
        groupes_messages_autorises: [...current, fonctionId]
      });
    }
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/fonctions', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction créée avec succès');
        setShowForm(false);
        setFormData(defaultFormData());
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      // Convertir groupes_messages_autorises en tableau si nécessaire
      const payload = {
        ...data,
        groupes_messages_autorises: data.groupes_messages_autorises && data.groupes_messages_autorises.length > 0
          ? data.groupes_messages_autorises
          : null
      };
      const response = await api.put(`/management/fonctions/${id}`, payload);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction mise à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        setFormData(defaultFormData());
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/fonctions/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fonctions');
        toast.success('Fonction supprimée avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression de la fonction';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const handleEdit = (fonction) => {
    setEditingId(fonction.id);
    // Parser groupes_messages_autorises depuis JSON si présent
    let groupesMessages = [];
    if (fonction.groupes_messages_autorises) {
      try {
        groupesMessages = JSON.parse(fonction.groupes_messages_autorises);
        if (!Array.isArray(groupesMessages)) {
          groupesMessages = [];
        }
      } catch (e) {
        groupesMessages = [];
      }
    }
    const ipAll = fonction.ip_acces_tous !== 0 && fonction.ip_acces_tous !== false && fonction.ip_acces_tous !== '0';
    const ipsList = Array.isArray(fonction.ips_autorisees) ? fonction.ips_autorisees : [];
    setFormData({
      titre: fonction.titre,
      etat: fonction.etat,
      page_accueil: fonction.page_accueil || '/dashboard',
      groupes_messages_autorises: groupesMessages,
      ip_acces_tous: ipAll,
      ips_text: ipsList.join('\n')
    });
    setShowForm(true);
  };

  const buildSubmitPayload = () => {
    const ips_autorisees = formData.ip_acces_tous
      ? []
      : String(formData.ips_text || '')
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    return {
      titre: formData.titre,
      etat: formData.etat,
      page_accueil: formData.page_accueil,
      groupes_messages_autorises: formData.groupes_messages_autorises,
      ip_acces_tous: formData.ip_acces_tous ? 1 : 0,
      ips_autorisees
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = buildSubmitPayload();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id, titre) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la fonction "${titre}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Chargement des fonctions..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Fonctions</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData(defaultFormData()); }}>
          <FaPlus /> Ajouter une fonction
        </button>
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
            <h3>{editingId ? 'Modifier' : 'Ajouter'} une fonction</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  Titre *
                  <Tooltip text="Nom de la fonction/rôle dans le système. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="text"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  required
                  placeholder="Ex: Administrateur, Commercial, Agent"
                />
              </div>
              <div className="form-group">
                <label>
                  État
                  <Tooltip text="Définit si la fonction est active (visible) ou inactive (masquée) dans le système.">
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
              <div className="form-group">
                <label>
                  Page d'accueil
                  <Tooltip text="Page vers laquelle les utilisateurs de cette fonction seront redirigés après connexion.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <select
                  value={formData.page_accueil}
                  onChange={(e) => setFormData({ ...formData, page_accueil: e.target.value })}
                >
                  {PAGE_ACCUEIL_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  {formData.page_accueil &&
                    !PAGE_ACCUEIL_KNOWN_PATHS.has(formData.page_accueil) && (
                      <option value={formData.page_accueil}>
                        {formData.page_accueil} (valeur en base, non listée)
                      </option>
                    )}
                </select>
              </div>
              <div className="form-group">
                <label>
                  Groupes autorisés pour les messages
                  <Tooltip text="Sélectionnez les fonctions auxquelles les utilisateurs de cette fonction peuvent envoyer des messages. Si aucune fonction n'est sélectionnée, tous les utilisateurs sont autorisés.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <div className="groupes-messages-container">
                  {fonctions && fonctions.length > 0 ? (
                    <div className="groupes-messages-checkboxes">
                      {fonctions
                        .filter(f => f.id !== editingId) // Exclure la fonction en cours d'édition
                        .map(fonction => (
                          <label key={fonction.id} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={(formData.groupes_messages_autorises || []).includes(fonction.id)}
                              onChange={() => handleToggleFonctionMessage(fonction.id)}
                            />
                            <span>{fonction.titre} (ID: {fonction.id})</span>
                          </label>
                        ))}
                    </div>
                  ) : (
                    <div className="no-fonctions">Aucune fonction disponible</div>
                  )}
                  {(formData.groupes_messages_autorises || []).length === 0 && (
                    <div className="info-message">
                      <small>Aucune fonction sélectionnée = tous les utilisateurs sont autorisés</small>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>
                  Accès par adresse IP
                  <Tooltip text="Si « Toutes les adresses IP » est coché, la connexion est autorisée depuis n’importe quelle IPv4. Sinon, indiquez une règle par ligne (IPv4 ou plage CIDR, ex. 203.0.113.5 ou 192.168.0.0/24).">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <label className="checkbox-label" style={{ marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.ip_acces_tous}
                    onChange={(e) => setFormData({ ...formData, ip_acces_tous: e.target.checked })}
                  />
                  <span>Toutes les adresses IP</span>
                </label>
                {!formData.ip_acces_tous && (
                  <textarea
                    className="search-input"
                    rows={5}
                    style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder={'Une règle par ligne, ex. :\n203.0.113.10\n10.0.0.0/24'}
                    value={formData.ips_text}
                    onChange={(e) => setFormData({ ...formData, ips_text: e.target.value })}
                  />
                )}
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
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); setFormData(defaultFormData()); }}>
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
              <th>Page d'accueil</th>
              <th>Accès IP</th>
              <th>Groupes messages</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((fonction) => (
                <tr key={fonction.id}>
                  <td data-label="">{fonction.id}</td>
                  <td data-label="Titre:">{fonction.titre}</td>
                  <td data-label="État:">
                    <span className={`badge ${fonction.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {fonction.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="Page d'accueil:">
                    <span
                      className="page-accueil-badge"
                      title={fonction.page_accueil || '/dashboard'}
                    >
                      {pageAccueilLabel(fonction.page_accueil)}
                    </span>
                  </td>
                  <td data-label="Accès IP:">
                    {fonction.ip_acces_tous === 0 || fonction.ip_acces_tous === false ? (
                      (() => {
                        const list = Array.isArray(fonction.ips_autorisees) ? fonction.ips_autorisees : [];
                        if (list.length === 0) {
                          return <span className="badge badge-danger" title="Aucune règle : connexion impossible">Liste vide</span>;
                        }
                        const title = list.join(', ');
                        const short = list.slice(0, 2).join(', ');
                        const more = list.length > 2 ? ` +${list.length - 2}` : '';
                        return (
                          <span className="groupes-messages-badge" title={title}>
                            {short}
                            {more}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="groupes-messages-badge all">Toutes</span>
                    )}
                  </td>
                  <td data-label="Groupes messages:">
                    {fonction.groupes_messages_autorises ? (
                      (() => {
                        try {
                          const groupes = JSON.parse(fonction.groupes_messages_autorises);
                          if (Array.isArray(groupes) && groupes.length > 0) {
                            // Récupérer les titres des fonctions
                            const groupesTitres = groupes.map(id => {
                              const f = fonctions?.find(f => f.id === id);
                              return f ? f.titre : `ID ${id}`;
                            });
                            return (
                              <span className="groupes-messages-badge" title={groupesTitres.join(', ')}>
                                {groupes.length} fonction{groupes.length > 1 ? 's' : ''}
                              </span>
                            );
                          }
                        } catch (e) {
                          // Ignorer les erreurs de parsing
                        }
                        return <span className="groupes-messages-badge">Tous</span>;
                      })()
                    ) : (
                      <span className="groupes-messages-badge all">Tous</span>
                    )}
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(fonction)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(fonction.id, fonction.titre)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucune fonction trouvée'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FonctionsTab;

