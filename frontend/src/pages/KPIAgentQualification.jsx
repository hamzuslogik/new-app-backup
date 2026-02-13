import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import { FaChartLine, FaExclamationTriangle, FaBan } from 'react-icons/fa';
import './KPIAgentQualification.css';

const KPIAgentQualification = () => {
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
      return raw && typeof raw === 'object' ? raw : {};
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

  const period = kpiData?.period;
  const fichesProduites = Number(kpiData?.fiches_produites) || 0;
  const nbHc = Number(kpiData?.nb_hc) || 0;
  const nbKo = Number(kpiData?.nb_ko) || 0;
  const tauxHc = Number(kpiData?.taux_hc) || 0;
  const tauxKo = Number(kpiData?.taux_ko) || 0;

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
          <div className="kpi-card-value" aria-label="Fiches produites">{fichesProduites}</div>
        </div>

        <div className="kpi-card kpi-card-hc">
          <div className="kpi-card-icon"><FaExclamationTriangle /></div>
          <div className="kpi-card-label">Taux HC (hors cible)</div>
          <div className="kpi-card-value" aria-label="Taux HC">{tauxHc} %</div>
          <div className="kpi-card-detail">{nbHc} fiche{nbHc !== 1 ? 's' : ''} HC</div>
        </div>

        <div className="kpi-card kpi-card-ko">
          <div className="kpi-card-icon"><FaBan /></div>
          <div className="kpi-card-label">Taux KO (non conformité)</div>
          <div className="kpi-card-value" aria-label="Taux KO">{tauxKo} %</div>
          <div className="kpi-card-detail">{nbKo} fiche{nbKo !== 1 ? 's' : ''} KO</div>
        </div>
      </div>
    </div>
  );
};

export default KPIAgentQualification;
