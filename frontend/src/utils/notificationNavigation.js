/**
 * Pages prédéfinies pour le clic sur une notification (workflow / métadonnées).
 * Valeur stockée : slug sans slash (ex. compte-rendu) ou chemin absolu (ex. /compte-rendu).
 */
export const NOTIFICATION_LINK_PAGE_PRESETS = [
  { value: '', label: 'Ouvrir la fiche liée (défaut)' },
  { value: 'compte-rendu', label: 'Compte rendu' },
  { value: 'compte-rendu-pending', label: 'Compte rendu en attente' },
  { value: 'controle-qualite', label: 'Contrôle qualité' },
  { value: 'alertes', label: 'Alertes' },
  { value: 'remarques', label: 'Remarques' },
  { value: 'decalages', label: 'Décalages' },
  { value: 'demandes-insertion', label: 'Demandes d’insertion' },
  { value: 'planning', label: 'Planning' },
  { value: 'planning-commercial', label: 'Planning commercial' },
  { value: 'fiches', label: 'Liste des fiches' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'notifications', label: 'Page notifications' },
  { value: 'validation', label: 'Validation' },
  { value: 'messages', label: 'Messages' },
];

/**
 * Résout l’URL de navigation depuis les métadonnées d’une notification (GET /notifications).
 * @returns {string|null} chemin commençant par / ou null pour utiliser le comportement fiche par défaut.
 */
export function getNotificationClickPath(notification) {
  let meta = notification?.metadata;
  if (meta == null) return null;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      return null;
    }
  }
  if (!meta || typeof meta !== 'object') return null;
  const path = meta.link_path;
  if (typeof path !== 'string' || !path.startsWith('/')) return null;
  if (path.includes('://') || path.toLowerCase().startsWith('//')) return null;
  return path;
}

/**
 * Ajoute ?overlay=auto aux chemins /fiches/:hash pour ouvrir la fiche en modal.
 */
export function withFicheOverlayAuto(path) {
  if (typeof path !== 'string' || !path.startsWith('/fiches/')) {
    return path;
  }
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex + 1) : '';
  if (!/^\/fiches\/[^/]+$/.test(pathname)) {
    return path;
  }
  const params = new URLSearchParams(search);
  const overlay = params.get('overlay');
  if (overlay === '1' || overlay === 'auto') {
    return path;
  }
  params.set('overlay', 'auto');
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : `${pathname}?overlay=auto`;
}

/** URL fiche en modal (overlay=auto). */
export function getFicheOverlayPath(hash) {
  if (hash == null || hash === '') return null;
  return withFicheOverlayAuto(`/fiches/${hash}`);
}

/**
 * Chemin de navigation au clic sur une notification (fiche → modal overlay=auto).
 * @returns {string|null}
 */
export function resolveNotificationNavigationPath(notification) {
  const customPath = getNotificationClickPath(notification);
  if (customPath) {
    return withFicheOverlayAuto(customPath);
  }
  if (notification?.hash && notification?.fiche_id) {
    return getFicheOverlayPath(notification.hash);
  }
  return null;
}

/** Extrait hash + options depuis un chemin /fiches/:hash?overlay=auto */
export function parseFicheNavigationFromPath(path) {
  if (typeof path !== 'string') return null;
  const match = path.match(/^\/fiches\/([^/?#]+)(?:\?(.*))?$/);
  if (!match) return null;
  const hash = decodeURIComponent(match[1]);
  const params = new URLSearchParams(match[2] || '');
  const closeMode = params.get('close');
  return {
    hash,
    options: closeMode != null && closeMode !== '' ? { closeMode } : {},
  };
}

/**
 * Navigation au clic notification : fiche → modal (openFicheDetail), sinon navigate().
 * @returns {boolean} true si une navigation a été effectuée
 */
export function navigateFromNotification(notification, { navigate, openFicheDetail }) {
  const path = resolveNotificationNavigationPath(notification);
  if (!path) return false;

  const ficheNav = parseFicheNavigationFromPath(path);
  if (ficheNav && typeof openFicheDetail === 'function') {
    openFicheDetail(ficheNav.hash, ficheNav.options);
    return true;
  }

  navigate(path);
  return true;
}
