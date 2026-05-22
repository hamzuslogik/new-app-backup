const XLSX = require('xlsx');
const { query, queryOne } = require('../config/database');
const { insertFicheKoRecord } = require('./fichesKo');

const IMPORT_KO_MOTIF = 'TRAITEMENT';
const IMPORT_KO_SOURCE = 'import_gestion';
const LOG_TAG = '[fiches-ko-import]';

function logStep(phase, message, data) {
  if (data !== undefined && data !== null) {
    console.log(`${LOG_TAG}[${phase}] ${message}`, data);
  } else {
    console.log(`${LOG_TAG}[${phase}] ${message}`);
  }
}

function logLine(phase, line, message, data) {
  const prefix = line != null ? `ligne ${line}` : 'ligne ?';
  if (data !== undefined && data !== null) {
    console.log(`${LOG_TAG}[${phase}] ${prefix} — ${message}`, data);
  } else {
    console.log(`${LOG_TAG}[${phase}] ${prefix} — ${message}`);
  }
}

const HEADER_ALIASES = {
  id_fiche: ['id', 'id_fiche', 'idfiche', 'fiche', 'n_fiche', 'numero_fiche', 'num_fiche', 'n°fiche'],
  tel: ['tel', 'telephone', 'téléphone', 'gsm', 'mobile', 'phone', 'numero', 'numéro'],
  agent: [
    'agent',
    'pseudo',
    'nom_agent',
    'agent_qualification',
    'agent_qualif',
    'qualification',
    'agent_qual',
    'confirmateur',
  ],
  date_appel: [
    'date_appel',
    'dateappel',
    'date_appel_time',
    'date_insertion',
    'date_insert',
    'date_insert_time',
  ],
  etat: ['etat', 'état', 'state', 'statut', 'status'],
};

function normalizeHeaderKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Téléphone Excel souvent sans 0 initial (ex. 612345678 → 0612345678). */
function normalizePhone(value) {
  if (value === null || value === undefined) return '';
  let digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('33') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (!digits.startsWith('0') && digits.length === 9 && /^[67]/.test(digits)) {
    return `0${digits}`;
  }
  return digits.startsWith('0') ? digits : `0${digits}`;
}

function isEtatKo(value) {
  const s = String(value ?? '').trim().toUpperCase();
  return s.includes('KO');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toMysqlDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function parseExcelDateValue(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toMysqlDateTime(value);
  }

  if (typeof value === 'number' && value > 0) {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
      return toMysqlDateTime(d);
    }
  }

  const s = String(value).trim();
  if (!s) return null;

  const fr = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (fr) {
    let y = parseInt(fr[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(
      y,
      parseInt(fr[2], 10) - 1,
      parseInt(fr[1], 10),
      parseInt(fr[4] || '0', 10),
      parseInt(fr[5] || '0', 10),
      parseInt(fr[6] || '0', 10)
    );
    return toMysqlDateTime(d);
  }

  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const d = new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
      parseInt(iso[4] || '0', 10),
      parseInt(iso[5] || '0', 10),
      parseInt(iso[6] || '0', 10)
    );
    return toMysqlDateTime(d);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : toMysqlDateTime(d);
}

function datePartOnly(mysqlDt) {
  if (!mysqlDt) return null;
  const s = String(mysqlDt);
  return s.slice(0, 10);
}

function mapRowFields(rawRow) {
  const normalized = {};
  for (const [key, val] of Object.entries(rawRow || {})) {
    const nk = normalizeHeaderKey(key);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => normalizeHeaderKey(a) === nk)) {
        normalized[field] = val;
        break;
      }
    }
  }
  return normalized;
}

