/**
 * Audits RDV — qualité confirmation (fonction 4).
 * Table audit_qualite_rdv + requêtes stats agents qualité confirmation.
 */

const { query, queryOne } = require('../config/database');

let tableExistsCache = null;

async function isAuditQualiteRdvTableAvailable() {
  if (tableExistsCache !== null) return tableExistsCache;
  try {
    const row = await queryOne(
      `SELECT COUNT(*) AS c
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'audit_qualite_rdv'`
    );
    tableExistsCache = !!(row && row.c > 0);
  } catch (e) {
    tableExistsCache = false;
  }
  return tableExistsCache;
}

/**
 * Enregistre un audit RDV (ne bloque pas la requête fiche en cas d'erreur).
 */
async function insertAuditQualiteRdv(params) {
  const available = await isAuditQualiteRdvTableAvailable();
  if (!available) return false;

  const {
    id_fiche,
    id_qualite_confirmation,
    observation = null,
    date_rdv_time = null,
    id_etat_final = null,
    id_confirmateur = null,
    id_centre = null,
    id_commercial = null,
    id_agent = null,
    date_audit,
  } = params;

  if (!id_fiche || !id_qualite_confirmation) return false;

  const now =
    date_audit || new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    await query(
      `INSERT INTO audit_qualite_rdv (
        id_fiche, id_qualite_confirmation, observation, date_rdv_time,
        id_etat_final, id_confirmateur, id_centre, id_commercial, id_agent,
        date_audit, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_fiche,
        id_qualite_confirmation,
        observation,
        date_rdv_time,
        id_etat_final,
        id_confirmateur,
        id_centre,
        id_commercial,
        id_agent,
        now,
        now,
      ]
    );
    return true;
  } catch (err) {
    console.error('Erreur insertion audit_qualite_rdv:', err.message);
    return false;
  }
}

/**
 * Stats confirmation depuis audit_qualite_rdv (période = date_rdv_time).
 */
async function fetchAuditQualiteRdvStats(startDate, endDate, idAgentQualiteConfirmation = null, encodeFicheId) {
  const agentFilterSql = idAgentQualiteConfirmation
    ? ' AND a.id_qualite_confirmation = ?'
    : '';
  const agentParams = idAgentQualiteConfirmation ? [idAgentQualiteConfirmation] : [];

  const agentsOptions = await query(
    `SELECT DISTINCT u.id, u.pseudo, u.nom, u.prenom
     FROM audit_qualite_rdv a
     INNER JOIN utilisateurs u ON a.id_qualite_confirmation = u.id AND u.fonction = 4 AND u.etat > 0
     WHERE a.date_rdv_time IS NOT NULL AND a.date_rdv_time != ''
       AND a.date_rdv_time >= ? AND a.date_rdv_time <= ?
     ORDER BY u.pseudo ASC`,
    [startDate, endDate]
  );

  const rows = await query(
    `SELECT
       u.id,
       u.pseudo,
       u.nom,
       u.prenom,
       u.photo,
       fn.titre AS fonction_titre,
       c.titre AS centre_titre,
       COUNT(DISTINCT a.id_fiche) AS total_rdvs_audites,
       SUM(
         CASE
           WHEN a.observation IS NOT NULL AND TRIM(a.observation) != '' THEN 1
           ELSE 0
         END
       ) AS avec_observation
     FROM audit_qualite_rdv a
     INNER JOIN utilisateurs u ON a.id_qualite_confirmation = u.id AND u.fonction = 4 AND u.etat > 0
     LEFT JOIN fonctions fn ON u.fonction = fn.id
     LEFT JOIN centres c ON u.centre = c.id
     WHERE a.date_rdv_time IS NOT NULL AND a.date_rdv_time != ''
       AND a.date_rdv_time >= ? AND a.date_rdv_time <= ?
       ${agentFilterSql}
     GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo, fn.titre, c.titre
     ORDER BY total_rdvs_audites DESC`,
    [startDate, endDate, ...agentParams]
  );

  const agents = (rows || []).map((row) => ({
    agent: {
      id: row.id,
      pseudo: row.pseudo,
      nom: row.nom,
      prenom: row.prenom,
      photo: row.photo,
      fonction_titre: row.fonction_titre,
      centre_titre: row.centre_titre,
    },
    stats: {
      total_rdvs_audites: parseInt(row.total_rdvs_audites || 0, 10),
      avec_observation: parseInt(row.avec_observation || 0, 10),
    },
  }));

  const totauxBase = agents.reduce(
    (acc, a) => ({
      total_rdvs_audites: acc.total_rdvs_audites + a.stats.total_rdvs_audites,
      avec_observation: acc.avec_observation + a.stats.avec_observation,
    }),
    { total_rdvs_audites: 0, avec_observation: 0 }
  );

  const rdvsRows = await query(
    `SELECT
       f.id,
       f.hash,
       f.nom,
       f.prenom,
       f.tel,
       f.cp,
       f.ville,
       a.date_rdv_time,
       a.date_audit,
       f.date_modif_time,
       a.observation AS observation_qualite,
       a.id_etat_final,
       f.valider,
       u_aud.id AS auditeur_id,
       u_aud.pseudo AS auditeur_pseudo,
       u_aud.nom AS auditeur_nom,
       u_aud.prenom AS auditeur_prenom,
       u1.pseudo AS confirmateur_pseudo,
       p.nom AS produit_nom,
       po.id_fiche AS porte_ouverte_id_fiche
     FROM audit_qualite_rdv a
     INNER JOIN fiches f ON f.id = a.id_fiche
     LEFT JOIN utilisateurs u_aud ON a.id_qualite_confirmation = u_aud.id
     LEFT JOIN utilisateurs u1 ON f.id_confirmateur = u1.id
     LEFT JOIN produits p ON f.produit = p.id
     LEFT JOIN (SELECT DISTINCT id_fiche FROM porte_ouverte) po ON po.id_fiche = f.id
     WHERE (f.archive = 0 OR f.archive IS NULL)
       AND a.date_rdv_time IS NOT NULL AND a.date_rdv_time != ''
       AND a.date_rdv_time >= ? AND a.date_rdv_time <= ?
       ${agentFilterSql}
     ORDER BY a.date_rdv_time DESC, a.id DESC
     LIMIT 1000`,
    [startDate, endDate, ...agentParams]
  );

  const rdvs_audites = (rdvsRows || []).map((r) => ({
    id: r.id,
    hash: r.hash || (encodeFicheId ? encodeFicheId(r.id) : null),
    nom: r.nom,
    prenom: r.prenom,
    tel: r.tel,
    cp: r.cp,
    ville: r.ville,
    date_rdv_time: r.date_rdv_time,
    date_audit: r.date_audit,
    date_modif_time: r.date_modif_time,
    observation_qualite: r.observation_qualite,
    id_etat_final: r.id_etat_final,
    valider: r.valider,
    has_porte_ouverte: !!r.porte_ouverte_id_fiche,
    auditeur: {
      id: r.auditeur_id,
      pseudo: r.auditeur_pseudo,
      nom: r.auditeur_nom,
      prenom: r.auditeur_prenom,
    },
    confirmateur_pseudo: r.confirmateur_pseudo,
    produit_nom: r.produit_nom,
  }));

  const signedEtats = new Set([13, 16, 38, 44, 45]);
  const signaturesCount = rdvs_audites.reduce(
    (acc, r) => acc + (signedEtats.has(Number(r.id_etat_final)) ? 1 : 0),
    0
  );
  const porteOuverteCount = rdvs_audites.reduce(
    (acc, r) => acc + (r.has_porte_ouverte ? 1 : 0),
    0
  );
  const totalRdvs = rdvs_audites.length;
  const tauxSignature =
    totalRdvs > 0 ? Number(((signaturesCount / totalRdvs) * 100).toFixed(1)) : 0;
  const tauxPorteOuverte =
    totalRdvs > 0 ? Number(((porteOuverteCount / totalRdvs) * 100).toFixed(1)) : 0;

  return {
    agents,
    agents_options: (agentsOptions || []).map((u) => ({
      id: u.id,
      pseudo: u.pseudo,
      nom: u.nom,
      prenom: u.prenom,
    })),
    totaux: {
      ...totauxBase,
      total_rdvs_audites: totalRdvs,
      signatures: signaturesCount,
      taux_signature: tauxSignature,
      porte_ouverte: porteOuverteCount,
      taux_porte_ouverte: tauxPorteOuverte,
    },
    rdvs_audites,
  };
}

module.exports = {
  isAuditQualiteRdvTableAvailable,
  insertAuditQualiteRdv,
  fetchAuditQualiteRdvStats,
};
