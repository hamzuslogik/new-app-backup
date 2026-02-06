import React, { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaCalendarDay, FaUserCheck, FaUserSlash } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './RendezVousVue.css';

const RendezVousVue = () => {
  const today = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('jour');
  const [dateJour, setDateJour] = useState(today);
  const [dateDebut, setDateDebut] = useState(today);
  const [dateFin, setDateFin] = useState(today);

  const { data: rdvData, isLoading } = useQuery(
    ['rdv-vue', activeTab, dateJour, dateDebut, dateFin],
    async () => {
      const params = { type: activeTab };
      if (activeTab === 'jour') params.date = dateJour;
      if (activeTab === 'affilie' || activeTab === 'non_affilie') {
        params.date_debut = dateDebut;
        params.date_fin = dateFin;
      }
      const res = await api.get('/planning/rdv-vue', { params });
      return res.data.data || [];
    },
    { enabled: true }
  );

  const list = rdvData || [];

  return (
    <div className="rdv-vue-page">
      <div className="page-header">
        <h1>Vue Rendez-vous</h1>
      </div>

      <div className="rdv-vue-tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === 'jour' ? 'active' : ''}`}
          onClick={() => setActiveTab('jour')}
        >
          <FaCalendarDay /> Rendez-vous du jour
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('affilie')}
        >
          <FaUserCheck /> Rendez-vous affiliés
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'non_affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('non_affilie')}
        >
          <FaUserSlash /> Rendez-vous non affiliés
        </button>
      </div>

      <div className="rdv-vue-filters">
        {activeTab === 'jour' && (
          <div className="filter-group">
            <label>Date</label>
            <input
              type="date"
              value={dateJour}
              onChange={(e) => setDateJour(e.target.value)}
              className="form-control"
            />
          </div>
        )}
        {(activeTab === 'affilie' || activeTab === 'non_affilie') && (
          <>
            <div className="filter-group">
              <label>Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="filter-group">
              <label>Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="form-control"
              />
            </div>
          </>
        )}
      </div>

      <div className="rdv-vue-content">
        {isLoading ? (
          <div className="loading">Chargement...</div>
        ) : list.length > 0 ? (
          <div className="table-container">
            <table className="rdv-vue-table">
              <thead>
                <tr>
                  <th>Fiche</th>
                  <th>Date / heure RDV</th>
                  <th>Commercial(s)</th>
                  <th>État</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.nom}</strong> {f.prenom}
                      {f.tel && <div className="tel">{f.tel}</div>}
                    </td>
                    <td>{formatRdvDateTime(f.date_rdv_time)}</td>
                    <td>
                      {f.commercial_pseudo || f.commercial2_pseudo
                        ? [f.commercial_pseudo, f.commercial2_pseudo].filter(Boolean).join(' / ')
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>{f.etat_titre || f.id_etat_final || '—'}</td>
                    <td>
                      <FicheDetailLink ficheId={f.id} className="btn-detail" title="Voir la fiche" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">Aucun rendez-vous pour ces critères.</div>
        )}
      </div>
    </div>
  );
};

export default RendezVousVue;
