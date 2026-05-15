import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartBar, FaSearch } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Statistiques.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const Statistiques = () => {
  useForceDesktopViewport('statistiques-page');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('centre'); // centre, confirmateur, commercial, agent, statko
  const [statType, setStatType] = useState('net'); // net, taux, repartition, part_total, barres, camembert
  
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
      case 'statko':
        name_stat = 'STAT_KO';
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
      date: activeTab === 'agent' ? 'date_insert_time' : filters.date,
      produit: filters.produit
    };

    if (func_id) params.func_id = func_id;
    if (id_filter) params[type_id] = id_filter;
    if (activeTab === 'statko') params.ko = 1;
    if (activeTab === 'confirmateur' && filters.id_centre) params.id_centre = filters.id_centre;

    return params;
  };

  // Récupérer les statistiques
  const { data: statsData, isLoading, refetch } = useQuery(
    ['statistiques', activeTab, statType, filters],
    async () => {
      const params = getQueryParams();
      // Backend n'accepte que 'net' ou 'taux' ; pour les autres formats on demande les chiffres bruts
      const apiStat = (statType === 'taux') ? 'taux' : 'net';
      const res = await api.get('/statistiques/all-stat', { params: { ...params, stat: apiStat } });
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

  // Onglet AGENT : statistiques par date de saisie (insertion), pas par qualification
  useEffect(() => {
    if (activeTab === 'agent') {
      setFilters(prev => (prev.date === 'date_insert_time' ? prev : { ...prev, date: 'date_insert_time' }));
    }
  }, [activeTab]);

  const renderFilterForm = () => {
    return (
      <form onSubmit={handleSubmit} className="search-form stats-filter-form">
        <div className="search-form-grid">
          <div className="form-group">
            <label>Énergie</label>
            <select
              value={filters.produit}
              onChange={(e) => handleFilterChange('produit', e.target.value)}
            >
              <option value="">PAC ET PV</option>
              <option value="1">PAC</option>
              <option value="2">PV</option>
            </select>
          </div>

          <div className="form-group">
            <label>Type de date</label>
            <select
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
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
            <div className="form-group">
              <label>Centre</label>
              <select
                value={filters.id_centre}
                onChange={(e) => handleFilterChange('id_centre', e.target.value)}
              >
                <option value="">TOUS LES CENTRES</option>
                {centresData?.map(centre => (
                  <option key={centre.id} value={centre.id}>{centre.titre}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'confirmateur' && (
            <>
              <div className="form-group">
                <label>Centre</label>
                <select
                  value={filters.id_centre}
                  onChange={(e) => handleFilterChange('id_centre', e.target.value)}
                >
                  <option value="">TOUS LES CENTRES</option>
                  {centresData?.map(centre => (
                    <option key={centre.id} value={centre.id}>{centre.titre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Confirmateur</label>
                <select
                  value={filters.id_confirmateur}
                  onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                >
                  <option value="">TOUS LES CONFIRMATEURS</option>
                  {confirmateursData?.map(conf => (
                    <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'commercial' && (
            <div className="form-group">
              <label>Commercial</label>
              <select
                value={filters.id_commercial}
                onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
              >
                <option value="">TOUS LES COMMERCIAUX</option>
                {commerciauxData?.map(com => (
                  <option key={com.id} value={com.id}>{com.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="form-group">
              <label>Agent</label>
              <select
                value={filters.id_agent}
                onChange={(e) => handleFilterChange('id_agent', e.target.value)}
              >
                <option value="">TOUS LES AGENTS</option>
                {agentsData?.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Date début</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => handleFilterChange('date_debut', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Date fin</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => handleFilterChange('date_fin', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Affichage</label>
            <select
              value={statType}
              onChange={(e) => setStatType(e.target.value)}
            >
              <option value="net">EN CHIFFRE</option>
              <option value="taux">EN TAUX</option>
              <option value="repartition">RÉPARTITION % (par ligne)</option>
              <option value="part_total">PART DU TOTAL %</option>
              <option value="barres">BARRES</option>
              <option value="camembert">CAMEMBERT</option>
            </select>
          </div>
        </div>

        <div className="search-form-actions-left">
          <button type="submit" className="btn-search">
            <FaSearch /> Générer
          </button>
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
      // Affichage en mode TAUX - Taux = positif / (positif + négatif)
      const calcTaux = (pos, neg) => {
        const sum = (pos || 0) + (neg || 0);
        return sum > 0 ? (((pos || 0) / sum) * 100).toFixed(1) + '%' : '—';
      };
      const totalPos = data.reduce((sum, item) => sum + item.totals.positive, 0);
      const totalNeg = data.reduce((sum, item) => sum + item.totals.negative, 0);
      return (
        <table className="stats-table">
          <thead>
            <tr>
              <th>N°</th>
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
                <td className="stat-numero">{idx + 1}</td>
                <td>{item.name}</td>
                <td className="stat-neutre">{item.totals.neutre}</td>
                <td className="stat-positive">{item.totals.positive}</td>
                <td className="stat-negative">{item.totals.negative}</td>
                <td className="stat-taux">{calcTaux(item.totals.positive, item.totals.negative)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td className="stat-numero">—</td>
              <td><strong>TOTAL</strong></td>
              <td className="stat-neutre">
                <strong>{data.reduce((sum, item) => sum + item.totals.neutre, 0)}</strong>
              </td>
              <td className="stat-positive">
                <strong>{totalPos}</strong>
              </td>
              <td className="stat-negative">
                <strong>{totalNeg}</strong>
              </td>
              <td className="stat-taux"><strong>{calcTaux(totalPos, totalNeg)}</strong></td>
            </tr>
          </tbody>
        </table>
      );
    }

    if (statType === 'repartition') {
      // Répartition % : chaque ligne = 100 %, valeur = part de l'état dans le total de la ligne
      return (
        <div className="table-responsive">
          <table className="stats-table stats-table-repartition">
            <thead>
              <tr>
                <th>N°</th>
                <th>{statsData.name_stat}</th>
                {etats.map(etat => (
                  <th key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                    {etat.abbreviation} %
                  </th>
                ))}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="stat-numero">{idx + 1}</td>
                  <td>{item.name}</td>
                  {etats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = item.total > 0 ? ((count * 100) / item.total).toFixed(1) : '0';
                    return (
                      <td key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                        {pct}%
                      </td>
                    );
                  })}
                  <td className="stat-total">{item.total}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="stat-numero">—</td>
                <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>TOTAL</td>
                {etats.map(etat => {
                  const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                  const pct = total > 0 ? ((colTotal * 100) / total).toFixed(1) : '0';
                  return (
                    <td key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                      <strong>{pct}%</strong>
                    </td>
                  );
                })}
                <td className="stat-total"><strong>{total}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (statType === 'part_total') {
      // Part du total % : chaque cellule = part de ce count dans le total général
      return (
        <div className="table-responsive">
          <table className="stats-table stats-table-part-total">
            <thead>
              <tr>
                <th>N°</th>
                <th>{statsData.name_stat}</th>
                {etats.map(etat => (
                  <th key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                    {etat.abbreviation} %
                  </th>
                ))}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="stat-numero">{idx + 1}</td>
                  <td>{item.name}</td>
                  {etats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = total > 0 ? ((count * 100) / total).toFixed(1) : '0';
                    return (
                      <td key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                        {pct}%
                      </td>
                    );
                  })}
                  <td className="stat-total">
                    {total > 0 ? ((item.total * 100) / total).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="stat-numero">—</td>
                <td style={{ color: '#ffffff', backgroundColor: '#222d32', fontWeight: 800 }}>TOTAL</td>
                {etats.map(etat => {
                  const colTotal = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
                  const pct = total > 0 ? ((colTotal * 100) / total).toFixed(1) : '0';
                  return (
                    <td key={etat.id} style={{ backgroundColor: etat.color, color: etat.id === 1 ? 'black' : 'white', fontWeight: 800 }}>
                      <strong>{pct}%</strong>
                    </td>
                  );
                })}
                <td className="stat-total"><strong>100%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (statType === 'barres') {
      // Barres : une barre horizontale par ligne (segments proportionnels aux états)
      return (
        <div className="stats-barres-container">
          <div className="stats-barres-legend">
            {etats.map(etat => (
              <span key={etat.id} className="stats-barres-legend-item" style={{ backgroundColor: etat.color }}>
                {etat.abbreviation}
              </span>
            ))}
          </div>
          <div className="stats-barres-list">
            {data.map((item, idx) => (
              <div key={idx} className="stats-barres-row">
                <div className="stats-barres-label" title={item.name}>
                  {item.name}
                </div>
                <div className="stats-barres-track">
                  {item.total > 0 && etats.map(etat => {
                    const count = item.stats[etat.id] || 0;
                    const pct = (count * 100) / item.total;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={etat.id}
                        className="stats-barres-segment"
                        style={{ width: `${pct}%`, backgroundColor: etat.color }}
                        title={`${etat.abbreviation}: ${count} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="stats-barres-total">{item.total}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (statType === 'camembert') {
      // Camembert : répartition par état (total par état)
      const pieData = etats.map(etat => {
        const value = data.reduce((sum, item) => sum + (item.stats[etat.id] || 0), 0);
        return {
          name: etat.abbreviation,
          value,
          color: etat.color
        };
      }).filter(d => d.value > 0);

      return (
        <div className="stats-camembert-container">
          <div className="stats-camembert-chart">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="stats-camembert-total">
            Total : <strong>{total}</strong> fiches
          </div>
        </div>
      );
    }

    // Affichage en mode NET (chiffres)
    return (
      <div className="table-responsive">
        <table className="stats-table">
          <thead>
            <tr>
              <th>N°</th>
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
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx}>
                <td className="stat-numero">{idx + 1}</td>
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
              </tr>
            ))}
            <tr className="total-row">
              <td className="stat-numero">—</td>
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
            </tr>
          </tbody>
        </table>
      </div>
    );
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
        <button
          className={`menu-btn ${activeTab === 'statko' ? 'active' : ''}`}
          onClick={() => setActiveTab('statko')}
        >
          STAT KO
        </button>
      </div>

      {/* Formulaire de filtres (style Dashboard) */}
      <div className="stats-filters search-panel">
        <div className="search-panel-header">
          <h2>
            <FaSearch /> {activeTab === 'statko' ? 'Statistiques fiches KO par Agent' : `Statistiques par ${activeTab.toUpperCase()}`}
          </h2>
        </div>
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
