import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaCheck, FaTimes, FaClock, FaFilter } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../config/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './DemandesInsertion.css';

const DemandesInsertion = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statutFilter, setStatutFilter] = useState('');

  // Calculer la date du jour
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Récupérer les demandes d'insertion
  const { data: demandesData, isLoading } = useQuery(
    ['demandes-insertion', statutFilter],
    async () => {
      const today = getTodayDate();
      const params = {
        date_debut: today,
        date_fin: today
      };
      if (statutFilter) {
        params.statut = statutFilter;
      }
      const res = await api.get('/fiches/demandes-insertion', { params });
      return res.data.data || [];
    }
  );

  // Mutation pour traiter une demande
  const traiterDemandeMutation = useMutation(
    async ({ id, statut, commentaire }) => {
      const res = await api.put(`/fiches/demandes-insertion/${id}`, {
        statut,
        commentaire
      });
      return res.data;
    },
    {
      onSuccess: (data, variables) => {
        toast.success(
          variables.statut === 'APPROUVEE'
            ? 'Demande approuvée et fiche insérée avec succès'
            : 'Demande rejetée'
        );
        queryClient.invalidateQueries('demandes-insertion');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du traitement de la demande');
      }
    }
  );

  const handleTraiter = (id, statut) => {
    const commentaire = window.prompt(
      statut === 'APPROUVEE'
        ? 'Commentaire (optionnel) :'
        : 'Raison du rejet (optionnel) :'
    );
    
    if (commentaire !== null) {
      traiterDemandeMutation.mutate({ id, statut, commentaire: commentaire || null });
    }
  };

  const handleVoirFiche = (hash) => {
    if (hash) {
      navigate(`/fiches/${hash}`);
    } else {
      toast.error('Hash de la fiche non disponible');
    }
  };

  const getStatutBadgeClass = (statut) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return 'badge-warning';
      case 'APPROUVEE':
        return 'badge-success';
      case 'REJETEE':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  const getStatutLabel = (statut) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'APPROUVEE':
        return 'Approuvée';
      case 'REJETEE':
        return 'Rejetée';
      default:
        return statut;
    }
  };

  const demandes = demandesData || [];

  if (isLoading) {
    return <LoadingSpinner text="Chargement des demandes d'insertion..." />;
  }

  return (
    <div className="demandes-insertion-container">
      <div className="page-header">
        <h1>Demandes d'Insertion</h1>
        <div className="filters">
          <div className="filter-group">
            <FaFilter />
            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">Tous les statuts</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="APPROUVEE">Approuvées</option>
              <option value="REJETEE">Rejetées</option>
            </select>
          </div>
        </div>
      </div>

      <div className="demandes-stats">
        <div className="stat-card">
          <div className="stat-value">{demandes.filter(d => d.statut === 'EN_ATTENTE').length}</div>
          <div className="stat-label">En attente</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{demandes.filter(d => d.statut === 'APPROUVEE').length}</div>
          <div className="stat-label">Approuvées</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{demandes.filter(d => d.statut === 'REJETEE').length}</div>
          <div className="stat-label">Rejetées</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{demandes.length}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {demandes.length === 0 ? (
        <div className="no-demandes">
          <FaClock size={48} />
          <p>Aucune demande d'insertion</p>
        </div>
      ) : (
        <div className="demandes-table-container">
          <table className="demandes-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Fiche existante</th>
                <th>Date insertion</th>
                <th>Date modification</th>
                <th>Date demande</th>
                <th>Statut</th>
                <th>Traitant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((demande) => (
                <tr key={demande.id}>
                  <td>
                    <div className="agent-info">
                      <strong>{demande.agent_pseudo || `${demande.agent_nom || ''} ${demande.agent_prenom || ''}`.trim()}</strong>
                    </div>
                  </td>
                  <td>
                    <div className="fiche-info">
                      <div>
                        <strong>{demande.fiche_nom} {demande.fiche_prenom}</strong>
                      </div>
                      <div className="fiche-tel">
                        {demande.fiche_tel || demande.fiche_gsm1 || 'N/A'}
                      </div>
                      {demande.fiche_hash && (
                        <button
                          className="btn-view-fiche"
                          onClick={() => handleVoirFiche(demande.fiche_hash)}
                          title="Voir la fiche"
                        >
                          <FaEye /> Voir
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    {demande.fiche_date_insert
                      ? new Date(demande.fiche_date_insert).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'}
                  </td>
                  <td>
                    {demande.fiche_date_modif
                      ? new Date(demande.fiche_date_modif).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'}
                  </td>
                  <td>
                    {new Date(demande.date_demande).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className={`badge ${getStatutBadgeClass(demande.statut)}`}>
                      {getStatutLabel(demande.statut)}
                    </span>
                  </td>
                  <td>
                    {demande.traitant_pseudo || '-'}
                    {demande.date_traitement && (
                      <div className="date-traitement">
                        {new Date(demande.date_traitement).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </div>
                    )}
                  </td>
                  <td>
                    {demande.statut === 'EN_ATTENTE' ? (
                      <div className="action-buttons">
                        <button
                          className="btn-approve"
                          onClick={() => handleTraiter(demande.id, 'APPROUVEE')}
                          disabled={traiterDemandeMutation.isLoading}
                          title="Approuver la demande"
                        >
                          <FaCheck /> Approuver
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleTraiter(demande.id, 'REJETEE')}
                          disabled={traiterDemandeMutation.isLoading}
                          title="Rejeter la demande"
                        >
                          <FaTimes /> Rejeter
                        </button>
                      </div>
                    ) : (
                      <div className="commentaire">
                        {demande.commentaire && (
                          <div className="commentaire-text" title={demande.commentaire}>
                            {demande.commentaire.length > 30
                              ? demande.commentaire.substring(0, 30) + '...'
                              : demande.commentaire}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DemandesInsertion;

