import React from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCalendarCheck, FaCalendarTimes, FaCalendarAlt } from 'react-icons/fa';
import './StatistiquesRDV.css';

const StatistiquesRDV = () => {
  const { user } = useAuth();

  // Récupérer les statistiques des RDV
  const { data: statsData, isLoading, error } = useQuery(
    'rdv-stats',
    async () => {
      const res = await api.get('/statistiques/dashboard');
      return res.data.data;
    },
    {
      refetchInterval: 60000, // Rafraîchir toutes les minutes
    }
  );

  if (isLoading) {
    return (
      <div className="statistiques-rdv-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistiques-rdv-page">
        <div className="error-container">
          <p>Erreur lors du chargement des statistiques</p>
          <button onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      </div>
    );
  }

  const stats = statsData || {
    rdvTodayConfirmed: 0,
    rdvTodayAnnuler: 0,
    rdvUpcoming: 0
  };

  return (
    <div className="statistiques-rdv-page">
      <div className="statistiques-rdv-header">
        <h1><FaCalendarAlt /> Statistiques des RDV</h1>
        <p>Vue d'ensemble des rendez-vous confirmés et à venir</p>
      </div>

      {/* Cartes de statistiques */}
      <div className="stats-cards">
        {/* RDV confirmés aujourd'hui */}
        <div className="stat-card stat-card-success">
          <div className="stat-card-icon">
            <FaCalendarCheck />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.rdvTodayConfirmed || 0}</div>
            <div className="stat-card-label">RDV Confirmés Aujourd'hui</div>
          </div>
        </div>

        {/* RDV annulés à reprogrammer aujourd'hui */}
        <div className="stat-card stat-card-warning">
          <div className="stat-card-icon">
            <FaCalendarTimes />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.rdvTodayAnnuler || 0}</div>
            <div className="stat-card-label">RDV Annulés à Reprogrammer Aujourd'hui</div>
          </div>
        </div>

        {/* RDV à venir */}
        <div className="stat-card stat-card-info">
          <div className="stat-card-icon">
            <FaCalendarAlt />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.rdvUpcoming || 0}</div>
            <div className="stat-card-label">RDV à Venir (Confirmés)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatistiquesRDV;

