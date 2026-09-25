import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch, FaUsers, FaUserTimes, FaSignOutAlt, FaTimes, FaUndo } from 'react-icons/fa';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './MonEquipe.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const getLocalTimeHm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatHeureDepart = (value) => {
  if (!value) return '';
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

const MonEquipe = () => {
  useForceDesktopViewport('mon-equipe-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [departModal, setDepartModal] = useState({ isOpen: false, agent: null, heure: getLocalTimeHm() });
  const fonctionId = Number(user?.fonction);
  const canManagePresence = [2, 12].includes(fonctionId);
  const showEquipeColumn = [12, 13].includes(fonctionId);

  useModalScrollLock(departModal.isOpen);

  const { data, isLoading, error } = useQuery(
    'utilisateurs-mon-equipe',
    async () => {
      const res = await api.get('/management/utilisateurs/mon-equipe');
      return res.data;
    },
    { enabled: !!user }
  );

  const presenceMutation = useMutation(
    async ({ id_agent, type, heure_depart }) => {
      const res = await api.post('/management/presence-agents-qualif', {
        id_agent,
        type,
        heure_depart,
      });
      return res.data;
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('utilisateurs-mon-equipe');
        toast.success(res.message || 'Présence enregistrée');
        setDepartModal({ isOpen: false, agent: null, heure: getLocalTimeHm() });
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
      },
    }
  );

  const cancelPresenceMutation = useMutation(
    async (id_agent) => {
      const res = await api.delete(`/management/presence-agents-qualif/${id_agent}`);
      return res.data;
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('utilisateurs-mon-equipe');
        toast.success(res.message || 'Présence annulée');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Erreur lors de l\'annulation');
      },
    }
  );

  const rows = data?.data || [];

  const subtitle =
    fonctionId === 14
      ? 'Confirmateurs rattachés à votre équipe.'
      : fonctionId === 13
        ? 'RE Confirmation et confirmateurs de votre équipe.'
        : fonctionId === 12
          ? 'Superviseurs et agents de votre plateau.'
          : 'Agents qualification rattachés à votre supervision.';

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const t = searchTerm.toLowerCase();
    return rows.filter(
      (r) =>
        r.pseudo?.toLowerCase().includes(t) ||
        r.nom?.toLowerCase().includes(t) ||
        r.prenom?.toLowerCase().includes(t) ||
        r.mail?.toLowerCase().includes(t) ||
        r.fonction_titre?.toLowerCase().includes(t) ||
        r.centre_titre?.toLowerCase().includes(t) ||
        r.supervisor_pseudo?.toLowerCase().includes(t)
    );
  }, [rows, searchTerm]);

  const openDepartModal = (agent) => {
    setDepartModal({
      isOpen: true,
      agent,
      heure: formatHeureDepart(agent.presence_aujourdhui?.heure_depart) || getLocalTimeHm(),
    });
  };

  const handleAbsence = (agent) => {
    const name = agent.pseudo || `${agent.nom || ''} ${agent.prenom || ''}`.trim() || 'cet agent';
    if (!window.confirm(`Signaler l'absence de ${name} pour aujourd'hui ?`)) return;
    presenceMutation.mutate({ id_agent: agent.id, type: 'absence' });
  };

  const handleDepartSubmit = (e) => {
    e.preventDefault();
    if (!departModal.agent) return;
    const heure = String(departModal.heure || '').trim();
    if (!heure) {
      toast.error("L'heure de départ est obligatoire");
      return;
    }
    presenceMutation.mutate({
      id_agent: departModal.agent.id,
      type: 'depart',
      heure_depart: heure,
    });
  };

  const handleCancelPresence = (agent) => {
    const name = agent.pseudo || `${agent.nom || ''} ${agent.prenom || ''}`.trim() || 'cet agent';
    if (!window.confirm(`Annuler le signalement de ${name} pour aujourd'hui ?`)) return;
    cancelPresenceMutation.mutate(agent.id);
  };

  const renderPresenceBadge = (presence) => {
    if (!presence) {
      return <span className="mon-equipe-badge mon-equipe-badge--ok">Présent</span>;
    }
    const coef = Number(presence.coefficient_presence);
    const coefLabel = Number.isFinite(coef) ? coef.toFixed(2) : null;
    if (presence.type === 'absence') {
      return (
        <span className="mon-equipe-badge mon-equipe-badge--absent" title="Coefficient 0">
          Absent{coefLabel != null ? ` (${coefLabel})` : ''}
        </span>
      );
    }
    return (
      <span
        className="mon-equipe-badge mon-equipe-badge--depart"
        title={
          Number.isFinite(Number(presence.heures_travaillees))
            ? `${presence.heures_travaillees}h / ${presence.heures_prevues}h`
            : undefined
        }
      >
        Départ {formatHeureDepart(presence.heure_depart)}
        {coefLabel != null ? ` (${coefLabel})` : ''}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner text="Chargement de l'équipe…" />;
  }

  if (error) {
    return (
      <div className="mon-equipe-page mon-equipe-error">
        <p>Impossible de charger la liste ({error.message || 'erreur'}).</p>
      </div>
    );
  }

  const colCount = 8 + (showEquipeColumn ? 1 : 0) + (canManagePresence ? 2 : 0);
  const isBusy = presenceMutation.isLoading || cancelPresenceMutation.isLoading;

  return (
    <div className="mon-equipe-page">
      <div className="mon-equipe-header">
        <h1>
          <FaUsers className="mon-equipe-header-icon" aria-hidden />
          Utilisateurs
        </h1>
        <p className="mon-equipe-subtitle">{subtitle}</p>
        {user?.pseudo && (
          <p className="mon-equipe-context">
            Connecté : <strong>{user.pseudo}</strong>
          </p>
        )}
      </div>

      <div className="mon-equipe-toolbar">
        <div className="mon-equipe-search">
          <FaSearch className="mon-equipe-search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Rechercher (pseudo, nom, e-mail, centre…)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filtrer la liste"
          />
        </div>
        <span className="mon-equipe-count">
          {filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="mon-equipe-table-wrap">
        <table className="mon-equipe-table">
          <thead>
            <tr>
              <th>Pseudo</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Fonction</th>
              {showEquipeColumn && <th>Équipe</th>}
              <th>Centre</th>
              <th>E-mail</th>
              <th>Téléphone</th>
              <th>État</th>
              {canManagePresence && (
                <>
                  <th>Présence</th>
                  <th>Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="mon-equipe-empty">
                  Aucun utilisateur rattaché pour le moment.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.pseudo || '—'}</td>
                  <td>{r.nom || '—'}</td>
                  <td>{r.prenom || '—'}</td>
                  <td>{r.fonction_titre || '—'}</td>
                  {showEquipeColumn && (
                    <td>{r.supervisor_pseudo || r.rp_qualif_pseudo || '—'}</td>
                  )}
                  <td>{r.centre_titre || '—'}</td>
                  <td>{r.mail || '—'}</td>
                  <td>{r.tel || '—'}</td>
                  <td>
                    {r.etat > 0 ? (
                      <span className="mon-equipe-badge mon-equipe-badge--ok">Actif</span>
                    ) : (
                      <span className="mon-equipe-badge">Inactif</span>
                    )}
                  </td>
                  {canManagePresence && (
                    <>
                      <td>{renderPresenceBadge(r.presence_aujourdhui)}</td>
                      <td>
                        <div className="mon-equipe-actions">
                          <button
                            type="button"
                            className="mon-equipe-action-btn mon-equipe-action-btn--absent"
                            onClick={() => handleAbsence(r)}
                            disabled={isBusy}
                            title="Signaler une absence aujourd'hui"
                          >
                            <FaUserTimes /> Absence
                          </button>
                          <button
                            type="button"
                            className="mon-equipe-action-btn mon-equipe-action-btn--depart"
                            onClick={() => openDepartModal(r)}
                            disabled={isBusy}
                            title="Signaler un départ dans la journée"
                          >
                            <FaSignOutAlt /> Départ
                          </button>
                          {r.presence_aujourdhui && (
                            <button
                              type="button"
                              className="mon-equipe-action-btn"
                              onClick={() => handleCancelPresence(r)}
                              disabled={isBusy}
                              title="Annuler le signalement du jour"
                            >
                              <FaUndo /> Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {departModal.isOpen && (
        <div
          className="mon-equipe-modal-overlay"
          onClick={() => setDepartModal({ isOpen: false, agent: null, heure: getLocalTimeHm() })}
        >
          <form
            className="mon-equipe-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleDepartSubmit}
          >
            <div className="mon-equipe-modal-header">
              <h3>Départ dans la journée</h3>
              <button
                type="button"
                className="mon-equipe-modal-close"
                onClick={() => setDepartModal({ isOpen: false, agent: null, heure: getLocalTimeHm() })}
                aria-label="Fermer"
              >
                <FaTimes />
              </button>
            </div>
            <p className="mon-equipe-modal-hint">
              Agent : <strong>{departModal.agent?.pseudo || '—'}</strong>
              {departModal.agent?.nom || departModal.agent?.prenom
                ? ` (${[departModal.agent?.nom, departModal.agent?.prenom].filter(Boolean).join(' ')})`
                : ''}
            </p>
            <label className="mon-equipe-modal-label" htmlFor="heure-depart">
              Heure de départ <span className="required">*</span>
            </label>
            <input
              id="heure-depart"
              type="time"
              required
              value={departModal.heure}
              onChange={(e) => setDepartModal((prev) => ({ ...prev, heure: e.target.value }))}
            />
            <div className="mon-equipe-modal-actions">
              <button
                type="button"
                className="mon-equipe-action-btn"
                onClick={() => setDepartModal({ isOpen: false, agent: null, heure: getLocalTimeHm() })}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="mon-equipe-action-btn mon-equipe-action-btn--depart"
                disabled={presenceMutation.isLoading || !departModal.heure}
              >
                {presenceMutation.isLoading ? 'Enregistrement…' : 'Valider le départ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MonEquipe;
