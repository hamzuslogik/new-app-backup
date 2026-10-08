/**
 * Libellé d'affichage d'un commercial : nom, sinon login (jamais le pseudo).
 * @param {{ nom?: string|null, login?: string|null }|null|undefined} user
 * @returns {string}
 */
export function formatCommercialDisplayName(user) {
  if (!user) return '';
  const nom = user.nom != null ? String(user.nom).trim() : '';
  if (nom) return nom;
  const login = user.login != null ? String(user.login).trim() : '';
  return login;
}
