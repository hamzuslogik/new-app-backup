import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartBar } from 'react-icons/fa';
import './Statistiques.css';

const Statistiques = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('centre'); // centre, confirmateur, commercial, agent
  const [statType, setStatType] = useState('net'); // net ou taux
  
  // États pour les filtres
  const [filters, setFilters] = useState({
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0],
    date: 'date_modif_time',
    produit: '',
    id_centre: '',
    id_confirmateur: '',
    id_commercial: '',
    id_agent: ''
  });

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5) || [];
  });

  const { data: agentsData } = useQuery('agents', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 3) || [];
  });

  // Construire les paramètres de requête selon l'onglet actif
  const getQueryParams = () => {
    let name_stat = 'CENTRE';
    let type_id = 'id_centre';
    let func_id = '';
    let id_filter = '';

    switch(activeTab) {
      case 'centre':
        name_stat = 'CENTRE';
        type_id = 'id_centre';
        id_filter = filters.id_centre;
        break;
      case 'confirmateur':
        name_stat = 'CONFIRMATEUR';
        type_id = 'id_confirmateur';
        func_id = '6';
        id_filter = filters.id_confirmateur;
        break;
      case 'commercial':
        name_stat = 'COMMERCIAL';
        type_id = 'id_commercial';
        func_id = '5';
        id_filter = filters.id_commercial;
        break;
      case 'agent':
        name_stat = 'AGENT';
        type_id = 'id_agent';
        func_id = '3';
        id_filter = filters.id_agent;
        break;
    }

    const params = {
      name_stat,
      type_id,
      stat: statType,
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      date: filters.date,
      produit: filters.produit
    };

    if (func_id) params.func_id = func_id;
    if (id_filter) params[type_id] = id_filter;

    return params;
  };

  // Récupérer les statistiques
  const { data: statsData, isLoading, refetch } = useQuery(
    ['statistiques', activeTab, statType, filters],
    async () => {
      const params = getQueryParams();
      const res = await api.get('/statistiques/all-stat', { params });
      return res.data.data;
    },
    { enabled: false } // Ne pas charger automatiquement
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    refetch();
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const renderFilterForm = () => {
    return (
      <form onSubmit={handleSubmit} className="stats-filter-form">
        <div className="filter-row">
          <div className="filter-group">
            <label>Énergie</label>
            <select
              value={filters.produit}
              onChange={(e) => handleFilterChange('produit', e.target.value)}
              className="form-control"
            >
              <option value="">PAC ET PV</option>
              <option value="1">PAC</option>
              <option value="2">PV</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Type de date</label>
            <select
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="form-control"
            >
              {activeTab === 'agent' ? (
                <option value="date_insert_time">Date Insertion (Saisie)</option>
              ) : (
                <>
                  <option value="date_modif_time">Date Qualification (Modification)</option>
                  <option value="date_insert_time">Date Insertion (Saisie)</option>
                  <option value="date_rdv_time">Date Rendez-vous</option>
                </>
              )}
            </select>
          </div>

          {activeTab === 'centre' && (
            <div className="filter-group">
              <label>Centre</label>
              <select
                value={filters.id_centre}
                onChange={(e) => handleFilterChange('id_centre', e.target.value)}
                className="form-control"
              >
                <option value="">TOUS LES CENTRES</option>
                {centresData?.map(centre => (
                  <option key={centre.id} value={centre.id}>{centre.titre}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'confirmateur' && (
            <div className="filter-group">
              <label>Confirmateur</label>
              <select
                value={filters.id_confirmateur}
                onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                className="form-control"
              >
                <option value="">TOUS LES CONFIRMATEURS</option>
                {confirmateursData?.map(conf => (
                  <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'commercial' && (
            <div className="filter-group">
              <label>Commercial</label>
              <select
                value={filters.id_commercial}
                onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
                className="form-control"
              >
                <option value="">TOUS LES COMMERCIAUX</option>
                {commerciauxData?.map(com => (
                  <option key={com.id} value={com.id}>{com.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="filter-group">
              <label>Agent</label>
              <select
                value={filters.id_agent}
                onChange={(e) => handleFilterChange('id_agent', e.target.value)}
                className="form-control"
              >
                <option value="">TOUS LES AGENTS</option>
                {agentsData?.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>Date début</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="filter-group">
            <label>Date fin</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="filter-group">
            <label>Affichage</label>
            <select
              value={statType}
              onChange={(e) => setStatType(e.target.value)}
              className="form-control"
            >
              <option value="net">EN CHIFFRE</option>
              <option value="taux">EN TAUX</option>
            </select>
          </div>

          <div className="filter-group">
            <button type="submit" className="btn-generate">
              <span>📊</span> Générer
            </button>
          </div>
        </div>
      </form>
    );
  };

  const renderStatsTable = () => {
    if (isLoading) {
      return <div className="loading">Chargement des statistiques...</div>;
    }

    if (!statsData || !statsData.data || statsData.data.length === 0) {
      return <div className="no-data">Aucune donnée disponible pour les critères sélectionnés.</div>;
    }

    const { etats, data, total } = statsData;

    if (statType === 'taux') {
      // Affichage en mode TAUX
      return (
        <table className="stats-table">
          <thead>
            <tr>
              <th>{statsData.name_stat}</th>
              <th>NEUTRE</th>
              <th>POSITIVE</th>
              <th>NEGATIVE</th>
              <th>TAUX %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx}>
                <td>{item.name}</td>
                <td className="stat-neutre">{item.totals.neutre}</td>
                <td className="stat-positive">{item.totals.positive}</td>
                <td className="stat-negative">{item.totals.negative}</td>
                <td className="stat-taux">{item.taux_reussite}%</td>
              </tr>
            ))}
            <tr className="total-row">
              <td><strong>TOTAL</strong></td>
              <td className="stat-neutre">
                <strong>{data.reduce((sum, item) => sum + item.totals.neutre, 0)}</strong>
              </td>
              <td className="stat-positive">
                <strong>{data.reduce((sum, item) => sum + item.totals.positive, 0)}</strong>
              </td>
              <td className="stat-negative">
                <strong>{data.reduce((sum, item) => sum + item.totals.negative, 0)}</strong>
              </td>
              <td className="stat-taux">
                <strong>
                  {(() => {
                    const totPos = data.reduce((sum, item) => sum + item.totals.positive, 0);
                    const totNeg = data.reduce((sum, item) => sum + item.totals.negative, 0);
                    return totPos + totNeg > 0 ? ((totPos * 100) / (totPos + totNeg)).toFixed(2) : 0;
                  })()}%
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      );
    } else {
      // Affichage en mode NET (chiffres)
      return (
        <div className="table-responsive">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{statsData.name_stat}</th>
                {etats.map(etat => (
                  <th
                    key={etat.id}
                    style={{
                      backgroundColor: etat.color,
                      color: etat.id === 1 ? 'black' : 'white',
                      fontWeight: 800
                    }}
                  >
                    {etat.abbreviation}
                  </th>
                ))}
                <th>TOTAL</th>
                <th>TAUX %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  {etats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    return (
                      <td
                        key={etat.id}
                        style={{
                          backgroundColor: etat.color,
                          color: etat.id === 1 ? 'black' : 'white',
                          fontWeight: 800
                        }}
                      >
                        {count}
                      </td>
                    );
                  })}
                  <td className="stat-total">{item.total}</td>
                  <td className="stat-taux">{item.taux_reussite}%</td>
                </tr>
              ))}
              <tr className="total-row">
                <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>
                  TOTAL
                </td>
                {etats.map(etat => {
                  const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                  return (
                    <td
                      key={etat.id}
                      style={{
                        backgroundColor: etat.color,
                        color: etat.id === 1 ? 'black' : 'white',
                        fontWeight: 800
                      }}
                    >
                      {colTotal}
                    </td>
                  );
                })}
                <td className="stat-total">
                  <strong>{total}</strong>
                </td>
                <td className="stat-taux">
                  <strong>
                    {(() => {
                      const totPos = data.reduce((sum, item) => sum + item.totals.positive, 0);
                      const totNeg = data.reduce((sum, item) => sum + item.totals.negative, 0);
                      return totPos + totNeg > 0 ? ((totPos * 100) / (totPos + totNeg)).toFixed(2) : 0;
                    })()}%
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div className="statistiques-page">
      <h2 className="page-title"><FaChartBar /> Statistiques</h2>

      {/* Menu de navigation */}
      <div className="stats-menu">
        <button
          className={`menu-btn ${activeTab === 'centre' ? 'active' : ''}`}
          onClick={() => setActiveTab('centre')}
        >
          CENTRE
        </button>
        <button
          className={`menu-btn ${activeTab === 'agent' ? 'active' : ''}`}
          onClick={() => setActiveTab('agent')}
        >
          AGENT
        </button>
        <button
          className={`menu-btn ${activeTab === 'confirmateur' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirmateur')}
        >
          CONFIRMATEUR
        </button>
        <button
          className={`menu-btn ${activeTab === 'commercial' ? 'active' : ''}`}
          onClick={() => setActiveTab('commercial')}
        >
          COMMERCIAL
        </button>
      </div>

      {/* Formulaire de filtres */}
      <div className="stats-filters">
        <h3>Statistiques par {activeTab.toUpperCase()}</h3>
        {renderFilterForm()}
      </div>

      {/* Tableau des résultats */}
      {statsData && (
        <div className="stats-results">
          {renderStatsTable()}
        </div>
      )}
    </div>
  );
};

export default Statistiques;
