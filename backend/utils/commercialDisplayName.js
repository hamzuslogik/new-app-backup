/**
 * Libellé d'affichage d'un commercial : pseudo (utilisateurs).
 * @param {{ pseudo?: string|null, nom?: string|null, login?: string|null }|null|undefined} user
 * @returns {string|null}
 */
function formatCommercialDisplayName(user) {
  if (!user) return null;
  const pseudo = user.pseudo != null ? String(user.pseudo).trim() : '';
  if (pseudo) return pseudo;
  const login = user.login != null ? String(user.login).trim() : '';
  if (login) return login;
  const nom = user.nom != null ? String(user.nom).trim() : '';
  return nom || null;
}

/** Expression SQL : pseudo (repli login puis nom si vide) */
function commercialDisplaySql(alias = 'u') {
  const a = String(alias).replace(/[^a-zA-Z0-9_]/g, '') || 'u';
  return `NULLIF(TRIM(COALESCE(NULLIF(TRIM(${a}.\`pseudo\`), ''), NULLIF(TRIM(${a}.\`login\`), ''), ${a}.\`nom\`)), '')`;
}

module.exports = {
  formatCommercialDisplayName,
  commercialDisplaySql,
};
