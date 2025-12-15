import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle, FaKey, FaCopy, FaCheck } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const UtilisateursTab = () => {
  const { user: currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_utilisateurs_search', '');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    pseudo: '',
    login: '',
    mdp: '',
    mail: '',
    tel: '',
    fonction: '',
    centre: '',
    centres: [], // Pour la fonction 9 : tableau de centres
    genre: 2,
    etat: 1,
    color: '#9cbfc8',
    chef_equipe: '',
    id_rp_qualif: ''
  });
  const queryClient = useQueryClient();

  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        resetForm();
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

  const { data: utilisateurs, isLoading: loadingUsers } = useQuery('utilisateurs', async () => {
    const response = await api.get('/management/utilisateurs');
    return response.data.data;
  });

  const { data: fonctions } = useQuery('fonctions', async () => {
    const response = await api.get('/management/fonctions');
    return response.data.data;
  });

  const { data: centres } = useQuery('centres', async () => {
    const response = await api.get('/management/centres');
    return response.data.data;
  });

  // Filtrer les données selon le terme de recherche
  const filteredData = useMemo(() => {
    if (!utilisateurs) return [];
    if (!searchTerm.trim()) return utilisateurs;
    const term = searchTerm.toLowerCase();
    return utilisateurs.filter(item => 
      item.nom?.toLowerCase().includes(term) ||
      item.prenom?.toLowerCase().includes(term) ||
      item.pseudo?.toLowerCase().includes(term) ||
      item.login?.toLowerCase().includes(term) ||
      item.fonction_titre?.toLowerCase().includes(term) ||
      item.centre_titre?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [utilisateurs, searchTerm]);

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/management/utilisateurs', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('utilisateurs');
        toast.success('Utilisateur créé avec succès');
        setShowForm(false);
        resetForm();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création de l\'utilisateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/management/utilisateurs/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('utilisateurs');
        toast.success('Utilisateur mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
        resetForm();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour de l\'utilisateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/utilisateurs/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('utilisateurs');
        toast.success('Utilisateur supprimé avec succès');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression de l\'utilisateur';
        const errorDetails = error.response?.data?.details ? 
                            ` Détails: ${error.response.data.details}` : '';
        toast.error(`${errorMessage}${errorDetails}`, { autoClose: 5000 });
      },
    }
  );

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      pseudo: '',
      login: '',
      mdp: '',
      mail: '',
      tel: '',
      fonction: '',
      centre: '',
      centres: [], // Pour la fonction 9 : tableau de centres
      genre: 2,
      etat: 1,
      color: '#9cbfc8',
      chef_equipe: '',
      id_rp_qualif: ''
    });
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setFormData({
      nom: user.nom || '',
      prenom: user.prenom || '',
      pseudo: user.pseudo || '',
      login: user.login || '',
      mdp: '', // Ne pas pré-remplir le mot de passe
      mail: user.mail || '',
      tel: user.tel || '',
      fonction: user.fonction || '',
      centre: user.centre || '',
      centres: (user.fonction === 9 && user.centres_ids) ? user.centres_ids : [], // Pour fonction 9 : charger les centres multiples
      genre: user.genre || 2,
      etat: user.etat || 1,
      color: user.color || '#9cbfc8',
      chef_equipe: user.chef_equipe || '',
      id_rp_qualif: user.id_rp_qualif || ''
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    
    // Si on modifie et que le mot de passe est vide, ne pas l'envoyer
    if (editingId && !submitData.mdp) {
      delete submitData.mdp;
    }

    // Pour la fonction 9, envoyer centres au lieu de centre
    if (submitData.fonction === 9) {
      if (submitData.centres && Array.isArray(submitData.centres) && submitData.centres.length > 0) {
        // Envoyer centres pour fonction 9
        submitData.centres = submitData.centres.map(c => parseInt(c)).filter(c => c > 0);
        // Garder aussi centre pour compatibilité (premier centre)
        submitData.centre = submitData.centres[0];
      } else {
        toast.error('Veuillez sélectionner au moins un centre pour la fonction 9');
        return;
      }
    } else {
      // Pour les autres fonctions, supprimer centres
      delete submitData.centres;
      if (!submitData.centre) {
        toast.error('Veuillez sélectionner un centre');
        return;
      }
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      if (!submitData.mdp) {
        toast.error('Le mot de passe est requis pour un nouvel utilisateur');
        return;
      }
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id, pseudo) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${pseudo}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Mutation pour générer le token
  const generateTokenMutation = useMutation(
    async () => {
      const response = await api.post('/management/utilisateurs/generate-token');
      return response.data;
    },
    {
      onSuccess: (data) => {
        setGeneratedToken(data.data.token);
        setTokenCopied(false);
        toast.success('Token généré avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la génération du token');
      }
    }
  );

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken).then(() => {
        setTokenCopied(true);
        toast.success('Token copié dans le presse-papiers');
        setTimeout(() => setTokenCopied(false), 2000);
      }).catch(() => {
        toast.error('Erreur lors de la copie du token');
      });
    }
  };

  if (loadingUsers) return <LoadingSpinner text="Chargement des utilisateurs..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Utilisateurs</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
          <FaPlus /> Ajouter un utilisateur
        </button>
      </div>

      {/* Section génération de token pour l'utilisateur connecté */}
      {currentUser && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '13.6px', color: '#9cbfc8' }}>
                <FaKey style={{ marginRight: '8px' }} />
                Token de l'utilisateur connecté
              </h3>
              <p style={{ margin: '5px 0 0 0', fontSize: '11.9px', color: '#666' }}>
                Utilisateur : <strong>{currentUser.pseudo}</strong> ({currentUser.login})
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => generateTokenMutation.mutate()}
              disabled={generateTokenMutation.isLoading}
              style={{ minWidth: '150px' }}
            >
              {generateTokenMutation.isLoading ? 'Génération...' : (
                <>
                  <FaKey /> Générer un token
                </>
              )}
            </button>
          </div>

          {generatedToken && (
            <div style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '15px',
              marginTop: '15px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '11.9px', fontWeight: '600', color: '#9cbfc8' }}>
                  Votre token JWT :
                </label>
                <button
                  onClick={handleCopyToken}
                  style={{
                    padding: '6px 12px',
                    background: tokenCopied ? '#28a745' : '#9cbfc8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10.2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {tokenCopied ? (
                    <>
                      <FaCheck /> Copié !
                    </>
                  ) : (
                    <>
                      <FaCopy /> Copier
                    </>
                  )}
                </button>
              </div>
              <textarea
                readOnly
                value={generatedToken}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '10.2px',
                  resize: 'vertical',
                  background: '#f8f9fa'
                }}
                onClick={(e) => e.target.select()}
              />
              <p style={{ margin: '10px 0 0 0', fontSize: '10.2px', color: '#666', fontStyle: 'italic' }}>
                ⚠️ Ce token est valide pour {generateTokenMutation.data?.data?.expiresIn || '7 jours'}. 
                Conservez-le en sécurité et ne le partagez pas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Barre de recherche */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, pseudo, login, fonction, centre ou ID..."
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
          <div className="form-content" style={{ maxWidth: '600px' }}>
            <h3>{editingId ? 'Modifier' : 'Ajouter'} un utilisateur</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    Nom *
                    <Tooltip text="Nom de famille de l'utilisateur. Ce champ est obligatoire.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Prénom *
                    <Tooltip text="Prénom de l'utilisateur. Ce champ est obligatoire.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Pseudo *
                    <Tooltip text="Nom d'affichage de l'utilisateur dans le système. Ce champ est obligatoire et doit être unique.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <input
                    type="text"
                    value={formData.pseudo}
                    onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Login *
                    <Tooltip text="Identifiant de connexion. Ce champ est obligatoire et doit être unique.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <input
                    type="text"
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Mot de passe {!editingId && '*'}
                  <Tooltip text={editingId ? "Laisser vide pour ne pas modifier le mot de passe. Remplir uniquement si vous souhaitez le changer." : "Mot de passe pour la connexion. Ce champ est obligatoire pour un nouvel utilisateur."}>
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="password"
                  value={formData.mdp}
                  onChange={(e) => setFormData({ ...formData, mdp: e.target.value })}
                  required={!editingId}
                  placeholder={editingId ? 'Laisser vide pour ne pas modifier' : ''}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.mail}
                    onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Téléphone</label>
                  <input
                    type="tel"
                    value={formData.tel}
                    onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Fonction *
                    <Tooltip text="Rôle de l'utilisateur dans le système. Détermine les permissions et accès.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <select
                    value={formData.fonction}
                    onChange={(e) => {
                      const newFonction = parseInt(e.target.value);
                      setFormData({ 
                        ...formData, 
                        fonction: newFonction,
                        // Réinitialiser chef_equipe si on change de fonction (sauf si agent ou confirmateur)
                        chef_equipe: (newFonction === 3 || newFonction === 6) ? formData.chef_equipe : '',
                        // Réinitialiser centres/centre selon la fonction
                        centres: newFonction === 9 ? (formData.centres || []) : [],
                        centre: newFonction === 9 ? '' : formData.centre
                      });
                    }}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {fonctions && fonctions.map(f => (
                      <option key={f.id} value={f.id}>{f.titre}</option>
                    ))}
                  </select>
                </div>
                {/* Champ Centre - Simple pour les autres fonctions, multiple pour fonction 9 */}
                {formData.fonction === 9 ? (
                  <div className="form-group">
                    <label>
                      Centres * (plusieurs sélections possibles)
                      <Tooltip text="Centres d'activité auxquels appartient l'utilisateur. Pour la fonction 9, vous pouvez sélectionner plusieurs centres.">
                        <FaInfoCircle className="info-icon" />
                      </Tooltip>
                    </label>
                    <select
                      multiple
                      size={5}
                      value={formData.centres.map(c => String(c))}
                      onChange={(e) => {
                        const selectedCentres = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                        setFormData({ ...formData, centres: selectedCentres });
                      }}
                      required
                      style={{ 
                        width: '100%', 
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        minHeight: '120px'
                      }}
                    >
                      {centres && centres.map(c => (
                        <option key={c.id} value={c.id}>{c.titre}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: '5px', fontSize: '10.2px', color: '#666' }}>
                      {formData.centres.length > 0 
                        ? `${formData.centres.length} centre(s) sélectionné(s)` 
                        : 'Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs centres'}
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>
                      Centre *
                      <Tooltip text="Centre d'activité auquel appartient l'utilisateur.">
                        <FaInfoCircle className="info-icon" />
                      </Tooltip>
                    </label>
                    <select
                      value={formData.centre}
                      onChange={(e) => setFormData({ ...formData, centre: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {centres && centres.map(c => (
                        <option key={c.id} value={c.id}>{c.titre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Champ Superviseur - Affiché uniquement pour les agents (fonction 3) */}
              {formData.fonction === 3 && (
                <div className="form-group">
                  <label>
                    Superviseur
                    <Tooltip text="Superviseur responsable de cet agent. Permet au superviseur de voir les statistiques et fiches de l'agent.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <select
                    value={formData.chef_equipe}
                    onChange={(e) => setFormData({ ...formData, chef_equipe: e.target.value ? parseInt(e.target.value) : '' })}
                  >
                    <option value="">Aucun superviseur</option>
                    {utilisateurs && utilisateurs
                      .filter(u => u.fonction === 2 && u.etat > 0) // Filtrer uniquement les utilisateurs avec fonction Superviseur (2) et actifs
                      .map(superviseur => (
                        <option key={superviseur.id} value={superviseur.id}>
                          {superviseur.pseudo} ({superviseur.fonction_titre || '-'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Champ RE Confirmation - Affiché uniquement pour les confirmateurs (fonction 6) */}
              {formData.fonction === 6 && (
                <div className="form-group">
                  <label>
                    RE Confirmation
                    <Tooltip text="RE Confirmation responsable de ce confirmateur. Permet au RE Confirmation de voir les décalages et RDV de ce confirmateur.">
                      <FaInfoCircle className="info-icon" />
                    </Tooltip>
                  </label>
                  <select
                    value={formData.chef_equipe}
                    onChange={(e) => setFormData({ ...formData, chef_equipe: e.target.value ? parseInt(e.target.value) : '' })}
                  >
                    <option value="">Aucun RE Confirmation</option>
                    {utilisateurs && utilisateurs
                      .filter(u => u.fonction === 14 && u.etat > 0 && u.id !== editingId) // Filtrer uniquement les utilisateurs avec fonction RE Confirmation (14) et actifs, exclure l'utilisateur en cours d'édition
                      .map(reConfirmation => (
                        <option key={reConfirmation.id} value={reConfirmation.id}>
                          {reConfirmation.pseudo} ({reConfirmation.fonction_titre || 'RE Confirmation'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Champ RP Qualification - Affiché pour les superviseurs (utilisateurs qui ont ou auront des agents sous leur responsabilité) */}
              {/* Afficher pour : 
                  - Les utilisateurs qui ont déjà des agents sous leur responsabilité (superviseurs existants)
                  - Les utilisateurs qui ne sont pas des agents (fonction 3), qui ne sont pas des RP Qualification (fonction 12) et qui ne sont pas des confirmateurs (fonction 6)
              */}
              {(() => {
                // Vérifier si l'utilisateur a déjà des agents sous sa responsabilité (superviseur existant)
                const hasAgents = editingId && utilisateurs && utilisateurs.some(u => 
                  u.chef_equipe === editingId && u.fonction === 3 && u.etat > 0
                );
                
                // Afficher le champ si :
                // - L'utilisateur a déjà des agents (superviseur existant), OU
                // - L'utilisateur n'est pas un agent (fonction 3), n'est pas un RP Qualification (fonction 12) et n'est pas un confirmateur (fonction 6)
                const shouldShow = hasAgents || (formData.fonction !== 3 && formData.fonction !== 12 && formData.fonction !== 6 && formData.fonction !== '');
                
                if (!shouldShow) return null;
                
                return (
                  <div className="form-group">
                    <label>
                      RP Qualification
                      <Tooltip text="RP Qualification responsable de ce superviseur. Permet au RP Qualification de voir la production de ce superviseur et les agents sous sa responsabilité.">
                        <FaInfoCircle className="info-icon" />
                      </Tooltip>
                    </label>
                    <select
                      value={formData.id_rp_qualif || ''}
                      onChange={(e) => setFormData({ ...formData, id_rp_qualif: e.target.value ? parseInt(e.target.value) : '' })}
                    >
                      <option value="">Aucun RP Qualification</option>
                      {utilisateurs && utilisateurs
                        .filter(u => u.fonction === 12 && u.etat > 0 && u.id !== editingId) // Filtrer uniquement les utilisateurs avec fonction RP Qualification (12) et actifs, exclure l'utilisateur en cours d'édition
                        .map(rp => (
                          <option key={rp.id} value={rp.id}>
                            {rp.pseudo} ({rp.fonction_titre || 'RP Qualification'})
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })()}

              <div className="form-row">
                <div className="form-group">
                  <label>Genre</label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: parseInt(e.target.value) })}
                  >
                    <option value={2}>Homme</option>
                    <option value={1}>Femme</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>État</label>
                  <select
                    value={formData.etat}
                    onChange={(e) => setFormData({ ...formData, etat: parseInt(e.target.value) })}
                  >
                    <option value={1}>Actif</option>
                    <option value={0}>Inactif</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Couleur</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
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
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
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
              <th>Pseudo</th>
              <th>Nom</th>
              <th>Login</th>
              <th>Fonction</th>
              <th>Centre</th>
              <th>Superviseur / RE Confirmation</th>
              <th>RP Qualification</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData && filteredData.length > 0 ? (
              filteredData.map((user) => (
                <tr key={user.id}>
                  <td data-label="">{user.id}</td>
                  <td data-label="Pseudo:">{user.pseudo}</td>
                  <td data-label="Nom:">{user.nom} {user.prenom}</td>
                  <td data-label="Login:">{user.login}</td>
                  <td data-label="Fonction:">{user.fonction_titre || '-'}</td>
                  <td data-label="Centre:">
                    {user.fonction === 9 && user.centres && user.centres.length > 0 ? (
                      <div>
                        {user.centres.map((c, idx) => (
                          <span key={c.id} style={{ 
                            display: 'inline-block',
                            marginRight: '5px',
                            marginBottom: '3px',
                            padding: '2px 8px',
                            background: '#e3f2fd',
                            borderRadius: '12px',
                            fontSize: '10.2px'
                          }}>
                            {c.titre}
                          </span>
                        ))}
                      </div>
                    ) : (
                      user.centre_titre || '-'
                    )}
                  </td>
                  <td data-label="Superviseur / RE Confirmation:">
                    {user.chef_equipe ? (
                      utilisateurs.find(u => u.id === user.chef_equipe)?.pseudo || user.supervisor_pseudo || '-'
                    ) : '-'}
                  </td>
                  <td data-label="RP Qualification:">
                    {user.id_rp_qualif ? (
                      utilisateurs.find(u => u.id === user.id_rp_qualif)?.pseudo || user.rp_qualif_pseudo || '-'
                    ) : '-'}
                  </td>
                  <td data-label="État:">
                    <span className={`badge ${user.etat === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {user.etat === 1 ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="action-buttons">
                      <button className="btn-icon" onClick={() => handleEdit(user)} title="Modifier">
                        <FaEdit />
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(user.id, user.pseudo)} title="Supprimer">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center">
                  {searchTerm ? 'Aucun résultat trouvé' : 'Aucun utilisateur trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UtilisateursTab;

