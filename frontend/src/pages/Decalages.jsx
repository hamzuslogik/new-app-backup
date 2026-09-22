import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaClock, FaUser, FaFileAlt, FaCheck, FaTimes, FaSearch, FaFilter, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { formatLocalYmd, isRdvDateBeforeToday } from '../utils/compteRenduEarlyVerification';
import './Decalages.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

function normalizeDecalageDateTime(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().replace('T', ' ');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ ](\d{1,2}):(\d{2})/);
  if (!m) return s;
  return `${m[1]} ${String(m[2]).padStart(2, '0')}:${m[3]}`;
}

function isSameDecalageDateTime(a, b) {
  const na = normalizeDecalageDateTime(a);
  const nb = normalizeDecalageDateTime(b);
  return Boolean(na && nb && na === nb);
}

function parseDecalageDatePart(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function isAdminOrBackofficeFonction(fonction) {
  return [1, 2, 7, 11].includes(Number(fonction));
}

function isDecalageSansHeure(decalage) {
  if (!decalage?.date_nouvelle) return true;
  return isSameDecalageDateTime(decalage.date_nouvelle, decalage.date_prevu);
}

const Decalages = () => {
  useForceDesktopViewport('decalages-page');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openFicheDetail } = useFicheDetailModal();
  const [filters, setFilters] = useState({
    id_etat: '',
    expediteur: '',
    destination: '',
    search: '',
    date_creation: formatLocalYmd(),
  });
  const [showFilters, setShowFilters] = useState(false);
  const [acceptModal, setAcceptModal] = useState(null);
  const [acceptDate, setAcceptDate] = useState('');
  const [acceptTime, setAcceptTime] = useState('');

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
    async ({ id, id_etat, date_nouvelle, appliquer_fiche }) => {
      const payload = { id_etat };
      if (date_nouvelle) payload.date_nouvelle = date_nouvelle;
      if (appliquer_fiche !== undefined) payload.appliquer_fiche = appliquer_fiche;
      const res = await api.put(`/decalages/${id}/statut`, payload);
      return res.data;
    },
    {
      onSuccess: (data) => {
        setAcceptModal(null);
        setAcceptDate('');
        setAcceptTime('');
        queryClient.invalidateQueries(['decalages']);
        queryClient.invalidateQueries(['fiche']);
        queryClient.invalidateQueries(['modifica']);
        queryClient.invalidateQueries(['planning-commercial']);
        if (data?.data?.id_fiche) {
          queryClient.invalidateQueries(['decalages', data.data.id_fiche]);
        }
        toast.success(
          data?.data?.fiche_updated
            ? 'Date enregistrée et appliquée à la fiche'
            : 'Date enregistrée sur la demande de décalage'
        );
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

  // Filtrer les décalages (par défaut : date de création = aujourd'hui, y compris sans heure)
  let filteredDecalages = (decalagesData || []).filter((decalage) => {
    if (filters.date_creation) {
      const createdOn = parseDecalageDatePart(decalage.date_creation);
      if (createdOn !== filters.date_creation) return false;
    }
    if (user?.fonction === 5) return true;
    if (filters.id_etat && decalage.id_etat !== parseInt(filters.id_etat, 10)) return false;
    if (filters.expediteur && Number(decalage.expediteur) !== parseInt(filters.expediteur, 10)) return false;
    if (filters.destination && Number(decalage.destination) !== parseInt(filters.destination, 10)) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchIn = `${decalage.fiche_nom || ''} ${decalage.fiche_prenom || ''} ${decalage.fiche_tel || ''} ${decalage.message || ''}`.toLowerCase();
      if (!searchIn.includes(searchLower)) return false;
    }
    return true;
  });
  
  // Trier par date de création (plus récent en premier)
  filteredDecalages = filteredDecalages.sort((a, b) => {
    const dateA = a.date_creation ? new Date(a.date_creation).getTime() : 0;
    const dateB = b.date_creation ? new Date(b.date_creation).getTime() : 0;
    return dateB - dateA; // Ordre décroissant
  });

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

  const isDecalageTraite = (decalage) => {
    const id = Number(decalage?.id_etat);
    const etat = etatsDecalage?.find((e) => e.id === id);
    const titre = String(etat?.titre || decalage?.etat_dec || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!Number.isFinite(id) || id === 1 || titre.includes('ATTENTE')) return false;
    if (id === 2 || titre.includes('ACCEPT') || titre.includes('VALID')) return true;
    if (id === 3 || id === 4 || titre.includes('REFUS')) return true;
    return false;
  };

  const getExpediteurFonction = (decalage) => {
    if (decalage?.expediteur_fonction != null && decalage.expediteur_fonction !== '') {
      return Number(decalage.expediteur_fonction);
    }
    const sender = usersData?.find((u) => Number(u.id) === Number(decalage?.expediteur));
    return sender?.fonction != null ? Number(sender.fonction) : null;
  };

  const isAcceptEtat = (etatId) => {
    const etat = etatsDecalage?.find((e) => Number(e.id) === Number(etatId));
    const titre = String(etat?.titre || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (Number(etatId) === 4 || titre.includes('REFUS')) return false;
    if (Number(etatId) === 6 || titre.includes('ANNUL')) return false;
    if (Number(etatId) === 1 || titre.includes('ATTENTE')) return false;
    return Number(etatId) === 2 || titre.includes('ACCEPT') || titre.includes('VALID');
  };

  const needsClientRdvModal = (decalage, etatId) => {
    if (!isAcceptEtat(etatId) || !isDecalageSansHeure(decalage)) return false;
    const fn = getExpediteurFonction(decalage);
    if (fn == null || Number.isNaN(fn)) return true;
    return isAdminOrBackofficeFonction(fn);
  };

  const handleStatutChange = (decalageId, newStatut, decalage) => {
    if (isDecalageTraite(decalage)) {
      toast.warning('Cette demande a déjà été traitée et ne peut plus être modifiée.');
      return;
    }
    if (needsClientRdvModal(decalage, newStatut)) {
      setAcceptModal({ decalage, id_etat: newStatut, step: 'saisie' });
      setAcceptDate(parseDecalageDatePart(decalage.date_prevu) || formatLocalYmd());
      setAcceptTime('');
      return;
    }
    if (window.confirm('Voulez-vous changer le statut de ce décalage ?')) {
      updateStatutMutation.mutate({ id: decalageId, id_etat: newStatut });
    }
  };

  const buildAcceptedDateNouvelle = () => {
    if (!acceptDate || !acceptTime) {
      toast.error('Veuillez saisir la date et l\'heure du RDV accepté par le client.');
      return null;
    }
    const date_nouvelle = `${acceptDate} ${acceptTime}:00`;
    if (isRdvDateBeforeToday(date_nouvelle)) {
      toast.error('La date du RDV ne peut pas être antérieure à aujourd\'hui.');
      return null;
    }
    return date_nouvelle;
  };

  const submitAcceptModal = (e) => {
    e?.preventDefault?.();
    if (!acceptModal?.decalage?.id) return;
    if (!buildAcceptedDateNouvelle()) return;
    setAcceptModal((prev) => (prev ? { ...prev, step: 'appliquer' } : prev));
  };

  const confirmAcceptModal = (appliquerFiche) => {
    if (!acceptModal?.decalage?.id) return;
    const date_nouvelle = buildAcceptedDateNouvelle();
    if (!date_nouvelle) {
      setAcceptModal((prev) => (prev ? { ...prev, step: 'saisie' } : prev));
      return;
    }
    updateStatutMutation.mutate({
      id: acceptModal.decalage.id,
      id_etat: acceptModal.id_etat,
      date_nouvelle,
      appliquer_fiche: !!appliquerFiche,
    });
  };

  if (isLoading) {
    return <div className="decalages-page"><div className="loading">Chargement...</div></div>;
  }

  return (
    <div className="decalages-page">
      <div className="decalages-header">
        <h1><FaClock /> Demandes de Décalage</h1>
        <div className="header-actions">
          <label className="decalage-date-filter">
            Date création
            <input
              type="date"
              value={filters.date_creation}
              onChange={(e) => setFilters({ ...filters, date_creation: e.target.value })}
            />
          </label>
          {filters.date_creation && (
            <button
              type="button"
              className="decalage-date-filter-all"
              onClick={() => setFilters({ ...filters, date_creation: '' })}
              title="Afficher toutes les dates"
            >
              Toutes les dates
            </button>
          )}
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
                {usersData?.filter((u) => [1, 2, 5, 7, 11].includes(Number(u.fonction))).map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.pseudo}
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
                  {filters.date_creation
                    ? 'Aucune demande de décalage pour cette date'
                    : 'Aucune demande de décalage trouvée'}
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
                      user?.fonction === 5 ? (
                        // Pour les commerciaux, afficher sans lien (désactivé)
                        <span className="fiche-info-disabled">
                          <FaFileAlt /> {decalage.fiche_nom || ''} {decalage.fiche_prenom || ''}
                          <br />
                          <small>{decalage.fiche_tel || ''}</small>
                        </span>
                      ) : (
                        <button
                          className="fiche-link-btn"
                          onClick={() => handleFicheClick(decalage)}
                          title="Voir la fiche"
                        >
                          <FaFileAlt /> {decalage.fiche_nom || ''} {decalage.fiche_prenom || ''}
                          <br />
                          <small>{decalage.fiche_tel || ''}</small>
                        </button>
                      )
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
                      ? formatRdvDateTime(decalage.date_prevu)
                      : '-'}
                  </td>
                  <td data-label="Nouveau RDV:">
                    {isDecalageSansHeure(decalage)
                      ? 'Non défini'
                      : decalage.date_nouvelle
                      ? formatRdvDateTime(decalage.date_nouvelle)
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
                    {isDecalageTraite(decalage) ? (
                      <span className="action-locked" title="Demande déjà traitée">
                        Traité
                      </span>
                    ) : (
                      ([1, 2, 7].includes(Number(user?.fonction)) ||
                        Number(user?.fonction) === 6 ||
                        Number(user?.fonction) === 14 ||
                        Number(user?.fonction) === 13 ||
                        (Number(user?.fonction) === 5 && decalage.expediteur === user?.id)) && (
                        <div className="action-buttons">
                          {etatsDecalage?.filter(etat => {
                            if ([1, 2, 7].includes(Number(user?.fonction))) {
                              return true;
                            } else if (Number(user?.fonction) === 6 || Number(user?.fonction) === 14 || Number(user?.fonction) === 13) {
                              return etat.id !== 6;
                            } else if (Number(user?.fonction) === 5) {
                              return etat.id === 6;
                            }
                            return false;
                          }).map(etat => (
                            <button
                              key={etat.id}
                              className={`action-btn ${decalage.id_etat === etat.id ? 'active' : ''}`}
                              onClick={() => handleStatutChange(decalage.id, etat.id, decalage)}
                              disabled={updateStatutMutation.isLoading || decalage.id_etat === etat.id}
                              title={`Changer le statut à: ${etat.titre}`}
                            >
                              {etat.titre}
                            </button>
                          ))}
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {acceptModal && (
        <div
          className="decalage-accept-modal-overlay"
          onClick={() => {
            if (!updateStatutMutation.isLoading) setAcceptModal(null);
          }}
        >
          <form
            className="decalage-accept-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitAcceptModal}
          >
            {acceptModal.step === 'appliquer' ? (
              <>
                <h2>Appliquer à la fiche ?</h2>
                <p>
                  Date saisie : <strong>{formatRdvDateTime(`${acceptDate} ${acceptTime}:00`)}</strong>
                  <br />
                  Enregistrer cette date sur la fiche ?
                </p>
                <div className="decalage-accept-modal-actions">
                  <button
                    type="button"
                    className="decalage-accept-modal-cancel"
                    onClick={() => setAcceptModal((prev) => (prev ? { ...prev, step: 'saisie' } : prev))}
                    disabled={updateStatutMutation.isLoading}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    className="decalage-accept-modal-no"
                    onClick={() => confirmAcceptModal(false)}
                    disabled={updateStatutMutation.isLoading}
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    className="decalage-accept-modal-confirm"
                    onClick={() => confirmAcceptModal(true)}
                    disabled={updateStatutMutation.isLoading}
                  >
                    {updateStatutMutation.isLoading ? 'Enregistrement…' : 'Oui'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>RDV accepté par le client</h2>
                <p>La date et l&apos;heure sont obligatoires. Elles seront toujours enregistrées sur la demande.</p>
                <div className="decalage-accept-modal-fields">
                  <label>
                    Date
                    <input
                      type="date"
                      value={acceptDate}
                      min={formatLocalYmd()}
                      onChange={(e) => setAcceptDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Heure
                    <input
                      type="time"
                      value={acceptTime}
                      onChange={(e) => setAcceptTime(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="decalage-accept-modal-actions">
                  <button
                    type="button"
                    className="decalage-accept-modal-cancel"
                    onClick={() => setAcceptModal(null)}
                    disabled={updateStatutMutation.isLoading}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="decalage-accept-modal-confirm"
                    disabled={updateStatutMutation.isLoading || !acceptDate || !acceptTime}
                  >
                    Continuer
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default Decalages;

