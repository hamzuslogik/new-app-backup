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
