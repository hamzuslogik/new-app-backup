import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaCalendarDay, FaUserCheck, FaUserSlash, FaChartLine } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './RendezVousVue.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const fetchRdvVue = async (type, date) => {
  const res = await api.get('/planning/rdv-vue', {
    params: { type, date }
  });
  return res.data.data || [];
};

const RendezVousVue = () => {
  useForceDesktopViewport('rendezvous-vue-page');
  const today = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('jour');
  const [dateJour, setDateJour] = useState(today);
  const [sortConfig, setSortConfig] = useState({ key: 'date_rdv_time', direction: 'asc' });

  const { data: dataJour, isLoading: loadingJour } = useQuery(
    ['rdv-vue', 'jour', dateJour],
    () => fetchRdvVue('jour', dateJour),
    { enabled: true }
  );
  const { data: dataAffilie, isLoading: loadingAffilie } = useQuery(
    ['rdv-vue', 'affilie', dateJour],
    () => fetchRdvVue('affilie', dateJour),
    { enabled: true }
  );
  const { data: dataNonAffilie, isLoading: loadingNonAffilie } = useQuery(
    ['rdv-vue', 'non_affilie', dateJour],
    () => fetchRdvVue('non_affilie', dateJour),
    { enabled: true }
  );
  const { data: dataProductionRdv, isLoading: loadingProductionRdv } = useQuery(
    ['rdv-vue', 'production_rdv', dateJour],
    () => fetchRdvVue('production_rdv', dateJour),
    { enabled: true }
  );

  const countJour = (dataJour || []).length;
  const countAffilie = (dataAffilie || []).length;
  const countNonAffilie = (dataNonAffilie || []).length;
  const countProductionRdv = (dataProductionRdv || []).length;

  const list =
    activeTab === 'jour'
      ? dataJour || []
      : activeTab === 'affilie'
        ? dataAffilie || []
        : activeTab === 'non_affilie'
          ? dataNonAffilie || []
          : dataProductionRdv || [];
  const isLoading =
    (activeTab === 'jour' && loadingJour) ||
    (activeTab === 'affilie' && loadingAffilie) ||
    (activeTab === 'non_affilie' && loadingNonAffilie) ||
    (activeTab === 'production_rdv' && loadingProductionRdv);

  const getSortValue = (fiche, key) => {
    switch (key) {
      case 'fiche':
        return `${fiche.nom || ''} ${fiche.prenom || ''}`.trim().toLowerCase();
      case 'adresse':
        return `${fiche.adresse || ''} ${fiche.cp || ''} ${fiche.ville || ''}`.trim().toLowerCase();
      case 'date_rdv_time':
        return fiche.date_rdv_time ? new Date(fiche.date_rdv_time).getTime() : 0;
      case 'commerciaux':
        return `${fiche.commercial_pseudo || ''} ${fiche.commercial2_pseudo || ''}`.trim().toLowerCase();
      case 'etat':
        return `${fiche.etat_titre || fiche.id_etat_final || ''}`.toString().toLowerCase();
      default:
        return '';
    }
  };

  const sortedList = useMemo(() => {
    const copied = [...list];
    copied.sort((a, b) => {
      const valA = getSortValue(a, sortConfig.key);
      const valB = getSortValue(b, sortConfig.key);
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return copied;
  }, [list, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ' <> ';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

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
          <FaCalendarDay /> Rendez-vous du jour <span className="tab-count">({countJour})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('affilie')}
        >
          <FaUserCheck /> Rendez-vous affiliés <span className="tab-count">({countAffilie})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'non_affilie' ? 'active' : ''}`}
          onClick={() => setActiveTab('non_affilie')}
        >
          <FaUserSlash /> Rendez-vous non affiliés <span className="tab-count">({countNonAffilie})</span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'production_rdv' ? 'active' : ''}`}
          onClick={() => setActiveTab('production_rdv')}
        >
          <FaChartLine /> Production RDV <span className="tab-count">({countProductionRdv})</span>
        </button>
      </div>

      <div className="rdv-vue-filters">
        <div className="filter-group">
          <label>Date (journée)</label>
          <input
            type="date"
            value={dateJour}
            onChange={(e) => setDateJour(e.target.value)}
            className="form-control"
          />
        </div>
      </div>

      <div className="rdv-vue-content">
        {isLoading ? (
          <div className="loading">Chargement...</div>
        ) : list.length > 0 ? (
          <div className="table-container">
            <table className="rdv-vue-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('fiche')}>Fiche{getSortIndicator('fiche')}</th>
                  <th className="sortable" onClick={() => handleSort('adresse')}>Adresse{getSortIndicator('adresse')}</th>
                  <th className="sortable" onClick={() => handleSort('date_rdv_time')}>Date / heure RDV{getSortIndicator('date_rdv_time')}</th>
                  <th className="sortable" onClick={() => handleSort('commerciaux')}>Commercial(s){getSortIndicator('commerciaux')}</th>
                  <th className="sortable" onClick={() => handleSort('etat')}>État{getSortIndicator('etat')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.nom}</strong> {f.prenom}
                      {f.tel && <div className="tel">{f.tel}</div>}
                    </td>
                    <td>
                      {f.adresse && <div>{f.adresse}</div>}
                      {(f.cp || f.ville) && (
                        <div className="cp-ville">
                          {[f.cp, f.ville].filter(Boolean).join(' ')}
                        </div>
                      )}
                      {!f.adresse && !f.cp && !f.ville && <span className="text-muted">—</span>}
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
