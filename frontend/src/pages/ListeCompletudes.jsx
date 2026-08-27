import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaListAlt, FaFilter, FaChevronDown, FaChevronUp, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import './ListeCompletudes.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const FONCTION_QC = 4;
const FONCTION_BACKOFFICE = 11;
const FONCTION_RP = 13;
const FONCTION_RE = 14;
const FONCTION_CONFIRMATEUR = 6;

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'traitee', label: 'Traitée' },
  { value: 'non_traitee', label: 'Non traitée' }
];

const ListeCompletudes = () => {
  useForceDesktopViewport('liste-completudes-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userFonction = Number(user?.fonction);
  const isQC = userFonction === FONCTION_QC;
  const isBackoffice = userFonction === FONCTION_BACKOFFICE;
  const isRE = userFonction === FONCTION_RE;
  const isRP = userFonction === FONCTION_RP;
  const allowed = isQC || isBackoffice || isRE || isRP;
  /** Filtre confirmateur sur tous les confirmateurs (QC, Backoffice, RE) */
  const canFilterAllConfirmateurs = isQC || isBackoffice || isRE;

  const [showFilters, setShowFilters] = useState(true);
  const [reponseById, setReponseById] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    statut: 'en_attente',
    date_debut: '',
    date_fin: '',
    id_confirmateur: isRE || isBackoffice ? 'all' : '',
    id_re: isRP ? 'all' : '',
    search: ''
  });

  const { data: usersData } = useQuery(
    'users-liste-completudes',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data?.data || [];
    },
    { enabled: isRP }
  );

  const reSousRP =
    isRP && usersData
      ? usersData.filter(
          (u) =>
            Number(u.chef_equipe) === Number(user?.id) &&
            Number(u.fonction) === FONCTION_RE &&
            (u.etat > 0 || u.etat == null)
        )
      : [];

  const confirmateursRP =
    isRP && usersData && filters.id_re
      ? (() => {
          const reIds =
            filters.id_re === 'all'
              ? reSousRP.map((r) => r.id)
              : [parseInt(filters.id_re, 10)];
          return usersData.filter(
            (u) =>
              Number(u.fonction) === FONCTION_CONFIRMATEUR &&
              reIds.includes(Number(u.chef_equipe)) &&
              (u.etat > 0 || u.etat == null)
          );
        })()
      : [];

  const { data: allConfirmateurs } = useQuery(
    'confirmateurs-liste-completudes-all',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return (
        res.data?.data?.filter(
          (u) => Number(u.fonction) === FONCTION_CONFIRMATEUR && (u.etat > 0 || u.etat == null)
        ) || []
      );
    },
    { enabled: canFilterAllConfirmateurs }
  );

  const { data, isLoading, error, refetch } = useQuery(
    ['liste-completudes', filters, user?.id],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] == null) delete params[k];
      });
      const res = await api.get('/fiches/liste-completudes', { params });
      if (res.data?.success) return res.data;
      throw new Error(res.data?.message || 'Erreur chargement');
    },
    {
      enabled: allowed,
      keepPreviousData: true,
      onError: (err) => {
        toast.error(err.response?.data?.message || err.message || 'Erreur chargement');
      }
    }
  );

  const traiterMutation = useMutation(
    async ({ hash, id, reponse_traitement }) => {
      const res = await api.patch(`/fiches/${hash}/completude/${id}`, {
        statut: 'traitee',
        reponse_traitement
      });
      return res.data;
    },
    {
      onSuccess: () => {
        toast.success('Complétude marquée comme traitée');
        queryClient.invalidateQueries(['liste-completudes']);
        refetch();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors du traitement');
      }
    }
  );

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  const rows = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
      ...(key === 'id_re' ? { id_confirmateur: '' } : {})
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statutClass = (statut) => {
    if (statut === 'traitee') return 'statut-traitee';
    if (statut === 'non_traitee') return 'statut-non-traitee';
    return 'statut-attente';
  };

  return (
    <div className="liste-completudes">
      <div className="page-header">
        <h1>
          <FaListAlt /> Liste des complétudes
        </h1>
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters((v) => !v)}
        >
          <FaFilter /> Filtres {showFilters ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      </div>

      {showFilters && (
        <div className="liste-completudes-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="lc-statut">Statut</label>
              <select
                id="lc-statut"
                className="form-control"
                value={filters.statut}
                onChange={(e) => handleFilterChange('statut', e.target.value)}
              >
                {STATUT_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="lc-date-debut">Date création du</label>
              <input
                id="lc-date-debut"
                type="date"
                className="form-control"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="lc-date-fin">au</label>
              <input
                id="lc-date-fin"
                type="date"
                className="form-control"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
            <div className="filter-group filter-group-search">
              <label htmlFor="lc-search">Recherche</label>
              <input
                id="lc-search"
                type="text"
                className="form-control"
                placeholder="Nom, téléphone, motif…"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
          </div>

          <div className="filter-row">
            {canFilterAllConfirmateurs && (
              <div className="filter-group">
                <label htmlFor="lc-conf">Confirmateur</label>
                <select
                  id="lc-conf"
                  className="form-control"
                  value={filters.id_confirmateur}
                  onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                >
                  <option value={isQC ? '' : 'all'}>Tous les confirmateurs</option>
                  {(allConfirmateurs || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.pseudo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isRP && (
              <>
                <div className="filter-group">
                  <label htmlFor="lc-re">RE</label>
                  <select
                    id="lc-re"
                    className="form-control"
                    value={filters.id_re}
                    onChange={(e) => handleFilterChange('id_re', e.target.value)}
                  >
                    <option value="all">Tous les RE</option>
                    {reSousRP.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.pseudo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="lc-conf-rp">Confirmateur</label>
                  <select
                    id="lc-conf-rp"
                    className="form-control"
                    value={filters.id_confirmateur}
                    onChange={(e) => handleFilterChange('id_confirmateur', e.target.value)}
                    disabled={!filters.id_re}
                  >
                    <option value="">Tous</option>
                    {confirmateursRP.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.pseudo}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="filter-actions">
              <button
                type="button"
                className="btn-reset"
                onClick={() =>
                  setFilters({
                    page: 1,
                    limit: 50,
                    statut: '',
                    date_debut: '',
                    date_fin: '',
                    id_confirmateur: isRE ? 'all' : '',
                    id_re: isRP ? 'all' : '',
                    search: ''
                  })
                }
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="results-info">
        <p>
          Total : <strong>{pagination.total}</strong> complétude(s)
          {pagination.pages > 1 && (
            <>
              {' '}
              | Page <strong>{pagination.page}</strong> / <strong>{pagination.pages}</strong>
            </>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement…</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement</p>
          <button type="button" onClick={() => refetch()}>
            Réessayer
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="no-results">Aucune complétude pour ces critères.</div>
      ) : (
        <>
          <div className="liste-completudes-table-wrap">
            <table className="liste-completudes-table">
              <thead>
                <tr>
                  <th>Date création</th>
                  <th>Statut</th>
                  <th>Fiche</th>
                  <th>Confirmateur</th>
                  <th>Motif</th>
                  <th>Complétudes</th>
                  <th>Créé par</th>
                  <th>Traitement</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date_creation)}</td>
                    <td>
                      <span className={`statut-badge ${statutClass(row.statut)}`}>
                        {row.statut_label || row.statut}
                      </span>
                    </td>
                    <td>
                      <div className="fiche-cell">
                        <strong>
                          {row.fiche_nom} {row.fiche_prenom}
                        </strong>
                        <br />
                        <span className="fiche-tel">{row.fiche_tel || '—'}</span>
                        <br />
                        <FicheDetailLink ficheHash={row.hash} />
                      </div>
                    </td>
                    <td>{row.confirmateur_pseudo || '—'}</td>
                    <td className="cell-motif">{row.motif}</td>
                    <td className="cell-completes">{row.completes}</td>
                    <td>{row.created_by_pseudo || '—'}</td>
                    <td className="cell-traitement">
                      {row.statut === 'traitee' ? (
                        <>
                          <div>{row.traite_par_pseudo || '—'}</div>
                          <div className="traitement-date">{formatDate(row.date_traitement)}</div>
                          {row.reponse_traitement && (
                            <div className="traitement-reponse">{row.reponse_traitement}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="cell-actions">
                      {row.can_treat ? (
                        <div className="traiter-block">
                          <textarea
                            className="form-control"
                            rows={2}
                            placeholder="Réponse optionnelle"
                            value={reponseById[row.id] || ''}
                            onChange={(e) =>
                              setReponseById((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="btn-traiter"
                            disabled={traiterMutation.isLoading}
                            onClick={() =>
                              traiterMutation.mutate({
                                hash: row.hash,
                                id: row.id,
                                reponse_traitement: reponseById[row.id] || ''
                              })
                            }
                          >
                            <FaCheck /> Traité
                          </button>
                        </div>
                      ) : (
                        <span className="no-action">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => handleFilterChange('page', pagination.page - 1)}
              >
                Précédent
              </button>
              <span>
                Page {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => handleFilterChange('page', pagination.page + 1)}
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

export default ListeCompletudes;
