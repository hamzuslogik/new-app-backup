import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCheck, FaTimes, FaEye, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './CompteRenduPending.css';

const CompteRenduPending = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatut, setSelectedStatut] = useState(user.fonction === 5 ? 'pending' : 'all'); // Commerciaux voient seulement 'pending' par défaut
  const [commentaireAdmin, setCommentaireAdmin] = useState('');
  const [selectedCompteRendu, setSelectedCompteRendu] = useState(null);
  
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(!!selectedCompteRendu);

  // Récupérer les comptes rendus
  const { data: comptesRendusData, isLoading } = useQuery(
    ['compte-rendu-pending', selectedStatut],
    async () => {
      const params = selectedStatut !== 'all' ? { statut: selectedStatut } : {};
      const res = await api.get('/compte-rendu', { params });
      return res.data.data || [];
    }
  );

  // Mutation pour approuver un compte rendu
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

  // Mutation pour rejeter un compte rendu
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

  const comptesRendus = comptesRendusData || [];
  const isAdmin = [1, 2, 7].includes(user.fonction);
  const isCommercial = user.fonction === 5;

  return (
    <div className="compte-rendu-pending-page">
      <div className="page-header">
        <h1>Comptes Rendus en Attente</h1>
        {isAdmin && (
          <div className="statut-filters">
            <button
              className={`statut-filter ${selectedStatut === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedStatut('all')}
            >
              Tous
            </button>
            <button
              className={`statut-filter ${selectedStatut === 'pending' ? 'active' : ''}`}
              onClick={() => setSelectedStatut('pending')}
            >
              <FaClock /> En attente
            </button>
            <button
              className={`statut-filter ${selectedStatut === 'approved' ? 'active' : ''}`}
              onClick={() => setSelectedStatut('approved')}
            >
              <FaCheckCircle /> Approuvés
            </button>
            <button
              className={`statut-filter ${selectedStatut === 'rejected' ? 'active' : ''}`}
              onClick={() => setSelectedStatut('rejected')}
            >
              <FaTimesCircle /> Rejetés
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="loading">Chargement...</div>
      ) : comptesRendus.length > 0 ? (
        <div className="compte-rendu-list">
          {comptesRendus.map((cr) => (
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
                      {cr.ph3_installateur && (
                        <div className="modification-item">
                          <span className="modification-key">Installateur:</span>
                          <span className="modification-value">{cr.ph3_installateur}</span>
                        </div>
                      )}
                      {cr.ph3_pac && (
                        <div className="modification-item">
                          <span className="modification-key">PAC:</span>
                          <span className="modification-value">{cr.ph3_pac}</span>
                        </div>
                      )}
                      {cr.ph3_puissance && (
                        <div className="modification-item">
                          <span className="modification-key">Puissance:</span>
                          <span className="modification-value">{cr.ph3_puissance}</span>
                        </div>
                      )}
                      {cr.ph3_puissance_pv && (
                        <div className="modification-item">
                          <span className="modification-key">Puissance PV:</span>
                          <span className="modification-value">{cr.ph3_puissance_pv}</span>
                        </div>
                      )}
                      {cr.ph3_rr_model && (
                        <div className="modification-item">
                          <span className="modification-key">Modèle RR:</span>
                          <span className="modification-value">{cr.ph3_rr_model}</span>
                        </div>
                      )}
                      {cr.ph3_ballon && (
                        <div className="modification-item">
                          <span className="modification-key">Ballon:</span>
                          <span className="modification-value">{cr.ph3_ballon}</span>
                        </div>
                      )}
                      {cr.ph3_marque_ballon && (
                        <div className="modification-item">
                          <span className="modification-key">Marque ballon:</span>
                          <span className="modification-value">{cr.ph3_marque_ballon}</span>
                        </div>
                      )}
                      {cr.ph3_type && (
                        <div className="modification-item">
                          <span className="modification-key">Type:</span>
                          <span className="modification-value">{cr.ph3_type}</span>
                        </div>
                      )}
                      {cr.ph3_prix && (
                        <div className="modification-item">
                          <span className="modification-key">Prix:</span>
                          <span className="modification-value">{cr.ph3_prix} €</span>
                        </div>
                      )}
                      {cr.ph3_bonus_30 && (
                        <div className="modification-item">
                          <span className="modification-key">Bonus 30%:</span>
                          <span className="modification-value">{cr.ph3_bonus_30} €</span>
                        </div>
                      )}
                      {cr.ph3_mensualite && (
                        <div className="modification-item">
                          <span className="modification-key">Mensualité:</span>
                          <span className="modification-value">{cr.ph3_mensualite} €</span>
                        </div>
                      )}
                      {cr.nbr_annee_finance && (
                        <div className="modification-item">
                          <span className="modification-key">Années financement:</span>
                          <span className="modification-value">{cr.nbr_annee_finance}</span>
                        </div>
                      )}
                      {cr.credit_immobilier && (
                        <div className="modification-item">
                          <span className="modification-key">Crédit immobilier:</span>
                          <span className="modification-value">{cr.credit_immobilier}</span>
                        </div>
                      )}
                      {cr.credit_autre && (
                        <div className="modification-item">
                          <span className="modification-key">Autre crédit:</span>
                          <span className="modification-value">{cr.credit_autre}</span>
                        </div>
                      )}
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
        <div className="no-data">Aucun compte rendu trouvé</div>
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
    </div>
  );
};

export default CompteRenduPending;

