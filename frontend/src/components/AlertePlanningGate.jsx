import React from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import AlertePlanning from '../pages/AlertePlanning';

/** Rôles autorisés à gérer les alertes planning (hors superviseur RE qualif / RE qualification). */
const ALLOWED_FONCTIONS = [1, 7, 11, 13, 14];

/**
 * Même règle que la sidebar : pas d'accès pour fonction 2 ni pour un utilisateur
 * qui supervise au moins un agent qualification (fonction 3).
 */
const AlertePlanningGate = () => {
  const { user, loading } = useAuth();

  const { data: agentsSousResponsabilite, isLoading } = useQuery(
    'agents-sous-responsabilite-sidebar',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter((u) => u.chef_equipe === user?.id && u.fonction === 3) || [];
    },
    { enabled: !!user }
  );

  if (loading || (isLoading && !!user)) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        Chargement...
      </div>
    );
  }

  const f = Number(user?.fonction);
  const isREQualif = agentsSousResponsabilite && agentsSousResponsabilite.length > 0;

  if (f === 2 || isREQualif || !ALLOWED_FONCTIONS.includes(f)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AlertePlanning />;
};

export default AlertePlanningGate;
