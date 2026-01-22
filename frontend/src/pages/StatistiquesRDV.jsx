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
      try {
        const res = await api.get('/statistiques/dashboard');
        console.log('Statistiques RDV reçues:', res.data);
        if (res.data && res.data.success && res.data.data) {
          return res.data.data;
        }
        // Si la structure est différente, retourner les données directement
        return res.data.data || res.data || {};
      } catch (err) {
        console.error('Erreur lors de la récupération des statistiques RDV:', err);
        throw err;
      }
    },
    {
      refetchInterval: 60000, // Rafraîchir toutes les minutes
      retry: 2, // Réessayer 2 fois en cas d'erreur
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
    console.error('Erreur dans StatistiquesRDV:', error);
    return (
      <div className="statistiques-rdv-page">
        <div className="error-container">
          <p>Erreur lors du chargement des statistiques</p>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            {error.response?.data?.message || error.message || 'Erreur inconnue'}
          </p>
          <button onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      </div>
    );
  }

  // Extraire les statistiques avec des valeurs par défaut
  const stats = statsData ? {
    rdvTodayConfirmed: statsData.rdvTodayConfirmed || 0,
    rdvTodayAnnuler: statsData.rdvTodayAnnuler || 0,
    rdvUpcoming: statsData.rdvUpcoming || 0
  } : {
    rdvTodayConfirmed: 0,
    rdvTodayAnnuler: 0,
    rdvUpcoming: 0
  };

  console.log('Stats affichées:', stats);

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
            <div className="stat-card-value">{stats.rdvTodayConfirmed}</div>
            <div className="stat-card-label">RDV Confirmés Aujourd'hui</div>
          </div>
        </div>

        {/* RDV annulés à reprogrammer aujourd'hui */}
        <div className="stat-card stat-card-warning">
          <div className="stat-card-icon">
            <FaCalendarTimes />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.rdvTodayAnnuler}</div>
            <div className="stat-card-label">RDV Annulés à Reprogrammer Aujourd'hui</div>
          </div>
        </div>

        {/* RDV à venir */}
        <div className="stat-card stat-card-info">
          <div className="stat-card-icon">
            <FaCalendarAlt />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.rdvUpcoming}</div>
            <div className="stat-card-label">RDV à Venir (Confirmés)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatistiquesRDV;