function parseKoExcelBuffer(buffer) {
  logStep('parse', 'Étape 1 — lecture du fichier Excel');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    logStep('parse', 'Aucune feuille trouvée dans le classeur');
    return [];
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const headers = rawRows[0] ? Object.keys(rawRows[0]) : [];
  logStep('parse', 'Feuille et lignes brutes', {
    sheet: sheetName,
    lignes_brutes: rawRows.length,
    colonnes_detectees: headers,
  });

  const parsed = [];
  let ignoredNonKo = 0;

  for (let index = 0; index < rawRows.length; index++) {
    const raw = rawRows[index];
    const m = mapRowFields(raw);

    if (!isEtatKo(m.etat)) {
      ignoredNonKo += 1;
      if (ignoredNonKo <= 3) {
        logLine('parse', index + 2, 'ignorée (Etat sans KO)', { etat: m.etat });
      }
      continue;
    }

    const idRaw =
      m.id_fiche != null && m.id_fiche !== '' ? parseInt(String(m.id_fiche).replace(/\D/g, ''), 10) : null;

    parsed.push({
      line: index + 2,
      id_fiche_excel: Number.isFinite(idRaw) && idRaw > 0 ? idRaw : null,
      tel_excel: m.tel != null && String(m.tel).trim() !== '' ? String(m.tel).trim() : null,
      agent_pseudo: m.agent != null && String(m.agent).trim() !== '' ? String(m.agent).trim() : null,
      date_appel_excel: parseExcelDateValue(m.date_appel),
      etat_excel: m.etat != null ? String(m.etat).trim() : 'KO',
    });
  }

  parsed._ignoredNonKo = ignoredNonKo;
  logStep('parse', 'Étape 1 terminée — lignes KO retenues', {
    lignes_ko: parsed.length,
    ignore_non_ko: ignoredNonKo,
    exemple: parsed[0]
      ? {
          line: parsed[0].line,
          tel: parsed[0].tel_excel,
          agent: parsed[0].agent_pseudo,
          date_appel: parsed[0].date_appel_excel,
        }
      : null,
  });
  return parsed;
}

async function loadAgentPseudoMap() {
  logStep('agents', 'Étape 2 — chargement des agents qualification (fonction 3)');
  const agents = await query(
    `SELECT id, pseudo FROM utilisateurs
     WHERE fonction = 3 AND (etat > 0 OR etat IS NULL) AND pseudo IS NOT NULL AND TRIM(pseudo) <> ''`
  );
  const map = new Map();
  for (const a of agents || []) {
    const key = String(a.pseudo).trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, a.id);
  }
  logStep('agents', 'Agents chargés', { count: map.size });
  return map;
}

function resolveAgentId(pseudo, agentMap) {
  if (!pseudo) return { id: null, error: 'Pseudo agent manquant' };
  const key = String(pseudo).trim().toLowerCase();
  const id = agentMap.get(key);
  if (!id) return { id: null, error: `Agent introuvable pour le pseudo « ${pseudo} »` };
  return { id, error: null };
}

const sqlTelNorm = (col) =>
  `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col}, ''), ' ', ''), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), '+', ''), 10)`;

const FICHE_SELECT =
  'id, id_agent, ko, date_appel_time, date_insert_time, tel, id_centre, id_etat_final';

async function findFicheForRow(row, logCtx = {}) {
  const { id_fiche_excel, tel_excel, date_appel_excel } = row;
  const line = logCtx.line ?? row.line;

  if (id_fiche_excel) {
    logLine('match', line, 'recherche par id_fiche', { id_fiche: id_fiche_excel });
    const fiche = await queryOne(`SELECT ${FICHE_SELECT} FROM fiches WHERE id = ?`, [id_fiche_excel]);
    if (!fiche) {
      logLine('match', line, 'fiche introuvable (id)');
      return { fiche: null, match_note: 'Fiche introuvable (id)' };
    }
    const excelDay = datePartOnly(date_appel_excel);
    const dbDay = datePartOnly(fiche.date_appel_time);
    let match_note = null;
    if (excelDay && dbDay && excelDay !== dbDay) {
      match_note = `Date appel Excel (${excelDay}) ≠ BDD (${dbDay})`;
    } else if (excelDay && !dbDay) {
      match_note = `Date appel Excel (${excelDay}) — pas de date_appel_time en BDD`;
    }
    logLine('match', line, 'fiche trouvée par id', {
      id: fiche.id,
      date_appel_time: fiche.date_appel_time,
      match_note,
    });
    return { fiche, match_note };
  }

  const telNorm = normalizePhone(tel_excel);
  logLine('match', line, 'recherche par téléphone', {
    tel_excel,
    tel_normalise: telNorm,
    date_appel_excel,
  });
  if (!telNorm || telNorm.length < 9) {
    logLine('match', line, 'téléphone invalide');
    return { fiche: null, match_note: 'Téléphone invalide ou manquant' };
  }

  const last10 = telNorm.slice(-10);
  let candidates = await query(
    `SELECT ${FICHE_SELECT}
     FROM fiches
     WHERE ${sqlTelNorm('tel')} = ? OR ${sqlTelNorm('gsm1')} = ? OR ${sqlTelNorm('gsm2')} = ?`,
    [last10, last10, last10]
  );

  logLine('match', line, 'candidats téléphone', {
    last10,
    count: candidates?.length || 0,
    ids: (candidates || []).slice(0, 5).map((f) => ({
      id: f.id,
      date_appel: datePartOnly(f.date_appel_time),
    })),
  });

  if (!candidates?.length) {
    logLine('match', line, 'aucune fiche pour ce téléphone');
    return { fiche: null, match_note: 'Aucune fiche pour ce téléphone' };
  }

  if (date_appel_excel) {
    const excelDay = datePartOnly(date_appel_excel);
    const byDate = candidates.filter((f) => datePartOnly(f.date_appel_time) === excelDay);
    logLine('match', line, 'filtre date_appel', { excelDay, matches: byDate.length });
    if (byDate.length === 1) {
      logLine('match', line, 'fiche retenue', { id: byDate[0].id });
      return { fiche: byDate[0], match_note: null };
    }
    if (byDate.length > 1) {
      logLine('match', line, 'ambiguïté (plusieurs fiches même date)', {
        ids: byDate.map((f) => f.id),
      });
      return {
        fiche: null,
        match_note: `${byDate.length} fiches avec ce téléphone et date appel ${excelDay}`,
      };
    }
    logLine('match', line, 'aucune fiche à la date appel', { excelDay });
    return {
      fiche: null,
      match_note: `Aucune fiche avec date appel ${excelDay} (${candidates.length} fiche(s) sur ce numéro)`,
    };
  }

  if (candidates.length === 1) {
    logLine('match', line, 'fiche unique (sans filtre date)', { id: candidates[0].id });
    return { fiche: candidates[0], match_note: null };
  }
  logLine('match', line, 'ambiguïté (plusieurs fiches, date_appel manquante)', {
    count: candidates.length,
  });
  return {
    fiche: null,
    match_note: `${candidates.length} fiches pour ce téléphone — renseignez date_appel`,
  };
}

