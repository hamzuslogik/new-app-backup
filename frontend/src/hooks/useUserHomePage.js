import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { getHomePage } from '../utils/getHomePage';

/**
 * Renvoie la page d'accueil de l'utilisateur connecté en suivant la même
 * logique que `HomeRedirect` (lit `page_accueil` côté fonction, gère le cas
 * RE Qualification avec agents sous responsabilité, et retombe sur la
 * logique par défaut de `getHomePage`).
 */
const useUserHomePage = () => {
  const { user } = useAuth();

  const { data: fonctionData } = useQuery(
    ['fonction-data', user?.fonction],
    async () => {
      const res = await api.get('/management/fonctions');
      return res.data.data?.find((f) => f.id === user?.fonction) || null;
    },
    { enabled: !!user && !!user.fonction, staleTime: 5 * 60 * 1000 }
  );

  // Les fonctions 3, 4, 5, 12 ont une page d'accueil déterministe ; on évite
  // l'appel inutile vers /management/utilisateurs dans ces cas.
  const needsAgents =
    !!user &&
    user.fonction !== 3 &&
    user.fonction !== 4 &&
    user.fonction !== 5 &&
    user.fonction !== 12;

  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite-home-shared',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter((u) => u.chef_equipe === user?.id && u.fonction === 3) || [];
    },
    { enabled: needsAgents, staleTime: 5 * 60 * 1000 }
  );

  if (!user) return '/dashboard';
  return getHomePage(user, fonctionData, agentsSousResponsabilite || []);
};

export default useUserHomePage;
