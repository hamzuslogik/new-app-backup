/**
 * Libellé d'affichage d'un commercial : pseudo (utilisateurs).
 * @param {{ pseudo?: string|null, nom?: string|null, login?: string|null }|null|undefined} user
 * @returns {string}
 */
export function formatCommercialDisplayName(user) {
  if (!user) return '';
  const pseudo = user.pseudo != null ? String(user.pseudo).trim() : '';
  if (pseudo) return pseudo;
  const login = user.login != null ? String(user.login).trim() : '';
  if (login) return login;
  const nom = user.nom != null ? String(user.nom).trim() : '';
  return nom;
}