function buildPreviewRow(parsed, fiche, agentResolved, match_note) {
  const id_agent_resolu = agentResolved.id;
  const agent_erreur = agentResolved.error;
  const hasFiche = !!fiche?.id;
  const hasAgent = !!id_agent_resolu;

  let status = 'pret';
  let status_label = 'Prêt à appliquer';
  if (!hasFiche) {
    status = 'erreur';
    status_label = match_note || 'Fiche introuvable';
  } else if (!hasAgent) {
    status = 'erreur';
    status_label = agent_erreur || 'Agent introuvable';
  } else if (match_note) {
    status = 'avertissement';
    status_label = match_note;
  }

  return {
    line: parsed.line,
    id_fiche_excel: parsed.id_fiche_excel,
    tel_excel: parsed.tel_excel,
    agent_pseudo: parsed.agent_pseudo,
    etat_excel: parsed.etat_excel ?? null,
    date_appel_excel: parsed.date_appel_excel,
    id_fiche: fiche?.id ?? null,
    id_agent_resolu,
    id_agent_actuel: fiche?.id_agent ?? null,
    agent_pseudo_trouve: hasAgent ? parsed.agent_pseudo : null,
    agent_erreur,
    date_appel_time_db: fiche?.date_appel_time ?? null,
    ko_actuel: fiche?.ko != null ? Number(fiche.ko) : 0,
    status,
    status_label,
    match_note: match_note || null,
  };
}

async function previewKoImportFromBuffer(buffer, options = {}) {
  const requestId = options.requestId || 'preview';
  logStep('preview', `=== Début analyse (${requestId}) ===`);

  const parsedRows = parseKoExcelBuffer(buffer);
  const ignoredNonKo = parsedRows._ignoredNonKo ?? 0;

  if (!parsedRows.length) {
    logStep('preview', 'Aucune ligne KO à traiter', { ignore_non_ko: ignoredNonKo });
    return {
      rows: [],
      meta: { total: 0, pret: 0, erreur: 0, avertissement: 0, ignore_non_ko: ignoredNonKo },
    };
  }

  const agentMap = await loadAgentPseudoMap();
  logStep('preview', 'Étape 3 — rapprochement fiche + agent par ligne');
  const rows = [];

  for (const parsed of parsedRows) {
    if (!parsed.tel_excel && !parsed.agent_pseudo) {
      logLine('preview', parsed.line, 'ligne ignorée (téléphone et agent vides)');
      continue;
    }

    const agentResolved = resolveAgentId(parsed.agent_pseudo, agentMap);
    if (agentResolved.error) {
      logLine('preview', parsed.line, 'agent non résolu', {
        pseudo: parsed.agent_pseudo,
        error: agentResolved.error,
      });
    } else {
      logLine('preview', parsed.line, 'agent résolu', {
        pseudo: parsed.agent_pseudo,
        id_agent: agentResolved.id,
      });
    }

    const { fiche, match_note } = await findFicheForRow(parsed, { line: parsed.line });
    const previewRow = buildPreviewRow(parsed, fiche, agentResolved, match_note);
    rows.push(previewRow);
    logLine('preview', parsed.line, 'résultat ligne', {
      status: previewRow.status,
      id_fiche: previewRow.id_fiche,
      status_label: previewRow.status_label,
    });
  }

  const meta = {
    total: rows.length,
    pret: rows.filter((r) => r.status === 'pret').length,
    avertissement: rows.filter((r) => r.status === 'avertissement').length,
    erreur: rows.filter((r) => r.status === 'erreur').length,
    ignore_non_ko: ignoredNonKo,
  };

  logStep('preview', `=== Fin analyse (${requestId}) ===`, meta);
  return { rows, meta };
}

