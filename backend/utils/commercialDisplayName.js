/**
 * Libellé d'affichage d'un commercial : nom, sinon login (jamais le pseudo).
 * @param {{ nom?: string|null, login?: string|null }|null|undefined} user
 * @returns {string|null}
 */
function formatCommercialDisplayName(user) {
  if (!user) return null;
  const nom = user.nom != null ? String(user.nom).trim() : '';
  if (nom) return nom;
  const login = user.login != null ? String(user.login).trim() : '';
  return login || null;
}

/** Expression SQL : COALESCE(NULLIF(TRIM(alias.nom), ''), alias.login) */
function commercialDisplaySql(alias = 'u') {
  const a = String(alias).replace(/[^a-zA-Z0-9_]/g, '') || 'u';
  return `NULLIF(TRIM(COALESCE(NULLIF(TRIM(${a}.\`nom\`), ''), ${a}.\`login\`)), '')`;
}

module.exports = {
  formatCommercialDisplayName,
  commercialDisplaySql,
};
