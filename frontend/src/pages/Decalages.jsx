import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaClock, FaUser, FaFileAlt, FaCheck, FaTimes, FaSearch, FaFilter, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import './Decalages.css';

const Decalages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openFicheDetail } = useFicheDetailModal();
  const [filters, setFilters] = useState({
    id_etat: '',
    expediteur: '',
    destination: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Récupérer les décalages (filtrés par l'utilisateur connecté côté backend)
  const { data: decalagesData, isLoading, refetch } = useQuery(
    ['decalages', user?.id], // Inclure l'ID utilisateur dans la clé pour éviter le cache partagé
    async () => {
      const res = await api.get('/decalages');
      return res.data.data || [];
    },
    {
      refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
      enabled: !!user?.id, // Ne charger que si l'utilisateur est connecté
      staleTime: 0, // Considérer les données comme obsolètes immédiatement pour forcer le rafraîchissement
    }
  );

  // Récupérer les états de décalage
  const { data: etatsDecalage } = useQuery(
    'etats-decalage',
    async () => {
      const res = await api.get('/management/etat-decalage');
      return res.data.data || [];
    }
  );

  // Récupérer les utilisateurs (pour les filtres)
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });

  // Mutation pour mettre à jour le statut d'un décalage
  const updateStatutMutation = useMutation(
    async ({ id, id_etat }) => {
      const res = await api.put(`/decalages/${id}/statut`, { id_etat });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['decalages', user?.id]);
        toast.success('Statut du décalage mis à jour avec succès');
      },
      onError: (error) => {
        toast.error('Erreur lors de la mise à jour du statut: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Rafraîchir les données quand l'utilisateur change
  useEffect(() => {
    if (user?.id) {
      queryClient.invalidateQueries(['decalages', user.id]);
      refetch();
    }
  }, [user?.id, queryClient, refetch]);

  // Filtrer les décalages
  let filteredDecalages = decalagesData || [];
  
  // Pour les commerciaux, pas de filtres (backend filtre déjà)
  if (user?.fonction !== 5) {
    filteredDecalages = filteredDecalages.filter(decalage => {
      if (filters.id_etat && decalage.id_etat !== parseInt(filters.id_etat)) return false;
      if (filters.expediteur && decalage.expediteur !== parseInt(filters.expediteur)) return false;
      if (filters.destination && decalage.destination !== parseInt(filters.destination)) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchIn = `${decalage.fiche_nom || ''} ${decalage.fiche_prenom || ''} ${decalage.fiche_tel || ''} ${decalage.message || ''}`.toLowerCase();
        if (!searchIn.includes(searchLower)) return false;
      }
      return true;
    });
  }
  
  // Trier par date de création (plus récent en premier)
  filteredDecalages = filteredDecalages.sort((a, b) => {
    const dateA = a.date_creation ? new Date(a.date_creation).getTime() : 0;
    const dateB = b.date_creation ? new Date(b.date_creation).getTime() : 0;
    return dateB - dateA; // Ordre décroissant
  });

  const handleStatutChange = (decalageId, newStatut) => {
    if (window.confirm('Voulez-vous changer le statut de ce décalage ?')) {
      updateStatutMutation.mutate({ id: decalageId, id_etat: newStatut });
    }
  };

  const handleFicheClick = (decalage) => {
    // Utiliser le hash de la fiche si disponible, sinon utiliser l'ID
    if (decalage.fiche_hash) {
      openFicheDetail(decalage.fiche_hash);
    } else if (decalage.fiche_id) {
      // L'API backend accepte aussi les IDs directs (hashToIdMiddleware)
      openFicheDetail(decalage.fiche_id);
    }
  };

  const getEtatColor = (etatId) => {
    // Couleurs par défaut selon l'état
    if (!etatId) return '#999';
    const etat = etatsDecalage?.find(e => e.id === etatId);
    return etat?.color || '#999';
  };

  const getEtatLabel = (etatId) => {
    if (!etatId) return 'Non défini';
    const etat = etatsDecalage?.find(e => e.id === etatId);
    return etat?.titre || 'Non défini';
  };

  if (isLoading) {
    return <div className="decalages-page"><div className="loading">Chargement...</div></div>;
  }

  return (
    <div className="decalages-page">
      <div className="decalages-header">
        <h1><FaClock /> Demandes de Décalage</h1>
        <div className="header-actions">
          {user?.fonction !== 5 && (
            <button
              className="filter-toggle-btn"
              onClick={() => setShowFilters(!showFilters)}
              style={{ marginRight: '10px' }}
            >
              <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
            </button>
          )}
          <button
            className="refresh-btn"
            onClick={() => {
              queryClient.invalidateQueries(['decalages', user?.id]);
              refetch();
              toast.info('Rafraîchissement en cours...');
            }}
            title="Rafraîchir les données"
          >
            <FaSync /> Rafraîchir
          </button>
        </div>
      </div>

      {showFilters && user?.fonction !== 5 && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Recherche</label>
              <div className="search-input-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Nom, prénom, téléphone, message..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="search-input"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>État</label>
              <select
                value={filters.id_etat}
                onChange={(e) => setFilters({ ...filters, id_etat: e.target.value })}
                className="filter-select"
              >
                <option value="">Tous les états</option>
                {etatsDecalage?.map(etat => (
                  <option key={etat.id} value={etat.id}>
                    {etat.titre}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Expéditeur</label>
              <select
                value={filters.expediteur}
                onChange={(e) => setFilters({ ...filters, expediteur: e.target.value })}
                className="filter-select"
              >
                <option value="">Tous les expéditeurs</option>
                {usersData?.filter(u => u.fonction === 5).map(user => (
                  <option key={user.id} value={user.id}>
                    {user.pseudo}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Destinataire</label>
              <select
                value={filters.destination}
                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                className="filter-select"
              >
                <option value="">Tous les destinataires</option>
                {usersData?.filter(u => u.fonction === 6).map(user => (
                  <option key={user.id} value={user.id}>
                    {user.pseudo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="decalages-stats">
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <span className="stat-value">{filteredDecalages.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">En attente</span>
          <span className="stat-value">
            {filteredDecalages.filter(d => !d.id_etat || d.id_etat === 1).length}
          </span>
        </div>
      </div>

      <div className="decalages-table-container">
        <table className="decalages-table">
          <thead>
            <tr>
              <th>Date création</th>
              <th>Fiche</th>
              <th>Expéditeur</th>
              <th>Destinataire</th>
              <th>RDV original</th>
              <th>Nouveau RDV</th>
              <th>Message</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDecalages.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">
                  Aucune demande de décalage trouvée
                </td>
              </tr>
            ) : (
              filteredDecalages.map((decalage) => (
                <tr key={decalage.id}>
                  <td data-label="Date création:">
                    {decalage.date_creation
                      ? new Date(decalage.date_creation).toLocaleString('fr-FR')
                      : '-'}
                  </td>
                  <td data-label="Fiche:">
                    {decalage.fiche_id ? (
                      <button
                        className="fiche-link-btn"
                        onClick={() => handleFicheClick(decalage)}
                        title="Voir la fiche"
                      >
                        <FaFileAlt /> {decalage.fiche_nom || ''} {decalage.fiche_prenom || ''}
                        <br />
                        <small>{decalage.fiche_tel || ''}</small>
                      </button>
                    ) : (
                      <span className="no-fiche">Fiche non disponible</span>
                    )}
                  </td>
                  <td data-label="Expéditeur:">
                    <div className="user-info">
                      {decalage.expediteur_photo && (
                        <img
                          src={decalage.expediteur_photo}
                          alt={decalage.expediteur_pseudo}
                          className="user-photo"
                        />
                      )}
                      <span>{decalage.expediteur_pseudo || 'N/A'}</span>
                    </div>
                  </td>
                  <td data-label="Destinataire:">
                    <div className="user-info">
                      {decalage.destination_photo && (
                        <img
                          src={decalage.destination_photo}
                          alt={decalage.destination_pseudo}
                          className="user-photo"
                        />
                      )}
                      <span>{decalage.destination_pseudo || 'N/A'}</span>
                    </div>
                  </td>
                  <td data-label="RDV original:">
                    {decalage.date_prevu
                      ? new Date(decalage.date_prevu).toLocaleString('fr-FR')
                      : '-'}
                  </td>
                  <td data-label="Nouveau RDV:">
                    {decalage.date_nouvelle
                      ? new Date(decalage.date_nouvelle).toLocaleString('fr-FR')
                      : decalage.date_prevu
                      ? new Date(decalage.date_prevu).toLocaleString('fr-FR')
                      : '-'}
                  </td>
                  <td data-label="Message:" className="message-cell">
                    <div className="message-content" title={decalage.message}>
                      {decalage.message || '-'}
                    </div>
                  </td>
                  <td data-label="État:">
                    <span
                      className="etat-badge"
                      style={{
                        backgroundColor: getEtatColor(decalage.id_etat),
                        color: '#fff'
                      }}
                    >
                      {getEtatLabel(decalage.id_etat)}
                    </span>
                  </td>
                  <td data-label="">
                    {/* Permissions pour modifier le statut :
                        - Admins (1, 2, 7) : peuvent changer vers tous les états
                        - Confirmateurs (6) : peuvent refuser ou valider, mais pas annuler
                        - Commerciaux (5) : peuvent seulement annuler leurs propres décalages */}
                    {([1, 2, 7].includes(user?.fonction) || 
                      (user?.fonction === 6) ||
                      (user?.fonction === 5 && decalage.expediteur === user?.id)) && (
                      <div className="action-buttons">
                        {etatsDecalage?.filter(etat => {
                          // Filtrer les états selon les permissions
                          if ([1, 2, 7].includes(user?.fonction)) {
                            // Admins : tous les états
                            return true;
                          } else if (user?.fonction === 6) {
                            // Confirmateurs : pas d'annulation (id_etat = 6)
                            return etat.id !== 6;
                          } else if (user?.fonction === 5) {
                            // Commerciaux : seulement annulation (id_etat = 6)
                            return etat.id === 6;
                          }
                          return false;
                        }).map(etat => (
                          <button
                            key={etat.id}
                            className={`action-btn ${decalage.id_etat === etat.id ? 'active' : ''}`}
                            onClick={() => handleStatutChange(decalage.id, etat.id)}
                            disabled={updateStatutMutation.isLoading || decalage.id_etat === etat.id}
                            title={`Changer le statut à: ${etat.titre}`}
                          >
                            {etat.titre}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Decalages;

