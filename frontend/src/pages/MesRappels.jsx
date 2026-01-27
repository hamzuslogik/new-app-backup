import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import './MesRappels.css';

// État 19 = RAPPEL POUR BUREAU (date rappel stockée dans date_rdv_time)
const ETAT_RAPPEL_BUREAU = 19;
const FONCTION_CONFIRMATEUR = 6;
const FONCTION_RE_CONFIRMATION = 14;
const FONCTION_RP_CONFIRMATION = 15;

const MesRappels = () => {
  const { user } = useAuth();
  const isConfirmateur = Number(user?.fonction) === FONCTION_CONFIRMATEUR;
  const isREConfirmation = Number(user?.fonction) === FONCTION_RE_CONFIRMATION;
  const isRPConfirmation = Number(user?.fonction) === FONCTION_RP_CONFIRMATION;

  if (!isConfirmateur && !isREConfirmation && !isRPConfirmation) {
    return <Navigate to="/dashboard" replace />;
  }

  const today = new Date().toISOString().split('T')[0];
  const [dateRappel, setDateRappel] = useState(today);
  const [idConfirmateurFilter, setIdConfirmateurFilter] = useState(isREConfirmation ? 'all' : null);
  const [idREFilter, setIdREFilter] = useState(isRPConfirmation ? 'all' : null);

  // Utilisateurs pour RE (équipe) et RP (liste des RE sous le RP)
  const { data: usersData } = useQuery(
    'users-mes-rappels',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data?.data || [];
    },
    { enabled: isREConfirmation || isRPConfirmation }
  );

  const confirmateursEquipe = (isREConfirmation && usersData)
    ? usersData.filter((u) => Number(u.chef_equipe) === Number(user?.id) && Number(u.fonction) === FONCTION_CONFIRMATEUR && (u.etat > 0 || u.etat == null))
    : [];

  const reSousRP = (isRPConfirmation && usersData)
    ? usersData.filter((u) => Number(u.chef_equipe) === Number(user?.id) && Number(u.fonction) === FONCTION_RE_CONFIRMATION && (u.etat > 0 || u.etat == null))
    : [];

  const { data, isLoading, error } = useQuery(
    ['mes-rappels', dateRappel, user?.id, idConfirmateurFilter, idREFilter],
    async () => {
      const params = {
        fiche_search: 1,
        id_etat_final: ETAT_RAPPEL_BUREAU,
        date_champ: 'date_rdv_time',
        date_debut: dateRappel,
        date_fin: dateRappel,
        time_debut: '00:00:00',
        time_fin: '23:59:59',
        limit: 9999,
        page: 1,
      };
      if (isConfirmateur) {
        params.id_confirmateur = user?.id;
      } else if (isREConfirmation) {
        if (idConfirmateurFilter && idConfirmateurFilter !== 'all') {
          params.id_confirmateur = idConfirmateurFilter;
        }
      } else if (isRPConfirmation) {
        if (idREFilter && idREFilter !== 'all') {
          params.id_re = idREFilter;
        }
      }
      const res = await api.get('/fiches', { params });
      return res.data?.data || [];
    },
    {
      enabled:
        !!user?.id &&
        (isConfirmateur ||
          (isREConfirmation && (idConfirmateurFilter === 'all' || !!idConfirmateurFilter)) ||
          (isRPConfirmation && (idREFilter === 'all' || !!idREFilter))),
    }
  );

  const rappels = data || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return '–';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConfirmateurPseudo = (fiche) => {
    const id = fiche.id_confirmateur;
    if (!id) return '–';
    if (isREConfirmation) {
      const c = confirmateursEquipe.find((u) => Number(u.id) === Number(id));
      return c?.pseudo || fiche.confirmateur_pseudo || id;
    }
    if (isRPConfirmation && usersData) {
      const c = usersData.find((u) => Number(u.id) === Number(id));
      return c?.pseudo || fiche.confirmateur_pseudo || id;
    }
    return fiche.confirmateur_pseudo || id;
  };

  const getREPseudo = (fiche) => {
    if (!isRPConfirmation || !usersData) return '–';
    const confirmateurId = fiche.id_confirmateur;
    if (!confirmateurId) return '–';
    const conf = usersData.find((u) => Number(u.id) === Number(confirmateurId));
    if (!conf || !conf.chef_equipe) return '–';
    const re = reSousRP.find((u) => Number(u.id) === Number(conf.chef_equipe));
    return re?.pseudo || conf.chef_equipe;
  };

  const titre =
    isRPConfirmation ? 'Rappels par RE' : isREConfirmation ? "Rappels de l'équipe" : 'Mes rappels';

  const description = isRPConfirmation
    ? 'Rappels bureau des confirmateurs de vos RE Confirmation, filtrés par RE et par date de rappel (qualification « Rappel pour bureau »).'
    : isREConfirmation
      ? "Rappels bureau des confirmateurs de votre équipe, filtrés par confirmateur et par date de rappel (qualification « Rappel pour bureau »)."
      : 'Rappels bureau du confirmateur connecté, filtrés par la date de rappel indiquée lors de la qualification « Rappel pour bureau ».';

  return (
    <div className="mes-rappels-page">
      <div className="mes-rappels-header">
        <h1>{titre}</h1>
        <p className="mes-rappels-description">{description}</p>
      </div>

      <div className="mes-rappels-filters">
        {isRPConfirmation && (
          <div className="form-group">
            <label htmlFor="filter-re">RE Confirmation :</label>
            <select
              id="filter-re"
              value={idREFilter || 'all'}
              onChange={(e) => setIdREFilter(e.target.value === 'all' ? 'all' : e.target.value)}
              className="form-control"
            >
              <option value="all">Tous</option>
              {reSousRP.map((re) => (
                <option key={re.id} value={String(re.id)}>
                  {re.pseudo || `${re.nom || ''} ${re.prenom || ''}`.trim() || `#${re.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {isREConfirmation && (
          <div className="form-group">
            <label htmlFor="filter-confirmateur">Confirmateur :</label>
            <select
              id="filter-confirmateur"
              value={idConfirmateurFilter || 'all'}
              onChange={(e) => setIdConfirmateurFilter(e.target.value === 'all' ? 'all' : e.target.value)}
              className="form-control"
            >
              <option value="all">Tous</option>
              {confirmateursEquipe.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.pseudo || `${c.nom || ''} ${c.prenom || ''}`.trim() || `#${c.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group">
          <label htmlFor="date-rappel">Date de rappel :</label>
          <input
            id="date-rappel"
            type="date"
            value={dateRappel}
            onChange={(e) => setDateRappel(e.target.value)}
            className="form-control"
          />
        </div>
      </div>

      <div className="mes-rappels-content">
        {isLoading && <div className="mes-rappels-loading">Chargement…</div>}
        {error && (
          <div className="mes-rappels-error">
            Erreur lors du chargement : {error.message || 'Veuillez réessayer.'}
          </div>
        )}
        {!isLoading && !error && (
          <>
            {rappels.length === 0 ? (
              <div className="mes-rappels-empty">
                {isRPConfirmation && idREFilter === 'all' && reSousRP.length === 0
                  ? 'Aucun RE Confirmation sous votre responsabilité.'
                  : isREConfirmation && idConfirmateurFilter === 'all' && confirmateursEquipe.length === 0
                    ? 'Aucun confirmateur dans votre équipe.'
                    : 'Aucun rappel bureau pour les critères sélectionnés.'
                }
              </div>
            ) : (
              <div className="mes-rappels-table-wrapper">
                <table className="mes-rappels-table">
                  <thead>
                    <tr>
                      {isRPConfirmation && <th>RE Confirmation</th>}
                      {(isREConfirmation || isRPConfirmation) && <th>Confirmateur</th>}
                      <th>Civ.</th>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Téléphone</th>
                      <th>À rappeler le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rappels.map((fiche) => (
                      <tr key={fiche.hash || fiche.id}>
                        {isRPConfirmation && (
                          <td data-label="RE Confirmation">{getREPseudo(fiche)}</td>
                        )}
                        {(isREConfirmation || isRPConfirmation) && (
                          <td data-label="Confirmateur">{getConfirmateurPseudo(fiche)}</td>
                        )}
                        <td data-label="Civ.">{fiche.civ || '–'}</td>
                        <td data-label="Nom">{fiche.nom || '–'}</td>
                        <td data-label="Prénom">{fiche.prenom || '–'}</td>
                        <td data-label="Téléphone">{fiche.tel || fiche.gsm1 || '–'}</td>
                        <td data-label="À rappeler le">{formatDate(fiche.date_rdv_time)}</td>
                        <td data-label="Actions">
                          <FicheDetailLink ficheHash={fiche.hash} className="btn-icon" title="Voir la fiche">
                            <FaSearch style={{ color: '#fff', fontSize: '13px' }} />
                          </FicheDetailLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MesRappels;
