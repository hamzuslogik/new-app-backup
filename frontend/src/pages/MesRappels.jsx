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

const MesRappels = () => {
  const { user } = useAuth();

  if (Number(user?.fonction) !== 6) {
    return <Navigate to="/dashboard" replace />;
  }

  const today = new Date().toISOString().split('T')[0];
  const [dateRappel, setDateRappel] = useState(today);

  const { data, isLoading, error } = useQuery(
    ['mes-rappels', dateRappel, user?.id],
    async () => {
      const params = {
        fiche_search: 1,
        id_etat_final: ETAT_RAPPEL_BUREAU,
        id_confirmateur: user?.id,
        date_champ: 'date_rdv_time',
        date_debut: dateRappel,
        date_fin: dateRappel,
        time_debut: '00:00:00',
        time_fin: '23:59:59',
        limit: 9999,
        page: 1,
      };
      const res = await api.get('/fiches', { params });
      return res.data?.data || [];
    },
    { enabled: !!user?.id }
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

  return (
    <div className="mes-rappels-page">
      <div className="mes-rappels-header">
        <h1>Mes rappels</h1>
        <p className="mes-rappels-description">
          Rappels bureau du confirmateur connecté, filtrés par la date de rappel indiquée lors de la qualification « Rappel pour bureau ».
        </p>
      </div>

      <div className="mes-rappels-filters">
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
                Aucun rappel bureau pour la date sélectionnée.
              </div>
            ) : (
              <div className="mes-rappels-table-wrapper">
                <table className="mes-rappels-table">
                  <thead>
                    <tr>
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
