const LOG_PREFIX = '[regles_autorisation]';

function logReglesAutorisation(message, data = null) {
  const ts = new Date().toISOString();
  if (data !== null && data !== undefined) {
    console.log(`${LOG_PREFIX} ${ts} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${LOG_PREFIX} ${ts} ${message}`);
  }
}

function logReglesAutorisationWarn(message, data = null) {
  const ts = new Date().toISOString();
  if (data !== null && data !== undefined) {
    console.warn(`${LOG_PREFIX} ${ts} ${message}`, JSON.stringify(data));
  } else {
    console.warn(`${LOG_PREFIX} ${ts} ${message}`);
  }
}

function logReglesAutorisationError(message, err = null) {
  const ts = new Date().toISOString();
  if (err) {
    console.error(`${LOG_PREFIX} ${ts} ${message}`, err.message || err);
  } else {
    console.error(`${LOG_PREFIX} ${ts} ${message}`);
  }
}

function snapshotFicheForLog(fiche) {
  if (!fiche) return null;
  return {
    id: fiche.id,
    id_etat_final: fiche.id_etat_final,
    id_centre: fiche.id_centre,
    tel: fiche.tel,
    date_insert_time: fiche.date_insert_time,
    date_appel_time: fiche.date_appel_time,
    date_appel: fiche.date_appel,
  };
}

function snapshotRuleForLog(rule, centreIds) {
  if (!rule) return null;
  return {
    id: rule.id,
    libelle: rule.libelle,
    priorite: rule.priorite,
    id_etat_final: rule.id_etat_final,
    centre_ids: centreIds || rule.centre_ids || [],
    date_insert: rule.date_insert_operateur
      ? `${rule.date_insert_operateur} ${rule.date_insert_valeur} ${rule.date_insert_unite}`
      : null,
    date_appel: rule.date_appel_operateur
      ? `${rule.date_appel_operateur} ${rule.date_appel_valeur} ${rule.date_appel_unite}`
      : null,
  };
}

module.exports = {
  logReglesAutorisation,
  logReglesAutorisationWarn,
  logReglesAutorisationError,
  snapshotFicheForLog,
  snapshotRuleForLog,
};
