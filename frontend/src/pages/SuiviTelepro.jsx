import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChartLine, FaSignature, FaFileAlt, FaPrint } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import './SuiviTelepro.css';

const SuiviTelepro = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('commissions'); // commissions, signatures, new-repro
  
  // États pour les filtres
  const [filters, setFilters] = useState({
    date_debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // 1er du mois
    date_fin: new Date().toISOString().split('T')[0], // Aujourd'hui
    id_confirmateur: ''
  });

  // Récupérer les confirmateurs
  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const confirmateurs = confirmateursData || [];

  // Récupérer les commissions
  const { data: commissionsData, isLoading: loadingCommissions } = useQuery(
    ['commissions', filters],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin
      };
      if (filters.id_confirmateur) params.id_confirmateur = filters.id_confirmateur;
      const res = await api.get('/suivi/commissions', { params });
      return res.data;
    },
    { enabled: activeTab === 'commissions' }
  );

  // Récupérer les signatures
  const { data: signaturesData, isLoading: loadingSignatures } = useQuery(
    ['signatures', filters],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin
      };
      if (filters.id_confirmateur) params.id_confirmateur = filters.id_confirmateur;
      const res = await api.get('/suivi/signatures', { params });
      return res.data;
    },
    { enabled: activeTab === 'signatures' }
  );

  // Récupérer les statistiques New/Repro
  const { data: newReproData, isLoading: loadingNewRepro } = useQuery(
    ['new-repro', filters],
    async () => {
      const params = {
        date_debut: filters.date_debut,
        date_fin: filters.date_fin
      };
      if (filters.id_confirmateur) params.id_confirmateur = filters.id_confirmateur;
      const res = await api.get('/suivi/new-repro', { params });
      return res.data;
    },
    { enabled: activeTab === 'new-repro' }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="suivi-telepro">
      <div className="suivi-header">
        <h1><FaChartLine /> Suivi Télépro</h1>
        <div className="suivi-tabs">
          <button
            className={activeTab === 'commissions' ? 'active' : ''}
            onClick={() => setActiveTab('commissions')}
          >
            <FaChartLine /> Commissions
          </button>
          <button
            className={activeTab === 'signatures' ? 'active' : ''}
            onClick={() => setActiveTab('signatures')}
          >
            <FaSignature /> Signatures
          </button>
          <button
            className={activeTab === 'new-repro' ? 'active' : ''}
            onClick={() => setActiveTab('new-repro')}
          >
            <FaFileAlt /> New/Repro
          </button>
        </div>
      </div>

      <div className="suivi-filters">
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
        <button className="print-btn noprint" onClick={handlePrint}>
          <FaPrint /> Imprimer
        </button>
      </div>

      <div className="suivi-content">
        {/* Onglet Commissions */}
        {activeTab === 'commissions' && (
          <div className="tab-content">
            <h2>Commissions</h2>
            {loadingCommissions ? (
              <div className="loading">Chargement...</div>
            ) : commissionsData ? (
              <>
                <div className="totals">
                  <div className="total-item">
                    <span className="total-label">CH Total:</span>
                    <span className="total-value">{commissionsData.totals?.ch_total?.toFixed(2) || '0.00'} €</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">CH Net:</span>
                    <span className="total-value">{commissionsData.totals?.ch_total_net?.toFixed(2) || '0.00'} €</span>
                  </div>
                  <div className="total-item">
                    <span className="total-label">Nb Ventes:</span>
                    <span className="total-value">{commissionsData.totals?.nb_vente_total || 0}</span>
                  </div>
                </div>
                <table className="suivi-table">
                  <thead>
                    <tr>
                      <th>Confirmateur</th>
                      <th>CH Aff</th>
                      <th>CH Net</th>
                      <th>Nb Ventes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionsData.commissions?.length > 0 ? (
                      commissionsData.commissions.map((comm, index) => (
                        <tr key={comm.id_confirmateur || index}>
                          <td>{comm.name}</td>
                          <td>{comm.ch?.toFixed(2) || '0.00'} €</td>
                          <td>{comm.ch_net?.toFixed(2) || '0.00'} €</td>
                          <td>{comm.nb_vente || 0}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center' }}>Aucune donnée</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="no-data">Aucune donnée disponible</div>
            )}
          </div>
        )}

        {/* Onglet Signatures */}
        {activeTab === 'signatures' && (
          <div className="tab-content">
            <h2>Statistiques de Signature</h2>
            {loadingSignatures ? (
              <div className="loading">Chargement...</div>
            ) : signaturesData ? (
              <>
                <div className="totals">
                  <div className="total-item">
                    <span className="total-label">Total Signatures:</span>
                    <span className="total-value">{signaturesData.total || 0}</span>
                  </div>
                </div>
                {filters.id_confirmateur ? (
                  // Détails pour un confirmateur spécifique
                  <table className="suivi-table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Prénom</th>
                        <th>Téléphone</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signaturesData.details?.length > 0 ? (
                        signaturesData.details.map((detail, index) => (
                          <tr key={index}>
                            <td>{detail.nom || '-'}</td>
                            <td>{detail.prenom || '-'}</td>
                            <td>{detail.tel || '-'}</td>
                            <td>{detail.ajoute || 0}</td>
                            <td>
                              <FicheDetailLink ficheId={detail.id} className="btn-link">
                                Voir fiche
                              </FicheDetailLink>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center' }}>Aucune donnée</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  // Liste des confirmateurs avec leurs scores
                  <table className="suivi-table">
                    <thead>
                      <tr>
                        <th>Confirmateur</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signaturesData.signatures?.length > 0 ? (
                        signaturesData.signatures.map((sign, index) => (
                          <tr key={sign.confirmateur || index}>
                            <td>
                              <a
                                href={`?contenu=signatures&id_confirmateur=${sign.confirmateur}&date_debut=${filters.date_debut}&date_fin=${filters.date_fin}`}
                                className="btn-link"
                              >
                                {sign.name}
                              </a>
                            </td>
                            <td>{sign.score || 0}</td>
                            <td>
                              <button
                                className="btn-link"
                                onClick={() => handleFilterChange('id_confirmateur', sign.confirmateur)}
                              >
                                Voir détails
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center' }}>Aucune donnée</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <div className="no-data">Aucune donnée disponible</div>
            )}
          </div>
        )}

        {/* Onglet New/Repro */}
        {activeTab === 'new-repro' && (
          <div className="tab-content">
            <h2>Statistiques New/Repro</h2>
            {loadingNewRepro ? (
              <div className="loading">Chargement...</div>
            ) : newReproData ? (
              <table className="suivi-table">
                <thead>
                  <tr>
                    <th>Confirmateur</th>
                    <th>NEW</th>
                    <th>REPRO</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {newReproData.newRepro?.length > 0 ? (
                    newReproData.newRepro.map((stat, index) => (
                      <tr key={stat.id_confirmateur || index}>
                        <td>{stat.name}</td>
                        <td>{stat.new || 0}</td>
                        <td>{stat.repro || 0}</td>
                        <td>{stat.total || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center' }}>Aucune donnée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Aucune donnée disponible</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviTelepro;

