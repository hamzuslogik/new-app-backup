import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch, FaCalendarAlt } from 'react-icons/fa';
import FicheDetailLink from '../components/FicheDetailLink';
import './RappelsBureau.css';

// État 19 = RAPPEL POUR BUREAU (date rappel stockée dans date_rdv_time)
const ETAT_RAPPEL_BUREAU = 19;
const FONCTION_CONFIRMATEUR = 6;
const FONCTION_RE_CONFIRMATION = 14;
const FONCTION_RP_CONFIRMATION = 13;

const RappelsBureau = () => {
  const { user } = useAuth();
  const isRPConfirmation = Number(user?.fonction) === FONCTION_RP_CONFIRMATION;

  if (!isRPConfirmation) {
    return <Navigate to="/dashboard" replace />;
  }

  const today = new Date().toISOString().split('T')[0];
  const [dateRappel, setDateRappel] = useState(today);
  const [idConfirmateurFilter, setIdConfirmateurFilter] = useState('all');

  // Récupérer tous les utilisateurs pour obtenir les confirmateurs sous les RE du RP
  const { data: usersData } = useQuery(
    'users-rappels-bureau',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data?.data || [];
    },
    { enabled: isRPConfirmation }
  );

  // Récupérer les RE sous le RP
  const reSousRP = (usersData)
    ? usersData.filter((u) => Number(u.chef_equipe) === Number(user?.id) && Number(u.fonction) === FONCTION_RE_CONFIRMATION && (u.etat > 0 || u.etat == null))
    : [];

  // Récupérer tous les confirmateurs sous les RE du RP
  const confirmateursSousRP = (usersData && reSousRP.length > 0)
    ? usersData.filter((u) => {
        const chefEquipeId = Number(u.chef_equipe);
        return reSousRP.some(re => Number(re.id) === chefEquipeId) && 
               Number(u.fonction) === FONCTION_CONFIRMATEUR && 
               (u.etat > 0 || u.etat == null);
      })
    : [];

  // Récupérer les fiches avec état 19 filtrées par date de rappel et confirmateur
  const { data, isLoading, error } = useQuery(
    ['rappels-bureau', dateRappel, idConfirmateurFilter],
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
      
      // Filtrer par confirmateur si sélectionné
      if (idConfirmateurFilter && idConfirmateurFilter !== 'all') {
        params.id_confirmateur = idConfirmateurFilter;
      }
      
      const res = await api.get('/fiches', { params });
      return res.data?.data || [];
    },
    {
      enabled: !!user?.id && isRPConfirmation && (idConfirmateurFilter === 'all' || !!idConfirmateurFilter),
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
    if (usersData) {
      const c = usersData.find((u) => Number(u.id) === Number(id));
      return c?.pseudo || fiche.confirmateur_pseudo || id;
    }
    return fiche.confirmateur_pseudo || id;
  };

  const getREPseudo = (fiche) => {
    if (!usersData) return '–';
    const confirmateurId = fiche.id_confirmateur;
    if (!confirmateurId) return '–';
    const conf = usersData.find((u) => Number(u.id) === Number(confirmateurId));
    if (!conf || !conf.chef_equipe) return '–';
    const re = reSousRP.find((u) => Number(u.id) === Number(conf.chef_equipe));
    return re?.pseudo || conf.chef_equipe;
  };

  return (
    <div className="rappels-bureau-page">
      <div className="rappels-bureau-header">
        <h1><FaCalendarAlt /> Rappels Bureau</h1>
        <p className="rappels-bureau-description">
          Rappels pour bureau des confirmateurs sous vos RE Confirmation, filtrés par date de rappel et par confirmateur (qualification « Rappel pour bureau »).
        </p>
      </div>

      <div className="rappels-bureau-filters">
        <div className="form-group">
          <label htmlFor="filter-confirmateur">Confirmateur :</label>
          <select
            id="filter-confirmateur"
            value={idConfirmateurFilter || 'all'}
            onChange={(e) => setIdConfirmateurFilter(e.target.value === 'all' ? 'all' : e.target.value)}
            className="form-control"
          >
            <option value="all">Tous les confirmateurs</option>
            {confirmateursSousRP.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.pseudo || `${c.nom || ''} ${c.prenom || ''}`.trim() || `#${c.id}`}
              </option>
            ))}
          </select>
        </div>
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

      <div className="rappels-bureau-content">
        {isLoading && <div className="rappels-bureau-loading">Chargement…</div>}
        {error && (
          <div className="rappels-bureau-error">
            Erreur lors du chargement : {error.message || 'Veuillez réessayer.'}
          </div>
        )}
        {!isLoading && !error && (
          <>
            {rappels.length === 0 ? (
              <div className="rappels-bureau-empty">
                {confirmateursSousRP.length === 0
                  ? 'Aucun confirmateur sous vos RE Confirmation.'
                  : 'Aucun rappel bureau pour les critères sélectionnés.'
                }
              </div>
            ) : (
              <div className="rappels-bureau-table-wrapper">
                <table className="rappels-bureau-table">
                  <thead>
                    <tr>
                      <th>RE Confirmation</th>
                      <th>Confirmateur</th>
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
                        <td data-label="RE Confirmation">{getREPseudo(fiche)}</td>
                        <td data-label="Confirmateur">{getConfirmateurPseudo(fiche)}</td>
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

export default RappelsBureau;