async function applyKoImportRows(rows, userId, options = {}) {
  const requestId = options.requestId || 'apply';
  logStep('apply', `=== Début application (${requestId}) ===`, {
    user_id: userId,
    lignes_recues: rows?.length || 0,
  });

  const agentMap = await loadAgentPseudoMap();
  const results = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const input of rows || []) {
    const line = input.line ?? null;
    const idFiche = parseInt(input.id_fiche, 10);
    const idAgent =
      input.id_agent_resolu != null
        ? parseInt(input.id_agent_resolu, 10)
        : resolveAgentId(input.agent_pseudo, agentMap).id;

    logLine('apply', line, 'traitement', {
      id_fiche: idFiche,
      id_agent: idAgent,
      agent_pseudo: input.agent_pseudo,
      date_appel_excel: input.date_appel_excel,
      status_import: input.status,
    });

    if (!idFiche || !idAgent) {
      logLine('apply', line, 'échec — id_fiche ou id_agent manquant');
      results.push({
        line,
        id_fiche: idFiche || null,
        success: false,
        message: 'id_fiche ou id_agent manquant',
      });
      continue;
    }

    const fiche = await queryOne(
      `SELECT id, id_agent, ko, id_centre, id_etat_final, date_appel_time FROM fiches WHERE id = ?`,
      [idFiche]
    );
    if (!fiche) {
      logLine('apply', line, 'échec — fiche introuvable en BDD', { id_fiche: idFiche });
      results.push({ line, id_fiche: idFiche, success: false, message: 'Fiche introuvable' });
      continue;
    }

    const dateAppel =
      input.date_appel_excel != null && String(input.date_appel_excel).trim() !== ''
        ? String(input.date_appel_excel).trim()
        : null;

    const oldKo = fiche.ko != null ? Number(fiche.ko) : 0;
    const oldAgent = fiche.id_agent != null ? Number(fiche.id_agent) : null;

    logLine('apply', line, 'mise à jour fiche', {
      id_fiche: idFiche,
      id_agent_avant: oldAgent,
      id_agent_apres: idAgent,
      ko_avant: oldKo,
      date_appel: dateAppel,
    });

    if (dateAppel) {
      await query(
        'UPDATE fiches SET id_agent = ?, ko = 1, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
        [idAgent, dateAppel, now, idFiche]
      );
    } else {
      await query('UPDATE fiches SET id_agent = ?, ko = 1, date_modif_time = ? WHERE id = ?', [
        idAgent,
        now,
        idFiche,
      ]);
    }

    if (oldKo !== 1) {
      logLine('apply', line, 'insertion fiches_ko');
      await insertFicheKoRecord({
        id_fiche: idFiche,
        motif_ko: IMPORT_KO_MOTIF,
        commentaire_qualite: IMPORT_KO_MOTIF,
        commentaire_complement: `Import gestion KO (ligne ${line ?? '?'})`,
        id_qualite: userId,
        id_agent: idAgent,
        id_centre: fiche.id_centre ?? null,
        id_etat_final_avant: fiche.id_etat_final ?? null,
        id_etat_final_apres: fiche.id_etat_final ?? null,
        source: IMPORT_KO_SOURCE,
        date_ko: dateAppel || now,
      });
    } else {
      logLine('apply', line, 'fiche déjà ko=1 — pas de nouvelle ligne fiches_ko');
    }

    logLine('apply', line, 'succès');
    results.push({
      line,
      id_fiche: idFiche,
      success: true,
      id_agent: idAgent,
      id_agent_avant: oldAgent,
      ko_avant: oldKo,
      date_appel_appliquee: dateAppel,
      message: 'Mis à jour (id_agent + ko=1)',
    });
  }

  const ok = results.filter((r) => r.success).length;
  const meta = { total: results.length, success: ok, failed: results.length - ok };
  logStep('apply', `=== Fin application (${requestId}) ===`, meta);
  return { results, meta };
}

module.exports = {
  parseKoExcelBuffer,
  previewKoImportFromBuffer,
  applyKoImportRows,
  normalizeHeaderKey,
  HEADER_ALIASES,
};
