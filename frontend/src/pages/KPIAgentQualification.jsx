import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import { FaChartLine, FaExclamationTriangle, FaBan } from 'react-icons/fa';
import './KPIAgentQualification.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const KPIAgentQualification = () => {
  useForceDesktopViewport('kpi-agent-qualification-page');
  const { user } = useAuth();

  const [filters, setFilters] = useState({
    date_debut: getFirstOfMonthLocal(),
    date_fin: getTodayLocal()
  });

  const { data: kpiData, isLoading, error } = useQuery(
    ['agent-qualification-kpis', filters.date_debut, filters.date_fin],
    async () => {
      const res = await api.get('/statistiques/agent-qualification-kpis', {
        params: { date_debut: filters.date_debut, date_fin: filters.date_fin }
      });
      const raw = res.data?.data ?? res.data;
      const payload = raw && typeof raw === 'object' ? raw : {};
      return payload;
    },
    { enabled: Number(user?.fonction) === 3 && !!filters.date_debut && !!filters.date_fin }
  );

  if (Number(user?.fonction) !== 3) {
    return (
      <div className="kpi-agent-qualif-page">
        <div className="error">Cette page est réservée aux agents qualification.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="kpi-agent-qualif-page">
        <div className="loading">Chargement des indicateurs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpi-agent-qualif-page">
        <div className="error">
          Erreur lors du chargement : {error?.response?.data?.message || error?.message || 'Erreur inconnue'}
        </div>
      </div>
    );
  }

  const data = kpiData || {};
  const period = data.period;
  const fichesProduites = Number(data.fiches_produites ?? data.fichesProduites) || 0;
  const nbHc = Number(data.nb_hc ?? data.nbHc) || 0;
  const nbKo = Number(data.nb_ko ?? data.nbKo) || 0;
  const tauxHc = Number(data.taux_hc ?? data.tauxHc) || 0;
  const tauxKo = Number(data.taux_ko ?? data.tauxKo) || 0;

  return (
    <div className="kpi-agent-qualif-page">
      <div className="kpi-agent-qualif-header">
        <h1><FaChartLine /> Mes indicateurs (non-conformité)</h1>
        <div className="kpi-agent-qualif-filters">
          <div className="filter-item">
            <label>Du</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => setFilters((f) => ({ ...f, date_debut: e.target.value }))}
            />
          </div>
          <div className="filter-item">
            <label>au</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => setFilters((f) => ({ ...f, date_fin: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {period && (
        <p className="kpi-agent-qualif-period">
          Période : <strong>{period.date_debut}</strong> au <strong>{period.date_fin}</strong>
        </p>
      )}

      <div className="kpi-agent-qualif-intro">
        <p>
          Fiches produites = fiches créées par vous sur la période, hors poubelle et doublon.
          <br />
          Taux HC = nombre de fiches HC / fiches produites. Taux KO = nombre de fiches KO / fiches produites.
        </p>
      </div>

      <div className="kpi-agent-qualif-cards">
        <div className="kpi-card kpi-card-base">
          <div className="kpi-card-label">Fiches produites</div>
          <div className="kpi-card-value" aria-label="Fiches produites">
            <span className="kpi-card-value-inner">{fichesProduites}</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-hc">
          <div className="kpi-card-icon"><FaExclamationTriangle /></div>
          <div className="kpi-card-label">Taux HC (hors cible)</div>
          <div className="kpi-card-value" aria-label="Taux HC">
            <span className="kpi-card-value-inner">{tauxHc} %</span>
          </div>
          <div className="kpi-card-detail">{nbHc} fiche{nbHc !== 1 ? 's' : ''} HC</div>
        </div>

        <div className="kpi-card kpi-card-ko">
          <div className="kpi-card-icon"><FaBan /></div>
          <div className="kpi-card-label">Taux KO (non conformité)</div>
          <div className="kpi-card-value" aria-label="Taux KO">
            <span className="kpi-card-value-inner">{tauxKo} %</span>
          </div>
          <div className="kpi-card-detail">{nbKo} fiche{nbKo !== 1 ? 's' : ''} KO</div>
        </div>
      </div>
    </div>
  );
};

export default KPIAgentQualification;
