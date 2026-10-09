import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { FaUnlockAlt, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import './RdvCreneauCodeBypass.css';

const ALLOWED_FONCTIONS = [1, 7, 11, 13, 14];

const MOTIF_OPTIONS = [
  { value: '', label: 'Tous motifs' },
  { value: 'surplus', label: 'Surplus / blindé' },
  { value: 'ferme_politique', label: 'Fermé (politique)' },
  { value: 'ferme_db', label: 'Fermé (planning)' },
  { value: 'zero_dispo', label: '0 disponibilité' },
];

const FONCTION_OPTIONS = [
  { value: '', label: 'Toutes fonctions' },
  { value: '6', label: 'Confirmateur' },
  { value: '11', label: 'Backoffice' },
  { value: '13', label: 'RP Confirmation' },
  { value: '14', label: 'RE Confirmation' },
  { value: '1', label: 'Admin' },
  { value: '7', label: 'Admin 7' },
];

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function motifBadges(row) {
  const badges = [];
  if (Number(row.is_surplus)) badges.push({ key: 'surplus', label: 'Surplus', className: 'badge-surplus' });
  if (Number(row.is_ferme_politique)) badges.push({ key: 'pol', label: 'Fermé pol.', className: 'badge-ferme' });
  if (Number(row.is_ferme_db)) badges.push({ key: 'db', label: 'Fermé DB', className: 'badge-ferme' });
  if (Number(row.is_zero_dispo)) badges.push({ key: 'zero', label: '0 dispo', className: 'badge-zero' });
  if (!badges.length && row.motif) {
    badges.push({ key: 'motif', label: row.motif, className: 'badge-motif' });
  }
  return badges;
}

const RdvCreneauCodeBypass = () => {
  useForceDesktopViewport('rdv-creneau-bypass-page');
  const { user } = useAuth();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toYmd = (d) => d.toISOString().slice(0, 10);

  const [dateDebut, setDateDebut] = useState(toYmd(firstOfMonth));
  const [dateFin, setDateFin] = useState(toYmd(today));
  const [idUtilisateur, setIdUtilisateur] = useState('');
  const [idFonction, setIdFonction] = useState('6');
  const [dep, setDep] = useState('');
  const [motif, setMotif] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      id_utilisateur: idUtilisateur || undefined,
      id_fonction: idFonction || undefined,
      dep: dep.trim() || undefined,
      motif: motif || undefined,
      page,
      limit: 50,
    }),
    [dateDebut, dateFin, idUtilisateur, idFonction, dep, motif, page]
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery(
    ['rdv-creneau-code-bypass', queryParams],
    async () => {
      const res = await api.get('/rdv-creneau-code-bypass', { params: queryParams });
      if (res.data?.success) return res.data;
      throw new Error(res.data?.message || 'Erreur chargement');
    },
    {
      keepPreviousData: true,
      onError: (err) =>
        toast.error(err.response?.data?.message || err.message || 'Erreur chargement'),
    }
  );

  if (!ALLOWED_FONCTIONS.includes(Number(user?.fonction))) {
    return (
      <div className="rdv-bypass-page">
        <div className="rdv-bypass-forbidden">
          <h2>Accès réservé</h2>
          <p>Cette page est réservée aux administrateurs, backoffice, RE et RP Confirmation.</p>
        </div>
      </div>
    );
  }

  const rows = data?.data || [];
  const byUser = data?.byUser || [];
  const totals = data?.totals || { total: 0 };
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };
  const usersFilter = data?.filtersMeta?.users || [];

  return (
    <div className="rdv-bypass-page">
      <div className="page-header">
        <h1>
          <FaUnlockAlt /> Bypass créneau (code retapé)
        </h1>
        <p className="page-subtitle">
          RDV placés en CONFIRMER malgré un créneau fermé, blindé ou en surplus, après validation du code.
        </p>
      </div>

      <div className="rdv-bypass-filters">
        <div className="filter-field">
          <label htmlFor="bypass-date-debut">Du</label>
          <input
            id="bypass-date-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => {
              setDateDebut(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="bypass-date-fin">Au</label>
          <input
            id="bypass-date-fin"
            type="date"
            value={dateFin}
            onChange={(e) => {
              setDateFin(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="bypass-user">Utilisateur</label>
          <select
            id="bypass-user"
            value={idUtilisateur}
            onChange={(e) => {
              setIdUtilisateur(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {usersFilter.map((u) => (
              <option key={u.id} value={u.id}>
                {u.pseudo || `#${u.id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="bypass-fonction">Fonction</label>
          <select
            id="bypass-fonction"
            value={idFonction}
            onChange={(e) => {
              setIdFonction(e.target.value);
              setPage(1);
            }}
          >
            {FONCTION_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="bypass-dep">Dép.</label>
          <input
            id="bypass-dep"
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="ex: 69"
            value={dep}
            onChange={(e) => {
              setDep(e.target.value.replace(/\D/g, '').slice(0, 2));
              setPage(1);
            }}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="bypass-motif">Motif</label>
          <select
            id="bypass-motif"
            value={motif}
            onChange={(e) => {
              setMotif(e.target.value);
              setPage(1);
            }}
          >
            {MOTIF_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-refresh" onClick={() => refetch()} disabled={isFetching}>
          <FaSearch /> Actualiser
        </button>
      </div>

      <div className="rdv-bypass-summary">
        <div className="summary-card">
          <span className="summary-label">Total bypass</span>
          <strong>{totals.total || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">Surplus</span>
          <strong>{totals.nb_surplus || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">Fermé pol.</span>
          <strong>{totals.nb_ferme_politique || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">Fermé DB</span>
          <strong>{totals.nb_ferme_db || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">0 dispo</span>
          <strong>{totals.nb_zero_dispo || 0}</strong>
        </div>
      </div>

      <section className="rdv-bypass-section">
        <h2>Répartition par utilisateur</h2>
        {isLoading && !data ? (
          <div className="loading">Chargement...</div>
        ) : byUser.length === 0 ? (
          <div className="no-results">Aucun bypass sur la période filtrée.</div>
        ) : (
          <div className="rdv-bypass-table-wrap">
            <table className="rdv-bypass-table by-user-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Fonction</th>
                  <th>Total</th>
                  <th>Part %</th>
                  <th>Surplus</th>
                  <th>Fermé pol.</th>
                  <th>Fermé DB</th>
                  <th>0 dispo</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((row) => (
                  <tr key={`${row.id_utilisateur}-${row.id_fonction}`}>
                    <td>
                      <button
                        type="button"
                        className="link-filter-user"
                        onClick={() => {
                          setIdUtilisateur(String(row.id_utilisateur));
                          setPage(1);
                        }}
                        title="Filtrer sur cet utilisateur"
                      >
                        {row.utilisateur_pseudo || `#${row.id_utilisateur}`}
                      </button>
                    </td>
                    <td>{row.fonction_titre || row.id_fonction || '—'}</td>
                    <td className="num">{row.total}</td>
                    <td className="num">
                      <div className="part-cell">
                        <span>{row.part_pct}%</span>
                        <div className="part-bar" aria-hidden="true">
                          <div className="part-bar-fill" style={{ width: `${Math.min(100, row.part_pct)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="num">{row.nb_surplus}</td>
                    <td className="num">{row.nb_ferme_politique}</td>
                    <td className="num">{row.nb_ferme_db}</td>
                    <td className="num">{row.nb_zero_dispo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rdv-bypass-section">
        <h2>
          Détail des bypass
          {pagination.total > 0 && (
            <span className="section-meta">
              {' '}
              — {pagination.total} enregistrement{pagination.total > 1 ? 's' : ''}
              {pagination.pages > 1 && ` · page ${pagination.page}/${pagination.pages}`}
            </span>
          )}
        </h2>

        {error ? (
          <div className="error">
            <p>Erreur lors du chargement</p>
            <button type="button" onClick={() => refetch()}>
              Réessayer
            </button>
          </div>
        ) : isLoading && !data ? (
          <div className="loading">Chargement...</div>
        ) : rows.length === 0 ? (
          <div className="no-results">Aucun enregistrement.</div>
        ) : (
          <>
            <div className="rdv-bypass-table-wrap">
              <table className="rdv-bypass-table detail-table">
                <thead>
                  <tr>
                    <th>Date bypass</th>
                    <th>Utilisateur</th>
                    <th>Fonction</th>
                    <th>Fiche</th>
                    <th>Date RDV</th>
                    <th>Dép.</th>
                    <th>Créneau</th>
                    <th>Motifs</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.date_creation)}</td>
                      <td>{row.utilisateur_pseudo || `#${row.id_utilisateur}`}</td>
                      <td>{row.fonction_titre || row.id_fonction || '—'}</td>
                      <td>
                        {[row.fiche_nom, row.fiche_prenom].filter(Boolean).join(' ') || `#${row.id_fiche}`}
                        {row.fiche_cp ? (
                          <span className="fiche-meta">
                            {' '}
                            ({row.fiche_cp}
                            {row.fiche_ville ? ` ${row.fiche_ville}` : ''})
                          </span>
                        ) : null}
                      </td>
                      <td>{formatRdvDateTime(row.date_rdv) || formatDateTime(row.date_rdv)}</td>
                      <td>{row.dep || '—'}</td>
                      <td>
                        {(row.slot_hour || '').toString().slice(0, 5) || '—'}
                        {row.week != null ? (
                          <span className="fiche-meta">
                            {' '}
                            S{row.week}/{row.year}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="motif-badges">
                          {motifBadges(row).map((b) => (
                            <span key={b.key} className={`motif-badge ${b.className}`}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {(row.fiche_hash || row.id_fiche) && (
                          <FicheDetailLink
                            ficheHash={row.fiche_hash}
                            ficheId={row.id_fiche}
                            className="btn-detail"
                            title="Voir la fiche"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="rdv-bypass-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <span>
                  Page {pagination.page} / {pagination.pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default RdvCreneauCodeBypass;
