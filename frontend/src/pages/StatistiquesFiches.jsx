import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartBar, FaFilter, FaCalendarAlt, FaSearch } from 'react-icons/fa';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getFirstOfMonthLocal, getLastDayOfMonthLocal } from '../utils/dateUtils';
import './StatistiquesFiches.css';

const initialFilters = () => ({
  date_debut: getFirstOfMonthLocal(),
  date_fin: getLastDayOfMonthLocal(),
  date_champ: 'date_modif_time',
  id_centre: ''
});

const StatistiquesFiches = () => {
  const { user } = useAuth();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Récupérer les centres (filtrés selon le rôle)
  const { data: centresData } = useQuery(
    ['centres-statistiques', user?.id],
    async () => {
      const res = await api.get('/management/centres');
      return res.data.data || [];
    }
  );

  // Vérifier si l'utilisateur a accès à cette page
  const hasAccess = !!user?.id && ([1, 2, 7].includes(user.fonction) || user.fonction === 9);

  const buildQueryParams = (f) => {
    const params = {
      date_debut: f.date_debut,
      date_fin: f.date_fin,
      date_champ: f.date_champ
    };
    if (f.id_centre) {
      params.id_centre = f.id_centre;
    }
    return params;
  };

  // Récupérer les statistiques (pour les onglets) — uniquement selon appliedFilters
  const {
    data: statsData,
    isLoading: isLoadingStats,
    isFetching: isFetchingStats,
    error: errorStats
  } = useQuery(
    ['statistiques-fiches', appliedFilters, user?.id],
    async () => {
      const res = await api.get('/statistiques/fiches-par-centre', {
        params: buildQueryParams(appliedFilters)
      });
      return res.data;
    },
    {
      enabled: hasAccess,
      keepPreviousData: true,
      onError: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
      }
    }
  );

  // Récupérer les fiches détaillées
  const {
    data: fichesData,
    isLoading: isLoadingFiches,
    isFetching: isFetchingFiches,
    error: errorFiches
  } = useQuery(
    ['fiches-detaillees', appliedFilters, user?.id],
    async () => {
      const res = await api.get('/statistiques/fiches-detaillees', {
        params: buildQueryParams(appliedFilters)
      });
      return res.data;
    },
    {
      enabled: hasAccess,
      keepPreviousData: true,
      onError: (error) => {
        console.error('Erreur lors du chargement des fiches détaillées:', error);
      }
    }
  );

  const handleApplySearch = () => {
    setAppliedFilters({ ...draftFilters });
    setActiveTab(0);
  };

  const isFetchingResults = isFetchingStats || isFetchingFiches;
  const isBootstrapping =
    hasAccess &&
    !errorStats &&
    !errorFiches &&
    (statsData === undefined || fichesData === undefined) &&
    (isFetchingStats || isFetchingFiches);

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '-') return '0';
    return Number(num).toLocaleString('fr-FR');
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

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Vérifier l'accès
  if (!hasAccess) {
    return (
      <div className="statistiques-fiches-page">
        <div className="error-message">
          Vous n'avez pas accès à cette page. Cette page est réservée aux administrateurs et aux utilisateurs avec la fonction 9.
        </div>
      </div>
    );
  }

  const stats = statsData?.data || [];
  const fiches = fichesData?.data || [];
  const totalGlobal = stats.reduce((sum, centre) => sum + (centre.total_fiches || 0), 0);

  // Grouper les fiches par centre
  const fichesByCentre = {};
  fiches.forEach(fiche => {
    // Trouver le centre de la fiche
    const centreId = fiche.id_centre || 'unknown';
    if (!fichesByCentre[centreId]) {
      fichesByCentre[centreId] = [];
    }
    fichesByCentre[centreId].push(fiche);
  });

  // Si un seul centre ou filtre par centre, afficher directement
  // Sinon, utiliser des onglets
  const showTabs = stats.length > 1 && !appliedFilters.id_centre;
  const displayStats = appliedFilters.id_centre
    ? stats.filter(c => c.centre_id === parseInt(appliedFilters.id_centre, 10))
    : showTabs
      ? [stats[activeTab]]
      : stats;

  // Obtenir les fiches pour le centre actif
  const getFichesForActiveCentre = () => {
    if (appliedFilters.id_centre) {
      return fichesByCentre[parseInt(appliedFilters.id_centre, 10)] || [];
    }
    if (showTabs && stats[activeTab]) {
      const centreId = stats[activeTab].centre_id;
      return fichesByCentre[centreId] || [];
    }
    if (stats.length === 1 && stats[0]) {
      return fichesByCentre[stats[0].centre_id] || [];
    }
    return fiches;
  };

  const activeFiches = getFichesForActiveCentre();

  const queryError =
    errorStats?.response?.data?.message ||
    errorStats?.message ||
    errorFiches?.response?.data?.message ||
    errorFiches?.message ||
    (statsData?.success === false ? statsData?.message : null) ||
    (fichesData?.success === false ? fichesData?.message : null);

  return (
    <div className="statistiques-fiches-page">
      <div className="page-header">
        <h1>
          <FaChartBar /> Statistiques Fiches
        </h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-toolbar">
            <div className="filter-field filter-field-date">
              <label htmlFor="sf-date-debut">
                <FaCalendarAlt /> Date de début
              </label>
              <input
                id="sf-date-debut"
                type="date"
                value={draftFilters.date_debut}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_debut: e.target.value })
                }
              />
            </div>
            <div className="filter-field filter-field-date">
              <label htmlFor="sf-date-fin">
                <FaCalendarAlt /> Date de fin
              </label>
              <input
                id="sf-date-fin"
                type="date"
                value={draftFilters.date_fin}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_fin: e.target.value })
                }
              />
            </div>
            <div className="filter-field filter-field-champ">
              <label htmlFor="sf-date-champ">Champ de date</label>
              <select
                id="sf-date-champ"
                value={draftFilters.date_champ}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, date_champ: e.target.value })
                }
              >
                <option value="date_modif_time">Date de modification</option>
                <option value="date_insert_time">Date d&apos;insertion</option>
              </select>
            </div>
            {([1, 2, 7].includes(user?.fonction)) && (
              <div className="filter-field filter-field-centre">
                <label htmlFor="sf-centre">Centre (optionnel)</label>
                <select
                  id="sf-centre"
                  value={draftFilters.id_centre}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, id_centre: e.target.value })
                  }
                >
                  <option value="">Tous les centres</option>
                  {centresData &&
                    centresData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="filters-toolbar-actions">
              <button
                type="button"
                className="btn-rechercher-stat-fiches"
                onClick={handleApplySearch}
                disabled={isFetchingResults}
              >
                <FaSearch /> Rechercher
              </button>
            </div>
          </div>
        </div>
      )}

      {isBootstrapping && (
        <div className="statistiques-fiches-loading">
          <LoadingSpinner text="Chargement des statistiques..." />
        </div>
      )}

      {queryError && !isBootstrapping && (
        <div className="error-message">
          Erreur lors du chargement des statistiques : {queryError || 'Erreur inconnue'}
        </div>
      )}

      {/* Message si aucune donnée */}
      {!isBootstrapping && !queryError && !isFetchingResults && stats.length === 0 && (
        <div className="no-data-message">
          <p>Aucune statistique disponible pour la période sélectionnée.</p>
          <p>Veuillez ajuster les filtres de date ou sélectionner un autre centre.</p>
        </div>
      )}

      {/* Résumé global */}
      {!isBootstrapping && !queryError && stats.length > 0 && (
        <div className={`summary-cards${isFetchingResults ? ' summary-cards--refreshing' : ''}`}>
          <div className="summary-card card-primary">
            <div className="summary-icon">
              <FaChartBar />
            </div>
            <div className="summary-content">
              <div className="summary-label">Total des fiches</div>
              <div className="summary-value">{formatNumber(totalGlobal)}</div>
            </div>
          </div>
          <div className="summary-card card-secondary">
            <div className="summary-icon">
              <FaChartBar />
            </div>
            <div className="summary-content">
              <div className="summary-label">Centres</div>
              <div className="summary-value">{stats.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Onglets si plusieurs centres */}
      {!isBootstrapping && !queryError && showTabs && (
        <div className={`tabs-container${isFetchingResults ? ' tabs-container--refreshing' : ''}`}>
          {stats.map((centre, index) => (
            <button
              key={centre.centre_id}
              className={`tab-button ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {centre.centre_titre || `Centre ${index + 1}`}
              <span className="tab-badge">({formatNumber(fichesByCentre[centre.centre_id]?.length || 0)})</span>
            </button>
          ))}
        </div>
      )}

      {/* Tableau des fiches */}
      {!isBootstrapping && !queryError && (
      <div className={`stats-table-container${isFetchingResults ? ' stats-table-container--refreshing' : ''}`}>
        {activeFiches.length === 0 ? (
          <div className="no-data">
            Aucune fiche disponible pour la période sélectionnée
          </div>
        ) : (
          <div className="fiches-table-wrapper">
            <div className="table-header-info">
              <h3>
                {displayStats[0]?.centre_titre || 'Tous les centres'}
                <span className="fiches-count">({formatNumber(activeFiches.length)} fiches)</span>
              </h3>
            </div>
            <table className="fiches-detail-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Téléphone</th>
                  <th>CP</th>
                  <th>Date insertion</th>
                  <th>Date / Heure RDV</th>
                  <th>Confirmateur</th>
                  <th>Commercial</th>
                  <th>État</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {activeFiches.map((fiche) => (
                  <tr key={fiche.id || fiche.hash}>
                    <td>{fiche.nom || '-'}</td>
                    <td>{fiche.prenom || '-'}</td>
                    <td>{fiche.tel || fiche.gsm1 || '-'}</td>
                    <td>{fiche.cp || '-'}</td>
                    <td>{formatDateOnly(fiche.date_insert_time)}</td>
                    <td>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                    <td>{fiche.confirmateur_nom || '-'}</td>
                    <td>{fiche.commercial_nom || '-'}</td>
                    <td>
                      {fiche.etat_titre ? (
                        <span 
                          className="etat-badge"
                          style={{ 
                            backgroundColor: fiche.etat_color || '#cccccc',
                            color: '#ffffff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10.2px',
                            fontWeight: '600'
                          }}
                        >
                          {fiche.etat_titre}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {fiche.hash ? (
                        <FicheDetailLink 
                          ficheHash={fiche.hash}
                          className="btn-detail-link"
                          title="Voir les détails"
                        >
                          <FaSearch />
                        </FicheDetailLink>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default StatistiquesFiches;
