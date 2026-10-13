/**
 * Backoffice dont le menu / les pages autorisées sont limités
 * à ceux de la session RP Qualification (fonction 12),
 * tout en conservant le contenu / layout backoffice (fonction 11).
 */

export const BACKOFFICE_NAV_AS_RP_QUALIF_USER_IDS = [4180];

/** Fonction RP Qualification */
export const RP_QUALIF_FONCTION = 12;

/**
 * Pages du menu RP Qualification (aligné sidebar + routes allowFunctions […, 12]).
 * Les sous-routes fiche détail restent accessibles si /fiches est autorisé.
 */
export const RP_QUALIF_NAV_PATHS = new Set([
  '/fiches',
  '/production-qualif',
  '/suivi-agents',
  '/suivi-agents-qualif',
  '/kpi-qualification',
  '/alertes',
  '/remarques',
  '/mon-equipe',
  '/mon-profil',
  '/messages',
  '/notifications',
]);

export function isBackofficeNavAsRpQualif(user) {
  return (
    Number(user?.fonction) === 11 &&
    BACKOFFICE_NAV_AS_RP_QUALIF_USER_IDS.includes(Number(user?.id))
  );
}

/** Utilisateur synthétique pour les contrôles de menu / allowFunctions (nav uniquement). */
export function getNavUser(user) {
  if (!user || !isBackofficeNavAsRpQualif(user)) return user;
  return { ...user, fonction: RP_QUALIF_FONCTION };
}

export function normalizeAppPath(pathname) {
  if (!pathname) return '/';
  const base = String(pathname).split('?')[0];
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/';
}

/** True si le chemin est autorisé pour le backoffice restreint (menu RP Qualif). */
export function isPathAllowedForRestrictedBackofficeNav(pathname) {
  const path = normalizeAppPath(pathname);
  if (RP_QUALIF_NAV_PATHS.has(path)) return true;
  // Détail fiche : /fiches/:id
  if (path.startsWith('/fiches/')) return true;
  return false;
}

/** Page d'accueil forcée (comme RP Qualification). */
export function getRestrictedBackofficeHomePath() {
  return '/production-qualif';
}
