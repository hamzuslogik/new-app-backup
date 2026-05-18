import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCheck, FaTimes, FaCalendarAlt, FaFilter, FaEye, FaEyeSlash, FaSearch } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateOnly, formatRdvTimeOnly } from '../utils/formatRdvDateTime';
import './Validation.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const Validation = () => {
  useForceDesktopViewport('validation-page');
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [quickSearchDep, setQuickSearchDep] = useState('');
  
  // Calculer les dates par défaut : lendemain, et si c'est vendredi, afficher les RDV de lundi
  const getDefaultDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = dimanche, 5 = vendredi, 6 = samedi
    
    let dateDebut, dateFin;
    
    // Si c'est vendredi (5), afficher les RDV de lundi
    if (dayOfWeek === 5) {
      const monday = new Date(today);
      // Calculer le nombre de jours jusqu'au prochain lundi
      // Vendredi (5) -> lundi prochain = +3 jours
      monday.setDate(today.getDate() + 3);
      dateDebut = monday.toISOString().split('T')[0];
      dateFin = monday.toISOString().split('T')[0];
    } else {
      // Sinon, afficher les RDV du lendemain
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      dateDebut = tomorrow.toISOString().split('T')[0];
      dateFin = tomorrow.toISOString().split('T')[0];
    }
    
    return { date_debut: dateDebut, date_fin: dateFin };
  };
  
  const defaultDates = getDefaultDates();
  const [filters, setFilters] = useState({
    valider: '', // '' = tous, '1' = validés, '0' = non validés
    date_debut: defaultDates.date_debut,
    date_fin: defaultDates.date_fin
  });

  // Confirmateur (6), Qualité Confirmation (4), RE Confirmation (14), admins / backoffice
  const canLoadValidation =
    !!user &&
    [1, 2, 4, 6, 7, 11, 14].includes(Number(user.fonction));

  // Récupérer les RDV validés/non validés
  const { data: validationData, isLoading, error } = useQuery(
    ['validation-rdv', filters],
    async () => {
      const params = {};
      if (filters.valider !== '') params.valider = filters.valider;
      // Toujours envoyer les dates (même vides) pour que le backend applique la logique par défaut
      params.date_debut = filters.date_debut || '';
      params.date_fin = filters.date_fin || '';
      
      const res = await api.get('/fiches/validation-rdv', { params });
      return res.data.data;
    },
    {
      enabled: canLoadValidation
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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

  const getProduitName = (produitId) => {
    return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '-';
  };

  const getProduitColor = (produitId) => {
    return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#FFE441' : '#cccccc';
  };

  const fiches = validationData?.fiches || [];
  const stats = validationData?.stats || { valides: 0, nonValides: 0, total: 0 };
  const statsByDepartement = validationData?.statsByDepartement || [];
  const totals = validationData?.totals || { valides: 0, nonValides: 0, total: 0 };

  const filteredFiches = (() => {
    const terms = quickSearchDep
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (terms.length === 0) return fiches;
    return fiches.filter((fiche) => {
      const cp = String(fiche.cp || '').trim().toUpperCase();
      if (!cp) return false;
      return terms.some((term) => cp.startsWith(term));
    });
  })();

  return (
    <div className="validation-page">
      <div className="validation-header">
        <h1><FaCalendarAlt /> Validation des RDV</h1>
        <div className="header-buttons">
          <button 
            className="filter-toggle-btn" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
          <button 
            className="details-toggle-btn" 
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <FaEyeSlash /> : <FaEye />} {showDetails ? 'Masquer' : 'Afficher'} les détails
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="validation-stats">
        <div className="stat-card validated">
          <div className="stat-card-icon">
            <FaCheck />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.valides}</div>
            <div className="stat-card-label">RDV Validés</div>
          </div>
        </div>
        <div className="stat-card non-validated">
          <div className="stat-card-icon">
            <FaTimes />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.nonValides}</div>
            <div className="stat-card-label">RDV Non Validés</div>
          </div>
        </div>
        <div className="stat-card total">
          <div className="stat-card-icon">
            <FaCalendarAlt />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.total}</div>
            <div className="stat-card-label">Total</div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="validation-filters">
          <div className="filter-group">
            <label>Statut</label>
            <select
              value={filters.valider}
              onChange={(e) => handleFilterChange('valider', e.target.value)}
            >
              <option value="">Tous</option>
              <option value="1">Validés</option>
              <option value="0">Non validés</option>
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
        </div>
      )}

      <div className="validation-content">
        <div className="validation-quick-search">
          <label htmlFor="validation-quick-search-dep">Recherche rapide département</label>
          <input
            id="validation-quick-search-dep"
            type="text"
            placeholder="Ex: 77 ou 77,45"
            value={quickSearchDep}
            onChange={(e) => setQuickSearchDep(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="loading">Chargement des RDV...</div>
        ) : error ? (
          <div className="error">
            <p>Erreur lors du chargement des RDV</p>
            <p style={{ fontSize: '10.2px', color: '#666', marginTop: '10px' }}>
              {error.response?.data?.message || error.message || 'Erreur inconnue'}
            </p>
          </div>
        ) : filteredFiches.length === 0 ? (
          <div className="no-results">Aucun RDV trouvé</div>
        ) : showDetails ? (
          <div className={`fiches-table-container ${!showDetails ? 'compact' : ''}`}>
            <table className="fiches-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th className="detail-column">Téléphone</th>
                  <th className="detail-column">CP</th>
                  <th className="detail-column">Ville</th>
                  <th className="product-column">Produit</th>
                  <th>Date RDV</th>
                  <th className="detail-column">Confirmateur(s)</th>
                  <th className="status-column">Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiches.map(fiche => {
                  const confirmateurs = [];
                  if (fiche.confirmateur1_pseudo) confirmateurs.push(fiche.confirmateur1_pseudo);
                  if (fiche.confirmateur2_pseudo) confirmateurs.push(fiche.confirmateur2_pseudo);
                  if (fiche.confirmateur3_pseudo) confirmateurs.push(fiche.confirmateur3_pseudo);
                  
                  return (
                    <tr key={fiche.id}>
                      <td>{fiche.nom || '-'}</td>
                      <td>{fiche.prenom || '-'}</td>
                      <td className="detail-column">{fiche.tel || '-'}</td>
                      <td className="detail-column">{fiche.cp || '-'}</td>
                      <td className="detail-column">{fiche.ville || '-'}</td>
                      <td className="product-column">
                        <span 
                          className="produit-indicator"
                          style={{ backgroundColor: getProduitColor(fiche.produit) }}
                        >
                          {getProduitName(fiche.produit)}
                        </span>
                      </td>
                      <td>{`${formatRdvDateOnly(fiche.date_rdv_time)} ${formatRdvTimeOnly(fiche.date_rdv_time)}`.trim()}</td>
                      <td className="detail-column">{confirmateurs.join(', ') || '-'}</td>
                      <td className="status-column">
                        {fiche.valider === 1 ? (
                          <span className="validation-badge validated">
                            <FaCheck /> Validé
                            {fiche.conf_rdv_avec && (
                              <span className="validation-with"> ({fiche.conf_rdv_avec})</span>
                            )}
                          </span>
                        ) : (
                          <span className="validation-badge non-validated">
                            <FaTimes /> Non validé
                          </span>
                        )}
                      </td>
                      <td>
                        <FicheDetailLink 
                          ficheId={fiche.id}
                          className="btn-detail"
                          title="Voir les détails"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />
                        </FicheDetailLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Tableau des statistiques par département */}
        <div className="departements-stats-container">
          <h2>Statistiques par Département</h2>
          <div className="departements-table-container">
            <table className="departements-table">
              <thead>
                <tr>
                  <th>Département</th>
                  <th>Validé</th>
                  <th>Non Validé</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {statsByDepartement
                  .filter(dep => (dep.nonValides || 0) > 0)
                  .map((dep, index) => (
                    <tr key={dep.departement || index}>
                      <td>{dep.departement || '-'}</td>
                      <td>{dep.valides || 0}</td>
                      <td>{dep.nonValides || 0}</td>
                      <td>{dep.total || 0}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td><strong>{totals.valides}</strong></td>
                  <td><strong>{totals.nonValides}</strong></td>
                  <td><strong>{totals.total}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Validation;

