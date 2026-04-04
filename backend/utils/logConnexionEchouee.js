const { query } = require('../config/database');
const { getClientIp, normalizeClientIp } = require('./ipAllowlist');

/** Codes stockés dans connexions_echouees.raison_echec */
const RAISON = {
  LOGIN_INCONNU: 'login_inconnu',
  MOT_DE_PASSE_INCORRECT: 'mot_de_passe_incorrect',
  IP_NON_AUTORISEE: 'ip_non_autorisee',
  COMPTE_OU_FONCTION_CENTRE_DESACTIVE: 'compte_ou_fonction_centre_desactive'
};

/**
 * Enregistre une tentative échouée (ne propage pas l'erreur vers l'appelant).
 * @param {{ login?: string|null, idUtilisateur?: number|null, req: import('express').Request, raison: string }} p
 */
async function logConnexionEchouee({ login, idUtilisateur, req, raison }) {
  try {
    const ip = normalizeClientIp(getClientIp(req));
    const loginStr =
      login != null && String(login).trim() !== '' ? String(login).trim().slice(0, 128) : null;
    await query(
      `INSERT INTO connexions_echouees (login, id_utilisateur, adresse_ip, raison_echec)
       VALUES (?, ?, ?, ?)`,
      [loginStr, idUtilisateur != null ? Number(idUtilisateur) : null, ip || null, String(raison).slice(0, 64)]
    );
  } catch (e) {
    console.error('logConnexionEchouee:', e.message);
  }
}

module.exports = { logConnexionEchouee, RAISON };
