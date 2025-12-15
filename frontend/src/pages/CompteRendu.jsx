import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaFileAlt, FaSearch, FaEdit, FaTrash, FaEye, FaClipboardList, FaCheck, FaTimes, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import EditCompteRenduModal from '../components/EditCompteRenduModal';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './CompteRendu.css';

const CompteRendu = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('visites'); // 'visites' ou 'pending'
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatutPending, setSelectedStatutPending] = useState(user.fonction === 5 ? 'pending' : 'all');
  const [commentaireAdmin, setCommentaireAdmin] = useState('');
  const [selectedCompteRendu, setSelectedCompteRendu] = useState(null);
  const [editingCompteRendu, setEditingCompteRendu] = useState(null);
  
  // Bloquer le scroll du body quand un modal est ouvert
  useModalScrollLock(!!selectedCompteRendu || !!editingCompteRendu);
  const [filters, setFilters] = useState({
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: '',
    critere: '',
    critere_champ: 'tel',
    cp: '',
    id_confirmateur: '',
    id_commercial: '',
    id_centre: '',
    etat_fiche: '',
    etat: '0' // 0: actif, 1: modifié, 2: supprimé
  });

  // Récupérer les données de référence
  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5) || [];
  });

  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les comptes rendus (visites)
  const { data: compteRendusData, isLoading } = useQuery(
    ['compte-rendu-visites', filters],
    async () => {
      const params = { ...filters, fiche_search: filters.critere ? 1 : 0 };
      // Nettoyer les paramètres vides
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });
      // Utiliser une route différente pour les visites ou filtrer côté client
      const res = await api.get('/compte-rendu', { params });
      // Filtrer pour ne garder que les comptes rendus de visites (ceux qui ont compte_rendu)
      return (res.data.data || []).filter(cr => cr.compte_rendu);
    },
    { enabled: activeTab === 'visites' }
  );

  // Récupérer les comptes rendus en attente
  const { data: comptesRendusPendingData, isLoading: isLoadingPending } = useQuery(
    ['compte-rendu-pending', selectedStatutPending],
    async () => {
      const params = selectedStatutPending !== 'all' ? { statut: selectedStatutPending } : {};
      const res = await api.get('/compte-rendu', { params });
      return res.data.data || [];
    },
    { enabled: activeTab === 'pending' }
  );

  // Mutation pour supprimer un compte rendu (visites)
  const deleteMutation = useMutation(
    async ({ id, id_fiche }) => {
      const res = await api.delete(`/compte-rendu/${id}`, { data: { id_fiche } });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-visites');
        toast.success('Compte rendu supprimé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  // Mutation pour approuver un compte rendu pending
  const approveMutation = useMutation(
    async ({ id, commentaire }) => {
      const res = await api.post(`/compte-rendu/${id}/approve`, { commentaire_admin: commentaire });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        queryClient.invalidateQueries('fiches');
        toast.success('Compte rendu approuvé avec succès');
        setSelectedCompteRendu(null);
        setCommentaireAdmin('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'approbation');
      }
    }
  );

  // Mutation pour rejeter un compte rendu pending
  const rejectMutation = useMutation(
    async ({ id, commentaire }) => {
      const res = await api.post(`/compte-rendu/${id}/reject`, { commentaire_admin: commentaire });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        toast.success('Compte rendu rejeté');
        setSelectedCompteRendu(null);
        setCommentaireAdmin('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du rejet');
      }
    }
  );

  // Mutation pour modifier un compte rendu pending
  const updatePendingMutation = useMutation(
    async ({ id, data }) => {
      const res = await api.put(`/compte-rendu/${id}`, data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        toast.success('Compte rendu modifié avec succès');
        setEditingCompteRendu(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la modification');
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    queryClient.invalidateQueries('compte-rendu');
  };

  const handleReset = () => {
    setFilters({
      date_debut: new Date().toISOString().split('T')[0],
      date_fin: '',
      critere: '',
      critere_champ: 'tel',
      cp: '',
      id_confirmateur: '',
      id_commercial: '',
      id_centre: '',
      etat_fiche: '',
      etat: '0'
    });
  };

  const handleDelete = (id, id_fiche) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce compte rendu ?')) {
      deleteMutation.mutate({ id, id_fiche });
    }
  };

  const handleApprove = (cr) => {
    if (window.confirm('Êtes-vous sûr de vouloir approuver ce compte rendu ? Les modifications seront appliquées à la fiche.')) {
      approveMutation.mutate({ id: cr.id, commentaire: commentaireAdmin });
    }
  };

  const handleReject = (cr) => {
    if (window.confirm('Êtes-vous sûr de vouloir rejeter ce compte rendu ?')) {
      rejectMutation.mutate({ id: cr.id, commentaire: commentaireAdmin });
    }
  };

  const getStatutIcon = (statut) => {
    switch (statut) {
      case 'pending':
        return <FaClock className="statut-icon pending" />;
      case 'approved':
        return <FaCheckCircle className="statut-icon approved" />;
      case 'rejected':
        return <FaTimesCircle className="statut-icon rejected" />;
      default:
        return null;
    }
  };

  const getStatutLabel = (statut) => {
    switch (statut) {
      case 'pending':
        return 'En attente';
      case 'approved':
        return 'Approuvé';
      case 'rejected':
        return 'Rejeté';
      default:
        return statut;
    }
  };

  const compteRendus = compteRendusData || [];
  const confirmateurs = confirmateursData || [];
  const commerciaux = commerciauxData || [];
  const centres = centresData || [];
  const etats = etatsData || [];

  const compteRendusPending = comptesRendusPendingData || [];
  const isAdmin = [1, 2, 7].includes(user.fonction);

  return (
    <div className="compte-rendu-page">
      <div className="page-header">
        <h1><FaClipboardList /> Comptes Rendus</h1>
        <div className="header-actions">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'visites' ? 'active' : ''}`}
              onClick={() => setActiveTab('visites')}
            >
              <FaClipboardList /> Comptes Rendus Visites
            </button>
            <button
              className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <FaClock /> En Attente d'Approbation
            </button>
          </div>
          {activeTab === 'visites' && (
            <button
              className="toggle-filters-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaSearch /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
            </button>
          )}
        </div>
      </div>

      {/* Section Comptes Rendus Visites */}
      {activeTab === 'visites' && showFilters && (
        <div className="filters-section">
          <form onSubmit={handleSearch}>
            <div className="filters-grid">
              <div className="filter-group">
                <label>Critère</label>
                <input
                  type="text"
                  value={filters.critere}
                  onChange={(e) => handleFilterChange('critere', e.target.value)}
                  placeholder="Rechercher..."
                />
              </div>
              <div className="filter-group">
                <label>Type de critère</label>
                <select
                  value={filters.critere_champ}
                  onChange={(e) => handleFilterChange('critere_champ', e.target.value)}
                >
                  <option value="tel">Téléphone</option>
                  <option value="nom">Nom Prénom</option>
                  <option value="gsm1">GSM</option>
                  <option value="gsm2">GSM2</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Département</label>
                <input
                  type="text"
                  value={filters.cp}
                  onChange={(e) => handleFilterChange('cp', e.target.value)}
                  placeholder="Code postal"
                />
              </div>
              <div className="filter-group">
                <label>Confirmateur</label>
                <select
                  value={filters.id_confirmateur}
                  onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                >
                  <option value="">Tous</option>
                  {confirmateurs.map(conf => (
                    <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Commercial</label>
                <select
                  value={filters.id_commercial}
                  onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
                >
                  <option value="">Tous</option>
                  {commerciaux.map(com => (
                    <option key={com.id} value={com.id}>{com.pseudo}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Centre</label>
                <select
                  value={filters.id_centre}
                  onChange={(e) => handleFilterChange('id_centre', e.target.value)}
                >
                  <option value="">Tous</option>
                  {centres.map(centre => (
                    <option key={centre.id} value={centre.id}>{centre.titre}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>État fiche</label>
                <select
                  value={filters.etat_fiche}
                  onChange={(e) => handleFilterChange('etat_fiche', e.target.value)}
                >
                  <option value="">Tous</option>
                  {etats.map(etat => (
                    <option key={etat.id} value={etat.id}>{etat.titre}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Date début</label>
                <input
                  type="date"
                  value={filters.date_debut}
                  onChange={(e) => handleFilterChange('date_debut', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>Date fin</label>
                <input
                  type="date"
                  value={filters.date_fin}
                  onChange={(e) => handleFilterChange('date_fin', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>État CR</label>
                <select
                  value={filters.etat}
                  onChange={(e) => handleFilterChange('etat', e.target.value)}
                >
                  <option value="0">Actifs</option>
                  <option value="1">Modifiés</option>
                  <option value="2">Supprimés</option>
                </select>
              </div>
            </div>
            <div className="filters-actions">
              <button type="submit" className="btn-primary">
                <FaSearch /> Rechercher
              </button>
              <button type="button" onClick={handleReset} className="btn-secondary">
                Réinitialiser
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Section Comptes Rendus Visites */}
      {activeTab === 'visites' && (
        <div className="results-section">
          {isLoading ? (
            <div className="loading">Chargement...</div>
          ) : compteRendus.length > 0 ? (
          <div className="compte-rendu-list">
            {compteRendus.map((cr) => (
              <div key={cr.id_cr || cr.id} className="compte-rendu-card">
                <div className="cr-header">
                  <div className="cr-info">
                    <h3>
                      {cr.nom} {cr.prenom}
                    </h3>
                    <div className="cr-meta">
                      <span>Tél: {cr.tel}</span>
                      {cr.name_visite && <span>Visite: {cr.name_visite}</span>}
                    </div>
                  </div>
                  <div className="cr-actions">
                    <FicheDetailLink ficheId={cr.id_fiche} className="btn-icon" title="Voir fiche">
                      <FaEye />
                    </FicheDetailLink>
                    {(user.fonction === 1 || user.fonction === 2 || user.fonction === 6 || user.fonction === 7) && (
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(cr.id_cr || cr.id, cr.id_fiche)}
                        title="Supprimer"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
                <div className="cr-content">
                  <div className="cr-field">
                    <strong>Commercial:</strong> {cr.commercial_pseudo || 'N/A'}
                  </div>
                  <div className="cr-field">
                    <strong>Date visite:</strong> {cr.date_visite ? new Date(cr.date_visite).toLocaleString('fr-FR') : 'N/A'}
                  </div>
                  <div className="cr-field">
                    <strong>Date modification:</strong> {cr.cr_date_modif ? new Date(cr.cr_date_modif).toLocaleString('fr-FR') : 'N/A'}
                  </div>
                  {cr.etat_fiche && (
                    <div className="cr-field">
                      <strong>État fiche:</strong> {etats.find(e => e.id === cr.etat_fiche)?.titre || cr.etat_fiche}
                    </div>
                  )}
                  <div className="cr-field">
                    <strong>Compte rendu:</strong>
                    <div className="cr-text">{cr.compte_rendu || 'Aucun compte rendu'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">Aucun compte rendu trouvé</div>
          )}
        </div>
      )}

      {/* Section Comptes Rendus Pending */}
      {activeTab === 'pending' && (
        <div className="results-section">
          <div className="pending-header">
            {isAdmin && (
              <div className="statut-filters">
                <button
                  className={`statut-filter ${selectedStatutPending === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('all')}
                >
                  Tous
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'pending' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('pending')}
                >
                  <FaClock /> En attente
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'approved' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('approved')}
                >
                  <FaCheckCircle /> Approuvés
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'rejected' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('rejected')}
                >
                  <FaTimesCircle /> Rejetés
                </button>
              </div>
            )}
          </div>

          {isLoadingPending ? (
            <div className="loading">Chargement...</div>
          ) : compteRendusPending.length > 0 ? (
            <div className="compte-rendu-list">
              {compteRendusPending.map((cr) => (
                <div key={cr.id} className={`compte-rendu-card statut-${cr.statut}`}>
                  <div className="cr-header">
                    <div className="cr-info">
                      <div className="cr-title">
                        {getStatutIcon(cr.statut)}
                        <h3>
                          {cr.fiche_nom} {cr.fiche_prenom}
                        </h3>
                        <span className={`statut-badge statut-${cr.statut}`}>{getStatutLabel(cr.statut)}</span>
                      </div>
                      <div className="cr-meta">
                        <span>Tél: {cr.fiche_tel}</span>
                        <span>Commercial: {cr.commercial_pseudo}</span>
                        <span>Créé le: {new Date(cr.date_creation).toLocaleString('fr-FR')}</span>
                        {cr.date_approbation && (
                          <span>
                            {cr.statut === 'approved' ? 'Approuvé' : 'Rejeté'} le: {new Date(cr.date_approbation).toLocaleString('fr-FR')}
                            {cr.approbateur_pseudo && ` par ${cr.approbateur_pseudo}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="cr-actions">
                      <FicheDetailLink ficheId={cr.id_fiche} className="btn-icon" title="Voir fiche">
                        <FaEye />
                      </FicheDetailLink>
                      {isAdmin && cr.statut === 'pending' && (
                        <>
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => setEditingCompteRendu(cr)}
                            title="Modifier"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn-icon btn-success"
                            onClick={() => {
                              setSelectedCompteRendu(cr);
                              setCommentaireAdmin('');
                            }}
                            title="Approuver"
                          >
                            <FaCheck />
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => {
                              setSelectedCompteRendu(cr);
                              setCommentaireAdmin('');
                            }}
                            title="Rejeter"
                          >
                            <FaTimes />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="cr-content">
                    {(cr.id_etat_final || cr.id_sous_etat) && (
                      <div className="cr-field">
                        <strong>État:</strong>
                        <div className="cr-text">
                          {cr.etat_titre && <span>État: {cr.etat_titre}</span>}
                          {cr.sous_etat_titre && <span> - Sous-état: {cr.sous_etat_titre}</span>}
                        </div>
                      </div>
                    )}

                    {(cr.ph3_installateur || cr.ph3_pac || cr.ph3_puissance || cr.ph3_prix || cr.ph3_mensualite) && (
                      <div className="cr-field">
                        <strong>Informations de vente (Phase 3):</strong>
                        <div className="modifications-list">
                          {cr.ph3_installateur && <div className="modification-item"><span className="modification-key">Installateur:</span><span className="modification-value">{cr.ph3_installateur}</span></div>}
                          {cr.ph3_pac && <div className="modification-item"><span className="modification-key">PAC:</span><span className="modification-value">{cr.ph3_pac}</span></div>}
                          {cr.ph3_puissance && <div className="modification-item"><span className="modification-key">Puissance:</span><span className="modification-value">{cr.ph3_puissance}</span></div>}
                          {cr.ph3_prix && <div className="modification-item"><span className="modification-key">Prix:</span><span className="modification-value">{cr.ph3_prix} €</span></div>}
                          {cr.ph3_mensualite && <div className="modification-item"><span className="modification-key">Mensualité:</span><span className="modification-value">{cr.ph3_mensualite} €</span></div>}
                        </div>
                      </div>
                    )}

                    {cr.commentaire && (
                      <div className="cr-field">
                        <strong>Commentaire commercial:</strong>
                        <div className="cr-text">{cr.commentaire}</div>
                      </div>
                    )}

                    <div className="cr-field">
                      <div className="modifications-list">
                        {Object.entries(cr.modifications || {})
                          .filter(([key]) => key !== 'conf_commentaire_produit')
                          .map(([key, value]) => (
                            <div key={key} className="modification-item">
                              <span className="modification-key">{key}:</span>
                              <span className="modification-value">{String(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {cr.commentaire_admin && (
                      <div className="cr-field">
                        <strong>Commentaire admin:</strong>
                        <div className="cr-text">{cr.commentaire_admin}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Aucun compte rendu en attente trouvé</div>
          )}
        </div>
      )}

      {/* Modal d'approbation/rejet */}
      {selectedCompteRendu && isAdmin && selectedCompteRendu.statut === 'pending' && (
        <div className="modal-overlay" onClick={() => setSelectedCompteRendu(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedCompteRendu.fiche_nom} {selectedCompteRendu.fiche_prenom}
              </h2>
              <button className="btn-close" onClick={() => setSelectedCompteRendu(null)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="action-buttons">
                <button
                  className="btn btn-success"
                  onClick={() => handleApprove(selectedCompteRendu)}
                  disabled={approveMutation.isLoading}
                >
                  <FaCheck /> Approuver
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleReject(selectedCompteRendu)}
                  disabled={rejectMutation.isLoading}
                >
                  <FaTimes /> Rejeter
                </button>
              </div>
              <div className="commentaire-section">
                <label>Commentaire (optionnel):</label>
                <textarea
                  value={commentaireAdmin}
                  onChange={(e) => setCommentaireAdmin(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modification */}
      {editingCompteRendu && isAdmin && editingCompteRendu.statut === 'pending' && (
        <EditCompteRenduModal
          compteRendu={editingCompteRendu}
          etats={etats}
          onClose={() => setEditingCompteRendu(null)}
          onSave={(data) => {
            updatePendingMutation.mutate({ id: editingCompteRendu.id, data });
          }}
          isLoading={updatePendingMutation.isLoading}
        />
      )}
    </div>
  );
};

export default CompteRendu;

