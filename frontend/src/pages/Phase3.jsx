import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCheckCircle, FaTimesCircle, FaCalendarWeek, FaCalendarAlt, FaFileAlt, FaCube } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import FicheDetailLink from '../components/FicheDetailLink';
import './Phase3.css';

const Phase3 = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('rdv-affilie'); // rdv-affilie, rdv-non-affilie, signes-semaine, signes-mois

  // Récupérer les RDV affiliés
  const { data: rdvAffilieData, isLoading: loadingAffilie } = useQuery(
    ['phase3', 'rdv-affilie'],
    async () => {
      const res = await api.get('/phase3/rdv-affilie');
      return res.data.data || [];
    },
    { enabled: activeTab === 'rdv-affilie' }
  );

  // Récupérer les RDV non affiliés
  const { data: rdvNonAffilieData, isLoading: loadingNonAffilie } = useQuery(
    ['phase3', 'rdv-non-affilie'],
    async () => {
      const res = await api.get('/phase3/rdv-non-affilie');
      return res.data.data || [];
    },
    { enabled: activeTab === 'rdv-non-affilie' }
  );

  // Récupérer les signés de la semaine
  const { data: signesSemaineData, isLoading: loadingSemaine } = useQuery(
    ['phase3', 'signes-semaine'],
    async () => {
      const res = await api.get('/phase3/signes-semaine');
      return res.data;
    },
    { enabled: activeTab === 'signes-semaine' }
  );

  // Récupérer les signés du mois
  const { data: signesMoisData, isLoading: loadingMois } = useQuery(
    ['phase3', 'signes-mois'],
    async () => {
      const res = await api.get('/phase3/signes-mois');
      return res.data;
    },
    { enabled: activeTab === 'signes-mois' }
  );

  // Récupérer les données de référence
  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const { data: installateursData } = useQuery('installateurs', async () => {
    const res = await api.get('/management/installateurs');
    return res.data.data || [];
  });

  const etats = etatsData || [];
  const installateurs = installateursData || [];

  const getEtatInfo = (idEtat) => {
    return etats.find(e => e.id === idEtat) || { titre: 'N/A', color: '#ccc' };
  };

  const getInstallateurNom = (idInstallateur) => {
    if (!idInstallateur) return 'N/A';
    const install = installateurs.find(i => i.id === idInstallateur);
    return install ? install.nom : 'N/A';
  };

  const renderFicheRow = (fiche) => {
    const etatInfo = getEtatInfo(fiche.id_etat_final);
    const showCQ = [13, 44, 45, 16, 38].includes(fiche.id_etat_final) || 
                   activeTab === 'signes-semaine' || 
                   activeTab === 'signes-mois';

    return (
      <tr key={fiche.id} style={{ backgroundColor: etatInfo.color + '20' }}>
        <td>{fiche.nom}</td>
        <td>{fiche.prenom}</td>
        <td>{fiche.tel}</td>
        <td>{fiche.cp}</td>
        <td>{fiche.ville}</td>
        <td>
          <span style={{ 
            backgroundColor: etatInfo.color, 
            color: '#fff', 
            padding: '4px 8px', 
            borderRadius: '4px',
            fontSize: '10.2px'
          }}>
            {etatInfo.titre}
          </span>
        </td>
        <td>{fiche.date_rdv_time ? new Date(fiche.date_rdv_time).toLocaleString('fr-FR') : 'N/A'}</td>
        {showCQ && (
          <>
            <td>{fiche.cq_etat || 'N/A'}</td>
            <td>{fiche.cq_dossier || 'N/A'}</td>
            <td>{getInstallateurNom(fiche.ph3_installateur)}</td>
          </>
        )}
        <td>
          <FicheDetailLink ficheId={fiche.id} className="btn-link">
            Voir détails
          </FicheDetailLink>
        </td>
      </tr>
    );
  };

  return (
    <div className="phase3-page">
      <div className="phase3-header">
        <h1><FaCube /> Phase 3</h1>
        <div className="phase3-tabs">
          {(user.fonction === 1 || user.fonction === 2 || user.fonction === 6 || user.fonction === 7) && (
            <>
              <button
                className={activeTab === 'rdv-affilie' ? 'active' : ''}
                onClick={() => setActiveTab('rdv-affilie')}
              >
                <FaCheckCircle /> RDV Affilié
              </button>
              <button
                className={activeTab === 'rdv-non-affilie' ? 'active' : ''}
                onClick={() => setActiveTab('rdv-non-affilie')}
              >
                <FaTimesCircle /> RDV Non Affilié
              </button>
            </>
          )}
          {(user.fonction === 1 || user.fonction === 2 || user.fonction === 7) && (
            <>
              <button
                className={activeTab === 'signes-semaine' ? 'active' : ''}
                onClick={() => setActiveTab('signes-semaine')}
              >
                <FaCalendarWeek /> Signés De La Semaine
              </button>
              <button
                className={activeTab === 'signes-mois' ? 'active' : ''}
                onClick={() => setActiveTab('signes-mois')}
              >
                <FaCalendarAlt /> Signés Du Mois
              </button>
            </>
          )}
        </div>
      </div>

      <div className="phase3-content">
        {/* RDV Affilié */}
        {activeTab === 'rdv-affilie' && (
          <div className="tab-content">
            <h2>Rendez-Vous Affiliés <span className="badge">Aujourd'hui</span></h2>
            {loadingAffilie ? (
              <div className="loading">Chargement...</div>
            ) : rdvAffilieData && rdvAffilieData.length > 0 ? (
              <table className="phase3-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Ville</th>
                    <th>État</th>
                    <th>Date RDV</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rdvAffilieData.map(fiche => renderFicheRow(fiche))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Aucun RDV affilié trouvé</div>
            )}
          </div>
        )}

        {/* RDV Non Affilié */}
        {activeTab === 'rdv-non-affilie' && (
          <div className="tab-content">
            <h2>Rendez-Vous Non Affiliés <span className="badge">Aujourd'hui</span></h2>
            {loadingNonAffilie ? (
              <div className="loading">Chargement...</div>
            ) : rdvNonAffilieData && rdvNonAffilieData.length > 0 ? (
              <table className="phase3-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Ville</th>
                    <th>État</th>
                    <th>Date RDV</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rdvNonAffilieData.map(fiche => renderFicheRow(fiche))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Aucun RDV non affilié trouvé</div>
            )}
          </div>
        )}

        {/* Signés de la Semaine */}
        {activeTab === 'signes-semaine' && (
          <div className="tab-content">
            <h2>
              Signés De La Semaine
              {signesSemaineData && (
                <span className="badge">
                  {signesSemaineData.week_start} - {signesSemaineData.week_end}
                </span>
              )}
            </h2>
            {loadingSemaine ? (
              <div className="loading">Chargement...</div>
            ) : signesSemaineData && signesSemaineData.data && signesSemaineData.data.length > 0 ? (
              <table className="phase3-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Ville</th>
                    <th>État</th>
                    <th>Date RDV</th>
                    <th>CQ_E</th>
                    <th>CQ_D</th>
                    <th>Installeur</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signesSemaineData.data.map(fiche => renderFicheRow(fiche))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Aucune fiche signée cette semaine</div>
            )}
          </div>
        )}

        {/* Signés du Mois */}
        {activeTab === 'signes-mois' && (
          <div className="tab-content">
            <h2>
              Signés Du Mois
              {signesMoisData && (
                <span className="badge">
                  {signesMoisData.month_start} - {signesMoisData.month_end}
                </span>
              )}
            </h2>
            {loadingMois ? (
              <div className="loading">Chargement...</div>
            ) : signesMoisData && signesMoisData.data && signesMoisData.data.length > 0 ? (
              <table className="phase3-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Téléphone</th>
                    <th>CP</th>
                    <th>Ville</th>
                    <th>État</th>
                    <th>Date RDV</th>
                    <th>CQ_E</th>
                    <th>CQ_D</th>
                    <th>Installeur</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signesMoisData.data.map(fiche => renderFicheRow(fiche))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Aucune fiche signée ce mois</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Phase3;

