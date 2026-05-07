import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FaCheckCircle, FaSearch } from 'react-icons/fa';
import api from '../config/api';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { getFirstOfMonthLocal, getTodayLocal } from '../utils/dateUtils';
import './CQSignatures.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return { dateDebut: toLocalDateString(monday), dateFin: toLocalDateString(now) };
}

function getYesterdayRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const d = toLocalDateString(yesterday);
  return { dateDebut: d, dateFin: d };
}

function getTodayRange() {
  const d = getTodayLocal();
  return { dateDebut: d, dateFin: d };
}

function getMonthRange() {
  return { dateDebut: getFirstOfMonthLocal(), dateFin: getTodayLocal() };
}

const TAB_DEFS = [
  { id: 'yesterday', label: "Signatures d'hier", getRange: getYesterdayRange },
  { id: 'today', label: 'Signatures de la journée', getRange: getTodayRange },
  { id: 'week', label: 'Signatures de la semaine', getRange: getCurrentWeekRange },
  { id: 'month', label: 'Signatures du mois', getRange: getMonthRange },
];

const CQSignatures = () => {
  useForceDesktopViewport('cq-signatures-page');
  const [activeTab, setActiveTab] = useState('today');
  const [page, setPage] = useState(1);
  const limit = 100;

  const activeRange = useMemo(() => {
    const found = TAB_DEFS.find((t) => t.id === activeTab) || TAB_DEFS[1];
    return found.getRange();
  }, [activeTab]);

  const { data, isLoading } = useQuery(
    ['cq-signatures', activeTab, activeRange.dateDebut, activeRange.dateFin, page],
    async () => {
      const res = await api.get('/signature', {
        params: {
          date_debut: activeRange.dateDebut,
          date_fin: activeRange.dateFin,
          id_etat_final: 13,
          page,
          limit,
          sort_by: 'date_planning',
          sort_order: 'desc',
        },
      });
      return res.data;
    },
    { keepPreviousData: true }
  );

  const rows = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <div className="cq-signatures-page">
      <div className="page-header">
        <h1><FaCheckCircle /> CQ Signatures</h1>
      </div>

      <div className="cq-tabs">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cq-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading">Chargement des signatures...</div>
      ) : rows.length === 0 ? (
        <div className="no-data">Aucune signature trouvée.</div>
      ) : (
        <>
          <div className="fiches-table-container">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th>Date planning</th>
                  <th>Date signature</th>
                  <th>Confirmateur</th>
                  <th>Centre</th>
                  <th>Installateur</th>
                  <th>CQ État</th>
                  <th>CQ Dossier</th>
                  <th>Fiche</th>
                  <th>Téléphone</th>
                  <th>Score</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sig) => (
                  <tr key={sig.id}>
                    <td>{sig.date_planning ? formatRdvDateTime(sig.date_planning) : '-'}</td>
                    <td>{sig.date_heure ? formatRdvDateTime(sig.date_heure) : '-'}</td>
                    <td>{sig.confirmateur_pseudo || '-'}</td>
                    <td>{sig.centre_titre || '-'}</td>
                    <td className="wrap-cell">{sig.installateur_nom || '-'}</td>
                    <td className="wrap-cell">{sig.cq_etat_titre || '-'}</td>
                    <td className="wrap-cell">{sig.cq_dossier_titre || '-'}</td>
                    <td>{sig.id_fiche || '-'}</td>
                    <td>{sig.tel || sig.fiche_tel || '-'}</td>
                    <td>{sig.ajoute ?? '-'}</td>
                    <td>
                      {sig.id_fiche ? (
                        <FicheDetailLink ficheId={sig.id_fiche}>
                          <FaSearch className="search-icon" />
                        </FicheDetailLink>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn-pagination"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Précédent
              </button>
              <span className="pagination-info">
                Page {pagination.page} sur {pagination.totalPages} ({pagination.total} signatures)
              </span>
              <button
                type="button"
                className="btn-pagination"
                onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                disabled={page >= (pagination.totalPages || 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CQSignatures;
