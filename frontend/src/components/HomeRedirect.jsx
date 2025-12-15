import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getHomePage } from '../utils/getHomePage';
import api from '../config/api';
import { useQuery } from 'react-query';

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  const [homePage, setHomePage] = useState('/dashboard');

  // Récupérer les données de la fonction (avec page_accueil)
  const { data: fonctionData, isLoading: isLoadingFonction } = useQuery(
    ['fonction-data', user?.fonction],
    async () => {
      const res = await api.get('/management/fonctions');
      return res.data.data?.find(f => f.id === user?.fonction) || null;
    },
    { enabled: !!user && !!user.fonction }
  );

  // Pour RE Qualification, vérifier s'il a des agents sous sa responsabilité
  const { data: agentsSousResponsabilite, isLoading: isLoadingAgents } = useQuery(
    'agents-sous-responsabilite-home',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter(u => u.chef_equipe === user?.id && u.fonction === 3) || [];
    },
    { 
      enabled: !!user && user?.fonction !== 3 && user?.fonction !== 4 && user?.fonction !== 5 && user?.fonction !== 12 
    }
  );

  useEffect(() => {
    if (user && !loading && !isLoadingFonction) {
      // Si on attend les agents (RE Qualification), attendre qu'ils soient chargés
      const needsAgents = user.fonction !== 3 && user.fonction !== 4 && user.fonction !== 5 && user.fonction !== 12;
      if (needsAgents && isLoadingAgents) {
        return; // Attendre que les agents soient chargés
      }
      
      const page = getHomePage(user, fonctionData, agentsSousResponsabilite || []);
      setHomePage(page);
    }
  }, [user, loading, fonctionData, isLoadingFonction, agentsSousResponsabilite, isLoadingAgents]);

  // Afficher un loader pendant le chargement
  if (loading || isLoadingFonction || (user && user.fonction !== 3 && user.fonction !== 4 && user.fonction !== 5 && user.fonction !== 12 && isLoadingAgents)) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Chargement...</div>
      </div>
    );
  }

  return <Navigate to={homePage} replace />;
};

export default HomeRedirect;

