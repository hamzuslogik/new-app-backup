import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import './MesRappels.css';

// État 19 = RAPPEL POUR BUREAU (date rappel stockée dans date_rdv_time)
const ETAT_RAPPEL_BUREAU = 19;
// État 8 = Annuler à reprogrammer
const ETAT_ANNULER_A_REPROGRAMMER = 8;
// État 9 = Client honoré à suivre
const ETAT_HONORE_A_SUIVRE = 9;
const FONCTION_CONFIRMATEUR = 6;
const FONCTION_RE_CONFIRMATION = 14;
const FONCTION_RP_CONFIRMATION = 13;

const MesRappels = () => {
  const { user } = useAuth();
  const isConfirmateur = Number(user?.fonction) === FONCTION_CONFIRMATEUR;
  const isREConfirmation = Number(user?.fonction) === FONCTION_RE_CONFIRMATION;
  const isRPConfirmation = Number(user?.fonction) === FONCTION_RP_CONFIRMATION;

  if (!isConfirmateur && !isREConfirmation && !isRPConfirmation) {
    return <Navigate to="/dashboard" replace />;
  }

  const today = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('bureau'); // 'bureau' | 'annuler_repro' | 'honore_suivre'
  const [dateRappel, setDateRappel] = useState(today);
  const [idConfirmateurFilter, setIdConfirmateurFilter] = useState(isREConfirmation ? 'all' : null);
  const [idREFilter, setIdREFilter] = useState(isRPConfirmation ? 'all' : null);
  const [origineFilter, setOrigineFilter] = useState(''); // '' | 'compte_rendu' | 'repro_confirmateurs' (onglets repro / honoré)

  const etatIdForTab =
    activeTab === 'annuler_repro'
      ? ETAT_ANNULER_A_REPROGRAMMER
      : activeTab === 'honore_suivre'
        ? ETAT_HONORE_A_SUIVRE
        : ETAT_RAPPEL_BUREAU;

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
    ['mes-rappels', activeTab, etatIdForTab, dateRappel, user?.id, idConfirmateurFilter, idREFilter, origineFilter],
    async () => {
      const params = {
        fiche_search: 1,
        id_etat_final: etatIdForTab,
        date_champ: 'date_rdv_time',
        date_debut: dateRappel,
        date_fin: dateRappel,
        time_debut: '00:00:00',
        time_fin: '23:59:59',
        limit: 9999,
        page: 1,
      };
      if (
        origineFilter &&
        (activeTab === 'annuler_repro' || activeTab === 'honore_suivre')
      ) {
        params.annuler_repro_type = origineFilter;
      }
      if (isConfirmateur) {
        params.id_confirmateur = user?.id;
        // API confirmateur : inclure fiches où le connecté est conf. 2 ou 3 (sinon seul id_confirmateur est testé)
        params.include_confirmateur_2 = 1;
      } else if (isREConfirmation) {
        if (idConfirmateurFilter && idConfirmateurFilter !== 'all') {
          params.id_confirmateur = idConfirmateurFilter;
          params.include_confirmateur_2 = 1;
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

  const descriptionBureau = isRPConfirmation
    ? 'Rappels bureau des confirmateurs de vos RE Confirmation, filtrés par RE et par date de rappel (qualification « Rappel pour bureau »).'
    : isREConfirmation
      ? "Rappels bureau des confirmateurs de votre équipe, filtrés par confirmateur et par date de rappel (qualification « Rappel pour bureau »)."
    : '';

  const descriptionAnnuler = isRPConfirmation
    ? 'Fiches en « Annuler à reprogrammer », filtrées par RE et par date de rappel. La colonne Origine indique si le passage à cet état provient d’un compte rendu.'
    : isREConfirmation
      ? "Fiches en « Annuler à reprogrammer », filtrées par confirmateur et par date de rappel. La colonne Origine indique si le passage à cet état provient d’un compte rendu."
    : '';

  const descriptionHonore = isRPConfirmation
    ? 'Fiches en « Honoré à suivre », filtrées par RE et par date de rappel. La colonne Origine indique si le passage à cet état provient d’un compte rendu.'
    : isREConfirmation
      ? "Fiches en « Honoré à suivre », filtrées par confirmateur et par date de rappel. La colonne Origine indique si le passage à cet état provient d’un compte rendu."
      : 'Fiches en « Honoré à suivre » vous concernant, filtrées par la date de rappel. La colonne Origine indique si le passage à cet état provient d’un compte rendu.';

  const description =
    activeTab === 'annuler_repro'
      ? descriptionAnnuler
      : activeTab === 'honore_suivre'
        ? descriptionHonore
        : descriptionBureau;

  const origineLabel = (fiche) =>
    fiche.current_state_from_compte_rendu === true ? 'Compte rendu' : 'Repro confirmateurs';

  return (
    <div className="mes-rappels-page">
      <div className="mes-rappels-header">
        <h1>{titre}</h1>
        <p className="mes-rappels-description">{description}</p>
      </div>

      <div className="mes-rappels-tabs" role="tablist" aria-label="Type de rappels">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bureau'}
          className={`mes-rappels-tab ${activeTab === 'bureau' ? 'mes-rappels-tab--active' : ''}`}
          onClick={() => setActiveTab('bureau')}
        >
          Rappel pour bureau
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'annuler_repro'}
          className={`mes-rappels-tab ${activeTab === 'annuler_repro' ? 'mes-rappels-tab--active' : ''}`}
          onClick={() => setActiveTab('annuler_repro')}
        >
          Annuler à reprogrammer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'honore_suivre'}
          className={`mes-rappels-tab ${activeTab === 'honore_suivre' ? 'mes-rappels-tab--active' : ''}`}
          onClick={() => setActiveTab('honore_suivre')}
        >
          Honoré à suivre
        </button>
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
                    : activeTab === 'annuler_repro'
                      ? 'Aucune fiche « Annuler à reprogrammer » pour les critères sélectionnés.'
                      : activeTab === 'honore_suivre'
                        ? 'Aucune fiche « Honoré à suivre » pour les critères sélectionnés.'
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
                      {(activeTab === 'annuler_repro' || activeTab === 'honore_suivre') && <th>Origine</th>}
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
                        {(activeTab === 'annuler_repro' || activeTab === 'honore_suivre') && (
                          <td data-label="Origine">
                            <span
                              className={
                                fiche.current_state_from_compte_rendu === true
                                  ? 'mes-rappels-origine mes-rappels-origine--cr'
                                  : 'mes-rappels-origine mes-rappels-origine--repro'
                              }
                            >
                              {origineLabel(fiche)}
                            </span>
                          </td>
                        )}
                        <td data-label="Civ.">{fiche.civ || '–'}</td>
                        <td data-label="Nom">{fiche.nom || '–'}</td>
                        <td data-label="Prénom">{fiche.prenom || '–'}</td>
                        <td data-label="Téléphone">{fiche.tel || fiche.gsm1 || '–'}</td>
                        <td data-label="À rappeler le">{formatRdvDateTime(fiche.date_rdv_time)}</td>
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
