import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch, FaUsers } from 'react-icons/fa';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './MonEquipe.css';

const MonEquipe = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery(
    'utilisateurs-mon-equipe',
    async () => {
      const res = await api.get('/management/utilisateurs/mon-equipe');
      return res.data;
    },
    { enabled: !!user }
  );

  const rows = data?.data || [];

  const subtitle =
    Number(user?.fonction) === 14
      ? 'Confirmateurs rattachés à votre équipe (lecture seule).'
      : 'Agents qualification rattachés à votre supervision (lecture seule).';

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
        r.centre_titre?.toLowerCase().includes(t)
    );
  }, [rows, searchTerm]);

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
              <th>Centre</th>
              <th>E-mail</th>
              <th>Téléphone</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="mon-equipe-empty">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonEquipe;
