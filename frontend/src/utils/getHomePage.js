/**
 * Détermine la page d'accueil selon la fonction de l'utilisateur
 * @param {Object} user - L'objet utilisateur avec sa fonction
 * @param {Object} fonctionData - Les données de la fonction (avec page_accueil)
 * @param {Array} agentsSousResponsabilite - Liste des agents sous responsabilité (pour RE Qualification)
 * @returns {string} Le chemin de la page d'accueil
 */
export const getHomePage = (user, fonctionData = null, agentsSousResponsabilite = []) => {
  if (!user || !user.fonction) {
    return '/dashboard';
  }

  // Si on a les données de la fonction avec page_accueil, utiliser cette valeur
  if (fonctionData && fonctionData.page_accueil) {
    // Exception pour RE Qualification : si l'utilisateur a des agents sous sa responsabilité,
    // utiliser /suivi-agents-qualif au lieu de la page d'accueil configurée
    if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
      return '/suivi-agents-qualif';
    }
    return fonctionData.page_accueil;
  }

  // Fallback : logique par défaut si page_accueil n'est pas configurée
  const fonction = user.fonction;

  // Agent Qualification (fonction 3) : Page Fiches
  if (fonction === 3) {
    return '/fiches';
  }

  // Qualité Qualification (fonction 4) : Page Contrôle Qualité
  if (fonction === 4) {
    return '/controle-qualite';
  }

  // Commercial (fonction 5) : Page Planning Commercial
  if (fonction === 5) {
    return '/planning-commercial';
  }

  // RP Qualification (fonction 12) : Page Production Qualif
  if (fonction === 12) {
    return '/production-qualif';
  }

  // RE Qualification (superviseur avec agents sous sa responsabilité) : Page Suivi Agents Qualif
  // Vérifier si l'utilisateur a des agents sous sa responsabilité
  if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
    return '/suivi-agents-qualif';
  }

  // Par défaut : Dashboard
  return '/dashboard';
};

