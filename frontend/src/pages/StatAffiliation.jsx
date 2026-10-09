import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FaUserCheck, FaUserSlash, FaList, FaSearch, FaChartPie } from 'react-icons/fa';
import api from '../config/api';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import './StatAffiliation.css';

const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TAB_DEFS = [
  { id: 'all', Icon: FaList, label: 'Tous' },
  { id: 'affilie', Icon: FaUserCheck, label: 'Affiliés' },
  { id: 'non_affilie', Icon: FaUserSlash, label: 'Non affiliés' },
];

const getProduitLabel = (produit) =>
  Number(produit) === 1 ? 'PAC' : Number(produit) === 2 ? 'PV' : '-';

const StatAffiliation = () => {
  useForceDesktopViewport('stat-affiliation-page');
  const [dateRdv, setDateRdv] = useState(getLocalDateStr);
  const [activeTab, setActiveTab] = useState('all');
  const [quickSearch, setQuickSearch] = useState('');

  const { data, isLoading, error } = useQuery(
    ['stat-affiliation', dateRdv, activeTab],
    async () => {
      const res = await api.get('/planning/stat-affiliation', {
        params: { date: dateRdv, type: activeTab },
      });
      return res.data?.data || { totals: {}, by_centre: [], fiches: [] };
    },
    { keepPreviousData: true }
  );

  const totals = data?.totals || { total: 0, affilies: 0, non_affilies: 0 };
  const byCentre = data?.by_centre || [];

  const filteredByCentre = useMemo(() => {
    const terms = quickSearch
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (terms.length === 0) return byCentre;

    return byCentre
      .map((group) => {
        const fiches = (group.fiches || []).filter((f) => {
          const hay = [
            f.nom,
            f.prenom,
            f.tel,
            f.cp,
            f.ville,
            f.commercial_display,
            f.etat_titre,
            f.centre_titre,
          ]
            .map((x) => String(x || '').toUpperCase())
            .join(' ');
          const cp = String(f.cp || '').trim().toUpperCase();
          return terms.some(
            (term) => hay.includes(term) || (cp && cp.startsWith(term))
          );
        });
        if (fiches.length === 0) return null;
        return {
          ...group,
          fiches,
          total: fiches.length,
          affilies: fiches.filter((f) => f.is_affilie).length,
          non_affilies: fiches.filter((f) => !f.is_affilie).length,
        };
      })
      .filter(Boolean);
  }, [byCentre, quickSearch]);

  const visibleTotals = useMemo(() => {
    const fiches = filteredByCentre.flatMap((g) => g.fiches || []);
    return {
      total: fiches.length,
      affilies: fiches.filter((f) => f.is_affilie).length,
      non_affilies: fiches.filter((f) => !f.is_affilie).length,
    };
  }, [filteredByCentre]);

  return (
    <div className="stat-affiliation-page">
      <div className="stat-affiliation-header">
        <h1>
          <FaChartPie /> STAT affiliation
        </h1>
        <p>
          RDV CONFIRMER issus de fiches_histo (date RDV figée à la confirmation),
          affiliés / non affiliés, classés par centre.
        </p>
      </div>

      <div className="stat-affiliation-controls">
        <div className="stat-affiliation-tabs">
          {TAB_DEFS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`tab-button ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon /> {label}
              {id === 'all' && (
                <span className="tab-count">({totals.total})</span>
              )}
              {id === 'affilie' && (
                <span className="tab-count">({totals.affilies})</span>
              )}
              {id === 'non_affilie' && (
                <span className="tab-count">({totals.non_affilies})</span>
              )}
            </button>
          ))}
        </div>

        <div className="stat-affiliation-filters">
          <div className="filter-group">
            <label htmlFor="stat-aff-date">Date RDV</label>
            <input
              id="stat-aff-date"
              type="date"
              value={dateRdv}
              onChange={(e) => setDateRdv(e.target.value)}
              className="form-control"
            />
          </div>
          <div className="filter-group filter-search">
            <label htmlFor="stat-aff-search">Recherche</label>
            <div className="search-input-wrap">
              <FaSearch />
              <input
                id="stat-aff-search"
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Nom, tél, CP, commercial…"
                className="form-control"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="stat-affiliation-summary">
        <div className="summary-card">
          <span className="summary-value">{visibleTotals.total}</span>
          <span className="summary-label">Total</span>
        </div>
        <div className="summary-card summary-affilie">
          <span className="summary-value">{visibleTotals.affilies}</span>
          <span className="summary-label">Affiliés</span>
        </div>
        <div className="summary-card summary-non-affilie">
          <span className="summary-value">{visibleTotals.non_affilies}</span>
          <span className="summary-label">Non affiliés</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{filteredByCentre.length}</span>
          <span className="summary-label">Centres</span>
        </div>
      </div>

      {isLoading ? (
        <div className="stat-affiliation-loading">Chargement…</div>
      ) : error ? (
        <div className="stat-affiliation-error">
          {error.response?.data?.message || error.message || 'Erreur de chargement'}
        </div>
      ) : filteredByCentre.length === 0 ? (
        <div className="stat-affiliation-empty">
          Aucun rendez-vous pour cette date.
        </div>
      ) : (
        <div className="stat-affiliation-centres">
          {filteredByCentre.map((group) => (
            <section
              key={group.id_centre != null ? group.id_centre : 'none'}
              className="centre-block"
            >
              <header className="centre-block-header">
                <h2>{group.centre_titre || 'Sans centre'}</h2>
                <div className="centre-block-meta">
                  <span>{group.total} RDV</span>
                  <span className="meta-affilie">{group.affilies} affiliés</span>
                  <span className="meta-non-affilie">
                    {group.non_affilies} non affiliés
                  </span>
                </div>
              </header>
              <div className="centre-table-wrap">
                <table className="stat-affiliation-table">
                  <thead>
                    <tr>
                      <th>Heure</th>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Tél</th>
                      <th>CP</th>
                      <th>Ville</th>
                      <th>État</th>
                      <th>Affiliation</th>
                      <th>Commercial</th>
                      <th>Produit</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.fiches.map((fiche) => (
                      <tr key={fiche.id}>
                        <td>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                        <td>{fiche.nom || '-'}</td>
                        <td>{fiche.prenom || '-'}</td>
                        <td>{fiche.tel || '-'}</td>
                        <td>{fiche.cp || '-'}</td>
                        <td>{fiche.ville || '-'}</td>
                        <td>
                          <span
                            className="etat-pill"
                            style={{
                              backgroundColor: fiche.etat_color || '#9cbfc8',
                            }}
                          >
                            {fiche.etat_titre || fiche.id_etat_final || '-'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              fiche.is_affilie
                                ? 'badge-affilie'
                                : 'badge-non-affilie'
                            }
                          >
                            {fiche.is_affilie ? 'Affilié' : 'Non affilié'}
                          </span>
                        </td>
                        <td>{fiche.commercial_display || '-'}</td>
                        <td>{getProduitLabel(fiche.produit)}</td>
                        <td>
                          <FicheDetailLink
                            ficheHash={fiche.hash}
                            ficheId={fiche.id}
                            className="btn-icon"
                            title="Voir la fiche"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatAffiliation;
