import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch, FaChevronDown, FaChevronUp, FaCheckCircle, FaFilter, FaUserCheck, FaCheck, FaComment, FaTimes, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import './ControleQualite.css';

const ControleQualite = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    id_agent: '',
    id_etat_final: '',
    date_debut: new Date().toISOString().split('T')[0], // Date du jour par défaut
    date_fin: new Date().toISOString().split('T')[0] // Date du jour par défaut
  });
  
  // État pour gérer l'édition du commentaire qualité
  const [editingComment, setEditingComment] = useState({ hash: null, value: '' });

  // Récupérer les agents qualification
  const { data: agentsData } = useQuery('agents-qualif-list', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 3) || [];
  });

  // Récupérer les états du groupe 0 uniquement (sans "En-Attente") pour les filtres et la sélection
  const { data: etatsData } = useQuery('etats-groupe-0-sans-en-attente', async () => {
    const res = await api.get('/management/etats');
    // Filtrer uniquement les états du groupe 0, exclure "En-Attente" (ID 1 ou titre contenant "ATTENTE")
    return res.data.data?.filter(e => {
      const isGroupe0 = (e.groupe === '0' || e.groupe === 0);
      const isEnAttente = e.id === 1 || 
                         (e.titre && (e.titre.toUpperCase().includes('ATTENTE') || e.titre.toUpperCase() === 'EN-ATTENTE'));
      return isGroupe0 && !isEnAttente;
    }) || [];
  });

  // Récupérer tous les états pour vérifier si un état est groupe 0 ou non
  const { data: allEtatsData } = useQuery('all-etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les fiches
  const { data: fichesData, isLoading, error, refetch } = useQuery(
    ['controle-qualite', filters],
    async () => {
      try {
        const params = { ...filters };
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null) delete params[key];
        });
        const res = await api.get('/fiches/controle-qualite', { params });
        console.log('Réponse contrôle qualité:', res.data);
        // Vérifier la structure de la réponse
        if (res.data && res.data.success) {
          return res.data;
        } else {
          throw new Error(res.data?.message || 'Format de réponse inattendu');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des fiches contrôle qualité:', error);
        console.error('Détails de l\'erreur:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      }
    },
    {
      onError: (error) => {
        console.error('Erreur useQuery contrôle qualité:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors du chargement des fiches';
        toast.error(errorMessage);
      }
    }
  );

  // Mutation pour modifier rapidement l'état
  const updateEtatMutation = useMutation(
    async ({ hash, id_etat_final }) => {
      const res = await api.put(`/fiches/${hash}/etat-rapide`, { id_etat_final });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        queryClient.invalidateQueries(['production-qualif']);
        queryClient.invalidateQueries(['agents-qualif-stats']);
        toast.success('État mis à jour avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour de l\'état');
      }
    }
  );

  // Mutation pour valider une fiche (passer en En-Attente)
  const validateQualiteMutation = useMutation(
    async (hash) => {
      const res = await api.put(`/fiches/${hash}/valider-qualite`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        toast.success('Fiche validée et passée en état "En-Attente"');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la validation');
      }
    }
  );

  // Mutation pour mettre à jour le commentaire qualité
  const updateCommentaireQualiteMutation = useMutation(
    async ({ hash, commentaire_qualite }) => {
      const res = await api.patch(`/fiches/${hash}/field`, {
        field: 'commentaire_qualite',
        value: commentaire_qualite
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        toast.success('Commentaire qualité enregistré avec succès');
        setEditingComment({ hash: null, value: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement du commentaire');
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleEtatChange = (hash, newEtatId) => {
    if (!newEtatId) return;
    updateEtatMutation.mutate({ hash, id_etat_final: parseInt(newEtatId) });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEtatColor = (etat) => {
    return etat?.color || '#cccccc';
  };

  // Vérifier si un état est groupe 0
  const isEtatGroupe0 = (id_etat_final) => {
    if (!id_etat_final || !allEtatsData) return false;
    const etat = allEtatsData.find(e => e.id === id_etat_final);
    return etat && (etat.groupe === '0' || etat.groupe === 0);
  };

  // Obtenir le libellé à afficher pour l'état actuel
  const getEtatActuelLabel = (fiche) => {
    if (isEtatGroupe0(fiche.id_etat_final)) {
      return fiche.etat_titre || '-';
    }
    return 'Validé';
  };

  // Obtenir la couleur pour l'état actuel
  const getEtatActuelColor = (fiche) => {
    if (isEtatGroupe0(fiche.id_etat_final)) {
      return getEtatColor(fiche);
    }
    // Couleur par défaut pour "Validé" (vert)
    return '#28a745';
  };

  const handleEditComment = (hash, currentComment) => {
    setEditingComment({ hash, value: currentComment || '' });
  };

  const handleSaveComment = (hash) => {
    const commentValue = editingComment.hash === hash ? editingComment.value : '';
    if (commentValue !== undefined) {
      updateCommentaireQualiteMutation.mutate({
        hash,
        commentaire_qualite: commentValue
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingComment({ hash: null, value: '' });
  };

  // Gestion des raccourcis clavier pour sauvegarder rapidement
  const handleKeyDown = (e, hash) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveComment(hash);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingComment({ hash: null, value: '' });
    }
  };

  const fiches = fichesData?.data || [];
  const pagination = fichesData?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };
  const agents = agentsData || [];
  const etats = etatsData || [];

  return (
    <div className="controle-qualite">
      <div className="page-header">
        <h1><FaUserCheck /> Contrôle Qualité</h1>
        <button 
          className="filter-toggle-btn" 
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="search-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Agent</label>
              <select
                value={filters.id_agent}
                onChange={(e) => handleFilterChange('id_agent', e.target.value)}
              >
                <option value="">Tous les agents</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.pseudo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>État</label>
              <select
                value={filters.id_etat_final}
                onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
              >
                <option value="">Tous les états</option>
                {etats.map(etat => (
                  <option key={etat.id} value={etat.id}>
                    {etat.titre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date début</label>
              <input
                type="date"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Date fin</label>
              <input
                type="date"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="results-info">
        <p>
          Total: <strong>{pagination.total}</strong> fiches
          {pagination.pages > 1 && (
            <> | Page <strong>{pagination.page}</strong> sur <strong>{pagination.pages}</strong></>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement des fiches...</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement des fiches</p>
          <p style={{ fontSize: '10.2px', color: '#666', marginTop: '10px' }}>
            {error.response?.data?.message || error.message || 'Erreur inconnue'}
          </p>
          {error.response?.data?.error && (
            <p style={{ fontSize: '9.4px', color: '#999', marginTop: '5px' }}>
              Détails: {error.response.data.error}
            </p>
          )}
          <button 
            onClick={() => refetch()} 
            style={{ marginTop: '15px', padding: '8px 16px', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      ) : fiches.length === 0 ? (
        <div className="no-results">Aucune fiche trouvée</div>
      ) : (
        <>
          <div className="fiches-table-container">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Téléphone</th>
                  <th>CP</th>
                  <th>Ville</th>
                  <th>Agent</th>
                  <th>Date Insertion</th>
                  <th>État Actuel</th>
                  <th>Nouvel État</th>
                  <th>Commentaire Qualité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fiches.map((fiche) => (
                  <tr key={fiche.hash}>
                    <td>{fiche.nom || '-'}</td>
                    <td>{fiche.prenom || '-'}</td>
                    <td>{fiche.tel || '-'}</td>
                    <td>{fiche.cp || '-'}</td>
                    <td>{fiche.ville || '-'}</td>
                    <td>{fiche.agent_pseudo || '-'}</td>
                    <td>{formatDate(fiche.date_insert_time)}</td>
                    <td>
                      <span 
                        className="etat-badge"
                        style={{ backgroundColor: getEtatActuelColor(fiche) }}
                      >
                        {getEtatActuelLabel(fiche)}
                      </span>
                    </td>
                    <td>
                      <select
                        value={fiche.id_etat_final || ''}
                        onChange={(e) => handleEtatChange(fiche.hash, e.target.value)}
                        className="etat-select"
                        disabled={updateEtatMutation.isLoading}
                      >
                        <option value="">-- Sélectionner --</option>
                        {etats.map(etat => (
                          <option key={etat.id} value={etat.id}>
                            {etat.titre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="comment-quick-edit-container">
                        <div className="comment-quick-actions">
                          {(() => {
                            const currentValue = editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '');
                            const originalValue = fiche.commentaire_qualite || '';
                            const hasChanges = editingComment.hash === fiche.hash && currentValue !== originalValue;
                            
                            return hasChanges && (
                              <>
                                <button
                                  className="btn-save-comment-quick"
                                  onClick={() => handleSaveComment(fiche.hash)}
                                  disabled={updateCommentaireQualiteMutation.isLoading}
                                  title="Enregistrer (Ctrl+Enter)"
                                >
                                  <FaSave />
                                </button>
                                <button
                                  className="btn-cancel-comment-quick"
                                  onClick={() => {
                                    setEditingComment({ hash: null, value: '' });
                                  }}
                                  disabled={updateCommentaireQualiteMutation.isLoading}
                                  title="Annuler (Echap)"
                                >
                                  <FaTimes />
                                </button>
                              </>
                            );
                          })()}
                        </div>
                        <textarea
                          value={editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '')}
                          onChange={(e) => {
                            if (editingComment.hash !== fiche.hash) {
                              setEditingComment({ hash: fiche.hash, value: e.target.value });
                            } else {
                              setEditingComment({ ...editingComment, value: e.target.value });
                            }
                          }}
                          onFocus={() => {
                            if (editingComment.hash !== fiche.hash) {
                              setEditingComment({ hash: fiche.hash, value: fiche.commentaire_qualite || '' });
                            }
                          }}
                          onKeyDown={(e) => handleKeyDown(e, fiche.hash)}
                          className="comment-textarea-quick"
                          placeholder="Commentaire qualité... (Ctrl+Enter pour sauvegarder)"
                          rows={2}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-validate-icon"
                          onClick={() => validateQualiteMutation.mutate(fiche.hash)}
                          disabled={validateQualiteMutation.isLoading}
                          title="Valider et passer en En-Attente"
                        >
                          <FaCheckCircle />
                        </button>
                        <FicheDetailLink 
                          ficheHash={fiche.hash}
                          className="btn-detail-icon"
                          title="Voir les détails"
                        >
                          <FaSearch />
                        </FicheDetailLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Précédent
              </button>
              <span>
                Page {pagination.page} sur {pagination.pages}
              </span>
              <button
                onClick={() => handleFilterChange('page', pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ControleQualite;

