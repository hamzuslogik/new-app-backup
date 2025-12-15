import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartBar, FaFilter, FaCalendarAlt, FaSearch } from 'react-icons/fa';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FicheDetailLink from '../components/FicheDetailLink';
import './StatistiquesFiches.css';

const StatistiquesFiches = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    date_debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_fin: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    date_champ: 'date_modif_time',
    id_centre: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Récupérer les centres (filtrés selon le rôle)
  const { data: centresData } = useQuery(
    ['centres-statistiques', user?.id],
    async () => {
      const res = await api.get('/management/centres');
      return res.data.data || [];
    }
  );

  // Récupérer les statistiques (pour les onglets)
  const { data: statsData, isLoading: isLoadingStats } = useQuery(
    ['statistiques-fiches', filters, user?.id],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin,
        date_champ: filters.date_champ
      };
      if (filters.id_centre) {
        params.id_centre = filters.id_centre;
      }
      const res = await api.get('/statistiques/fiches-par-centre', { params });
      return res.data;
    },
    {
      enabled: !!user?.id && ([1, 2, 7].includes(user.fonction) || user.fonction === 9)
    }
  );

  // Récupérer les fiches détaillées
  const { data: fichesData, isLoading: isLoadingFiches } = useQuery(
    ['fiches-detaillees', filters, user?.id],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin,
        date_champ: filters.date_champ
      };
      if (filters.id_centre) {
        params.id_centre = filters.id_centre;
      }
      const res = await api.get('/statistiques/fiches-detaillees', { params });
      return res.data;
    },
    {
      enabled: !!user?.id && ([1, 2, 7].includes(user.fonction) || user.fonction === 9)
    }
  );

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

  if (isLoadingStats || isLoadingFiches) {
    return (
      <div className="statistiques-fiches-page">
        <LoadingSpinner text="Chargement des statistiques..." />
      </div>
    );
  }

  if (statsData?.success === false || fichesData?.success === false) {
    return (
      <div className="statistiques-fiches-page">
        <div className="error-message">
          Erreur lors du chargement des statistiques
        </div>
      </div>
    );
  }

  const stats = statsData?.data || [];
  const fiches = fichesData?.data || [];
  const totalGlobal = stats.reduce((sum, centre) => sum + centre.total_fiches, 0);

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
  const showTabs = stats.length > 1 && !filters.id_centre;
  const displayStats = filters.id_centre 
    ? stats.filter(c => c.centre_id === parseInt(filters.id_centre))
    : showTabs 
      ? [stats[activeTab]]
      : stats;

  // Obtenir les fiches pour le centre actif
  const getFichesForActiveCentre = () => {
    if (filters.id_centre) {
      return fichesByCentre[parseInt(filters.id_centre)] || [];
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

  return (
    <div className="statistiques-fiches-page">
      <div className="page-header">
        <h1>
          <FaChartBar /> Statistiques Fiches
        </h1>
        <button
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>
                <FaCalendarAlt /> Date de début
              </label>
              <input
                type="date"
                value={filters.date_debut}
                onChange={(e) => setFilters({ ...filters, date_debut: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <label>
                <FaCalendarAlt /> Date de fin
              </label>
              <input
                type="date"
                value={filters.date_fin}
                onChange={(e) => setFilters({ ...filters, date_fin: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <label>Champ de date</label>
              <select
                value={filters.date_champ}
                onChange={(e) => setFilters({ ...filters, date_champ: e.target.value })}
              >
                <option value="date_modif_time">Date de modification</option>
                <option value="date_insert_time">Date d'insertion</option>
              </select>
            </div>
            {([1, 2, 7].includes(user?.fonction)) && (
              <div className="filter-group">
                <label>Centre (optionnel)</label>
                <select
                  value={filters.id_centre}
                  onChange={(e) => {
                    setFilters({ ...filters, id_centre: e.target.value });
                    setActiveTab(0);
                  }}
                >
                  <option value="">Tous les centres</option>
                  {centresData && centresData.map(c => (
                    <option key={c.id} value={c.id}>{c.titre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Résumé global */}
      {stats.length > 0 && (
        <div className="summary-cards">
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
      {showTabs && (
        <div className="tabs-container">
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
      <div className="stats-table-container">
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
                    <td>{formatDate(fiche.date_rdv_time)}</td>
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
    </div>
  );
};

export default StatistiquesFiches;
