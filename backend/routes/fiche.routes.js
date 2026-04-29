const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate, checkPermission, isAdminOrBackofficeOrRPConfirmation } = require('../middleware/auth.middleware');
const { checkPermissionCode, hasPermission } = require('../middleware/permissions.middleware');
const { triggerWorkflowOnFicheCreated, triggerWorkflowOnFicheUpdated, triggerWorkflowOnEtatChanged, triggerWorkflowOnRdvValidated } = require('../middleware/workflow.middleware');
const { query, queryOne } = require('../config/database');
const { logUserActivityEvent } = require('../utils/userActivitySession');
const { executeWorkflow } = require('../services/workflow/workflow-executor');

// Clé secrète pour encoder/décoder les IDs (à mettre dans .env en production)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

/** Retourne l'id_confirmateur à enregistrer dans fiches_histo : body.histo_id_confirmateur (RE/RP/admin/backoffice), sinon id utilisateur connecté (assignation automatique à chaque modification d'état) */
function getHistoConfirmateur(req, fiche = null) {
  const sent = req.body && req.body.histo_id_confirmateur !== undefined && req.body.histo_id_confirmateur !== null && req.body.histo_id_confirmateur !== '';
  if (sent) {
    const v = parseInt(req.body.histo_id_confirmateur, 10);
    return Number.isFinite(v) ? v : null;
  }
  // À chaque changement d'état : assigner automatiquement l'id utilisateur connecté
  if (req.user && req.user.id) return req.user.id;
  return null;
}

/** Colonnes conf_* de fiches_histo (alignées sur add_fiches_histo_conf_columns.sql) pour enregistrer la confirmation (état 7) */
const FICHES_HISTO_CONF_COLUMNS = [
  'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur', 'conf_profession_madame',
  'conf_presence_couple', 'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
  'conf_consommation_electricite', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
  'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
  'conf_type_contrat_mr', 'conf_type_contrat_madame'
];

/**
 * Construit les colonnes et valeurs conf_* pour un INSERT fiches_histo lorsque id_etat = 7.
 * Toutes les colonnes conf_* sont incluses (valeur null si absente).
 * @param {Object} source - Objet principal (ex: ficheData, body)
 * @param {Object} fallback - Objet de repli si source n'a pas la clé (ex: fiche)
 * @returns {{ cols: string[], vals: any[] }}
 */
function getConfFieldsForHisto(source = {}, fallback = {}) {
  const cols = [...FICHES_HISTO_CONF_COLUMNS];
  const vals = cols.map(key => {
    const v = source[key] !== undefined && source[key] !== '' ? source[key] : (fallback[key] !== undefined && fallback[key] !== '' ? fallback[key] : null);
    return v === '' ? null : v;
  });
  return { cols, vals };
}

/** Parse id état pour comparaisons fiables (évite 7 !== "7" et historique manquant) */
function parseEtatId(v) {
  if (v === undefined || v === null || v === '') return NaN;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : NaN;
}

/** Limite les clauses IN (...) sur les id_fiche après un SELECT massif — sinon ER_NET_PACKET_TOO_LARGE / max_allowed_packet */
const FICHE_IDS_IN_CHUNK = 2000;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Confirmateur : lignes fiches_histo (plage date_creation) dont l’auteur est userId,
 * et qui sont la dernière ligne globale de la fiche (pas de fh2 avec même id_fiche et id > fh.id).
 * includeMultiSlot : si true, la ligne peut être « signée » par userId en id_confirmateur, _2 ou _3 (case Dashboard).
 */
function confirmateurDerniereLigneHistoJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const confMatch = includeMultiSlot
    ? '(fh.id_confirmateur = ? OR fh.id_confirmateur_2 = ? OR fh.id_confirmateur_3 = ?)'
    : 'fh.id_confirmateur = ?';
  const headParams = includeMultiSlot ? [userId, userId, userId] : [userId];
  return {
    joinSql: `INNER JOIN (
    SELECT fh.id_fiche
    FROM fiches_histo fh
    WHERE ${confMatch}
      AND fh.date_creation >= ? AND fh.date_creation <= ?
      AND NOT EXISTS (
        SELECT 1 FROM fiches_histo fh2
        WHERE fh2.id_fiche = fh.id_fiche AND fh2.id > fh.id
      )
  ) histo_conf_last ON fiche.id = histo_conf_last.id_fiche`,
    params: [...headParams, startDatetime, endDatetime],
  };
}

/**
 * Dernière ligne fiches_histo par fiche **dont la date_creation est dans la plage** (autre profil que conf. pur),
 * puis filtre sur l’auteur de cette ligne (1er confirmateur ou 2e/3e si includeMultiSlot).
 */
function fichesHistoLastInRangeJoin(startDatetime, endDatetime, userId, includeMultiSlot = false) {
  const confClause = includeMultiSlot
    ? '(fh.id_confirmateur = ? OR fh.id_confirmateur_2 = ? OR fh.id_confirmateur_3 = ?)'
    : 'fh.id_confirmateur = ?';
  const tailParams = includeMultiSlot ? [userId, userId, userId] : [userId];
  return {
    joinSql: `INNER JOIN (
    SELECT fh.id_fiche
    FROM fiches_histo fh
    INNER JOIN (
      SELECT id_fiche, MAX(id) AS max_id
      FROM fiches_histo
      WHERE date_creation >= ? AND date_creation <= ?
      GROUP BY id_fiche
    ) histo_last_in_range ON fh.id_fiche = histo_last_in_range.id_fiche AND fh.id = histo_last_in_range.max_id
    WHERE ${confClause}
  ) histo_ids ON fiche.id = histo_ids.id_fiche`,
    params: [startDatetime, endDatetime, ...tailParams],
  };
}

/** Remplit id_etat_histo (GROUP_CONCAT des id_etat) sans sous-requête corrélée par ligne sur le SELECT principal */
async function attachIdEtatHistoToFiches(fiches) {
  if (!fiches?.length) return;
  const map = new Map();
  const ids = fiches.map((f) => f.id);
  for (const chunk of chunkArray(ids, FICHE_IDS_IN_CHUNK)) {
    const ph = chunk.map(() => '?').join(',');
    const rows = await query(
      `SELECT id_fiche, GROUP_CONCAT(DISTINCT id_etat ORDER BY id ASC SEPARATOR ',') AS id_etat_histo
       FROM fiches_histo
       WHERE id_fiche IN (${ph})
       GROUP BY id_fiche`,
      chunk
    );
    for (const r of rows) {
      map.set(r.id_fiche, r.id_etat_histo);
    }
  }
  for (const f of fiches) {
    f.id_etat_histo = map.get(f.id) ?? null;
  }
}

/**
 * Faut-il insérer une ligne fiches_histo sur PUT /fiches/:id ?
 * — Changement d'état (numérique), ou même état avec mise à jour des infos liées (sous-état, RDV, commentaire, etc.)
 */
function shouldInsertFichesHistoPut(ficheData, fiche) {
  const newEt = parseEtatId(ficheData.id_etat_final);
  if (!Number.isFinite(newEt)) return false;
  const oldEt = parseEtatId(fiche.id_etat_final);
  if (!Number.isFinite(oldEt) || newEt !== oldEt) return true;
  return (
    ficheData.id_sous_etat !== undefined ||
    ficheData.conf_commentaire_produit !== undefined ||
    ficheData.motif_qualif !== undefined ||
    ficheData.date_rdv_time !== undefined ||
    ficheData.date_sign_time !== undefined ||
    ficheData.conf_rdv_avec !== undefined ||
    ficheData.id_commercial !== undefined
  );
}

/**
 * Enregistre un audit dans la table controle_qualite (page Contrôle Qualité).
 * En cas d'erreur (ex: table absente), log uniquement pour ne pas casser la réponse.
 * @param {Object} params - id_fiche, id_qualite, id_etat?, id_sous_etat?, commentaire?, ko?, hc?, id_etat_precedent?, id_sous_etat_precedent?, id_agent_fiche?, id_centre?, date_audit?, date_fiche?
 */
async function insertControleQualiteAudit(params) {
  const {
    id_fiche,
    id_qualite,
    id_etat = null,
    id_sous_etat = null,
    commentaire = null,
    ko = 0,
    hc = 0,
    id_etat_precedent = null,
    id_sous_etat_precedent = null,
    id_agent_fiche = null,
    id_centre = null,
    date_audit,
    date_fiche = null
  } = params;
  const now = date_audit || new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    await query(
      `INSERT INTO controle_qualite (id_fiche, id_qualite, id_etat, id_sous_etat, commentaire, ko, hc, id_etat_precedent, id_sous_etat_precedent, id_agent_fiche, id_centre, date_audit, date_fiche, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_fiche, id_qualite, id_etat, id_sous_etat, commentaire, ko, hc, id_etat_precedent, id_sous_etat_precedent, id_agent_fiche, id_centre, now, date_fiche, now]
    );
  } catch (err) {
    console.error('Erreur insertion table controle_qualite (audit non enregistré):', err.message);
  }
}

/**
 * IDs des états pour lesquels tout agent qualité peut modifier une fiche déjà assignée à un autre
 * (ex: Debrief, À vérifier). Mis en cache pour éviter des requêtes répétées.
 */
let ETATS_QUALITE_OUVERTS_CACHE = null;
async function getEtatsQualiteOuverts() {
  if (ETATS_QUALITE_OUVERTS_CACHE) return ETATS_QUALITE_OUVERTS_CACHE;
  try {
    const rows = await query(
      "SELECT id FROM etats WHERE LOWER(titre) LIKE '%debrif%' OR LOWER(titre) LIKE '%verifier%'"
    );
    ETATS_QUALITE_OUVERTS_CACHE = (rows || []).map(r => r.id);
  } catch (err) {
    console.error('Erreur récupération états qualité ouverts:', err.message);
    ETATS_QUALITE_OUVERTS_CACHE = [];
  }
  return ETATS_QUALITE_OUVERTS_CACHE;
}

/**
 * Vérifie si un agent qualité peut modifier une fiche déjà assignée à un autre agent qualité.
 * Autorisation si : pas d'id_qualite, ou même utilisateur, ou état "Debrief" / "À vérifier".
 * @param {Object} fiche - { id_qualite, id_etat_final }
 * @param {number} userId - ID utilisateur connecté
 * @param {number} userFonction - Fonction de l'utilisateur (2=RE Qualif, 8=Qualité Qualif, 12=RP Qualif)
 * @returns {Promise<boolean>}
 */
async function canQualiteModifierFiche(fiche, userId, userFonction) {
  const isQualiteUser = userFonction === 2 || userFonction === 8 || userFonction === 12;
  if (!isQualiteUser) return true;
  // Fiche validée (état hors groupe 0) : verrouillée pour tout le monde
  const etatRow = await queryOne('SELECT groupe FROM etats WHERE id = ?', [fiche.id_etat_final]);
  if (etatRow && etatRow.groupe !== '0' && etatRow.groupe !== 0) {
    return false;
  }
  if (!fiche.id_qualite) return true;
  if (Number(fiche.id_qualite) === Number(userId)) return true;
  const etatsOuverts = await getEtatsQualiteOuverts();
  if (etatsOuverts.includes(Number(fiche.id_etat_final))) return true;
  return false;
}

// Fonction pour encoder un ID en hash (utilise HMAC pour créer un hash unique)
const encodeFicheId = (id) => {
  if (!id) return null;
  // Créer un hash HMAC basé sur l'ID et le secret
  const hmac = crypto.createHmac('sha256', HASH_SECRET);
  hmac.update(String(id));
  const hash = hmac.digest('hex');
  // Encoder en base64 URL-safe et ajouter l'ID encodé pour pouvoir le décoder
  const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
    return { '+': '-', '/': '_', '=': '' }[m];
  });
  // Combiner le hash et l'ID encodé (on peut décoder l'ID, mais le hash permet de vérifier l'intégrité)
  return `${hash.substring(0, 16)}${encodedId}`;
};

// Fonction pour décoder un hash en ID
const decodeFicheId = (hash) => {
  if (!hash) return null;
  try {
    // Si le hash est trop court, ce n'est pas un format valide
    if (hash.length < 17) {
      console.warn(`Hash trop court: ${hash} (longueur: ${hash.length})`);
      return null;
    }
    
    // Extraire l'ID encodé (les 16 premiers caractères sont le hash de vérification)
    const encodedId = hash.substring(16);
    const hashPrefix = hash.substring(0, 16);
    
    // Décoder l'ID
    let base64 = encodedId.replace(/[-_]/g, (m) => {
      return { '-': '+', '_': '/' }[m];
    });
    
    // Ajouter le padding si nécessaire pour base64
    const paddingNeeded = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(paddingNeeded);
    
    const id = Buffer.from(base64, 'base64').toString('utf8');
    const idNum = parseInt(id, 10);
    
    if (isNaN(idNum) || idNum <= 0) {
      console.warn(`ID décodé invalide depuis le hash: ${hash} -> ID: ${id} (num: ${idNum})`);
      return null;
    }
    
    // Vérifier l'intégrité en recalculant le hash
    const hmac = crypto.createHmac('sha256', HASH_SECRET);
    hmac.update(id);
    const expectedHash = hmac.digest('hex').substring(0, 16);
    
    if (hashPrefix === expectedHash) {
      return idNum;
    } else {
      // La vérification a échoué, mais on peut quand même retourner l'ID décodé
      // (cas où le secret a changé ou hash créé avec ancien format)
      console.warn(`Hash invalide mais ID décodable: hash=${hash.substring(0, 20)}..., id=${idNum}, expected=${expectedHash.substring(0, 8)}..., got=${hashPrefix.substring(0, 8)}...`);
      // Retourner l'ID même si la vérification échoue (pour compatibilité avec anciens hashes)
      return idNum;
    }
  } catch (error) {
    console.error('Erreur lors du décodage du hash:', error.message, 'Hash:', hash?.substring(0, 30));
    return null;
  }
};

// Middleware pour convertir le hash en ID dans les paramètres
const hashToIdMiddleware = async (req, res, next) => {
  try {
    // Cache court pour éviter une requête DB à chaque hit
    if (!global.__phoneUrlSearchSettingCache) {
      global.__phoneUrlSearchSettingCache = { value: true, expiresAt: 0 };
    }
    const getPhoneUrlSearchEnabled = async () => {
      const now = Date.now();
      if (global.__phoneUrlSearchSettingCache.expiresAt > now) {
        return global.__phoneUrlSearchSettingCache.value;
      }
      try {
        const tableExists = await queryOne(
          `SELECT COUNT(*) as count
           FROM information_schema.tables
           WHERE table_schema = DATABASE()
           AND table_name = 'global_settings'`
        );
        if (!tableExists || Number(tableExists.count) === 0) {
          global.__phoneUrlSearchSettingCache = { value: true, expiresAt: now + 5000 };
          return true;
        }
        const row = await queryOne(
          'SELECT setting_value FROM global_settings WHERE setting_key = ?',
          ['phone_url_search_enabled']
        );
        const raw = row?.setting_value;
        const enabled = raw === undefined || raw === null
          ? true
          : !(String(raw).toLowerCase() === '0' || String(raw).toLowerCase() === 'false');
        global.__phoneUrlSearchSettingCache = { value: enabled, expiresAt: now + 5000 };
        return enabled;
      } catch (e) {
        // En cas d'erreur, rester permissif pour ne pas bloquer la navigation
        global.__phoneUrlSearchSettingCache = { value: true, expiresAt: now + 3000 };
        return true;
      }
    };

    const looksLikePhoneNumber = (value) => {
      if (value === null || value === undefined) return false;
      const s = String(value).trim();
      // Autoriser formats usuels: 0612345678, 33612345678, +33612345678, 06 12 34 56 78
      const digits = s.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 14;
    };

    const findFicheIdByPhone = async (rawPhone) => {
      if (!rawPhone) return null;
      const trimmed = String(rawPhone).trim();
      if (!trimmed) return null;

      // Normaliser: garder uniquement les chiffres
      const digits = trimmed.replace(/\D/g, '');
      const variants = new Set([trimmed]);
      if (digits) {
        variants.add(digits);
        if (digits.startsWith('33') && digits.length >= 11) {
          variants.add(`0${digits.slice(2)}`);
        }
        if (digits.startsWith('0')) {
          variants.add(`33${digits.slice(1)}`);
        }
      }

      const vals = Array.from(variants).filter(Boolean);
      if (vals.length === 0) return null;

      const placeholders = vals.map(() => '?').join(',');
      const found = await queryOne(
        `SELECT id FROM fiches
         WHERE tel IN (${placeholders})
            OR gsm1 IN (${placeholders})
            OR gsm2 IN (${placeholders})
         ORDER BY id DESC
         LIMIT 1`,
        [...vals, ...vals, ...vals]
      );
      return found?.id || null;
    };

    // Gérer le paramètre 'id'
    if (req.params.id) {
      // Essayer de décoder le hash
      const decodedId = decodeFicheId(req.params.id);
      if (decodedId) {
        req.params.id = decodedId;
      } else {
        // Si ça ressemble à un numéro de téléphone, PRIORITÉ à la recherche téléphone
        // (évite 0610895976 -> parseInt -> 610895976, faux ID)
        if (looksLikePhoneNumber(req.params.id) && await getPhoneUrlSearchEnabled()) {
          const phoneMatchedId = await findFicheIdByPhone(req.params.id);
          if (phoneMatchedId) {
            req.params.id = phoneMatchedId;
            return next();
          }
        }

        // Si le décodage échoue, essayer de parser comme ID direct (pour compatibilité)
        const directId = parseInt(req.params.id, 10);
        if (!isNaN(directId) && directId > 0) {
          req.params.id = directId;
        } else {
          // Si ce n'est ni un hash ni un id, essayer comme numéro de téléphone (tel/gsm1/gsm2)
          const phoneMatchedId = await findFicheIdByPhone(req.params.id);
          if (phoneMatchedId) {
            req.params.id = phoneMatchedId;
            return next();
          }

          // Logger pour le débogage avec plus de détails
          console.error('Identifiant de fiche invalide dans hashToIdMiddleware (param id):', {
            id: req.params.id,
            length: req.params.id?.length,
            path: req.path,
            method: req.method,
            decodedId,
            url: req.url,
            originalUrl: req.originalUrl
          });
          return res.status(400).json({ 
            success: false, 
            message: `Identifiant de fiche invalide: "${req.params.id}" (longueur: ${req.params.id?.length})`,
            debug: {
              providedId: req.params.id,
              path: req.path,
              method: req.method
            }
          });
        }
      }
    }
    
    // Gérer le paramètre 'hash' (utilisé dans certaines routes)
    if (req.params.hash) {
      // Essayer de décoder le hash
      const decodedId = decodeFicheId(req.params.hash);
      if (decodedId !== null && decodedId !== undefined && decodedId > 0) {
        // Convertir le hash en ID dans req.params
        req.params.id = decodedId;
        delete req.params.hash;
      } else {
        // Si ça ressemble à un téléphone, le rechercher avant parseInt
        if (looksLikePhoneNumber(req.params.hash) && await getPhoneUrlSearchEnabled()) {
          const phoneMatchedId = await findFicheIdByPhone(req.params.hash);
          if (phoneMatchedId) {
            req.params.id = phoneMatchedId;
            delete req.params.hash;
            return next();
          }
        }

        // Si le décodage échoue, essayer de parser comme ID direct (pour compatibilité)
        const directId = parseInt(req.params.hash, 10);
        if (!isNaN(directId) && directId > 0) {
          req.params.id = directId;
          delete req.params.hash;
        } else {
          // Fallback: autoriser /fiches/<tel> en résolvant via tel/gsm1/gsm2
          const phoneMatchedId = await findFicheIdByPhone(req.params.hash);
          if (phoneMatchedId) {
            req.params.id = phoneMatchedId;
            delete req.params.hash;
            return next();
          }

          // Logger pour le débogage
          console.error('Hash de fiche invalide dans hashToIdMiddleware (param hash):', {
            hash: req.params.hash,
            length: req.params.hash?.length,
            path: req.path,
            method: req.method,
            decodedId,
            directId
          });
          return res.status(400).json({ 
            success: false, 
            message: 'Hash de fiche invalide ou format incorrect' 
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Erreur dans hashToIdMiddleware:', error);
    return res.status(400).json({ 
      success: false, 
      message: 'Erreur lors du traitement de l\'identifiant de fiche' 
    });
  }
};

// Cache pour la structure de la table modifica (éviter de vérifier à chaque fois)
let modificaStructureCache = null;

// Cache pour l'existence de la table qualif (éviter de vérifier à chaque requête)
let qualifTableCache = {
  exists: null,
  lastCheck: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

// Cache pour les groupes d'états et permissions (éviter de vérifier à chaque requête)
let etatGroupsCache = {
  data: null,
  lastCheck: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

// Fonction pour vérifier si la table qualif existe (avec cache)
const checkQualifTableExists = async () => {
  const now = Date.now();
  if (qualifTableCache.exists !== null && 
      qualifTableCache.lastCheck && 
      (now - qualifTableCache.lastCheck) < qualifTableCache.ttl) {
    return qualifTableCache.exists;
  }
  
  try {
    const qualifCheck = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'qualif'`
    );
    qualifTableCache.exists = qualifCheck && qualifCheck.count > 0;
    qualifTableCache.lastCheck = now;
    return qualifTableCache.exists;
  } catch (e) {
    qualifTableCache.exists = false;
    qualifTableCache.lastCheck = now;
    return false;
  }
};

// Fonction pour récupérer les groupes d'états et permissions (avec cache)
const getEtatGroupsAndPermissions = async (userFonction) => {
  const now = Date.now();
  const cacheKey = `fonction_${userFonction}`;
  
  // Vérifier si le cache est valide
  if (etatGroupsCache.data && 
      etatGroupsCache.lastCheck && 
      (now - etatGroupsCache.lastCheck) < etatGroupsCache.ttl) {
    // Retourner les groupes autorisés pour cette fonction depuis le cache
    return etatGroupsCache.data[userFonction] || { allowedGroups: [], anyPermissionExists: false };
  }
  
  // Récupérer tous les groupes d'états depuis la base de données
  const etatGroups = await query('SELECT DISTINCT groupe FROM etats WHERE groupe IS NOT NULL AND groupe != ""');
  const uniqueGroups = [...new Set(etatGroups.map(e => String(e.groupe)))].sort();
  
  // Vérifier les permissions pour chaque groupe d'états trouvé
  const cacheData = {};
  
  // Pour chaque fonction possible (3, 5, 6, etc.), calculer les groupes autorisés
  const functions = [3, 5, 6, 7, 8]; // Ajouter d'autres fonctions si nécessaire
  
  for (const fonction of functions) {
    const allowedGroups = [];
    const permissionChecks = [];
    
    for (const group of uniqueGroups) {
      const permissionCode = `VIEW_ETAT_GROUP_${group}`;
      const permissionExists = await queryOne('SELECT id FROM permissions WHERE code = ? AND etat = 1', [permissionCode]);
      
      if (permissionExists) {
        const hasGroup = await hasPermission(fonction, permissionCode);
        if (hasGroup) {
          allowedGroups.push(group);
        }
        permissionChecks.push(permissionExists);
      }
    }
    // Session Confirmateur (6) : inclure Phase 1 (groupe 1) dans les filtres et le changement d'état
    if (fonction === 6 && !allowedGroups.includes('1')) {
      allowedGroups.push('1');
    }
    
    cacheData[fonction] = {
      allowedGroups,
      anyPermissionExists: permissionChecks.length > 0
    };
  }
  
  etatGroupsCache.data = cacheData;
  etatGroupsCache.lastCheck = now;
  
  return cacheData[userFonction] || { allowedGroups: [], anyPermissionExists: false };
};

// Fonction helper pour enregistrer les modifications dans modifica
const logModification = async (idFiche, userId, userPseudo, field, oldValue, newValue) => {
  try {
    // Vérifier d'abord si la table modifica existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'modifica'`
    );
    
    if (!tableExists || tableExists.count === 0) {
      console.log('Table modifica n\'existe pas, impossible d\'enregistrer la modification');
      return;
    }
    
    // Détecter la structure de la table (avec cache)
    if (!modificaStructureCache) {
      const columns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'modifica'`
      );
      modificaStructureCache = columns.map(col => col.COLUMN_NAME);
      console.log('Structure de modifica détectée:', modificaStructureCache);
    }
    
    const hasNewStructure = modificaStructureCache.includes('type') && 
                            modificaStructureCache.includes('ancien_valeur') && 
                            modificaStructureCache.includes('nouvelle_valeur');
    const hasOldStructure = modificaStructureCache.includes('champ') && 
                            modificaStructureCache.includes('last_val') && 
                            modificaStructureCache.includes('val');
    
    // Convertir les valeurs en string pour la comparaison
    const oldValStr = oldValue === null || oldValue === undefined ? '' : String(oldValue);
    const newValStr = newValue === null || newValue === undefined ? '' : String(newValue);
    
    // Ne logger que si les valeurs sont différentes
    if (oldValStr !== newValStr) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      console.log(`Enregistrement modification: fiche=${idFiche}, user=${userId}, champ=${field}, ancien=${oldValStr}, nouveau=${newValStr}`);
      
      if (hasNewStructure) {
        // Utiliser la nouvelle structure
        const dateCol = modificaStructureCache.includes('date_modif_time') ? 'date_modif_time' : 'date';
        await query(
          `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, \`${dateCol}\`)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [idFiche, userId, field, oldValStr, newValStr, now]
        );
        console.log('Modification enregistrée avec succès dans modifica (nouvelle structure)');
      } else if (hasOldStructure) {
        // Utiliser l'ancienne structure
        const dateCol = modificaStructureCache.includes('date') ? 'date' : 'date_modif_time';
        await query(
          `INSERT INTO modifica (id_fiche, id_user, champ, last_val, val, \`${dateCol}\`)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [idFiche, userId, field, oldValStr, newValStr, now]
        );
        console.log('Modification enregistrée avec succès dans modifica (ancienne structure)');
      } else {
        console.error('Structure de la table modifica non reconnue. Colonnes:', modificaStructureCache);
      }
    } else {
      console.log(`Pas de modification détectée pour le champ ${field} (ancien=${oldValStr}, nouveau=${newValStr})`);
    }
  } catch (error) {
    // Ne pas bloquer la mise à jour si l'enregistrement du log échoue
    console.error('Erreur lors de l\'enregistrement dans modifica:', error);
  }
};

// Récupérer toutes les fiches avec filtres
router.get('/', authenticate, async (req, res) => {
  const requestStartTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[FICHES-${requestId}] === Début GET /fiches ===`);
  console.log(`[FICHES-${requestId}] User: id=${req.user?.id}, fonction=${req.user?.fonction}, pseudo=${req.user?.pseudo || req.user?.login || 'N/A'}`);
  console.log(`[FICHES-${requestId}] Query params:`, JSON.stringify(req.query));
  
  try {
    const {
      page = 1,
      limit = 500,
      include_archive,
      nom,
      prenom,
      critere,
      critere_champ,
      tel,
      cp,
      produit,
      id_etat_final,
      id_sous_etat,
      id_commercial,
      id_confirmateur,
      include_confirmateur_2,
      id_re,
      id_centre,
      id_agent,
      date_debut,
      date_fin,
      time_debut,
      time_fin,
      date_champ,
      day_rdv,
      w,
      y,
      affectation,
      suivi,
      prof_ret,
      prof_celib,
      ko,
      hc,
      rdv_valid,
      rdv_non_valid,
      rdv_affilie,
      rdv_non_affilie,
      sgn_week,
      sgn_month,
      yesterday,
      tomorrow,
      include_ko
    } = req.query;

    const includeArchive =
      include_archive === '1' ||
      include_archive === 1 ||
      include_archive === true ||
      include_archive === 'true';

    const ficheSearchFlag =
      req.query.fiche_search === '1' ||
      req.query.fiche_search === 1 ||
      req.query.fiche_search === true ||
      req.query.fiche_search === 'true';

    /** Évite COUNT/SELECT sur toute la table (ex. ?fiche_search=1 seul → ~800k lignes) */
    const qNarrow = (v) =>
      v !== undefined && v !== null && String(v).trim() !== '';
    if (ficheSearchFlag) {
      const hasNarrowing =
        qNarrow(id_etat_final) ||
        qNarrow(id_sous_etat) ||
        qNarrow(date_champ) ||
        qNarrow(date_debut) ||
        qNarrow(date_fin) ||
        qNarrow(critere) ||
        qNarrow(critere_champ) ||
        qNarrow(tel) ||
        qNarrow(cp) ||
        qNarrow(nom) ||
        qNarrow(prenom) ||
        qNarrow(produit) ||
        qNarrow(id_commercial) ||
        qNarrow(id_confirmateur) ||
        qNarrow(id_re) ||
        qNarrow(id_centre) ||
        qNarrow(id_agent) ||
        qNarrow(affectation) ||
        qNarrow(suivi) ||
        qNarrow(day_rdv) ||
        qNarrow(ko) ||
        qNarrow(hc) ||
        qNarrow(rdv_valid) ||
        qNarrow(rdv_non_valid) ||
        qNarrow(rdv_affilie) ||
        qNarrow(rdv_non_affilie) ||
        qNarrow(sgn_week) ||
        qNarrow(sgn_month) ||
        qNarrow(prof_ret) ||
        qNarrow(prof_celib) ||
        qNarrow(include_ko) ||
        qNarrow(req.query.annuler_repro_type) ||
        qNarrow(req.query.qualification_code) ||
        includeArchive ||
        qNarrow(w) ||
        qNarrow(y) ||
        yesterday === '1' ||
        yesterday === 1 ||
        tomorrow === '1' ||
        tomorrow === 1;
      if (!hasNarrowing) {
        return res.status(400).json({
          success: false,
          code: 'FICHES_SEARCH_TOO_BROAD',
          message:
            'Recherche trop large : indiquez au moins un critère (état, dates, téléphone, code postal, commercial, etc.).',
        });
      }
    }

    // Ne pas chercher par id_etat 54 pour les fiches KO : uniquement ko=1
    let idEtatFinalForWhere = id_etat_final;
    let koForWhere = ko;
    if (id_etat_final == 54 || id_etat_final === '54') {
      idEtatFinalForWhere = undefined;
      koForWhere = 1;
    }
    // ko : si fourni (ex. ko=1 pour fiches KO), on filtre par ko ; sinon on affiche toutes les fiches (pas de filtre ko=0 par défaut)
    const hasKoFilter = koForWhere !== undefined && koForWhere !== null && koForWhere !== '';
    let whereConditions = ['fiche.active = 1'];
    let params = [];
    let histoJoinForFichesHisto = '';
    let histoParamsForFichesHisto = [];
    const includeConfSlots =
      req.user.fonction === 6 &&
      (include_confirmateur_2 === '1' ||
        include_confirmateur_2 === 1 ||
        include_confirmateur_2 === true ||
        include_confirmateur_2 === 'true');

    const parsedConfIdForHisto =
      id_confirmateur && id_confirmateur !== 'all' ? parseInt(String(id_confirmateur), 10) : NaN;
    const histoTargetUserId =
      Number.isFinite(parsedConfIdForHisto) && parsedConfIdForHisto > 0
        ? parsedConfIdForHisto
        : req.user.id;

    const excludeHistoSecondaire =
      include_confirmateur_2 === '0' ||
      include_confirmateur_2 === 0 ||
      include_confirmateur_2 === false ||
      include_confirmateur_2 === 'false';

    /** Mes actions (fiches_histo) : 2e/3e colonnes sur la ligne d’historique si case cochée ou session conf. avec case cochée */
    const includeHistoMultiSlot =
      id_confirmateur && id_confirmateur !== 'all'
        ? !excludeHistoSecondaire
        : req.user.fonction === 6 && includeConfSlots;

    if (hasKoFilter) {
      whereConditions.push('(fiche.ko = ? OR (fiche.ko IS NULL AND ? = 0))');
      params.push(koForWhere, koForWhere);
    }
    if (!includeArchive) {
      // Par défaut, on exclut les fiches archivées
      whereConditions.push('(fiche.archive = 0 OR fiche.archive IS NULL)');
    }

    // Filtres par fonction - Par défaut pour commerciaux : fiches confirmées du jour
    const today = new Date().toISOString().split('T')[0];
    const y_m_d = today;
    
    // Vérifier si c'est une recherche active (critere ou autres filtres spécifiques)
    const isActiveSearch = req.query.fiche_search || req.query.affectation || req.query.suivi || 
                          req.query.critere || req.query.nom || req.query.prenom || 
                          req.query.tel || req.query.cp || req.query.produit || 
                          req.query.id_etat_final || req.query.id_commercial || 
                          req.query.id_confirmateur || req.query.id_re || req.query.id_centre;
    console.log(`[FICHES-${requestId}] isActiveSearch=${!!isActiveSearch} (fiche_search=${!!req.query.fiche_search}, affectation=${!!req.query.affectation}, suivi=${!!req.query.suivi}, critere=${!!req.query.critere})`);

    /** Confirmateur : recherche par critère ou tel → résultats globaux, sans filtre « dernier histo / moi » */
    const hasCritereOuTelSearch =
      (critere !== undefined && critere !== null && String(critere).trim() !== '') ||
      (tel !== undefined && tel !== null && String(tel).trim() !== '');

    if (req.user.fonction === 6 && req.query.fiche_search) {
      console.log(
        `[FICHES-${requestId}] CONF6_FILTRE: fiche_search=1 isActiveSearch=${!!isActiveSearch} date_champ=${date_champ ?? '(vide)'} date_debut=${date_debut ?? ''} date_fin=${date_fin ?? ''} time_debut=${time_debut ?? ''} time_fin=${time_fin ?? ''} include_confirmateur_2(raw)=${JSON.stringify(include_confirmateur_2)} includeConfSlots=${includeConfSlots} hasCritereOuTelSearch=${hasCritereOuTelSearch}`
      );
    }

    if (!isActiveSearch) {
      if (req.user.fonction === 5) {
        // Commerciaux : RDV du jour avec état final 7
        whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
        whereConditions.push('fiche.id_etat_final = ?');
        whereConditions.push('fiche.id_commercial = ?');
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, 7, req.user.id);
      } else if (req.user.fonction === 3) {
        // Agents Qualification : Fiches créées aujourd'hui, assignées à l'agent (id_agent uniquement)
        console.log(`[FICHES-${requestId}] Filtre Agent Qualif: date_insert_time ${y_m_d} 00:00:00 -> 23:59:59, id_agent=${req.user.id}`);
        whereConditions.push('fiche.date_insert_time >= ? AND fiche.date_insert_time <= ?');
        whereConditions.push('fiche.id_agent = ?');
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, req.user.id);
      } else if (req.user.fonction === 6) {
        const j = confirmateurDerniereLigneHistoJoin(
          `${y_m_d} 00:00:00`,
          `${y_m_d} 23:59:59`,
          histoTargetUserId,
          includeHistoMultiSlot
        );
        histoJoinForFichesHisto = j.joinSql;
        histoParamsForFichesHisto = j.params;
      }
    } else {
      // Filtres par fonction quand recherche active
      if (req.user.fonction === 3) {
        // Agents Qualification : Filtrer par id_agent pour limiter aux fiches de l'agent
        console.log(`[FICHES-${requestId}] Filtre Agent Qualif (recherche active): id_agent=${req.user.id}`);
        whereConditions.push('fiche.id_agent = ?');
        params.push(req.user.id);
      } else if (req.user.fonction === 5 && !affectation) {
        whereConditions.push('fiche.id_commercial = ?');
        params.push(req.user.id);
      } else if (req.user.fonction === 6) {
        // Confirmateurs : périmètre "fiches touchées par le connecté" appliqué après les filtres de date
        // (EXISTS sur fiches_histo ou JOIN si date_champ=fiches_histo). Ne pas filtrer ici par COALESCE.
      }
    }

    // Filtre par groupes d'états autorisés (selon les permissions)
    // Pour les agents qualification (fonction 3), on a déjà filtré par groupe 0 dans le filtre par défaut
    // Donc on ne doit pas appliquer le filtre de permissions si c'est un agent qualification sans recherche
    // Pour les confirmateurs (6) en recherche par critère (tel, CP, etc.), ne pas filtrer par état : afficher l'état de la fiche même s'il est hors droit confirmateur
    const hasRechercheParCritereConfirmateur = req.user.fonction === 6 && !!(req.query.tel || req.query.critere);
    const shouldApplyPermissionFilter = !(req.user.fonction === 3 && !req.query.fiche_search && !req.query.affectation && !req.query.suivi)
      && !hasRechercheParCritereConfirmateur;
    console.log(`[FICHES-${requestId}] shouldApplyPermissionFilter=${shouldApplyPermissionFilter}`);

    if (shouldApplyPermissionFilter) {
      // Utiliser la fonction mise en cache pour récupérer les groupes autorisés
      const { allowedGroups, anyPermissionExists } = await getEtatGroupsAndPermissions(req.user.fonction);
      
      if (anyPermissionExists) {
        
        // Si aucune permission n'est accordée, ne pas retourner de fiches
        if (allowedGroups.length === 0) {
          // Aucun groupe autorisé, retourner un résultat vide
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            }
          });
        }
        
        // Ajouter le groupe 0 aux groupes autorisés pour voir toutes les fiches (KO, HC, doublon, etc.)
        const allAllowedGroups = [...new Set([...allowedGroups, '0'])];
        
        // Filtrer selon les groupes autorisés (incluant groupe 0)
        // Note: groupe est un VARCHAR, donc on compare avec des chaînes
        // Pour les commerciaux (fonction 5), ajouter aussi l'état CONFIRMER (7) en plus des groupes autorisés
        if (req.user.fonction === 5) {
          // Commerciaux : Phase 3 (groupe 3) + CONFIRMER (état 7) + groupe 0
          whereConditions.push(`EXISTS (
            SELECT 1 FROM etats e 
            WHERE e.id = fiche.id_etat_final 
            AND (CAST(e.groupe AS CHAR) IN (${allAllowedGroups.map(() => '?').join(',')}) OR fiche.id_etat_final = 7)
          )`);
          params.push(...allAllowedGroups.map(g => String(g)));
        } else {
          whereConditions.push(`EXISTS (
            SELECT 1 FROM etats e 
            WHERE e.id = fiche.id_etat_final 
            AND CAST(e.groupe AS CHAR) IN (${allAllowedGroups.map(() => '?').join(',')})
          )`);
          params.push(...allAllowedGroups.map(g => String(g)));
        }
      }
      // Si aucune permission n'existe dans la base, ne pas filtrer (rétrocompatibilité)
    }

    // NOTE: On n'exclut plus les états du groupe 0 - toutes les fiches sont visibles
    // (ko, hc, doublon, etc.)

    // Filtres de recherche
    if (nom) {
      whereConditions.push('LOWER(fiche.nom) LIKE ?');
      params.push(`%${nom.toLowerCase()}%`);
    }
    if (prenom) {
      whereConditions.push('LOWER(fiche.prenom) LIKE ?');
      params.push(`%${prenom.toLowerCase()}%`);
    }
    // Recherche par critère
    if (critere) {
      // Si critere_champ n'est pas fourni, utiliser 'tel' par défaut
      const champRecherche = critere_champ || 'tel';
      
      if (champRecherche === 'tel') {
        whereConditions.push('(fiche.tel = ? OR fiche.gsm1 = ? OR fiche.gsm2 = ?)');
        params.push(critere, critere, critere);
      } else if (champRecherche === 'cp') {
        whereConditions.push('fiche.cp LIKE ?');
        params.push(`${critere}%`);
      } else if (champRecherche === 'commentaire') {
        whereConditions.push('LOWER(fiche.commentaire) LIKE ? OR LOWER(fiche.conf_commentaire_produit) LIKE ?');
        params.push(`%${critere.toLowerCase()}%`, `%${critere.toLowerCase()}%`);
      } else {
        // Pour les autres champs, recherche LIKE
        whereConditions.push(`fiche.${champRecherche} LIKE ?`);
        params.push(`%${critere}%`);
      }
    }
    if (tel) {
      whereConditions.push('(fiche.tel = ? OR fiche.gsm1 = ? OR fiche.gsm2 = ?)');
      params.push(tel, tel, tel);
    }
    if (cp) {
      // Support de plusieurs départements séparés par des virgules
      const departements = cp.split(',').map(d => d.trim()).filter(d => d.length > 0);
      if (departements.length > 0) {
        if (departements.length === 1) {
          // Un seul département
          whereConditions.push('SUBSTRING(fiche.cp, 1, 2) = ?');
          params.push(departements[0]);
        } else {
          // Plusieurs départements
          whereConditions.push(`SUBSTRING(fiche.cp, 1, 2) IN (${departements.map(() => '?').join(',')})`);
          params.push(...departements);
        }
      }
    }
    if (produit) {
      const produits = Array.isArray(produit) ? produit : [produit];
      whereConditions.push(`fiche.produit IN (${produits.map(() => '?').join(',')})`);
      params.push(...produits);
    }
    // Vérifier si la table qualif existe (une seule fois pour toute la requête)
    // Vérifier si la table qualif existe (avec cache)
    const qualifTableExists = await checkQualifTableExists();
    
    // Filtre par qualification (RDV_URGENT) - sera géré dans la requête SQL
    let needsQualifJoin = false;
    let qualificationCondition = null;
    
    if (req.query.qualification_code) {
      needsQualifJoin = qualifTableExists;
      if (qualifTableExists) {
        // Si la table existe, utiliser qualif.code
        qualificationCondition = 'qualif.code = ?';
      } else {
        // Si la table n'existe pas, id_qualif peut contenir directement le code
        qualificationCondition = 'fiche.id_qualif = ?';
      }
    }
    
    if (idEtatFinalForWhere !== undefined && idEtatFinalForWhere !== null && idEtatFinalForWhere !== '') {
      if (idEtatFinalForWhere === 't_s') {
        whereConditions.push('(fiche.id_etat_final = 13 OR fiche.id_etat_final = 45 OR fiche.id_etat_final = 44 OR fiche.id_etat_final = 16 OR fiche.id_etat_final = 38)');
      } else {
        const etatFinal = Array.isArray(idEtatFinalForWhere) ? idEtatFinalForWhere : [idEtatFinalForWhere];
        const etatIds = etatFinal.map(e => parseInt(e, 10)).filter(n => !Number.isNaN(n));
        if (etatIds.length === 1) {
          if (qualificationCondition) {
            whereConditions.push(`(fiche.id_etat_final = ? OR ${qualificationCondition})`);
            params.push(etatIds[0], req.query.qualification_code);
          } else {
            whereConditions.push('fiche.id_etat_final = ?');
            params.push(etatIds[0]);
          }
        } else if (etatIds.length > 1) {
          if (qualificationCondition) {
            whereConditions.push(`(fiche.id_etat_final IN (${etatIds.map(() => '?').join(',')}) OR ${qualificationCondition})`);
            params.push(...etatIds, req.query.qualification_code);
          } else {
            whereConditions.push(`fiche.id_etat_final IN (${etatIds.map(() => '?').join(',')})`);
            params.push(...etatIds);
          }
        }
      }
    } else if (qualificationCondition) {
      // Si seulement qualification_code est fourni (sans id_etat_final)
      whereConditions.push(qualificationCondition);
      params.push(req.query.qualification_code);
    }
    // Annuler à reprogrammer (id 8) et Client honoré à suivre (id 9) : affiner par COMPTE RENDU ou REPRO CONFIRMATEURS
    // Uniquement les fiches dont l'état actuel (dernière entrée historio) est 8 ou 9 et provient d'un CR (from_compte_rendu)
    const annulerReproType = req.query.annuler_repro_type;
    const arEtatId =
      idEtatFinalForWhere === 8 || idEtatFinalForWhere === '8'
        ? 8
        : idEtatFinalForWhere === 9 || idEtatFinalForWhere === '9'
          ? 9
          : null;
    if (annulerReproType && arEtatId !== null) {
      const lastHistoIsEtatFromCR = `EXISTS (
        SELECT 1 FROM fiches_histo fh
        WHERE fh.id_fiche = fiche.id AND fh.id_etat = ${arEtatId} AND fh.from_compte_rendu = 1
        AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fiche.id)
      )`;
      if (annulerReproType === 'compte_rendu') {
        whereConditions.push(lastHistoIsEtatFromCR);
      } else if (annulerReproType === 'repro_confirmateurs') {
        whereConditions.push(`NOT (${lastHistoIsEtatFromCR})`);
      }
    }
    if (id_sous_etat !== undefined && id_sous_etat !== null && id_sous_etat !== '' && id_sous_etat !== 'tout') {
      whereConditions.push('fiche.id_sous_etat = ?');
      params.push(id_sous_etat);
    }
    if (id_commercial) {
      whereConditions.push('(fiche.id_commercial = ? OR fiche.id_commercial_2 = ?)');
      params.push(id_commercial, id_commercial);
    }
    // RP Confirmation (13) : rappels par RE (id_etat_final=19), filtre par id_re (Tous = tous les RE sous le RP)
    if (req.user.fonction === 13 && (idEtatFinalForWhere == 19 || idEtatFinalForWhere === '19')) {
      const reSousRP = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 14 AND etat > 0',
        [req.user.id]
      );
      const reIds = reSousRP.map((r) => r.id);
      let idsConfirmateurs = [];
      if (id_re && id_re !== 'all') {
        if (!reIds.includes(parseInt(id_re, 10))) {
          whereConditions.push('1 = 0');
        } else {
          const confs = await query(
            'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 6 AND etat > 0',
            [id_re]
          );
          idsConfirmateurs = confs.map((c) => c.id);
        }
      } else {
        if (reIds.length > 0) {
          const placeholders = reIds.map(() => '?').join(',');
          const confs = await query(
            `SELECT id FROM utilisateurs WHERE chef_equipe IN (${placeholders}) AND fonction = 6 AND etat > 0`,
            reIds
          );
          idsConfirmateurs = confs.map((c) => c.id);
        }
      }
      if (idsConfirmateurs.length > 0) {
        const ph = idsConfirmateurs.map(() => '?').join(',');
        whereConditions.push(`(fiche.id_confirmateur IN (${ph}) OR fiche.id_confirmateur_2 IN (${ph}) OR fiche.id_confirmateur_3 IN (${ph}))`);
        params.push(...idsConfirmateurs, ...idsConfirmateurs, ...idsConfirmateurs);
      } else if (!(id_re && id_re !== 'all' && !reIds.includes(parseInt(id_re, 10)))) {
        whereConditions.push('1 = 0');
      }
    // Filtre par confirmateur : pour toutes les sessions Dashboard sauf confirmateur (fonction 6).
    // include_confirmateur_2=0 : uniquement 1er confirmateur ; sinon (défaut) inclure aussi 2ème et 3ème.
    // Pas de filtre sur les slots fiche si « Mes actions » : le JOIN fiches_histo ci-dessous fait foi.
    } else if (
      id_confirmateur &&
      id_confirmateur !== 'all' &&
      req.user.fonction !== 6 &&
      String(date_champ) !== 'fiches_histo'
    ) {
      const excludeConfirmateur2 = include_confirmateur_2 === '0' || include_confirmateur_2 === 0 || include_confirmateur_2 === false || include_confirmateur_2 === 'false';
      if (excludeConfirmateur2) {
        whereConditions.push('fiche.id_confirmateur = ?');
        params.push(id_confirmateur);
      } else {
        whereConditions.push('(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)');
        params.push(id_confirmateur, id_confirmateur, id_confirmateur);
      }
    }
    if (id_centre) {
      whereConditions.push('fiche.id_centre = ?');
      params.push(id_centre);
    }
    // Superviseur qualification (fonction 2) : uniquement les fiches des agents (fonction 3) rattachés en chef_equipe
    if (req.user.fonction === 2) {
      const superviseurAgents = await query(
        `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      const allowedAgentIds = (superviseurAgents || []).map((a) => a.id);
      if (id_agent !== undefined && id_agent !== null && String(id_agent).trim() !== '') {
        const want = parseInt(String(id_agent), 10);
        if (!Number.isFinite(want) || !allowedAgentIds.includes(want)) {
          whereConditions.push('1 = 0');
        } else {
          whereConditions.push('fiche.id_agent = ?');
          params.push(want);
        }
      } else if (allowedAgentIds.length > 0) {
        whereConditions.push(`fiche.id_agent IN (${allowedAgentIds.map(() => '?').join(',')})`);
        params.push(...allowedAgentIds);
      } else {
        whereConditions.push('1 = 0');
      }
    } else if (id_agent) {
      whereConditions.push('fiche.id_agent = ?');
      params.push(id_agent);
    }
    // ko : filtre déjà appliqué en début de route (lignes 393-396)
    if (hc !== undefined && hc !== '') {
      whereConditions.push('fiche.hc = ?');
      params.push(hc);
    }
    if (prof_ret) {
      whereConditions.push(`(fiche.profession_mr LIKE 'ret%' OR fiche.profession_mr LIKE 'Ret%' OR fiche.profession_mr LIKE 'RET%' OR fiche.profession_mr = '610' OR fiche.profession_madame LIKE 'ret%' OR fiche.profession_madame LIKE 'Ret%' OR fiche.profession_madame LIKE 'RET%' OR fiche.profession_madame = '610')`);
    }
    if (prof_celib) {
      whereConditions.push(`(fiche.situation_conjugale LIKE 'CELIB%' OR fiche.situation_conjugale LIKE 'Celib%' OR fiche.situation_conjugale LIKE 'celib%')`);
    }
    if (rdv_valid) {
      whereConditions.push('fiche.valider = 1');
    }
    if (rdv_non_valid) {
      whereConditions.push('fiche.valider = 0');
    }
    if (day_rdv) {
      whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
      params.push(`${day_rdv} 00:00:00`, `${day_rdv} 23:59:59`);
    }
    if (yesterday) {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yDate = yesterdayDate.toISOString().split('T')[0];
      whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
      whereConditions.push('fiche.id_etat_final = ?');
      params.push(`${yDate} 00:00:00`, `${yDate} 23:59:59`, 7);
    }
    if (tomorrow) {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tDate = tomorrowDate.toISOString().split('T')[0];
      whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
      whereConditions.push('fiche.id_etat_final = ?');
      params.push(`${tDate} 00:00:00`, `${tDate} 23:59:59`, 7);
    }
    if (affectation) {
      whereConditions.push('fiche.id_commercial = ?');
      params.push(affectation);
      if (!day_rdv && !w) {
        whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
        whereConditions.push('fiche.id_etat_final = ?');
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, 7);
      }
    }
    // Filtres de date avec validation du champ de date
    if (date_champ) {
      // Valider que date_champ est une colonne de date autorisée (sécurité)
      // confirmations = filtre par date_creation dans table confirmations
      // fiches_histo = fiches statuées aujourd'hui par le confirmateur connecté (table fiches_histo, id_confirmateur)
      const allowedDateColumns = ['date_insert_time', 'date_modif_time', 'date_rdv_time', 'date_appel_time', 'date_confirmation', 'date_qualif', 'date_sign_time', 'fiches_histo_confirmation', 'fiches_histo', 'confirmations'];
      if (!allowedDateColumns.includes(date_champ)) {
        return res.status(400).json({
          success: false,
          message: `Colonne de date non autorisée: ${date_champ}`
        });
      }
      
      // Normaliser les valeurs de date (supprimer les chaînes vides)
      const dateDebut = date_debut && String(date_debut).trim() !== '' ? date_debut : null;
      const dateFin = date_fin && String(date_fin).trim() !== '' ? date_fin : null;
      
      // Appliquer le filtre seulement si on a au moins une date
      if (dateDebut || dateFin) {
        const timeStart = time_debut && String(time_debut).trim() !== '' ? time_debut : '00:00:00';
        const timeEnd = time_fin && String(time_fin).trim() !== '' ? time_fin : '23:59:59';
        
        // fiches_histo : confirmateur 6 → dernière ligne fiches_histo (MAX(id)) = connecté + date_creation dans la plage.
        // Autres profils : JOIN dernière ligne dont la date_creation est dans la plage.
        if (date_champ === 'fiches_histo' && !(req.user.fonction === 6 && hasCritereOuTelSearch)) {
          const startDatetime = `${dateDebut || dateFin} ${timeStart}`;
          const endDatetime = `${dateFin || dateDebut} ${timeEnd}`;
          if (req.user.fonction === 6 && !hasCritereOuTelSearch) {
            const j = confirmateurDerniereLigneHistoJoin(
              startDatetime,
              endDatetime,
              histoTargetUserId,
              includeHistoMultiSlot
            );
            histoJoinForFichesHisto = j.joinSql;
            histoParamsForFichesHisto = j.params;
            console.log(
              `[FICHES-${requestId}] CONF6 date_champ=fiches_histo → JOIN dernière ligne histo = conf ${histoTargetUserId} (multiSlot=${includeHistoMultiSlot}) [${startDatetime}] — [${endDatetime}]`
            );
          } else {
            const j = fichesHistoLastInRangeJoin(
              startDatetime,
              endDatetime,
              histoTargetUserId,
              includeHistoMultiSlot
            );
            histoJoinForFichesHisto = j.joinSql;
            histoParamsForFichesHisto = j.params;
            console.log(
              `[FICHES-${requestId}] date_champ=fiches_histo → JOIN histo dans plage = conf ${histoTargetUserId} (multiSlot=${includeHistoMultiSlot}) [${startDatetime}] — [${endDatetime}]`
            );
          }
        } else if (date_champ === 'fiches_histo' && req.user.fonction === 6 && hasCritereOuTelSearch) {
          console.log(`[FICHES-${requestId}] Confirmateur: critère/tel — pas de JOIN fiches_histo (recherche globale)`);
        } else if (date_champ === 'confirmations' || date_champ === 'fiches_histo_confirmation') {
          // Fiches confirmées : basé sur fiches_histo (id_etat=7, date_creation dans la plage)
          const startDatetime = `${dateDebut || dateFin} ${timeStart}`;
          const endDatetime = `${dateFin || dateDebut} ${timeEnd}`;
          whereConditions.push(`fiche.id_etat_final = 7`);
          histoJoinForFichesHisto = `INNER JOIN (SELECT DISTINCT id_fiche FROM fiches_histo WHERE id_etat = 7 AND date_creation >= ? AND date_creation <= ?) histo_conf ON fiche.id = histo_conf.id_fiche`;
          histoParamsForFichesHisto = [startDatetime, endDatetime];
        } else if (date_champ === 'date_confirmation') {
          // Convertir les dates en timestamps Unix
          const startTimestamp = Math.floor(new Date(`${dateDebut || dateFin} ${timeStart}`).getTime() / 1000);
          const endTimestamp = Math.floor(new Date(`${dateFin || dateDebut} ${timeEnd}`).getTime() / 1000);
          const histoDate = dateDebut || dateFin;
          // Inclure si : date_confirmation dans la plage OU (date_confirmation NULL et passage à l'état 7 dans l'historique à cette date)
          if (dateDebut && dateFin) {
            whereConditions.push(`(
              (fiche.date_confirmation IS NOT NULL AND fiche.date_confirmation >= ? AND fiche.date_confirmation <= ?)
              OR (fiche.date_confirmation IS NULL AND EXISTS (
                SELECT 1 FROM fiches_histo h WHERE h.id_fiche = fiche.id AND h.id_etat = 7 AND DATE(h.date_creation) = ?
              ))
            )`);
            params.push(startTimestamp, endTimestamp, histoDate);
          } else if (dateDebut) {
            whereConditions.push(`(
              (fiche.date_confirmation IS NOT NULL AND fiche.date_confirmation >= ?)
              OR (fiche.date_confirmation IS NULL AND EXISTS (
                SELECT 1 FROM fiches_histo h WHERE h.id_fiche = fiche.id AND h.id_etat = 7 AND DATE(h.date_creation) = ?
              ))
            )`);
            params.push(startTimestamp, histoDate);
          } else if (dateFin) {
            whereConditions.push(`(
              (fiche.date_confirmation IS NOT NULL AND fiche.date_confirmation <= ?)
              OR (fiche.date_confirmation IS NULL AND EXISTS (
                SELECT 1 FROM fiches_histo h WHERE h.id_fiche = fiche.id AND h.id_etat = 7 AND DATE(h.date_creation) = ?
              ))
            )`);
            params.push(endTimestamp, histoDate);
          }
        } else {
          // Pour les autres champs de date (datetime)
          // S'assurer que la colonne de date n'est pas NULL ou vide
          whereConditions.push(`fiche.${date_champ} IS NOT NULL`);
          whereConditions.push(`fiche.${date_champ} != ''`);
          
          if (dateDebut && dateFin) {
            // Plage de dates complète
            whereConditions.push(`fiche.${date_champ} >= ? AND fiche.${date_champ} <= ?`);
            params.push(`${dateDebut} ${timeStart}`, `${dateFin} ${timeEnd}`);
          } else if (dateDebut) {
            // Seulement date de début
            whereConditions.push(`fiche.${date_champ} >= ?`);
            params.push(`${dateDebut} ${timeStart}`);
          } else if (dateFin) {
            // Seulement date de fin
            whereConditions.push(`fiche.${date_champ} <= ?`);
            params.push(`${dateFin} ${timeEnd}`);
          }
        }
      }
    } else if (!isActiveSearch && !date_debut && !date_fin && !date_champ) {
      // Par défaut, si aucune recherche active et aucun filtre de date spécifié,
      // filtrer par fiches créées aujourd'hui (date_insert_time)
      // Ceci ne s'applique que si aucun filtre de date n'a été spécifié et qu'il n'y a pas de recherche active
      // Note: Les filtres par fonction spécifiques (commerciaux avec date_rdv, agents qualif, confirmateurs) sont déjà gérés ci-dessus
      // Cette règle s'applique pour tous les autres utilisateurs ou si aucun filtre spécifique n'a été appliqué
      
      // Vérifier si un filtre de date a déjà été ajouté dans les filtres par fonction ci-dessus
      const hasDateFilterAlready = whereConditions.some(cond => 
        cond.includes('date_insert_time') || 
        cond.includes('date_modif_time') || 
        cond.includes('date_rdv_time')
      );
      
      if (!hasDateFilterAlready) {
        // Filtrer par fiches créées aujourd'hui par défaut
        whereConditions.push('fiche.date_insert_time IS NOT NULL');
        whereConditions.push('fiche.date_insert_time != ""');
        whereConditions.push('fiche.date_insert_time >= ? AND fiche.date_insert_time <= ?');
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`);
        console.log(`[FICHES-${requestId}] Filtre par défaut: fiches créées aujourd'hui (date_insert_time)`);
      }
    }

    // Session confirmateur (Dashboard / fiche_search) : périmètre depuis la table fiches — id_confirmateur (1er) ;
    // id_confirmateur_2 et id_confirmateur_3 si include_confirmateur_2=1. La plage « Mes actions (fiches_histo) »
    // est gérée ci-dessus via dernière ligne fiches_histo : ne pas restreindre en plus sur fiche.id_confirmateur.
    if (req.user.fonction === 6 && isActiveSearch && !hasCritereOuTelSearch && date_champ !== 'fiches_histo') {
      if (includeConfSlots) {
        whereConditions.push(
          '(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)'
        );
        params.push(req.user.id, req.user.id, req.user.id);
        console.log(
          `[FICHES-${requestId}] Confirmateur: périmètre fiches id_confirmateur / _2 / _3 = ${req.user.id}`
        );
      } else {
        whereConditions.push('fiche.id_confirmateur = ?');
        params.push(req.user.id);
        console.log(
          `[FICHES-${requestId}] Confirmateur: périmètre fiches id_confirmateur = ${req.user.id}`
        );
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Log de la clause WHERE et des paramètres pour debugging
    console.log(`[FICHES-${requestId}] WHERE clause: ${whereClause}`);
    console.log(`[FICHES-${requestId}] WHERE params (${params.length}):`, JSON.stringify(params));

    // Configurer GROUP_CONCAT pour éviter les troncatures
    await query('SET SESSION group_concat_max_len = 1000000');

    // Compter le total (inclure le JOIN qualif et histo si nécessaire)
    const qualifJoinForCount = needsQualifJoin && qualifTableExists 
      ? 'LEFT JOIN qualif ON fiche.id_qualif = qualif.id' 
      : '';
    const countParams = histoJoinForFichesHisto ? [...histoParamsForFichesHisto, ...params] : params;

    // Log des requêtes SQL exécutées pour agent qualification (fonction 3)
    if (req.user.fonction === 3) {
      const countSql = `SELECT COUNT(DISTINCT fiche.id) as total FROM fiches fiche ${histoJoinForFichesHisto} ${qualifJoinForCount} ${whereClause}`;
      console.log(`[FICHES-${requestId}] [AGENT_QUALIF] COUNT SQL:`, countSql);
      console.log(`[FICHES-${requestId}] [AGENT_QUALIF] COUNT params:`, JSON.stringify(countParams));
    }
    if (req.user.fonction === 6 && isActiveSearch) {
      const countSqlPreview = `SELECT COUNT(DISTINCT fiche.id) as total FROM fiches fiche ${histoJoinForFichesHisto} ${qualifJoinForCount} ${whereClause}`;
      console.log(`[FICHES-${requestId}] CONF6_COUNT_SQL:`, countSqlPreview);
      console.log(`[FICHES-${requestId}] CONF6_COUNT_PARAMS (${countParams.length}):`, JSON.stringify(countParams));
      console.log(
        `[FICHES-${requestId}] CONF6_JOINS: histoJoin=${histoJoinForFichesHisto ? 'oui' : 'non'} qualifJoin=${qualifJoinForCount ? 'oui' : 'non'}`
      );
    }

    // Compter le total
    const countStartTime = Date.now();
    const countResult = await queryOne(
      `SELECT COUNT(DISTINCT fiche.id) as total FROM fiches fiche ${histoJoinForFichesHisto} ${qualifJoinForCount} ${whereClause}`,
      countParams
    );
    const total = countResult.total;
    const countDuration = Date.now() - countStartTime;
    console.log(`[FICHES-${requestId}] COUNT query: ${countDuration}ms → total=${total} fiches`);

    if (req.user.fonction === 6 && isActiveSearch && Number(total) === 0) {
      try {
        const baseArchive = '(fiche.active = 1 AND (fiche.archive = 0 OR fiche.archive IS NULL))';
        const d1 = await queryOne(
          `SELECT COUNT(*) as c FROM fiches fiche WHERE ${baseArchive} AND fiche.id_confirmateur = ?`,
          [req.user.id]
        );
        const d2 = await queryOne(
          `SELECT COUNT(*) as c FROM fiches fiche WHERE ${baseArchive} AND (fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)`,
          [req.user.id, req.user.id, req.user.id]
        );
        console.log(
          `[FICHES-${requestId}] CONF6_DIAG (total=0): fiches avec id_confirmateur=${req.user.id} → ${d1.c} | avec id en conf1/2/3 → ${d2.c} (repère: absence d’assignation vs filtres date/état/permissions)`
        );
      } catch (e) {
        console.warn(`[FICHES-${requestId}] CONF6_DIAG erreur:`, e?.message || e);
      }
    }

    // Calculer la pagination
    const offset = (page - 1) * limit;

    // Construire le JOIN qualif si nécessaire (toujours l'ajouter pour récupérer qualification_code)
    const qualifJoin = qualifTableExists ? 'LEFT JOIN qualif ON fiche.id_qualif = qualif.id' : '';
    const qualifSelect = qualifTableExists 
      ? ', qualif.code as qualification_code' 
      : ', CASE WHEN fiche.id_qualif IS NOT NULL AND fiche.id_qualif != "" AND fiche.id_qualif != "0" THEN fiche.id_qualif ELSE NULL END as qualification_code';

    // Récupérer les fiches avec historique et décalages
    // Optimisation: utiliser une sous-requête pour l'historique au lieu de GROUP_CONCAT avec JOIN
    // Cela évite de créer un produit cartésien qui peut ralentir la requête
    const selectStartTime = Date.now();
    const selectQuery = `SELECT fiche.*,
       etat.titre as etat_titre,
       etat.color as etat_color,
       cq_e.titre as cqe,
       cq_d.titre as cqd,
       install.nom as installeur,
       NULL as id_etat_histo,
       decale.message as decale_message,
       decale.expediteur as decale_expediteur,
       decale_etat.titre as etat_dec,
       u1.pseudo as confirmateur_pseudo,
       u2.pseudo as confirmateur_2_pseudo,
       u3.pseudo as confirmateur_3_pseudo
       ${qualifSelect}
       FROM fiches fiche
       LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
       LEFT JOIN cq_etat cq_e ON fiche.cq_etat = cq_e.id
       LEFT JOIN cq_dossier cq_d ON fiche.cq_dossier = cq_d.id
       LEFT JOIN installateurs install ON fiche.ph3_installateur = install.id
       LEFT JOIN decalages decale ON fiche.id = decale.id_fiche
       LEFT JOIN etat_decalage decale_etat ON decale.id_etat = decale_etat.id
       LEFT JOIN utilisateurs u1 ON fiche.id_confirmateur = u1.id
       LEFT JOIN utilisateurs u2 ON fiche.id_confirmateur_2 = u2.id
       LEFT JOIN utilisateurs u3 ON fiche.id_confirmateur_3 = u3.id
       ${histoJoinForFichesHisto}
       ${qualifJoin}
       ${whereClause}
       GROUP BY fiche.id
       ORDER BY fiche.date_rdv_time ASC
       LIMIT ? OFFSET ?`;
    const selectParams = histoJoinForFichesHisto ? [...histoParamsForFichesHisto, ...params, parseInt(limit), offset] : [...params, parseInt(limit), offset];
    if (req.user.fonction === 3) {
      console.log(`[FICHES-${requestId}] [AGENT_QUALIF] SELECT SQL:`, selectQuery);
      console.log(`[FICHES-${requestId}] [AGENT_QUALIF] SELECT params:`, JSON.stringify(selectParams));
    }
    console.log(`[FICHES-${requestId}] SELECT query - limit=${limit}, offset=${offset}, page=${page}`);
    const fiches = await query(selectQuery, selectParams);
    const selectDuration = Date.now() - selectStartTime;
    console.log(`[FICHES-${requestId}] SELECT query: ${selectDuration}ms → ${fiches.length} fiches`);

    await attachIdEtatHistoToFiches(fiches);

    // Enrichir les fiches : has_etat_changed_by_compte_rendu + compte_rendu_commercial_pseudo (dernier CR approuvé)
    if (fiches.length > 0) {
      const ficheIds = fiches.map((f) => f.id);
      const crWithCommercial = [];
      const lastHistoConfRows = [];
      for (const chunk of chunkArray(ficheIds, FICHE_IDS_IN_CHUNK)) {
        const placeholders = chunk.map(() => '?').join(',');
        const crQuery = `
        SELECT cr.id_fiche, u.pseudo as compte_rendu_commercial_pseudo
        FROM compte_rendu_pending cr
        LEFT JOIN utilisateurs u ON cr.id_commercial = u.id
        INNER JOIN (
          SELECT id_fiche, MAX(id) as max_id
          FROM compte_rendu_pending
          WHERE statut = 'approved' AND id_fiche IN (${placeholders})
          GROUP BY id_fiche
        ) last_cr ON cr.id_fiche = last_cr.id_fiche AND cr.id = last_cr.max_id
        WHERE cr.statut = 'approved'
      `;
        crWithCommercial.push(...(await query(crQuery, chunk)));
        lastHistoConfRows.push(
          ...(await query(
            `SELECT fh.id_fiche, fh.id_confirmateur, fh.id_confirmateur_2, fh.id_confirmateur_3,
              fh.conf_commentaire_produit AS histo_last_conf_commentaire
         FROM fiches_histo fh
         INNER JOIN (
           SELECT id_fiche, MAX(id) AS max_id
           FROM fiches_histo
           WHERE id_fiche IN (${placeholders})
           GROUP BY id_fiche
         ) fh_last ON fh.id_fiche = fh_last.id_fiche AND fh.id = fh_last.max_id`,
            chunk
          ))
        );
      }
      const crByFiche = new Map(crWithCommercial.map((r) => [r.id_fiche, r.compte_rendu_commercial_pseudo || null]));
      fiches.forEach((fiche) => {
        fiche.has_etat_changed_by_compte_rendu = crByFiche.has(fiche.id);
        fiche.compte_rendu_commercial_pseudo = crByFiche.get(fiche.id) || null;
      });

      // Colonne Confirmateur (Dashboard / listes) : confirmateur(s) de la DERNIÈRE ligne fiches_histo (MAX(id)),
      // champs id_confirmateur, id_confirmateur_2, id_confirmateur_3 sur cette ligne uniquement.
      const histoLastCommentByFiche = new Map();
      const confIdsByFiche = new Map();
      for (const row of lastHistoConfRows) {
        const fid = Number(row.id_fiche);
        if (!Number.isFinite(fid)) continue;
        histoLastCommentByFiche.set(fid, row.histo_last_conf_commentaire ?? null);
        const candidates = [row.id_confirmateur, row.id_confirmateur_2, row.id_confirmateur_3]
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0);
        const uniq = [];
        for (const cid of candidates) {
          if (!uniq.includes(cid)) uniq.push(cid);
        }
        confIdsByFiche.set(fid, uniq.slice(0, 3));
      }
      const allConfIds = [...new Set(ficheIds.flatMap((fid) => confIdsByFiche.get(Number(fid)) || []))];
      let idToPseudo = new Map();
      if (allConfIds.length > 0) {
        const ph = allConfIds.map(() => '?').join(',');
        const userRows = await query(`SELECT id, pseudo FROM utilisateurs WHERE id IN (${ph})`, allConfIds);
        idToPseudo = new Map(userRows.map((u) => [Number(u.id), u.pseudo]));
      }
      fiches.forEach((fiche) => {
        fiche.histo_last_conf_commentaire = histoLastCommentByFiche.get(Number(fiche.id)) ?? null;
        const ids = confIdsByFiche.get(Number(fiche.id)) || [];
        const parts = ids.map((id) => idToPseudo.get(id) || `ID${id}`).filter(Boolean);
        fiche.histo_confirmateurs_pseudo = parts.length > 0 ? parts.join(' | ') : null;
      });
    }

    // État actuel = compte rendu : vrai ssi la dernière entrée fiches_histo a from_compte_rendu = 1 (pour affichage <CR> colonne état final)
    if (fiches.length > 0) {
      const ficheIds = fiches.map((f) => f.id);
      const currentStateFromCrRows = [];
      for (const chunk of chunkArray(ficheIds, FICHE_IDS_IN_CHUNK)) {
        const placeholders = chunk.map(() => '?').join(',');
        const currentStateFromCrQuery = `
        SELECT fh.id_fiche
        FROM fiches_histo fh
        INNER JOIN (
          SELECT id_fiche, MAX(id) as max_id
          FROM fiches_histo
          WHERE id_fiche IN (${placeholders})
          GROUP BY id_fiche
        ) last ON fh.id_fiche = last.id_fiche AND fh.id = last.max_id
        WHERE fh.from_compte_rendu = 1
      `;
        currentStateFromCrRows.push(...(await query(currentStateFromCrQuery, chunk)));
      }
      const currentStateFromCrSet = new Set(currentStateFromCrRows.map((r) => r.id_fiche));
      fiches.forEach((fiche) => {
        fiche.current_state_from_compte_rendu = currentStateFromCrSet.has(fiche.id);
      });
    }

    // Ajouter le hash pour chaque fiche (masquer l'ID)
    const hashStartTime = Date.now();
    const fichesWithHash = fiches.map(fiche => ({
      ...fiche,
      hash: encodeFicheId(fiche.id),
      // Ne pas exposer l'ID dans la réponse
      id: undefined
    }));
    const hashDuration = Date.now() - hashStartTime;
    console.log(`[FICHES-${requestId}] Hash encoding: ${hashDuration}ms`);

    const totalDuration = Date.now() - requestStartTime;
    console.log(`[FICHES-${requestId}] === FIN GET /fiches: ${total} total, ${fiches.length} retournées, ${totalDuration}ms ===`);
    console.log(`[FICHES-${requestId}] Perf: COUNT ${countDuration}ms | SELECT ${selectDuration}ms | HASH ${hashDuration}ms | TOTAL ${totalDuration}ms`);

    res.json({
      success: true,
      data: fichesWithHash,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[FICHES-${requestId}] Erreur après ${totalDuration}ms:`, error);
    console.error('Erreur lors de la récupération des fiches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches'
    });
  }
});

// Stats du mois pour agent qualification (Production du mois)
router.get('/stats/mois', authenticate, async (req, res) => {
  try {
    if (req.user.fonction !== 3) {
      return res.status(403).json({ success: false, message: 'Réservé aux agents qualification' });
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${y}-${m}-01 00:00:00`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')} 23:59:59`;

    // États groupe 0 : stats par état (id_agent uniquement)
    const statsGroupe0 = await query(
      `SELECT e.id as etat_id, e.titre as etat_nom, e.color as etat_color, COUNT(f.id) as count
       FROM fiches f
       INNER JOIN etats e ON f.id_etat_final = e.id AND (e.groupe = '0' OR e.groupe = 0)
       WHERE f.active = 1 AND (f.archive = 0 OR f.archive IS NULL)
         AND f.date_insert_time >= ? AND f.date_insert_time <= ?
         AND f.id_agent = ?
       GROUP BY e.id, e.titre, e.color
       ORDER BY e.ordre ASC`,
      [startDate, endDate, req.user.id]
    );

    // Comptage "Validé" : états hors groupe 0
    const validatedResult = await queryOne(
      `SELECT COUNT(f.id) as count
       FROM fiches f
       INNER JOIN etats e ON f.id_etat_final = e.id AND (e.groupe != '0' AND e.groupe != 0)
       WHERE f.active = 1 AND (f.archive = 0 OR f.archive IS NULL)
         AND f.date_insert_time >= ? AND f.date_insert_time <= ?
         AND f.id_agent = ?`,
      [startDate, endDate, req.user.id]
    );

    const data = statsGroupe0.map((r) => ({
      etat_id: r.etat_id,
      etat_nom: r.etat_nom,
      etat_color: r.etat_color || '#cccccc',
      count: r.count
    }));

    // Ajouter la carte Validé si > 0
    const validatedCount = validatedResult?.count || 0;
    if (validatedCount > 0) {
      data.push({
        etat_id: 'validated',
        etat_nom: 'Validé',
        etat_color: '#28a745',
        count: validatedCount
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /fiches/stats/mois:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des stats du mois' });
  }
});

// Diagnostic - Vérifier pourquoi une fiche n'apparaît pas dans le planning commercial
router.get('/planning-commercial/diagnostic/:tel', authenticate, async (req, res) => {
  try {
    const { tel } = req.params;
    
    // Rechercher la fiche par téléphone
    const fiche = await queryOne(
      `SELECT 
        fiche.id,
        fiche.hash,
        fiche.tel,
        fiche.nom,
        fiche.prenom,
        fiche.archive,
        fiche.ko,
        fiche.active,
        fiche.date_rdv_time,
        fiche.id_etat_final,
        fiche.id_commercial,
        fiche.id_commercial_2,
        etat.titre as etat_titre,
        commercial.pseudo as commercial_pseudo,
        commercial2.pseudo as commercial_2_pseudo
       FROM fiches fiche
       LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
       LEFT JOIN utilisateurs commercial ON fiche.id_commercial = commercial.id
       LEFT JOIN utilisateurs commercial2 ON fiche.id_commercial_2 = commercial2.id
       WHERE (fiche.tel = ? OR fiche.gsm1 = ? OR fiche.gsm2 = ?)
       LIMIT 1`,
      [tel, tel, tel]
    );

    if (!fiche) {
      return res.json({
        success: false,
        message: 'Fiche non trouvée avec ce numéro de téléphone',
        tel: tel
      });
    }

    // Vérifier chaque condition
    const checks = {
      fiche_trouvee: true,
      archive: {
        valeur: fiche.archive,
        condition: 'archive = 0',
        valide: fiche.archive === 0,
        message: fiche.archive === 0 ? 'OK' : `La fiche est archivée (archive = ${fiche.archive})`
      },
      ko: {
        valeur: fiche.ko,
        condition: 'ko = 0',
        valide: fiche.ko === 0,
        message: fiche.ko === 0 ? 'OK' : `La fiche est KO (ko = ${fiche.ko})`
      },
      active: {
        valeur: fiche.active,
        condition: 'active = 1',
        valide: fiche.active === 1,
        message: fiche.active === 1 ? 'OK' : `La fiche n'est pas active (active = ${fiche.active})`
      },
      date_rdv_time: {
        valeur: fiche.date_rdv_time,
        condition: 'date_rdv_time IS NOT NULL AND date_rdv_time != ""',
        valide: fiche.date_rdv_time !== null && fiche.date_rdv_time !== '',
        message: (fiche.date_rdv_time !== null && fiche.date_rdv_time !== '') 
          ? `OK (${fiche.date_rdv_time})` 
          : 'La fiche n\'a pas de date de RDV'
      },
      id_commercial: {
        valeur: fiche.id_commercial,
        condition: 'id_commercial IS NOT NULL AND id_commercial > 0',
        valide: fiche.id_commercial !== null && fiche.id_commercial > 0,
        message: (fiche.id_commercial !== null && fiche.id_commercial > 0)
          ? `OK (Commercial: ${fiche.commercial_pseudo || fiche.id_commercial})`
          : 'La fiche n\'est pas affectée à un commercial'
      },
      id_etat_final: {
        valeur: fiche.id_etat_final,
        condition: 'id_etat_final = 7',
        valide: fiche.id_etat_final === 7,
        message: fiche.id_etat_final === 7 
          ? 'OK (CONFIRMER)' 
          : `La fiche n'est pas confirmée (état: ${fiche.id_etat_final} - ${fiche.etat_titre || 'N/A'})`
      }
    };

    const toutesConditionsValides = Object.values(checks)
      .filter(c => typeof c === 'object' && c.valide !== undefined)
      .every(c => c.valide);

    res.json({
      success: true,
      fiche: {
        id: fiche.id,
        hash: fiche.hash,
        nom: fiche.nom,
        prenom: fiche.prenom,
        tel: fiche.tel,
        commercial: fiche.commercial_pseudo || fiche.id_commercial,
        commercial_2: fiche.commercial_2_pseudo || fiche.id_commercial_2,
        etat: fiche.etat_titre || fiche.id_etat_final
      },
      diagnostic: checks,
      toutesConditionsValides,
      message: toutesConditionsValides 
        ? 'La fiche devrait apparaître dans le planning commercial. Vérifiez les filtres de date.'
        : 'La fiche ne remplit pas toutes les conditions pour apparaître dans le planning commercial.'
    });
  } catch (error) {
    console.error('Erreur lors du diagnostic:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du diagnostic',
      error: error.message
    });
  }
});

// Planning Commercial - Récupérer les RDV affectés aux commerciaux
// IMPORTANT: Cette route doit être AVANT la route /:id sinon Express va matcher "planning-commercial" comme un ID
router.get('/planning-commercial', authenticate, async (req, res) => {
  const logId = `[PLANNING-COMM-${Date.now()}]`;
  try {
    const {
      page = 1,
      limit = 100,
      id_commercial,
      id_etat_final,
      produit,
      date_debut,
      date_fin,
      time_debut,
      time_fin,
      id_centre,
      cp
    } = req.query;

    console.log(`${logId} User: id=${req.user.id}, fonction=${req.user.fonction}, pseudo=${req.user.pseudo || ''}`);
    console.log(`${logId} Query: date_debut=${date_debut}, date_fin=${date_fin}, time_debut=${time_debut}, time_fin=${time_fin}, id_commercial=${id_commercial}, page=${page}, limit=${limit}`);

    let whereConditions = [
      'fiche.archive = 0',
      // Ne pas exclure les fiches KO : un RDV confirmé (état 7) affecté doit apparaître au planning même si la fiche est KO
      'fiche.active = 1',
      'fiche.date_rdv_time IS NOT NULL',
      'fiche.date_rdv_time != ""',
      // Seulement les RDV affectés aux commerciaux
      '(fiche.id_commercial IS NOT NULL AND fiche.id_commercial > 0)',
      // Seulement les RDV confirmés (état 7 - CONFIRMER)
      'fiche.id_etat_final = 7'
    ];
    let params = [];

    // Filtrer par commercial
    if (id_commercial) {
      whereConditions.push('(fiche.id_commercial = ? OR fiche.id_commercial_2 = ?)');
      params.push(id_commercial, id_commercial);
    } else if (req.user.fonction === 5) {
      // Si c'est un commercial, afficher uniquement ses RDV
      whereConditions.push('(fiche.id_commercial = ? OR fiche.id_commercial_2 = ?)');
      params.push(req.user.id, req.user.id);
    }

    // Filtrer par état final - FORCER uniquement l'état 7 (CONFIRMER)
    // Même si id_etat_final est fourni, on ne garde que l'état 7
    // Supprimer le paramètre id_etat_final des conditions pour toujours forcer l'état 7
    whereConditions = whereConditions.filter(cond => !cond.includes('id_etat_final'));
    whereConditions.push('fiche.id_etat_final = 7'); // Toujours filtrer par CONFIRMER uniquement

    // Filtrer par produit
    if (produit) {
      const produitArray = Array.isArray(produit) ? produit : [produit];
      if (produitArray.length > 0) {
        whereConditions.push(`fiche.produit IN (${produitArray.map(() => '?').join(',')})`);
        params.push(...produitArray);
      }
    }

    // Filtrer par date RDV
    // S'assurer que date_rdv_time n'est pas NULL ou vide (déjà dans les conditions de base, mais on le vérifie quand même)
    if (date_debut || date_fin) {
      whereConditions.push('fiche.date_rdv_time IS NOT NULL');
      whereConditions.push('fiche.date_rdv_time != ""');
    }
    
    let dateStart = null;
    let dateEnd = null;
    if (date_debut && date_fin) {
      dateStart = time_debut ? `${date_debut} ${time_debut}` : `${date_debut} 00:00:00`;
      dateEnd = time_fin ? `${date_fin} ${time_fin}` : `${date_fin} 23:59:59`;
      whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
      params.push(dateStart, dateEnd);
    } else if (date_debut) {
      dateStart = time_debut ? `${date_debut} ${time_debut}` : `${date_debut} 00:00:00`;
      whereConditions.push('fiche.date_rdv_time >= ?');
      params.push(dateStart);
    } else if (date_fin) {
      dateEnd = time_fin ? `${date_fin} ${time_fin}` : `${date_fin} 23:59:59`;
      whereConditions.push('fiche.date_rdv_time <= ?');
      params.push(dateEnd);
    }
    console.log(`${logId} Plage date_rdv_time: ${dateStart || '(non défini)'} -> ${dateEnd || '(non défini)'}`);

    // Filtrer par centre
    if (id_centre) {
      const centreArray = Array.isArray(id_centre) ? id_centre : [id_centre];
      if (centreArray.length > 0) {
        whereConditions.push(`fiche.id_centre IN (${centreArray.map(() => '?').join(',')})`);
        params.push(...centreArray);
      }
    }

    // Filtrer par code postal (département)
    if (cp) {
      // Support de plusieurs départements séparés par des virgules
      const departements = cp.split(',').map(d => d.trim()).filter(d => d.length > 0);
      if (departements.length > 0) {
        if (departements.length === 1) {
          // Un seul département
          whereConditions.push('SUBSTRING(fiche.cp, 1, 2) = ?');
          params.push(departements[0]);
        } else {
          // Plusieurs départements
          whereConditions.push(`SUBSTRING(fiche.cp, 1, 2) IN (${departements.map(() => '?').join(',')})`);
          params.push(...departements);
        }
      }
    }

    const whereClause = whereConditions.join(' AND ');
    console.log(`${logId} WHERE: ${whereClause}`);
    console.log(`${logId} Params: ${JSON.stringify(params)}`);

    // Compter le total
    const countResult = await queryOne(
      `SELECT COUNT(DISTINCT fiche.id) as total
       FROM fiches fiche
       WHERE ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;
    console.log(`${logId} Total fiches trouvées: ${total}`);

    // Calculer la pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Vérifier si la table qualif existe
    let qualifTableExists = false;
    try {
      const qualifCheck = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = 'qualif'`
      );
      qualifTableExists = qualifCheck && qualifCheck.count > 0;
    } catch (error) {
      qualifTableExists = false;
    }

    // Construire la requête avec ou sans qualif selon l'existence de la table
    const qualifJoin = qualifTableExists 
      ? 'LEFT JOIN qualif ON fiche.id_qualif = qualif.id'
      : '';
    const qualifSelect = qualifTableExists
      ? 'qualif.code as qualification_code'
      : 'NULL as qualification_code';

    // Récupérer les fiches avec les informations nécessaires
    const fiches = await query(
      `SELECT 
        fiche.id,
        fiche.hash,
        fiche.nom,
        fiche.prenom,
        fiche.tel,
        fiche.cp,
        fiche.ville,
        fiche.adresse,
        fiche.produit,
        fiche.date_rdv_time,
        fiche.id_etat_final,
        fiche.id_commercial,
        fiche.id_commercial_2,
        fiche.id_centre,
        fiche.rdv_urgent,
        fiche.valider,
        fiche.conf_rdv_avec,
        etat.titre as etat_titre,
        etat.color as etat_color,
        commercial.pseudo as commercial_pseudo,
        commercial2.pseudo as commercial_2_pseudo,
        centre.titre as centre_titre,
        ${qualifSelect}
       FROM fiches fiche
       LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
       LEFT JOIN utilisateurs commercial ON fiche.id_commercial = commercial.id
       LEFT JOIN utilisateurs commercial2 ON fiche.id_commercial_2 = commercial2.id
       LEFT JOIN centres centre ON fiche.id_centre = centre.id
       ${qualifJoin}
       WHERE ${whereClause}
       ORDER BY fiche.date_rdv_time ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    if (fiches.length > 0) {
      console.log(`${logId} Fiches retournées (${fiches.length}):`, fiches.slice(0, 5).map(f => ({
        id: f.id,
        date_rdv_time: f.date_rdv_time,
        id_commercial: f.id_commercial,
        id_commercial_2: f.id_commercial_2,
        nom: f.nom,
        prenom: f.prenom
      })));
    } else if (total === 0 && (date_debut || date_fin)) {
      // Diagnostic : existe-t-il des fiches état 7 avec un commercial dans la plage, sans les critères archive/ko/active ?
      const commercialId = id_commercial || (req.user.fonction === 5 ? req.user.id : null);
      if (commercialId) {
        const diagStart = dateStart || (date_debut ? `${date_debut} 00:00:00` : null);
        const diagEnd = dateEnd || (date_fin ? `${date_fin} 23:59:59` : null);
        if (diagStart && diagEnd) {
          const diag = await query(
            `SELECT id, date_rdv_time, id_etat_final, id_commercial, id_commercial_2, archive, ko, active
             FROM fiches
             WHERE id_etat_final = 7
               AND (id_commercial = ? OR id_commercial_2 = ?)
               AND date_rdv_time IS NOT NULL AND date_rdv_time != ''
               AND date_rdv_time >= ? AND date_rdv_time <= ?`,
            [commercialId, commercialId, diagStart, diagEnd]
          );
          console.log(`${logId} DIAG: Fiches état 7 + commercial ${commercialId} dans la plage (sans filtre archive/ko/active): ${diag.length}`, diag.slice(0, 3).map(f => ({ id: f.id, date_rdv_time: f.date_rdv_time, archive: f.archive, ko: f.ko, active: f.active })));
        }
      }
    }

    // Enrichir les fiches avec l'information sur les comptes rendu (uniquement depuis compte_rendu_pending)
    // "Compte rendu rédigé" uniquement si le commercial actuel a un CR en attente (pending) pour cette fiche.
    // On ne compte pas les CR approuvés : à l'approbation la fiche est désaffectée (id_commercial = null),
    // donc si la fiche réapparaît au planning c'est qu'elle a été réaffectée → afficher "non rédigé".
    if (fiches.length > 0) {
      const ficheIds = fiches.map(f => f.id);
      const fichesAvecCompteRendu = [];
      for (const chunk of chunkArray(ficheIds, FICHE_IDS_IN_CHUNK)) {
        const placeholders = chunk.map(() => '?').join(',');
        const compteRenduQuery = `
        SELECT DISTINCT cr.id_fiche
        FROM compte_rendu_pending cr
        INNER JOIN fiches f ON f.id = cr.id_fiche
        WHERE f.id IN (${placeholders})
          AND (cr.id_commercial = f.id_commercial OR cr.id_commercial = f.id_commercial_2)
          AND cr.statut = 'pending'
      `;
        fichesAvecCompteRendu.push(...(await query(compteRenduQuery, chunk)));
      }
      const ficheIdsAvecCompteRendu = new Set(fichesAvecCompteRendu.map(cr => cr.id_fiche));
      fiches.forEach(fiche => {
        fiche.has_compte_rendu = ficheIdsAvecCompteRendu.has(fiche.id);
        if (!fiche.hash && fiche.id) {
          fiche.hash = encodeFicheId(fiche.id);
        }
      });
    }

    res.json({
      success: true,
      data: fiches,
      pagination: {
        total,
        page: parseInt(page),
        pages: totalPages,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du planning commercial:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du planning commercial'
    });
  }
});

// Audit Rendez-vous - Fiches état Confirmer (7) où le RDV a été créé à la date choisie (pas par date de planning)
// "RDV créé aujourd'hui" = date_rdv_time a été enregistré ce jour-là (via modifica). Pour Qualité Confirmation (4) et RP Confirmation (13).
router.get('/audit-rdv', authenticate, async (req, res) => {
  try {
    const allowed = [4, 13]; // Qualité Confirmation, RP Confirmation
    if (!allowed.includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé à la Qualité Confirmation (fonction 4) et au RP Confirmation (fonction 13)'
      });
    }
    const { page = 1, limit = 100, date: dateParam } = req.query;
    const date = dateParam || new Date().toISOString().split('T')[0]; // YYYY-MM-DD, défaut = aujourd'hui
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dateDebut, dateFin] = [`${date} 00:00:00`, `${date} 23:59:59`];

    // Utiliser modifica pour "RDV créé à cette date" (date_rdv_time enregistré ce jour). Fallback : date_modif_time ce jour.
    let useModifica = false;
    let modificaFieldCol = 'type';
    let modificaDateCol = 'date_modif_time';
    try {
      const modExists = await queryOne(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'modifica'`
      );
      if (modExists) {
        const modCols = await query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modifica'`
        );
        const names = (modCols || []).map((c) => c.COLUMN_NAME);
        if (names.includes('champ') && !names.includes('type')) modificaFieldCol = 'champ';
        if (names.includes('date') && !names.includes('date_modif_time')) modificaDateCol = 'date';
        useModifica = names.includes('id_fiche') && (names.includes(modificaFieldCol) && names.includes(modificaDateCol));
      }
    } catch (_) {}

    let total = 0;
    let fiches = [];

    if (useModifica) {
      const totalResult = await queryOne(
        `SELECT COUNT(*) as total
         FROM fiches fiche
         INNER JOIN (
           SELECT id_fiche FROM modifica
           WHERE \`${modificaFieldCol}\` = 'date_rdv_time'
             AND \`${modificaDateCol}\` >= ?
             AND \`${modificaDateCol}\` <= ?
           GROUP BY id_fiche
         ) m ON m.id_fiche = fiche.id
         WHERE (fiche.archive = 0 OR fiche.archive IS NULL)
           AND fiche.id_etat_final = 7
           AND fiche.date_rdv_time IS NOT NULL`,
        [dateDebut, dateFin]
      );
      total = totalResult?.total || 0;

      fiches = await query(
        `SELECT
          fiche.id,
          fiche.nom,
          fiche.prenom,
          fiche.tel,
          fiche.cp,
          fiche.ville,
          fiche.date_rdv_time,
          m.rdv_created_at as date_creation_rdv,
          fiche.commentaire_qualite,
          agent.pseudo as agent_pseudo,
          centre.titre as centre_nom,
          etat.titre as etat_titre
         FROM fiches fiche
         INNER JOIN (
           SELECT id_fiche, MAX(\`${modificaDateCol}\`) as rdv_created_at
           FROM modifica
           WHERE \`${modificaFieldCol}\` = 'date_rdv_time'
             AND \`${modificaDateCol}\` >= ?
             AND \`${modificaDateCol}\` <= ?
           GROUP BY id_fiche
         ) m ON m.id_fiche = fiche.id
         LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
         LEFT JOIN centres centre ON fiche.id_centre = centre.id
         LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
         WHERE (fiche.archive = 0 OR fiche.archive IS NULL)
           AND fiche.id_etat_final = 7
           AND fiche.date_rdv_time IS NOT NULL
         ORDER BY m.rdv_created_at DESC
         LIMIT ? OFFSET ?`,
        [dateDebut, dateFin, parseInt(limit), offset]
      );
    } else {
      // Fallback : fiches état Confirmer (7) modifiées à cette date (proxy pour "RDV créé ce jour")
      const totalResult = await queryOne(
        `SELECT COUNT(*) as total FROM fiches fiche
         WHERE (fiche.archive = 0 OR fiche.archive IS NULL)
           AND fiche.id_etat_final = 7
           AND fiche.date_rdv_time IS NOT NULL
           AND fiche.date_modif_time >= ?
           AND fiche.date_modif_time <= ?`,
        [dateDebut, dateFin]
      );
      total = totalResult?.total || 0;

      fiches = await query(
        `SELECT
          fiche.id,
          fiche.nom,
          fiche.prenom,
          fiche.tel,
          fiche.cp,
          fiche.ville,
          fiche.date_rdv_time,
          fiche.date_modif_time as date_creation_rdv,
          fiche.commentaire_qualite,
          agent.pseudo as agent_pseudo,
          centre.titre as centre_nom,
          etat.titre as etat_titre
         FROM fiches fiche
         LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
         LEFT JOIN centres centre ON fiche.id_centre = centre.id
         LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
         WHERE (fiche.archive = 0 OR fiche.archive IS NULL)
           AND fiche.id_etat_final = 7
           AND fiche.date_rdv_time IS NOT NULL
           AND fiche.date_modif_time >= ?
           AND fiche.date_modif_time <= ?
         ORDER BY fiche.date_modif_time DESC
         LIMIT ? OFFSET ?`,
        [dateDebut, dateFin, parseInt(limit), offset]
      );
    }

    const fichesWithHash = fiches.map((f) => ({
      ...f,
      hash: encodeFicheId(f.id)
    }));

    res.json({
      success: true,
      data: fichesWithHash,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    console.error('Erreur audit RDV:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'audit RDV',
      error: error.message
    });
  }
});

// Contrôle Qualité - Récupérer les fiches BRUT pour audit
// IMPORTANT: Cette route doit être AVANT la route /:id sinon Express va matcher "controle-qualite" comme un ID
router.get('/controle-qualite', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      id_agent,
      id_etat_final,
      date_debut,
      date_fin
    } = req.query;

    // Note: Les filtres id_centre et produit ont été retirés selon les spécifications

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construire les conditions
    let whereConditions = [
      '(fiche.archive = 0 OR fiche.archive IS NULL)',
      'fiche.id_agent IS NOT NULL',
      // Filtrer les états du groupe 0 (états utilisés par la qualité) OU l'état "En-Attente" (ID 1)
      // L'état "En-Attente" est inclus pour permettre de voir les fiches validées
      `EXISTS (
        SELECT 1 FROM etats e 
        WHERE e.id = fiche.id_etat_final 
        AND ((e.groupe = '0' OR e.groupe = 0) OR e.id = 1)
      )`
    ];
    let params = [];

    // Filtres optionnels
    if (id_agent) {
      whereConditions.push('fiche.id_agent = ?');
      params.push(parseInt(id_agent));
    }

    if (id_etat_final) {
      whereConditions.push('fiche.id_etat_final = ?');
      params.push(parseInt(id_etat_final));
    }

    if (date_debut) {
      whereConditions.push('fiche.date_insert_time >= ?');
      params.push(`${date_debut} 00:00:00`);
    }

    if (date_fin) {
      whereConditions.push('fiche.date_insert_time <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Détecter la structure de la table modifica pour la requête
    let modificaFieldCondition = '';
    let modificaDateColumn = 'date_modif_time';
    try {
      const modificaColumns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'modifica'`
      );
      const columnNames = modificaColumns.map(col => col.COLUMN_NAME);
      const hasType = columnNames.includes('type');
      const hasChamp = columnNames.includes('champ');
      
      // Détecter la colonne de date
      if (columnNames.includes('date_modif_time')) {
        modificaDateColumn = 'date_modif_time';
      } else if (columnNames.includes('date')) {
        modificaDateColumn = 'date';
      }
      
      if (hasType) {
        modificaFieldCondition = "m1.type = 'commentaire_qualite'";
      } else if (hasChamp) {
        modificaFieldCondition = "m1.champ = 'commentaire_qualite'";
      } else {
        modificaFieldCondition = "1=0"; // Aucune structure reconnue, ne retournera rien
      }
    } catch (error) {
      console.error('Erreur lors de la détection de la structure modifica:', error);
      modificaFieldCondition = "1=0"; // En cas d'erreur, ne retournera rien
    }

    // Compter le total
    const totalResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM fiches fiche
       WHERE ${whereClause}`,
      params
    );

    const total = totalResult?.total || 0;

    // Récupérer les fiches avec le dernier utilisateur qualité qui a modifié le commentaire + nb d'alertes KO
    let fiches;
    try {
      fiches = await query(
        `SELECT 
          fiche.id,
          fiche.nom,
          fiche.prenom,
          fiche.tel,
          fiche.cp,
          fiche.ville,
          fiche.produit,
          fiche.id_agent,
          fiche.id_centre,
          fiche.id_etat_final,
          fiche.id_sous_etat,
          fiche.date_insert_time,
          fiche.date_modif_time,
          fiche.commentaire_qualite,
          fiche.commentaire_commercial,
          fiche.commentaire,
          fiche.ko,
          agent.pseudo as agent_pseudo,
          agent.nom as agent_nom,
          agent.prenom as agent_prenom,
          centre.titre as centre_nom,
          etat.titre as etat_titre,
          etat.color as etat_color,
          etat.abbreviation as etat_abbreviation,
          sous_etat.titre as sous_etat_titre,
          qualite_user.pseudo as qualite_user_pseudo,
          qualite_user.nom as qualite_user_nom,
          qualite_user.prenom as qualite_user_prenom,
          fiche.id_qualite,
          qualite_assignee.pseudo as qualite_assignee_pseudo,
          qualite_assignee.nom as qualite_assignee_nom,
          qualite_assignee.prenom as qualite_assignee_prenom,
          (SELECT COUNT(*) FROM alert_ko ak WHERE ak.id_fiche = fiche.id) AS nb_alertes
         FROM fiches fiche
         LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
         LEFT JOIN centres centre ON fiche.id_centre = centre.id
         LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
         LEFT JOIN sous_etat ON fiche.id_sous_etat = sous_etat.id
         LEFT JOIN (
           SELECT 
             m1.id_fiche,
             m1.id_user
           FROM modifica m1
           WHERE ${modificaFieldCondition}
           AND m1.id = (
             SELECT m2.id
             FROM modifica m2
             WHERE ${modificaFieldCondition.replace('m1.', 'm2.')}
             AND m2.id_fiche = m1.id_fiche
             ORDER BY m2.\`${modificaDateColumn}\` DESC
             LIMIT 1
           )
         ) last_modif ON fiche.id = last_modif.id_fiche
         LEFT JOIN utilisateurs qualite_user ON last_modif.id_user = qualite_user.id
         LEFT JOIN utilisateurs qualite_assignee ON fiche.id_qualite = qualite_assignee.id
         WHERE ${whereClause}
         ORDER BY fiche.date_appel_time DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' && err.message && err.message.includes('alert_ko')) {
        // Table alert_ko absente : requête sans nb_alertes
        fiches = await query(
          `SELECT 
            fiche.id,
            fiche.nom,
            fiche.prenom,
            fiche.tel,
            fiche.cp,
            fiche.ville,
            fiche.produit,
            fiche.id_agent,
            fiche.id_centre,
            fiche.id_etat_final,
            fiche.id_sous_etat,
            fiche.date_insert_time,
            fiche.date_modif_time,
            fiche.commentaire_qualite,
            fiche.commentaire_commercial,
            fiche.commentaire,
            fiche.ko,
            agent.pseudo as agent_pseudo,
            agent.nom as agent_nom,
            agent.prenom as agent_prenom,
            centre.titre as centre_nom,
            etat.titre as etat_titre,
            etat.color as etat_color,
            etat.abbreviation as etat_abbreviation,
            sous_etat.titre as sous_etat_titre,
            qualite_user.pseudo as qualite_user_pseudo,
            qualite_user.nom as qualite_user_nom,
            qualite_user.prenom as qualite_user_prenom,
            fiche.id_qualite,
            qualite_assignee.pseudo as qualite_assignee_pseudo,
            qualite_assignee.nom as qualite_assignee_nom,
            qualite_assignee.prenom as qualite_assignee_prenom
           FROM fiches fiche
           LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
           LEFT JOIN centres centre ON fiche.id_centre = centre.id
           LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
           LEFT JOIN sous_etat ON fiche.id_sous_etat = sous_etat.id
           LEFT JOIN (
             SELECT 
               m1.id_fiche,
               m1.id_user
             FROM modifica m1
             WHERE ${modificaFieldCondition}
             AND m1.id = (
               SELECT m2.id
               FROM modifica m2
               WHERE ${modificaFieldCondition.replace('m1.', 'm2.')}
               AND m2.id_fiche = m1.id_fiche
               ORDER BY m2.\`${modificaDateColumn}\` DESC
               LIMIT 1
             )
           ) last_modif ON fiche.id = last_modif.id_fiche
           LEFT JOIN utilisateurs qualite_user ON last_modif.id_user = qualite_user.id
           LEFT JOIN utilisateurs qualite_assignee ON fiche.id_qualite = qualite_assignee.id
           WHERE ${whereClause}
           ORDER BY fiche.date_appel_time DESC
           LIMIT ? OFFSET ?`,
          [...params, parseInt(limit), offset]
        );
        fiches = fiches.map(f => ({ ...f, nb_alertes: 0 }));
      } else {
        throw err;
      }
    }

    // Encoder les IDs
    const fichesWithHash = fiches.map(fiche => ({
      ...fiche,
      hash: encodeFicheId(fiche.id)
    }));

    res.json({
      success: true,
      data: fichesWithHash,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches pour contrôle qualité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Récupérer les fiches des agents sous la responsabilité du superviseur qualification (RE Qualification)
// IMPORTANT: Cette route doit être AVANT la route /:id sinon Express va matcher "agents-sous-responsabilite" comme un ID
router.get('/agents-sous-responsabilite', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 1000,
      id_agent,
      id_etat_final,
      id_superviseur,
      date_debut,
      date_fin
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let agentIds = [];

    console.log('Route /agents-sous-responsabilite appelée pour fonction:', req.user.fonction);

    // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
    // Si oui, récupérer les agents de tous les superviseurs assignés au RP
    if (req.user.fonction === 12) {
      console.log('RP Qualification détecté, ID:', req.user.id);
      // Récupérer les superviseurs assignés au RP connecté
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [req.user.id]
      );

      console.log('Superviseurs assignés:', superviseursAssignes?.length || 0);

      if (!superviseursAssignes || superviseursAssignes.length === 0) {
        // Si aucun superviseur assigné, retourner un résultat vide
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }

      const superviseurIds = superviseursAssignes.map(s => s.id);
      
      // Filtrer par superviseur si spécifié
      let superviseursFiltres = superviseurIds;
      if (id_superviseur) {
        const superviseurId = parseInt(id_superviseur);
        if (superviseurIds.includes(superviseurId)) {
          superviseursFiltres = [superviseurId];
        } else {
          // Si le superviseur n'est pas assigné au RP, retourner vide
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0
            }
          });
        }
      }
      
      // Récupérer les agents de tous ces superviseurs
      if (superviseursFiltres.length > 0) {
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseursFiltres.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseursFiltres
        );
        
        agentIds = (agentsSousResponsabilite || []).map(a => a.id);
        console.log('Agents sous responsabilité:', agentIds.length);
      }
    } else {
      // RE Qualification : récupérer les agents directement sous la responsabilité du superviseur connecté
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs 
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );

      agentIds = (agentsSousResponsabilite || []).map(a => a.id);
    }

    if (!agentIds || agentIds.length === 0) {
      // Si aucun agent sous responsabilité, retourner un résultat vide
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    // Construire les conditions
    let whereConditions = [
      'fiche.archive = 0',
      'fiche.ko = 0',
      'fiche.active = 1',
      `fiche.id_agent IN (${agentIds.map(() => '?').join(',')})`
    ];
    let params = [...agentIds];

    // Pour RP Qualification (fonction 12), inclure tous les états (groupe 0 + "Validé" = tous les états)
    // Pour les autres (RE Qualification), filtrer groupe 0 + EN-ATTENTE + fiches validées (groupe 1, 2 ou 3)
    if (req.user.fonction === 12) {
      // Pour RP Qualification : inclure tous les états (pas de filtre sur les états)
      // Le filtre par état se fera côté frontend si nécessaire
    } else {
      // Pour RE Qualification : filtrer les états du groupe 0 + EN-ATTENTE + fiches validées (hors groupe 0)
      whereConditions.push(`EXISTS (
        SELECT 1 FROM etats e 
        WHERE e.id = fiche.id_etat_final 
        AND (
          (e.groupe = '0' OR e.groupe = 0) OR
          (e.id = 1 OR e.titre = 'EN-ATTENTE' OR e.titre = 'En-Attente' OR e.titre = 'EN ATTENTE') OR
          (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
        )
      )`);
    }

    // Filtres optionnels
    if (id_agent) {
      // Vérifier que l'agent demandé est bien sous la responsabilité
      if (agentIds.includes(parseInt(id_agent))) {
        whereConditions.push('fiche.id_agent = ?');
        params.push(parseInt(id_agent));
      } else {
        // Si l'agent n'est pas sous responsabilité, retourner vide
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Gérer le filtre par état final (peut être un tableau ou une valeur unique)
    if (id_etat_final) {
      // Normaliser : convertir en tableau si nécessaire
      let etatArray = [];
      if (Array.isArray(id_etat_final)) {
        etatArray = id_etat_final;
      } else if (typeof id_etat_final === 'string' && id_etat_final.includes(',')) {
        // Si c'est une string avec des virgules, la split
        etatArray = id_etat_final.split(',').map(e => e.trim()).filter(e => e.length > 0);
      } else {
        // Sinon, c'est une valeur unique
        etatArray = [id_etat_final];
      }
      
      // Si c'est un tableau (plusieurs états)
      if (etatArray.length > 0) {
        const etatIds = [];
        let hasValidated = false;
        
        // Séparer les IDs d'états et "validated"
        etatArray.forEach(etat => {
          if (etat === 'validated') {
            hasValidated = true;
          } else {
            const parsedId = parseInt(etat);
            if (!isNaN(parsedId)) {
              etatIds.push(parsedId);
            }
          }
        });
        
        // Construire la condition
        const conditions = [];
        
        // Si des IDs d'états sont sélectionnés
        if (etatIds.length > 0) {
          conditions.push(`fiche.id_etat_final IN (${etatIds.map(() => '?').join(',')})`);
          params.push(...etatIds);
        }
        
        // Si "validated" est sélectionné
        if (hasValidated) {
          const etatsGroupe0 = await query(`
            SELECT id FROM etats WHERE (groupe = '0' OR groupe = 0)
          `);
          const idsGroupe0 = etatsGroupe0.map(e => e.id);
          if (idsGroupe0.length > 0) {
            conditions.push(`fiche.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})`);
            params.push(...idsGroupe0);
          }
        }
        
        // Si plusieurs conditions, utiliser OR
        if (conditions.length > 1) {
          whereConditions.push(`(${conditions.join(' OR ')})`);
        } else if (conditions.length === 1) {
          whereConditions.push(conditions[0]);
        }
      } else if (id_etat_final === 'validated') {
        // Pour "validated", exclure les états du groupe 0
        const etatsGroupe0 = await query(`
          SELECT id FROM etats WHERE (groupe = '0' OR groupe = 0)
        `);
        const idsGroupe0 = etatsGroupe0.map(e => e.id);
        if (idsGroupe0.length > 0) {
          whereConditions.push(`fiche.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})`);
          params.push(...idsGroupe0);
        }
      } else {
        // Filtre par état spécifique
        const parsedId = parseInt(id_etat_final);
        if (!isNaN(parsedId)) {
          whereConditions.push('fiche.id_etat_final = ?');
          params.push(parsedId);
        }
      }
    }

    // Pour la production, utiliser date_insert_time (date de création) au lieu de date_appel_time
    // S'assurer que date_insert_time n'est pas NULL ou vide
    whereConditions.push('fiche.date_insert_time IS NOT NULL');
    whereConditions.push('fiche.date_insert_time != ""');
    
    // Filtrer par dates si fournies (pas de date par défaut pour permettre toutes les fiches)
    if (date_debut) {
      whereConditions.push('fiche.date_insert_time >= ?');
      params.push(`${date_debut} 00:00:00`);
    }

    if (date_fin) {
      whereConditions.push('fiche.date_insert_time <= ?');
      params.push(`${date_fin} 23:59:59`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Compter le total
    const totalResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM fiches fiche
       WHERE ${whereClause}`,
      params
    );

    const total = totalResult?.total || 0;

    // Récupérer les fiches
    const fiches = await query(
      `SELECT 
        fiche.id,
        fiche.hash,
        fiche.nom,
        fiche.prenom,
        fiche.tel,
        fiche.cp,
        fiche.ville,
        fiche.produit,
        fiche.id_agent,
        fiche.id_centre,
        fiche.id_etat_final,
        fiche.date_insert_time,
        fiche.date_modif_time,
        fiche.commentaire_qualite,
        agent.pseudo as agent_pseudo,
        agent.nom as agent_nom,
        agent.prenom as agent_prenom,
        centre.titre as centre_nom,
        etat.titre as etat_titre,
        etat.color as etat_color,
        etat.abbreviation as etat_abbreviation,
        etat.groupe as etat_groupe
       FROM fiches fiche
       LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
       LEFT JOIN centres centre ON fiche.id_centre = centre.id
       LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
       WHERE ${whereClause}
       ORDER BY fiche.date_insert_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Encoder les IDs si le hash n'existe pas
    const fichesWithHash = fiches.map(fiche => ({
      ...fiche,
      hash: fiche.hash || encodeFicheId(fiche.id)
    }));

    res.json({
      success: true,
      data: fichesWithHash,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches des agents sous responsabilité:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// =====================================================
// VALIDATION RDV (Confirmateur/RE Confirmation)
// IMPORTANT: Cette route doit être définie AVANT router.get('/:id') pour éviter les conflits
// =====================================================

// Récupérer les RDV validés et non validés pour Confirmateur/RE Confirmation
router.get('/validation-rdv', authenticate, checkPermissionCode('validation_view'), async (req, res) => {
  try {
    const { valider, date_debut, date_fin } = req.query;

    const whereConditions = [
      'f.id_etat_final = 7', // Fiches confirmées uniquement
      '(f.archive = 0 OR f.archive IS NULL)',
      'f.date_rdv_time IS NOT NULL' // Uniquement les fiches avec un RDV
    ];
    const params = [];

    // Pour les confirmateurs (fonction 6) et RE Confirmation (fonction 14) : voir toutes les fiches à valider (pas de filtre par confirmateur)
    // Les admins (1, 2, 7) voient également tout.
    console.log(`[Validation RDV] User fonction: ${req.user.fonction}, User ID: ${req.user.id}`);

    // Filtrer par validation
    if (valider !== undefined && valider !== '') {
      if (valider === '1') {
        whereConditions.push('f.valider = 1');
      } else if (valider === '0') {
        whereConditions.push('(f.valider = 0 OR f.valider IS NULL)');
      }
    }

    // Filtrer par date RDV
    // Par défaut : afficher les RDV du lendemain, et si c'est vendredi, afficher les RDV de lundi
    let dateDebut = date_debut;
    let dateFin = date_fin;
    
    // Si aucune date n'est fournie, calculer les dates par défaut
    if ((!dateDebut || dateDebut.trim() === '') && (!dateFin || dateFin.trim() === '')) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = dimanche, 5 = vendredi
      
      // Si c'est vendredi (5), afficher les RDV de lundi
      if (dayOfWeek === 5) {
        const monday = new Date(today);
        // Calculer le nombre de jours jusqu'au prochain lundi
        // Vendredi (5) -> lundi prochain = +3 jours
        monday.setDate(today.getDate() + 3);
        dateDebut = monday.toISOString().split('T')[0];
        dateFin = monday.toISOString().split('T')[0];
      } else {
        // Sinon, afficher les RDV du lendemain
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        dateDebut = tomorrow.toISOString().split('T')[0];
        dateFin = tomorrow.toISOString().split('T')[0];
      }
    }
    
    // S'assurer que date_rdv_time n'est pas NULL ou vide
    whereConditions.push('f.date_rdv_time IS NOT NULL');
    whereConditions.push('f.date_rdv_time != ""');
    
    // Filtrer par date (utiliser les dates par défaut si aucune date n'a été fournie)
    if (dateDebut && dateDebut.trim() !== '') {
      whereConditions.push('f.date_rdv_time >= ?');
      params.push(`${dateDebut} 00:00:00`);
      console.log(`[Validation RDV] Date début: ${dateDebut} 00:00:00`);
    }
    if (dateFin && dateFin.trim() !== '') {
      whereConditions.push('f.date_rdv_time <= ?');
      params.push(`${dateFin} 23:59:59`);
      console.log(`[Validation RDV] Date fin: ${dateFin} 23:59:59`);
    }

    const whereClause = whereConditions.join(' AND ');
    console.log(`[Validation RDV] WHERE clause: ${whereClause}`);
    console.log(`[Validation RDV] Params:`, params);

    const fiches = await query(
      `SELECT 
        f.*,
        u1.pseudo as confirmateur1_pseudo,
        u2.pseudo as confirmateur2_pseudo,
        u3.pseudo as confirmateur3_pseudo,
        e.titre as etat_titre,
        e.color as etat_color,
        p.nom as produit_nom,
        com.pseudo as commercial_pseudo
       FROM fiches f
       LEFT JOIN utilisateurs u1 ON f.id_confirmateur = u1.id
       LEFT JOIN utilisateurs u2 ON f.id_confirmateur_2 = u2.id
       LEFT JOIN utilisateurs u3 ON f.id_confirmateur_3 = u3.id
       LEFT JOIN etats e ON f.id_etat_final = e.id
       LEFT JOIN produits p ON f.produit = p.id
       LEFT JOIN utilisateurs com ON f.id_commercial = com.id
       WHERE ${whereClause}
      ORDER BY f.date_rdv_time ASC, f.id DESC
      LIMIT 1000`,
      params
    );

    console.log(`[Validation RDV] Nombre de fiches trouvées: ${fiches.length}`);
    if (fiches.length > 0) {
      console.log(`[Validation RDV] Première fiche:`, {
        id: fiches[0].id,
        date_rdv_time: fiches[0].date_rdv_time,
        id_confirmateur: fiches[0].id_confirmateur,
        id_confirmateur_2: fiches[0].id_confirmateur_2,
        id_confirmateur_3: fiches[0].id_confirmateur_3,
        valider: fiches[0].valider
      });
    }

    // Calculer les stats globales
    const stats = {
      valides: fiches.filter(f => f.valider === 1).length,
      nonValides: fiches.filter(f => !f.valider || f.valider === 0).length,
      total: fiches.length
    };

    // Calculer les stats par département (en utilisant les 2 premiers chiffres du code postal)
    const statsByDep = {};
    fiches.forEach(fiche => {
      if (fiche.cp && fiche.cp.length >= 2) {
        const dep = fiche.cp.substring(0, 2);
        if (!statsByDep[dep]) {
          statsByDep[dep] = {
            departement: dep,
            valides: 0,
            nonValides: 0,
            total: 0
          };
        }
        statsByDep[dep].total++;
        if (fiche.valider === 1) {
          statsByDep[dep].valides++;
        } else {
          statsByDep[dep].nonValides++;
        }
      }
    });

    // Récupérer tous les départements pour afficher ceux qui n'ont pas de RDV
    const allDepartements = await query(
      'SELECT departement_code FROM departements WHERE etat > 0 ORDER BY departement_code ASC'
    );

    // Créer un tableau complet avec tous les départements
    const statsDepartements = allDepartements.map(dep => {
      const depCode = dep.departement_code;
      if (statsByDep[depCode]) {
        return statsByDep[depCode];
      } else {
        return {
          departement: depCode,
          valides: 0,
          nonValides: 0,
          total: 0
        };
      }
    });

    // Calculer les totaux
    const totals = {
      valides: statsDepartements.reduce((sum, dep) => sum + dep.valides, 0),
      nonValides: statsDepartements.reduce((sum, dep) => sum + dep.nonValides, 0),
      total: statsDepartements.reduce((sum, dep) => sum + dep.total, 0)
    };

    res.json({
      success: true,
      data: {
        fiches,
        stats,
        statsByDepartement: statsDepartements,
        totals
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des RDV validés/non validés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des RDV',
      error: error.message
    });
  }
});

// =====================================================
// ROUTES POUR LES DEMANDES D'INSERTION
// (Doivent être définies AVANT la route /:id pour éviter les conflits)
// =====================================================

// Récupérer toutes les demandes d'insertion
router.get('/demandes-insertion', authenticate, checkPermissionCode('demandes_insertion_view'), async (req, res) => {
  try {
    const { statut, date_debut, date_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (statut) {
      whereClause += ' AND di.statut = ?';
      params.push(statut);
    }
    
    // Filtrer par date de demande si fourni
    if (date_debut) {
      whereClause += ' AND DATE(di.date_demande) >= ?';
      params.push(date_debut);
    }
    if (date_fin) {
      whereClause += ' AND DATE(di.date_demande) <= ?';
      params.push(date_fin);
    }
    
    console.log('[DEMANDES-INSERTION] Récupération des demandes avec filtre:', { statut, whereClause, params });
    
    const demandes = await query(
      `SELECT 
        di.*,
        u.pseudo as agent_pseudo,
        u.nom as agent_nom,
        u.prenom as agent_prenom,
        f.nom as fiche_nom,
        f.prenom as fiche_prenom,
        f.tel as fiche_tel,
        f.gsm1 as fiche_gsm1,
        f.date_insert_time as fiche_date_insert,
        f.date_modif_time as fiche_date_modif,
        f.hash as fiche_hash,
        t.pseudo as traitant_pseudo
      FROM demandes_insertion di
      LEFT JOIN utilisateurs u ON di.id_agent = u.id
      LEFT JOIN fiches f ON di.id_fiche_existante = f.id
      LEFT JOIN utilisateurs t ON di.id_traitant = t.id
      WHERE ${whereClause}
      ORDER BY di.date_demande DESC`,
      params
    );
    
    console.log('[DEMANDES-INSERTION] Nombre de demandes trouvées:', demandes.length);
    if (demandes.length > 0) {
      console.log('[DEMANDES-INSERTION] Première demande:', {
        id: demandes[0].id,
        statut: demandes[0].statut,
        agent_pseudo: demandes[0].agent_pseudo,
        fiche_nom: demandes[0].fiche_nom
      });
    }
    
    res.json({
      success: true,
      data: demandes
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes d\'insertion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes',
      error: error.message
    });
  }
});

// Traiter une demande d'insertion (approuver ou rejeter)
router.put('/demandes-insertion/:id', authenticate, checkPermissionCode('demandes_insertion_view'), async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaire } = req.body;
    
    if (!statut || !['APPROUVEE', 'REJETEE'].includes(statut)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Doit être APPROUVEE ou REJETEE'
      });
    }
    
    // Récupérer la demande
    const demande = await queryOne(
      `SELECT * FROM demandes_insertion WHERE id = ?`,
      [id]
    );
    
    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }
    
    if (demande.statut !== 'EN_ATTENTE') {
      return res.status(400).json({
        success: false,
        message: 'Cette demande a déjà été traitée'
      });
    }
    
    // Récupérer l'agent, son RE qualification (chef_equipe) et le RP qualification (id_rp_qualif du RE)
    const agentInfo = await queryOne(
      `SELECT u.id, u.pseudo, u.chef_equipe, s.pseudo as superviseur_pseudo, s.id_rp_qualif
       FROM utilisateurs u
       LEFT JOIN utilisateurs s ON u.chef_equipe = s.id
       WHERE u.id = ?`,
      [demande.id_agent]
    );
    
    // Récupérer les informations de la fiche existante
    const ficheExistante = await queryOne(
      `SELECT id, nom, prenom, tel, hash FROM fiches WHERE id = ?`,
      [demande.id_fiche_existante]
    );
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ficheHash = ficheExistante?.hash || (ficheExistante?.id ? encodeFicheId(ficheExistante.id) : null);
    const traitantPseudo = req.user.pseudo || 'Administrateur';
    
    // Si approuvée, archiver la fiche existante et insérer la nouvelle fiche
    if (statut === 'APPROUVEE') {
      try {
        // Archiver la fiche existante
        await query(
          `UPDATE fiches SET archive = 1, date_modif_time = ? WHERE id = ?`,
          [now, demande.id_fiche_existante]
        );
        
        const donneesFiche = JSON.parse(demande.donnees_fiche);
        
        // Normaliser le téléphone
        if (donneesFiche.tel && !donneesFiche.tel.startsWith('0')) {
          donneesFiche.tel = '0' + donneesFiche.tel;
        }
        if (!donneesFiche.gsm1 || donneesFiche.gsm1 === '0') {
          donneesFiche.gsm1 = donneesFiche.tel;
        }
        if (!donneesFiche.gsm2 || donneesFiche.gsm2 === '0') {
          donneesFiche.gsm2 = donneesFiche.tel;
        }
        
        // Ajouter les champs par défaut
        donneesFiche.date_insert_time = now;
        donneesFiche.date_modif_time = now;
        donneesFiche.date_insert = Math.floor(Date.now() / 1000);
        if (!donneesFiche.id_agent) {
          donneesFiche.id_agent = demande.id_agent;
        }
        donneesFiche.active = 1;
        donneesFiche.archive = 0;
        donneesFiche.ko = 0;
        donneesFiche.hc = 0;
        donneesFiche.valider = 0;
        if (!donneesFiche.id_etat_final) {
          donneesFiche.id_etat_final = 1;
        }
        if (!donneesFiche.id_centre && req.user.centre) {
          donneesFiche.id_centre = req.user.centre;
        }
        
        // Liste des colonnes valides
        const validColumns = [
          'civ', 'nom', 'prenom', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville', 'etude',
          'consommation_chauffage', 'surface_habitable', 'annee_systeme_chauffage', 'surface_chauffee',
          'proprietaire_maison', 'nb_pieces', 'nb_pans', 'age_maison', 'orientation_toiture', 'produit',
          'site_classe', 'zones_ombres',
          'nb_chemines', 'mode_chauffage', 'complement_chauffage', 'consommation_electricite', 'age_mr', 'age_madame',
          'revenu_foyer', 'credit_foyer', 'situation_conjugale', 'entretien', 'nb_enfants', 'profession_mr',
          'profession_madame', 'type_contrat_mr', 'type_contrat_madame', 'commentaire', 'id_agent', 'id_centre', 'id_insert', 'id_confirmateur',
          'id_confirmateur_2', 'id_confirmateur_3', 'id_qualite', 'id_qualif', 'id_commercial',
          'id_commercial_2', 'id_etat_final', 'id_sous_etat', 'date_appel', 'date_insert', 'date_insert_time',
          'date_audit', 'date_confirmation', 'date_qualif', 'date_rdv', 'date_rdv_time',
          'date_affect', 'date_sign', 'date_sign_time', 'date_modif_time', 'archive', 'ko', 'hc',
          'active', 'valider', 'conf_commentaire_produit', 'conf_consommations',
          'conf_profession_monsieur', 'conf_profession_madame', 'conf_presence_couple',
          'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
'conf_consommation_electricite', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
      'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
      'conf_type_contrat_mr', 'conf_type_contrat_madame',
      'cq_etat', 'cq_dossier',
      'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
          'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
          'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
          'credit_immobilier', 'credit_autre', 'valeur_mensualite', 'pseudo'
        ];
        
        // Filtrer les colonnes valides
        const fields = [];
        const values = [];
        const placeholders = [];
        
        for (const [key, value] of Object.entries(donneesFiche)) {
          if (validColumns.includes(key) && value !== undefined && value !== null && value !== '') {
            fields.push(key);
            values.push(value);
            placeholders.push('?');
          }
        }
        
        if (fields.length === 0) {
          throw new Error('Aucun champ valide à insérer');
        }
        
        const sql = `INSERT INTO fiches (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
        const result = await query(sql, values);
        const insertId = result.insertId;
        
        // Calculer et stocker le hash
        let nouvelleFicheHash = null;
        if (insertId) {
          nouvelleFicheHash = encodeFicheId(insertId);
          await query('UPDATE fiches SET hash = ? WHERE id = ?', [nouvelleFicheHash, insertId]);
        }
        
        // Créer l'entrée dans l'historique + champs conf_* si état 7
        const histoConf = getHistoConfirmateur(req, null);
        const histoSousEtat = donneesFiche.id_sous_etat != null ? donneesFiche.id_sous_etat : null;
        const histoEtatId = donneesFiche.id_etat_final || 1;
        const isEtat7 = parseInt(histoEtatId) === 7;
        const { cols: confCols, vals: confVals } = isEtat7 ? getConfFieldsForHisto(donneesFiche, {}) : { cols: [], vals: [] };
        let histoCols = ['id_fiche', 'id_etat', 'id_confirmateur', 'id_sous_etat', 'date_rdv_time', 'date_creation', ...confCols];
        const dateRdvHisto = donneesFiche.date_rdv_time || null;
        let histoValues = [insertId, histoEtatId, histoConf, histoSousEtat, dateRdvHisto, now, ...confVals];
        if (Object.prototype.hasOwnProperty.call(donneesFiche, 'complement_chauffage')) {
          histoCols.push('complement_chauffage');
          histoValues.push(donneesFiche.complement_chauffage === '' || donneesFiche.complement_chauffage == null ? null : donneesFiche.complement_chauffage);
        }
        const histoPlaceholders = histoCols.map(() => '?').join(', ');
        await query(
          `INSERT INTO fiches_histo (${histoCols.join(', ')}) VALUES (${histoPlaceholders})`,
          histoValues
        );
        
        // Créer des notifications pour l'agent et son superviseur (si existe)
        const messageAcceptation = `Votre demande d'insertion de fiche pour ${donneesFiche.nom || ''} ${donneesFiche.prenom || ''} a été approuvée par ${traitantPseudo}. La fiche existante a été archivée et la nouvelle fiche a été créée.`;
        const metadataAcceptation = JSON.stringify({
          id_demande: id,
          id_fiche_existante: demande.id_fiche_existante,
          id_nouvelle_fiche: insertId,
          hash_nouvelle_fiche: nouvelleFicheHash
        });
        
        // Notification pour l'agent
        if (demande.id_agent && messageAcceptation && messageAcceptation.trim() !== '') {
          await query(
            `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            ['demande_insertion_acceptee', insertId, messageAcceptation.trim(), demande.id_agent, now, metadataAcceptation]
          ).catch(err => {
            console.error('Erreur lors de la création de la notification pour l\'agent:', err);
          });
        }
        
        // Notification pour le superviseur (si existe)
        if (agentInfo?.chef_equipe && messageAcceptation && messageAcceptation.trim() !== '') {
          await query(
            `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            ['demande_insertion_acceptee', insertId, messageAcceptation.trim(), agentInfo.chef_equipe, now, metadataAcceptation]
          ).catch(err => {
            console.error('Erreur lors de la création de la notification pour le superviseur:', err);
          });
        }
      } catch (insertError) {
        console.error('Erreur lors de l\'insertion de la fiche:', insertError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'insertion de la fiche',
          error: insertError.message
        });
      }
    } else if (statut === 'REJETEE') {
      // Refus : ne pas modifier la fiche existante (garder son état), ne pas insérer la nouvelle fiche.
      // Notifier l'agent qualification, son RE et son RP de la décision (avec commentaire)
      const messageRefus = `Demande d'insertion refusée. Fiche concernée : ${ficheExistante?.nom || ''} ${ficheExistante?.prenom || ''}. Rejetée par ${traitantPseudo}.${commentaire ? ` Commentaire : ${commentaire}` : ''}`;
      const metadataRefus = JSON.stringify({
        id_demande: id,
        id_fiche_existante: demande.id_fiche_existante,
        commentaire: commentaire || null
      });

      const destinations = [
        demande.id_agent,
        agentInfo?.chef_equipe || null,
        agentInfo?.id_rp_qualif || null
      ].filter(Boolean);
      const seen = new Set();
      for (const destId of destinations) {
        if (seen.has(destId)) continue;
        seen.add(destId);
        if (messageRefus && messageRefus.trim() !== '') {
          await query(
            `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            ['demande_insertion_refusee', demande.id_fiche_existante, messageRefus.trim(), destId, now, metadataRefus]
          ).catch(err => {
            console.error('Erreur notification refus (destination:', destId, '):', err);
          });
        }
      }
    }
    
    // Mettre à jour la demande
    await query(
      `UPDATE demandes_insertion 
       SET statut = ?, 
           date_traitement = NOW(), 
           id_traitant = ?, 
           commentaire = ?
       WHERE id = ?`,
      [statut, req.user.id, commentaire || null, id]
    );
    
    res.json({
      success: true,
      message: statut === 'APPROUVEE' 
        ? 'Demande approuvée et fiche insérée avec succès'
        : 'Demande rejetée'
    });
  } catch (error) {
    console.error('Erreur lors du traitement de la demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement de la demande',
      error: error.message
    });
  }
});

// Récupérer une fiche par ID
router.get('/:id', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ficheId = parseInt(id);
    
    if (isNaN(ficheId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de fiche invalide'
      });
    }

    console.log(`Recherche de la fiche avec ID: ${ficheId}`);
    
    // Récupérer la fiche de base (même si archivée ou inactive)
    const fiche = await queryOne(
      `SELECT * FROM fiches WHERE id = ?`,
      [ficheId]
    );

    console.log(`Résultat de la requête:`, fiche ? 'Fiche trouvée' : 'Fiche non trouvée');
    
    if (fiche) {
      console.log(`Fiche trouvée - Archive: ${fiche.archive}, Active: ${fiche.active}, KO: ${fiche.ko}`);
    }

    if (!fiche) {
      // Vérifier si des fiches existent dans la table
      const count = await queryOne('SELECT COUNT(*) as total FROM fiches');
      const allIds = await query('SELECT id FROM fiches ORDER BY id LIMIT 10');
      console.log(`Nombre total de fiches dans la base: ${count?.total || 0}`);
      console.log(`IDs disponibles (10 premiers):`, allIds.map(f => f.id));
      
      return res.status(404).json({
        success: false,
        message: `Fiche non trouvée avec l'ID ${ficheId}`,
        debug: {
          requestedId: ficheId,
          totalFiches: count?.total || 0,
          availableIds: allIds.map(f => f.id)
        }
      });
    }

    // Récupérer les informations complémentaires séparément
    let cq_etat = null;
    let cq_dossier = null;
    let installeur = null;
    let agent = null;
    let centre = null;
    let commercial = null;
    let confirmateur = null;
    let etat = null;
    let sousEtat = null;
    let produit = null;

    try {
      if (fiche.cq_etat) {
        const cq_e = await queryOne('SELECT titre FROM cq_etat WHERE id = ?', [fiche.cq_etat]);
        if (cq_e) cq_etat = cq_e.titre;
      }
    } catch (e) { console.log('Erreur cq_etat:', e.message); }

    try {
      if (fiche.cq_dossier) {
        const cq_d = await queryOne('SELECT titre FROM cq_dossier WHERE id = ?', [fiche.cq_dossier]);
        if (cq_d) cq_dossier = cq_d.titre;
      }
    } catch (e) { console.log('Erreur cq_dossier:', e.message); }

    try {
      if (fiche.ph3_installateur) {
        const inst = await queryOne('SELECT nom FROM installateurs WHERE id = ?', [fiche.ph3_installateur]);
        if (inst) installeur = inst.nom;
      }
    } catch (e) { console.log('Erreur installateurs:', e.message); }

    try {
      if (fiche.id_agent) {
        agent = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_agent]);
      }
    } catch (e) { console.log('Erreur agent:', e.message); }

    try {
      if (fiche.id_centre) {
        const cent = await queryOne('SELECT titre FROM centres WHERE id = ?', [fiche.id_centre]);
        if (cent) centre = { titre: cent.titre };
      }
    } catch (e) { console.log('Erreur centre:', e.message); }

    try {
      if (fiche.id_commercial) {
        commercial = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_commercial]);
      }
    } catch (e) { console.log('Erreur commercial:', e.message); }

    try {
      if (fiche.id_confirmateur) {
        confirmateur = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_confirmateur]);
      }
    } catch (e) { console.log('Erreur confirmateur:', e.message); }

    let confirmateur2 = null;
    let confirmateur3 = null;

    try {
      if (fiche.id_confirmateur_2) {
        confirmateur2 = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_confirmateur_2]);
      }
    } catch (e) { console.log('Erreur confirmateur2:', e.message); }

    try {
      if (fiche.id_confirmateur_3) {
        confirmateur3 = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_confirmateur_3]);
      }
    } catch (e) { console.log('Erreur confirmateur3:', e.message); }

    let qualite_user = null;
    try {
      if (fiche.id_qualite) {
        qualite_user = await queryOne('SELECT pseudo, color FROM utilisateurs WHERE id = ?', [fiche.id_qualite]);
      }
    } catch (e) { console.log('Erreur id_qualite:', e.message); }

    try {
      if (fiche.id_etat_final) {
        etat = await queryOne('SELECT titre, color, groupe FROM etats WHERE id = ?', [fiche.id_etat_final]);
        // Log pour déboguer le problème d'affichage du titre d'état
        if (etat) {
          console.log(`État récupéré pour fiche ID ${ficheId}: id_etat_final=${fiche.id_etat_final}, titre=${etat.titre}, groupe=${etat.groupe}`);
        } else {
          console.log(`Aucun état trouvé pour id_etat_final=${fiche.id_etat_final} (fiche ID ${ficheId})`);
        }
      }
    } catch (e) { 
      console.log('Erreur etat:', e.message);
      console.error('Erreur lors de la récupération de l\'état:', e);
    }

    try {
      if (fiche.id_sous_etat) {
        sousEtat = await queryOne('SELECT titre FROM sous_etat WHERE id = ?', [fiche.id_sous_etat]);
      }
    } catch (e) {
      console.log('Erreur sous_etat:', e.message);
    }

    // Récupérer la qualification si id_qualif existe
    let qualification = null;
    let qualification_code = null;
    if (fiche.id_qualif) {
      try {
        // Vérifier si la table qualif existe
        const qualifTableExists = await queryOne(
          `SELECT COUNT(*) as count 
           FROM information_schema.tables 
           WHERE table_schema = DATABASE() 
           AND table_name = 'qualif'`
        );
        
        if (qualifTableExists && qualifTableExists.count > 0) {
          // Si la table existe, récupérer le code depuis la table
          const qualif = await queryOne('SELECT code FROM qualif WHERE id = ?', [fiche.id_qualif]);
          if (qualif) {
            qualification_code = qualif.code;
          }
        } else {
          // Si la table n'existe pas, id_qualif peut contenir directement le code (ex: 'RDV_URGENT')
          if (typeof fiche.id_qualif === 'string') {
            qualification_code = fiche.id_qualif;
          }
        }
      } catch (e) { 
        console.log('Erreur qualification:', e.message);
        // Si id_qualif est une string (code direct), l'utiliser
        if (typeof fiche.id_qualif === 'string') {
          qualification_code = fiche.id_qualif;
        }
      }
    }

    try {
      if (fiche.produit) {
        produit = await queryOne('SELECT nom FROM produits WHERE id = ?', [fiche.produit]);
        // Ajouter une couleur par défaut selon le produit
        if (produit) {
          produit.color = fiche.produit === 1 ? '#0000CD' : '#FFE441'; // PAC = bleu, PV = jaune
        }
      }
    } catch (e) { console.log('Erreur produit:', e.message); }

    const hasEtatChangedByCompteRendu = !!(await queryOne(
      'SELECT 1 FROM compte_rendu_pending WHERE id_fiche = ? AND statut = ? LIMIT 1',
      [id, 'approved']
    ));

    // Pseudo du commercial auteur du dernier compte rendu approuvé (pour affichage <CR> + nom)
    let compte_rendu_commercial_pseudo = null;
    if (hasEtatChangedByCompteRendu) {
      const lastCr = await queryOne(
        `SELECT u.pseudo
         FROM compte_rendu_pending cr
         LEFT JOIN utilisateurs u ON cr.id_commercial = u.id
         WHERE cr.id_fiche = ? AND cr.statut = 'approved'
         ORDER BY cr.date_approbation DESC, cr.id DESC LIMIT 1`,
        [id]
      );
      if (lastCr && lastCr.pseudo) compte_rendu_commercial_pseudo = lastCr.pseudo;
    }

    // Confirmateurs issus de fiches_histo (id_etat=7) : source de vérité pour ne pas écraser l'ancien confirmateur
    let confirmateurs_from_histo = [];
    try {
      const histoConfRows = await query(
        `SELECT id_confirmateur FROM fiches_histo WHERE id_fiche = ? AND id_etat = 7 ORDER BY id ASC`,
        [id]
      );
      const seen = new Set();
      for (const row of histoConfRows || []) {
        const cid = row.id_confirmateur ? Number(row.id_confirmateur) : null;
        if (cid && cid > 0 && !seen.has(cid) && confirmateurs_from_histo.length < 3) {
          seen.add(cid);
          confirmateurs_from_histo.push(cid);
        }
      }
    } catch (e) {
      console.log('confirmateurs_from_histo:', e.message);
    }

    // Récupérer "Validé par qui" pour fiches confirmées et validées (dernière validation avec valider=1)
    let validateur_pseudo = null;
    if (fiche.id_etat_final === 7 && fiche.valider > 0) {
      try {
        const tableExists = await queryOne(
          `SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'validations'`
        );
        if (tableExists && tableExists.c > 0) {
          const lastValid = await queryOne(
            `SELECT u.pseudo 
             FROM validations v
             LEFT JOIN utilisateurs u ON v.id_user = u.id
             WHERE v.id_fiche = ? AND v.valider = 1
             ORDER BY v.date_valider_time DESC, v.id DESC LIMIT 1`,
            [id]
          );
          if (lastValid && lastValid.pseudo) validateur_pseudo = lastValid.pseudo;
        }
      } catch (e) { console.log('Erreur validateur:', e.message); }
    }

    // Construire l'objet fiche enrichi
    const ficheEnrichie = {
      ...fiche,
      cqe: cq_etat,
      cqd: cq_dossier,
      installeur: installeur,
      agent_pseudo: agent?.pseudo || null,
      agent_color: agent?.color || null,
      centre_titre: centre?.titre || null,
      commercial_pseudo: commercial?.pseudo || null,
      commercial_color: commercial?.color || null,
      confirmateur_pseudo: confirmateur?.pseudo || null,
      confirmateur_color: confirmateur?.color || null,
      confirmateur_2_pseudo: confirmateur2?.pseudo || null,
      confirmateur_2_color: confirmateur2?.color || null,
      confirmateur_3_pseudo: confirmateur3?.pseudo || null,
      confirmateur_3_color: confirmateur3?.color || null,
      qualite_pseudo: qualite_user?.pseudo || null,
      qualite_color: qualite_user?.color || null,
      etat_final_titre: etat?.titre || null,
      etat_final_color: etat?.color || null,
      etat_final_groupe: etat?.groupe || null,
      sous_etat_titre: sousEtat?.titre || null,
      // Ajouter id_etat_final pour vérification côté frontend
      id_etat_final_verified: fiche.id_etat_final,
      has_etat_changed_by_compte_rendu: hasEtatChangedByCompteRendu,
      compte_rendu_commercial_pseudo,
      produit_nom: produit?.nom || null,
      produit_color: produit?.color || null,
      qualification_code: qualification_code || null,
      validateur_pseudo: validateur_pseudo,
      confirmateurs_from_histo
    };

    // Récupérer l'historique complet avec détails
    // Enrichir avec les informations de la fiche actuelle (sous-état, confirmateur, commentaire, etc.)
    let historique;
    try {
      // D'abord récupérer l'historique de base
      historique = await query(
        `SELECT histo.*,
         etat.titre as etat_titre,
         etat.color as etat_color,
         se.titre as sous_etat_titre,
         u_histo.pseudo as histo_confirmateur_pseudo,
         u_cr.pseudo as cr_commercial_pseudo
         FROM fiches_histo histo
         LEFT JOIN etats etat ON histo.id_etat = etat.id
         LEFT JOIN sous_etat se ON histo.id_sous_etat = se.id
         LEFT JOIN utilisateurs u_histo ON histo.id_confirmateur = u_histo.id
         LEFT JOIN utilisateurs u_cr ON histo.id_commercial_cr = u_cr.id
         WHERE histo.id_fiche = ? 
         ORDER BY histo.id ASC`,
        [id]
      );
      
      // Enrichir chaque entrée de l'historique avec les données de la fiche actuelle
      if (historique && historique.length > 0 && fiche) {
        historique = historique.map(histo => ({
          ...histo,
          histo_id_confirmateur: histo.id_confirmateur,
          from_compte_rendu: histo.from_compte_rendu === 1 || (histo.id_etat === 8 && !histo.id_confirmateur),
          cr_commercial_pseudo: histo.cr_commercial_pseudo || null,
          id_confirmateur: fiche.id_confirmateur,
          id_confirmateur_2: fiche.id_confirmateur_2,
          id_confirmateur_3: fiche.id_confirmateur_3,
          confirmateur_pseudo: confirmateur?.pseudo || null,
          confirmateur_2_pseudo: confirmateur2?.pseudo || null,
          confirmateur_3_pseudo: confirmateur3?.pseudo || null,
          // Historique: conserver le commentaire au moment du passage d'état
          conf_commentaire_produit: histo.conf_commentaire_produit || null,
          conf_rdv_avec: fiche.conf_rdv_avec || null,
          conf_appel_tunisie_avec: fiche.conf_appel_tunisie_avec || null,
          conf_deja_etude: fiche.conf_deja_etude || null,
          conf_profession_monsieur: fiche.conf_profession_monsieur ?? fiche.profession_mr ?? null,
          conf_type_contrat_mr: fiche.conf_type_contrat_mr ?? fiche.type_contrat_mr ?? null,
          conf_profession_madame: fiche.conf_profession_madame ?? fiche.profession_madame ?? null,
          conf_type_contrat_madame: fiche.conf_type_contrat_madame ?? fiche.type_contrat_madame ?? null,
          conf_revenu: fiche.conf_revenu || null,
          conf_credit: fiche.conf_credit || null,
          conf_mode_chauffage: fiche.conf_mode_chauffage ?? fiche.mode_chauffage ?? null,
          conf_complement_chauffage: fiche.conf_complement_chauffage || null,
          conf_consommation_electricite: fiche.conf_consommation_electricite || null,
          conf_consommation_chauffage: fiche.conf_consommation_chauffage || null,
          conf_rdv_annule_precedent: fiche.conf_rdv_annule_precedent || null,
          conf_presence_couple: fiche.conf_presence_couple || null,
          date_rdv_time: fiche.date_rdv_time || null,
          date_appel_time: fiche.date_appel_time || null,
          profession_mr: fiche.profession_mr || null,
          profession_madame: fiche.profession_madame || null,
          type_contrat_mr: fiche.type_contrat_mr || null,
          type_contrat_madame: fiche.type_contrat_madame || null,
          revenu_foyer: fiche.revenu_foyer || null,
          credit_foyer: fiche.credit_foyer || null,
          mode_chauffage: fiche.mode_chauffage || null,
          complement_chauffage:
            Object.prototype.hasOwnProperty.call(histo, 'complement_chauffage')
              ? histo.complement_chauffage
              : (fiche.complement_chauffage || null),
          produit: fiche.produit || null,
          surface_chauffee: fiche.surface_chauffee || null,
          consommation_chauffage: fiche.consommation_chauffage || null,
          annee_systeme_chauffage: fiche.annee_systeme_chauffage || null,
          conf_orientation_toiture: fiche.conf_orientation_toiture || null,
          conf_zones_ombres: fiche.conf_zones_ombres || null,
          conf_site_classe: fiche.conf_site_classe || null,
          conf_consommation_electricite: fiche.conf_consommation_electricite || null,
          nb_pans: fiche.nb_pans || null,
          sous_etat_titre: histo.sous_etat_titre || null,
          cq_etat: cq_etat || null,
          cq_dossier: cq_dossier || null,
          commentaire_qualite: fiche.commentaire_qualite || null,
          observations_cq: fiche.observations_cq || null,
          commentaire_commercial: fiche.commentaire_commercial || null,
          installeur_nom: installeur || null,
          commercial_pseudo: commercial?.pseudo || null,
          // Champs Phase 3 pour SIGNER
          ph3_financement: fiche.ph3_type || null,
          ph3_phase: null, // À déterminer selon la logique métier
          ph3_prix: fiche.ph3_prix || null,
          ph3_puissance: fiche.ph3_puissance || fiche.ph3_puissance_pv || null,
          ph3_consommation: fiche.conf_consommations || null,
          ph3_bonus: fiche.ph3_bonus_30 || null,
          ph3_mensualite: fiche.ph3_mensualite || null,
          ph3_nbr_annee_finance: fiche.nbr_annee_finance || null,
          credit_immobilier: fiche.credit_immobilier || null,
          credit_autre: fiche.credit_autre || null,
          ph3_pac: fiche.ph3_pac || null,
          ph3_ballon: fiche.ph3_ballon || null,
          ph3_alimentation: fiche.ph3_alimentation || null,
          date_sign_time: fiche.date_sign_time || null,
          valeur_mensualite: fiche.valeur_mensualite || null
        }));

        // Pour les entrées issues d'un compte rendu (from_compte_rendu), remplacer commentaire_commercial par le commentaire du CR (compte_rendu_pending)
        try {
          const crs = await query(
            `SELECT id, id_etat_final, id_commercial, commentaire,
                    COALESCE(date_approbation, date_modif, date_creation) AS date_ref
             FROM compte_rendu_pending
             WHERE id_fiche = ? AND statut = 'approved'`,
            [id]
          );
          if (crs && crs.length > 0) {
            historique = historique.map(histo => {
              if (!(histo.from_compte_rendu === true || (histo.id_etat === 8 && !histo.id_confirmateur))) return histo;
              const histoDate = histo.date_creation ? new Date(histo.date_creation).getTime() : 0;
              const matching = crs.filter(cr =>
                Number(cr.id_etat_final) === Number(histo.id_etat) &&
                ((cr.id_commercial == null && histo.id_commercial_cr == null) || Number(cr.id_commercial) === Number(histo.id_commercial_cr))
              );
              if (matching.length === 0) return histo;
              const best = matching.reduce((acc, cr) => {
                const crDate = cr.date_ref ? new Date(cr.date_ref).getTime() : 0;
                const diff = Math.abs(histoDate - crDate);
                return !acc || diff < acc.diff ? { cr, diff } : acc;
              }, null);
              if (best && best.cr.commentaire != null && best.cr.commentaire !== '') {
                return { ...histo, commentaire_commercial: best.cr.commentaire };
              }
              return histo;
            });
          }
        } catch (e) {
          console.log('Enrichissement commentaire CR (compte_rendu_pending) ignoré:', e.message);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error.message);
      // En cas d'erreur, retourner un historique vide plutôt que de faire planter la requête
      historique = [];
    }

    // Récupérer les affectations (si la table existe)
    let affectations = [];
    try {
      // Vérifier d'abord si la table existe
      const tableExists = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = 'affectations'`
      );
      
      if (tableExists && tableExists.count > 0) {
        affectations = await query(
          `SELECT aff.*,
           user.pseudo as commercial_pseudo,
           user.color as commercial_color
           FROM affectations aff
           LEFT JOIN utilisateurs user ON aff.id_commercial = user.id
           WHERE aff.id_fiche = ?
           ORDER BY aff.id DESC`,
          [id]
        );
      }
    } catch (affError) {
      // La table affectations n'existe pas, on continue sans (erreur silencieuse)
      // Pas besoin de logger car c'est normal que cette table n'existe pas toujours
    }

    // Récupérer les comptes rendu en attente pour cette fiche
    let comptesRendus = [];
    try {
      comptesRendus = await query(
        `SELECT 
          cr.*,
          u_commercial.pseudo as commercial_pseudo,
          u_approbateur.pseudo as approbateur_pseudo,
          e.titre as etat_titre,
          se.titre as sous_etat_titre
        FROM compte_rendu_pending cr
        LEFT JOIN utilisateurs u_commercial ON cr.id_commercial = u_commercial.id
        LEFT JOIN utilisateurs u_approbateur ON cr.id_approbateur = u_approbateur.id
        LEFT JOIN etats e ON cr.id_etat_final = e.id
        LEFT JOIN sous_etat se ON cr.id_sous_etat = se.id
        WHERE cr.id_fiche = ?
        ORDER BY cr.date_creation DESC`,
        [id]
      );

      // Parser les modifications JSON pour chaque compte rendu
      comptesRendus = comptesRendus.map(cr => {
        try {
          return {
            ...cr,
            modifications: cr.modifications ? JSON.parse(cr.modifications) : {}
          };
        } catch (error) {
          console.error('Erreur lors du parsing des modifications pour CR ID:', cr.id, error);
          return {
            ...cr,
            modifications: {}
          };
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des comptes rendu:', error);
      // Ne pas bloquer la réponse si la récupération des comptes rendu échoue
      comptesRendus = [];
    }

    // Ajouter le hash et garder l'ID (nécessaire pour certaines opérations comme les décalages)
    const ficheIdValue = ficheEnrichie.id;
    
    res.json({
      success: true,
      data: {
        ...ficheEnrichie,
        id: ficheIdValue, // Garder l'ID pour les opérations backend (décalages, etc.)
        hash: encodeFicheId(ficheIdValue),
        historique,
        affectations,
        comptes_rendus: comptesRendus
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la fiche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la fiche',
      error: error.message
    });
  }
});

// Mettre à jour rapidement un champ d'une fiche
router.patch('/:id/field', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    if (!field) {
      return res.status(400).json({
        success: false,
        message: 'Le champ à modifier est requis'
      });
    }

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    // Vérifier les permissions selon le champ
    const user = req.user;
    
    // Vérifier les permissions selon la fonction de l'utilisateur
    if (user.fonction === 3) {
      // Agents : seulement leurs fiches du même centre
      if (fiche.id_centre !== user.centre) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
    } else if (user.fonction === 5) {
      // Commerciaux : seulement leurs fiches
      if (fiche.id_commercial !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
    } else if (user.fonction === 6) {
      // Confirmateurs : peuvent modifier toutes les fiches (pas de restriction)
      // Pas de vérification d'assignation nécessaire
    } else if (user.fonction === 14 || user.fonction === 13 || user.fonction === 11) {
      // RE Confirmation (14), RP Confirmation (13), Backoffice (11) : peuvent modifier les champs des fiches (modification rapide)
      // Pas de vérification d'assignation nécessaire
    } else if (user.fonction === 2) {
      // Superviseur Qualification : peuvent modifier les fiches des agents sous leur responsabilité
      // Récupérer les agents sous la responsabilité du superviseur
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs 
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [user.id]
      );
      
      const agentIds = agentsSousResponsabilite.map(a => a.id);
      
      // Vérifier que la fiche appartient à un de ces agents
      // Si le superviseur n'a pas d'agents ou si la fiche n'appartient pas à un de ses agents, refuser
      if (agentIds.length === 0 || !agentIds.includes(fiche.id_agent)) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche. Seules les fiches de vos agents peuvent être modifiées.'
        });
      }
    } else if (user.fonction === 12) {
      // RP Qualification : peuvent modifier les fiches des agents sous la responsabilité de leurs superviseurs
      // Récupérer les superviseurs assignés au RP
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND fonction = 2 AND etat > 0`,
        [user.id]
      );
      
      if (!superviseursAssignes || superviseursAssignes.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
      
      const superviseurIds = superviseursAssignes.map(s => s.id);
      
      // Récupérer les agents de ces superviseurs
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs 
         WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
         AND fonction = 3 AND etat > 0`,
        superviseurIds
      );
      
      const agentIds = agentsSousResponsabilite.map(a => a.id);
      
      // Vérifier que la fiche appartient à un de ces agents
      if (!agentIds.includes(fiche.id_agent)) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
    } else if (user.fonction === 8) {
      // Qualité Qualification (fonction 8) : peuvent modifier toutes les fiches (pas de restriction)
      // Pas de vérification d'assignation nécessaire
    }
    // Admins (1, 2, 7) : peuvent tout modifier, pas de vérification supplémentaire

    // Contrôle qualité : si un agent qualité modifie le commentaire qualité sur une fiche déjà assignée à un autre, bloquer (sauf états Debrief / À vérifier)
    const isQualiteUserField = user.fonction === 2 || user.fonction === 8 || user.fonction === 12;
    if (isQualiteUserField && field === 'commentaire_qualite') {
      const canModifyField = await canQualiteModifierFiche(fiche, user.id, user.fonction);
      if (!canModifyField) {
        return res.status(403).json({
          success: false,
          message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
        });
      }
    }
    
    // Si modification de l'état final, créer une entrée dans l'historique (comparaison numérique : 7 et "7" = même état)
    if (field === 'id_etat_final' && value != null && value !== '' && parseEtatId(value) !== parseEtatId(fiche.id_etat_final)) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Attribuer id_qualite si c'est un utilisateur qualité et que c'est la première modification
      const isQualiteUser = user.fonction === 2 || user.fonction === 8 || user.fonction === 12;
      if (isQualiteUser && !fiche.id_qualite) {
        await query(
          `UPDATE fiches SET id_qualite = ? WHERE id = ?`,
          [user.id, id]
        );
        console.log(`id_qualite attribué à l'utilisateur ${user.id} (${user.pseudo}) pour la fiche ${id}`);
      }
      
      // Mettre à jour automatiquement date_appel_time lors du changement d'état
      await query(
        `UPDATE fiches SET date_appel_time = ?, date_modif_time = ? WHERE id = ?`,
        [now, now, id]
      );
      
      const histoConf = getHistoConfirmateur(req, fiche);
      const histoSousEtat = (fiche && (fiche.id_sous_etat != null)) ? fiche.id_sous_etat : null;
      const dateRdvHisto = fiche.date_rdv_time || null;
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, id_confirmateur, id_sous_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, parseInt(value, 10), histoConf, histoSousEtat, dateRdvHisto, now]
      );
      
      // Si on passe de l'état CONFIRMER (7) à un état du groupe 2, supprimer la date du RDV
      const oldEtatId = fiche.id_etat_final;
      const newEtatId = parseInt(value);
      
      if (oldEtatId === 7 && newEtatId !== 7) {
        // Récupérer le groupe du nouvel état
        const newEtat = await queryOne(
          'SELECT groupe FROM etats WHERE id = ?',
          [newEtatId]
        );
        
        // Si le nouvel état est dans le groupe 2, supprimer date_rdv_time
        if (newEtat && (newEtat.groupe === 2 || newEtat.groupe === '2')) {
          await query(
            'UPDATE fiches SET date_rdv_time = NULL, date_modif_time = ? WHERE id = ?',
            [now, id]
          );
          
          // Enregistrer aussi cette modification dans modifica
          await logModification(
            id,
            req.user.id,
            req.user.pseudo || 'Utilisateur',
            'date_rdv_time',
            fiche.date_rdv_time,
            null
          );
          
          console.log(`Date RDV supprimée pour la fiche ${id} : passage de l'état CONFIRMER (7) à l'état ${newEtatId} (groupe 2)`);
        }
      }
    }

    // Liste des champs autorisés pour éviter les injections SQL
    const allowedFields = [
      'nom', 'prenom', 'civ', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville',
      'situation_conjugale', 'entretien', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage', 'complement_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'etude_raison', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'isolation', 'conf_commentaire_produit', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
      'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
      'conf_presence_couple', 'conf_profession_monsieur', 'conf_profession_madame',
      'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_consommations',
      'date_rdv_time', 'date_appel_time', 'id_centre', 'id_agent', 'id_commercial', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_commercial_2', 'id_etat_final',
      'rdv_urgent', 'rdv_seul', 'commentaire', 'commentaire_qualite', 'commentaire_commercial', 'motif_qualif', 'type_contrat_mr', 'type_contrat_madame',
      'conf_type_contrat_mr', 'conf_type_contrat_madame',
      'cq_etat', 'cq_dossier', 'observations_cq'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Le champ "${field}" n'est pas autorisé à être modifié`
      });
    }

    // date_appel_time : modifiable uniquement par les sessions "modification rapide" (RE 14, RP 13, Backoffice 11 ou permission fiche_quick_edit)
    const isModificationRapide = user.fonction === 14 || user.fonction === 13 || user.fonction === 11 ||
      (await hasPermission(user.fonction, 'fiche_quick_edit'));
    if (field === 'date_appel_time' && !isModificationRapide) {
      return res.status(400).json({
        success: false,
        message: 'date_appel_time ne peut pas être modifiée manuellement. Elle est remplie automatiquement lors du changement d\'état.'
      });
    }

    // Récupérer l'ancienne valeur avant la mise à jour
    const oldValue = fiche[field];

    // Champs logiques -> colonne en base (colonnes différentes ou absentes)
    const fieldToDb = {
      rdv_seul: 'conf_presence_couple',
      profession_mr: 'conf_profession_monsieur',
      profession_madame: 'conf_profession_madame',
      type_contrat_mr: 'conf_type_contrat_mr',
      type_contrat_madame: 'conf_type_contrat_madame'
    };
    const dbField = fieldToDb[field] || field;
    const dbOldValue = fieldToDb[field] ? (fiche[dbField] ?? oldValue) : oldValue;

    // Mettre à jour le champ
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `UPDATE fiches SET \`${dbField}\` = ?, date_modif_time = ? WHERE id = ?`,
      [value || null, now, id]
    );

    // Enregistrer la modification dans modifica (nom logique du champ pour l'audit)
    await logModification(
      id,
      req.user.id,
      req.user.pseudo || 'Utilisateur',
      field,
      dbOldValue,
      value || null
    );

    // Enregistrer l'audit dans controle_qualite lorsque seul le commentaire qualité est modifié (page Contrôle Qualité)
    if (field === 'commentaire_qualite') {
      const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
      if (hasControleQualitePermission) {
        await insertControleQualiteAudit({
          id_fiche: id,
          id_qualite: req.user.id,
          id_etat: fiche.id_etat_final ?? null,
          id_sous_etat: fiche.id_sous_etat ?? null,
          commentaire: value || null,
          ko: 0,
          hc: 0,
          id_etat_precedent: fiche.id_etat_final ?? null,
          id_sous_etat_precedent: fiche.id_sous_etat ?? null,
          id_agent_fiche: fiche.id_agent ?? null,
          id_centre: fiche.id_centre ?? null,
          date_audit: now,
          date_fiche: fiche.date_insert_time ?? null
        });
      }
    }

    res.json({
      success: true,
      message: 'Champ mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du champ:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du champ',
      error: error.message
    });
  }
});

// Contrôle Qualité : enregistrer CQ ETAT, CQ DOSSIER et OBSERVATIONS (états signer uniquement)
// Utilise le champ dédié observations_cq (pas commentaire_qualite)
router.put('/:id/controle-qualite', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { cq_etat, cq_dossier, observations_cq } = req.body;

    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
    }

    // États signer : 13, 16, 44, 45
    const etatsSigner = [13, 16, 44, 45];
    if (!etatsSigner.includes(fiche.id_etat_final)) {
      return res.status(400).json({
        success: false,
        message: 'Le contrôle qualité n\'est disponible que pour les fiches en état signé (SIGNER, SIGNER RETRACTER, SIGNER PM, SIGNER COMPLET)'
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const cqEtatVal = cq_etat !== undefined && cq_etat !== '' ? parseInt(cq_etat) || null : fiche.cq_etat;
    const cqDossierVal = cq_dossier !== undefined && cq_dossier !== '' ? parseInt(cq_dossier) || null : fiche.cq_dossier;
    const observationsVal = observations_cq !== undefined ? (observations_cq || null) : (fiche.observations_cq ?? null);

    await query(
      `UPDATE fiches SET cq_etat = ?, cq_dossier = ?, observations_cq = ?, date_modif_time = ? WHERE id = ?`,
      [cqEtatVal, cqDossierVal, observationsVal, now, id]
    );

    if (cqEtatVal !== fiche.cq_etat) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'cq_etat', fiche.cq_etat, cqEtatVal);
    }
    if (cqDossierVal !== fiche.cq_dossier) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'cq_dossier', fiche.cq_dossier, cqDossierVal);
    }
    if (String(observationsVal || '') !== String(fiche.observations_cq || '')) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'observations_cq', fiche.observations_cq, observationsVal);
    }

    res.json({ success: true, message: 'Contrôle qualité enregistré avec succès' });
  } catch (error) {
    console.error('Erreur contrôle qualité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du contrôle qualité',
      error: error.message
    });
  }
});

// Créer une nouvelle fiche
// Permissions : Admin (1, 2), Agents (3), Qualité (4), Commerciaux (5), Confirmateurs (6), Dev (7), Autres (8)
router.post('/', authenticate, checkPermissionCode('fiches_create'), triggerWorkflowOnFicheCreated, async (req, res) => {
  try {
    const ficheData = req.body;

    // index.php / Vicidial : entretien_avec → colonne fiches.entretien
    if (Object.prototype.hasOwnProperty.call(ficheData, 'entretien_avec')) {
      if (ficheData.entretien == null || ficheData.entretien === '') {
        ficheData.entretien = ficheData.entretien_avec;
      }
      delete ficheData.entretien_avec;
    }

    // Normaliser le téléphone AVANT de vérifier les doublons
    // Fonction pour normaliser un numéro de téléphone
    const normalizePhone = (phone) => {
      if (!phone) return null;
      // Supprimer les espaces et caractères spéciaux
      let normalized = phone.toString().replace(/\s+/g, '').replace(/[^\d+]/g, '');
      // Si le numéro ne commence pas par 0 ou +, ajouter 0
      if (normalized && !normalized.startsWith('0') && !normalized.startsWith('+')) {
        normalized = '0' + normalized;
      }
      return normalized || null;
    };
    
    // Normaliser les numéros de téléphone
    const telNormalized = normalizePhone(ficheData.tel);
    const gsm1Normalized = ficheData.gsm1 ? normalizePhone(ficheData.gsm1) : null;
    const gsm2Normalized = ficheData.gsm2 ? normalizePhone(ficheData.gsm2) : null;
    
    // Mettre à jour ficheData avec les valeurs normalisées
    if (telNormalized) ficheData.tel = telNormalized;
    if (gsm1Normalized) ficheData.gsm1 = gsm1Normalized;
    if (gsm2Normalized) ficheData.gsm2 = gsm2Normalized;
    
    // Si gsm1 ou gsm2 sont vides, les copier depuis tel
    if (!ficheData.gsm1 || ficheData.gsm1 === '0') {
      ficheData.gsm1 = ficheData.tel;
    }
    if (!ficheData.gsm2 || ficheData.gsm2 === '0') {
      ficheData.gsm2 = ficheData.tel;
    }
    
    // Vérifier les doublons par téléphone (ignorer les fiches archivées)
    // Si un doublon est trouvé, créer une demande d'insertion au lieu de rejeter
    // Fonction pour obtenir les variations d'un numéro (avec/sans 0) à partir d'un numéro déjà normalisé
    const getPhoneVariations = (normalizedPhone) => {
      if (!normalizedPhone) return [];
      // Le numéro est déjà normalisé (avec 0)
      const variations = [normalizedPhone];
      // Ajouter la version sans 0 si le numéro commence par 0
      if (normalizedPhone.startsWith('0') && normalizedPhone.length > 1) {
        variations.push(normalizedPhone.substring(1));
      }
      return [...new Set(variations)]; // Supprimer les doublons
    };
    
    let existingFiche = null;
    
    // Récupérer toutes les variations des numéros normalisés à vérifier
    const telVariations = ficheData.tel ? getPhoneVariations(ficheData.tel) : [];
    const gsm1Variations = ficheData.gsm1 && ficheData.gsm1 !== ficheData.tel ? getPhoneVariations(ficheData.gsm1) : [];
    const gsm2Variations = ficheData.gsm2 && ficheData.gsm2 !== ficheData.tel && ficheData.gsm2 !== ficheData.gsm1 ? getPhoneVariations(ficheData.gsm2) : [];
    
    // Combiner toutes les variations uniques
    const allVariations = [...new Set([...telVariations, ...gsm1Variations, ...gsm2Variations])];
    
    // Si on a des numéros à vérifier
    if (allVariations.length > 0) {
      // Créer les placeholders pour la requête
      const placeholders = allVariations.map(() => '?').join(',');
      
      existingFiche = await queryOne(
        `SELECT id, date_insert_time, date_modif_time FROM fiches 
         WHERE (
           tel IN (${placeholders})
           OR gsm1 IN (${placeholders})
           OR gsm2 IN (${placeholders})
         )
         AND (archive = 0 OR archive IS NULL)
         LIMIT 1`,
        [...allVariations, ...allVariations, ...allVariations]
      );
    }
    
    // Si une fiche existante est trouvée, créer une demande d'insertion (plusieurs demandes possibles pour le même numéro)
    if (existingFiche) {
      const agentId = ficheData.id_agent || req.user.id;
      
      // Récupérer les informations de l'agent pour le message
      const agentInfo = await queryOne(
        `SELECT pseudo FROM utilisateurs WHERE id = ?`,
        [agentId]
      );
      
      // Créer la demande d'insertion
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      console.log('[DEMANDE INSERTION] Création de la demande - agent:', agentId, 'fiche:', existingFiche.id);
      const demandeResult = await query(
        `INSERT INTO demandes_insertion 
         (id_agent, id_fiche_existante, donnees_fiche, date_demande, statut)
         VALUES (?, ?, ?, ?, 'EN_ATTENTE')`,
        [agentId, existingFiche.id, JSON.stringify(ficheData), now]
      );
      
      console.log('[DEMANDE INSERTION] Demande créée avec ID:', demandeResult.insertId);
      
      // Récupérer les informations de la fiche existante pour le message
      const ficheExistanteInfo = await queryOne(
        `SELECT nom, prenom, tel, hash FROM fiches WHERE id = ?`,
        [existingFiche.id]
      );
      
      // Notifications manuelles supprimées : déclenchement workflow dédié
      executeWorkflow('demande_insertion_created', {
        user: req.user,
        fiche: {
          id: existingFiche.id,
          hash: ficheExistanteInfo?.hash || encodeFicheId(existingFiche.id),
          nom: ficheExistanteInfo?.nom || null,
          prenom: ficheExistanteInfo?.prenom || null,
          tel: ficheExistanteInfo?.tel || null,
        },
        demande_insertion: {
          id: demandeResult.insertId,
          id_fiche_existante: existingFiche.id,
          id_agent: agentId,
          agent_pseudo: agentInfo?.pseudo || null,
          donnees_fiche: ficheData,
          date_demande: now,
        },
      }).catch((wfError) => {
        console.error('[WORKFLOW] Erreur lors de l\'exécution des workflows (demande_insertion_created):', wfError);
      });
      
      return res.status(200).json({
        success: true,
        message: 'Une fiche existe déjà avec ce numéro de téléphone. Une demande d\'insertion a été créée.',
        data: {
          demandeId: demandeResult.insertId,
          existingFicheId: existingFiche.id,
          demandeCreated: true
        }
      });
    }

    // Normaliser le code postal (tous les codes postaux doivent être 5 chiffres)
    // Les codes postaux de 4 chiffres sont complétés avec un 0 devant
    if (ficheData.cp) {
      const cpStr = String(ficheData.cp).trim();
      // Supprimer tous les caractères non numériques
      const cpDigits = cpStr.replace(/\D/g, '');
      
      if (cpDigits.length === 0) {
        // Si pas de chiffres, considérer comme vide
        ficheData.cp = null;
      } else if (cpDigits.length === 4) {
        // Si exactement 4 chiffres, ajouter un 0 devant pour obtenir 5 chiffres
        ficheData.cp = '0' + cpDigits;
      } else if (cpDigits.length === 5) {
        // Si exactement 5 chiffres, accepter tel quel
        ficheData.cp = cpDigits;
      } else {
        // Si moins de 4 chiffres ou plus de 5 chiffres, rejeter
        return res.status(400).json({
          success: false,
          message: `Code postal invalide : "${cpStr}" (doit contenir 4 ou 5 chiffres. Les codes de 4 chiffres seront complétés avec un 0 devant)`
        });
      }
    }

    // Ajouter les champs par défaut
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    ficheData.date_insert_time = now;
    ficheData.date_modif_time = now;
    ficheData.date_insert = Math.floor(Date.now() / 1000);
    
    // Utiliser id_agent envoyé dans la requête si présent, sinon utiliser l'utilisateur connecté
    if (!ficheData.id_agent) {
      ficheData.id_agent = req.user.id;
    } else {
      // Valider que l'id_agent envoyé est un nombre valide
      ficheData.id_agent = parseInt(ficheData.id_agent);
      if (isNaN(ficheData.id_agent) || ficheData.id_agent <= 0) {
        return res.status(400).json({
          success: false,
          message: 'id_agent invalide'
        });
      }
    }
    
    ficheData.active = 1;
    ficheData.archive = 0;
    ficheData.ko = 0;
    ficheData.hc = 0;
    ficheData.valider = 0;
    if (!ficheData.id_etat_final) {
      ficheData.id_etat_final = 1; // État par défaut : Nouveau
    }
    if (!ficheData.id_centre && req.user.centre) {
      ficheData.id_centre = req.user.centre;
    }

    // Liste des colonnes valides dans la table fiches (basée sur database_schema.sql)
    const validColumns = [
      'civ', 'nom', 'prenom', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville', 'etude', 'etude_raison',
      'consommation_chauffage', 'surface_habitable', 'annee_systeme_chauffage', 'surface_chauffee',
          'proprietaire_maison', 'nb_pieces', 'nb_pans', 'age_maison', 'orientation_toiture', 'produit',
          'site_classe', 'zones_ombres',
          'nb_chemines', 'mode_chauffage', 'complement_chauffage', 'consommation_electricite', 'circuit_eau', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'situation_conjugale', 'entretien', 'nb_enfants', 'profession_mr',
      'profession_madame', 'type_contrat_mr', 'type_contrat_madame', 'commentaire', 'id_agent', 'id_centre', 'id_insert', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_qualite', 'id_qualif', 'id_commercial',
      'id_commercial_2', 'id_etat_final', 'id_sous_etat', 'date_appel', 'date_insert', 'date_insert_time',
      'date_audit', 'date_confirmation', 'date_qualif', 'date_rdv', 'date_rdv_time',
      'date_affect', 'date_sign', 'date_sign_time', 'date_modif_time', 'archive', 'ko', 'hc',
      'active', 'valider', 'conf_commentaire_produit', 'conf_consommations',
      'conf_profession_monsieur', 'conf_profession_madame', 'conf_presence_couple',
      'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec', 'conf_appel_tunisie_avec', 'conf_deja_etude',
      'conf_revenu', 'conf_credit', 'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
      'conf_type_contrat_mr', 'conf_type_contrat_madame',
      'cq_etat', 'cq_dossier',
      'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
      'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
      'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
      'credit_immobilier', 'credit_autre', 'valeur_mensualite', 'pseudo'
    ];

    // Gérer les valeurs NULL et filtrer les colonnes valides
    const fields = [];
    const values = [];
    const placeholders = [];

    for (const [key, value] of Object.entries(ficheData)) {
      // Vérifier que la colonne existe dans le schéma et que la valeur n'est pas vide
      if (validColumns.includes(key) && value !== undefined && value !== null && value !== '') {
        fields.push(key);
        values.push(value);
        placeholders.push('?');
      } else if (!validColumns.includes(key)) {
        // Log les colonnes ignorées pour le débogage
        console.log(`Colonne ignorée (n'existe pas dans le schéma): ${key}`);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ valide à insérer'
      });
    }

    const result = await query(
      `INSERT INTO fiches (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    const insertId = result.insertId;

    // Calculer et stocker le hash de l'ID (toujours calculé pour chaque nouvelle fiche)
    if (insertId) {
      const hash = encodeFicheId(insertId);
      await query('UPDATE fiches SET hash = ? WHERE id = ?', [hash, insertId]);
    } else {
      throw new Error('Impossible de récupérer l\'ID de la fiche insérée');
    }

    // Créer l'entrée dans l'historique + champs conf_* si état 7
    if (ficheData.id_etat_final) {
      const histoConf = getHistoConfirmateur(req, null);
      const histoSousEtat = (ficheData.id_sous_etat != null) ? ficheData.id_sous_etat : null;
      const isEtat7 = parseInt(ficheData.id_etat_final) === 7;
      const { cols: confCols, vals: confVals } = isEtat7 ? getConfFieldsForHisto(ficheData, {}) : { cols: [], vals: [] };
      let histoCols = ['id_fiche', 'id_etat', 'id_confirmateur', 'id_sous_etat', 'date_rdv_time', 'date_creation', ...confCols];
      const dateRdvHisto = ficheData.date_rdv_time || null;
      let histoValues = [insertId, ficheData.id_etat_final, histoConf, histoSousEtat, dateRdvHisto, now, ...confVals];
      if (Object.prototype.hasOwnProperty.call(ficheData, 'complement_chauffage')) {
        histoCols.push('complement_chauffage');
        histoValues.push(ficheData.complement_chauffage === '' || ficheData.complement_chauffage == null ? null : ficheData.complement_chauffage);
      }
      const histoPlaceholders = histoCols.map(() => '?').join(', ');
      await query(
        `INSERT INTO fiches_histo (${histoCols.join(', ')}) VALUES (${histoPlaceholders})`,
        histoValues
      );
    }

    res.status(201).json({
      success: true,
      message: 'Fiche créée avec succès',
      data: { id: insertId }
    });
  } catch (error) {
    console.error('Erreur lors de la création de la fiche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la fiche',
      error: error.message
    });
  }
});

// Modification rapide de l'état d'une fiche (pour contrôle qualité)
// IMPORTANT: Cette route doit être définie AVANT la route PUT /:id pour éviter les conflits
router.put('/:id/etat-rapide', hashToIdMiddleware, authenticate, triggerWorkflowOnEtatChanged, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_etat_final } = req.body;

    if (!id_etat_final) {
      return res.status(400).json({
        success: false,
        message: 'L\'état est requis'
      });
    }

    // Vérifier que la fiche existe (id_sous_etat, id_qualite pour vérification)
    const fiche = await queryOne('SELECT id_etat_final, id_qualite, id_sous_etat FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    const canModifyEtat = await canQualiteModifierFiche(fiche, req.user.id, req.user.fonction);
    if (!canModifyEtat) {
      return res.status(403).json({
        success: false,
        message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
      });
    }

    // Vérifier que le nouvel état est du groupe 0
    const etat = await queryOne(
      'SELECT id, groupe FROM etats WHERE id = ?',
      [parseInt(id_etat_final)]
    );

    if (!etat) {
      return res.status(400).json({
        success: false,
        message: 'État invalide'
      });
    }

    if (etat.groupe !== '0' && etat.groupe !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les états du groupe 0 peuvent être assignés via cette route'
      });
    }

    const oldEtatId = fiche.id_etat_final;
    const newEtatId = parseInt(id_etat_final);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Attribuer id_qualite au nouvel agent qualité qui modifie l'état (fiche non verrouillée)
    const isQualiteUser = req.user.fonction === 2 || req.user.fonction === 8 || req.user.fonction === 12;
    if (isQualiteUser) {
      await query(
        `UPDATE fiches SET id_qualite = ? WHERE id = ?`,
        [req.user.id, id]
      );
      console.log(`id_qualite assigné à l'utilisateur ${req.user.id} (${req.user.pseudo}) pour la fiche ${id}`);
    }

    // Mettre à jour l'état et date_appel_time automatiquement lors du changement d'état
    await query(
      'UPDATE fiches SET id_etat_final = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, now, now, id]
    );

    // Enregistrer dans l'historique (avec id_confirmateur : connecté ou choisi par RE/RP/admin/backoffice) + conf_* si état 7
    if (parseEtatId(oldEtatId) !== parseEtatId(newEtatId)) {
      const histoConf = getHistoConfirmateur(req, fiche);
      const histoSousEtat = (fiche && (fiche.id_sous_etat != null)) ? fiche.id_sous_etat : null;
      let dateRdvHisto = null;
      let confCols = [];
      let confVals = [];
      if (newEtatId === 7) {
        const ficheForConf = await queryOne(
          `SELECT date_rdv_time, ${FICHES_HISTO_CONF_COLUMNS.join(', ')} FROM fiches WHERE id = ?`,
          [id]
        );
        if (ficheForConf) {
          dateRdvHisto = ficheForConf.date_rdv_time || null;
          const out = getConfFieldsForHisto(ficheForConf, {});
          confCols = out.cols;
          confVals = out.vals;
        }
      }
      let histoCols = ['id_fiche', 'id_etat', 'id_confirmateur', 'id_sous_etat', 'date_rdv_time', 'date_creation', ...confCols];
      let histoValues = [id, newEtatId, histoConf, histoSousEtat, dateRdvHisto, now, ...confVals];
      const ficheQualifSnap = await queryOne('SELECT complement_chauffage FROM fiches WHERE id = ?', [id]);
      if (ficheQualifSnap) {
        histoCols.push('complement_chauffage');
        histoValues.push(ficheQualifSnap.complement_chauffage ?? null);
      }
      const histoPlaceholders = histoCols.map(() => '?').join(', ');
      await query(
        `INSERT INTO fiches_histo (${histoCols.join(', ')}) VALUES (${histoPlaceholders})`,
        histoValues
      );

      // Logger la modification
      const userPseudo = req.user.pseudo || 'Utilisateur';
      await logModification(
        id,
        req.user.id,
        userPseudo,
        'id_etat_final',
        oldEtatId,
        newEtatId
      );

      // Enregistrer l'audit dans controle_qualite (page Contrôle Qualité)
      const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
      if (hasControleQualitePermission) {
        const ficheInfos = await queryOne('SELECT id_agent, id_centre, date_insert_time FROM fiches WHERE id = ?', [id]);
        if (ficheInfos) {
          await insertControleQualiteAudit({
            id_fiche: id,
            id_qualite: req.user.id,
            id_etat: newEtatId,
            id_sous_etat: null,
            ko: 0,
            hc: 0,
            id_etat_precedent: oldEtatId,
            id_sous_etat_precedent: fiche.id_sous_etat ?? null,
            id_agent_fiche: ficheInfos.id_agent ?? null,
            id_centre: ficheInfos.id_centre ?? null,
            date_audit: now,
            date_fiche: ficheInfos.date_insert_time ?? null
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'État mis à jour avec succès',
      data: {
        id,
        id_etat_final: newEtatId,
        old_etat: oldEtatId
      }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour rapide de l\'état:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Valider une fiche qualité (passer en état En-Attente)
// IMPORTANT: Cette route doit être définie AVANT la route PUT /:id pour éviter les conflits
// NOTE: triggerWorkflowOnEtatChanged intercepte la réponse pour déclencher etat_changed
router.put('/:hash/valider-qualite', authenticate, hashToIdMiddleware, triggerWorkflowOnEtatChanged, async (req, res) => {
  try {
    // Le middleware hashToIdMiddleware devrait avoir converti req.params.hash en req.params.id
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    
    // Vérifier que l'ID a été correctement extrait du hash
    if (!id || isNaN(id) || id <= 0) {
      console.error('Erreur: ID invalide dans valider-qualite', {
        id: req.params.id,
        hash: req.params.hash,
        params: req.params
      });
      return res.status(400).json({
        success: false,
        message: 'Identifiant de fiche invalide ou manquant'
      });
    }
    
    // Vérifier les permissions - utiliser la permission controle_qualite_view
    const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
    if (!hasControleQualitePermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de valider des fiches qualité'
      });
    }

    // Vérifier que la fiche existe (id_sous_etat, date_rdv_time pour fiches_histo)
    const fiche = await queryOne('SELECT id_etat_final, id_qualite, id_sous_etat, date_rdv_time FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    const canModify = await canQualiteModifierFiche(fiche, req.user.id, req.user.fonction);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
      });
    }

    // Récupérer l'état "En-Attente" (ID 1)
    const etatEnAttente = await queryOne(
      'SELECT id, titre FROM etats WHERE id = 1 OR (titre = ? OR titre = ? OR titre = ?) LIMIT 1',
      ['EN-ATTENTE', 'En-Attente', 'EN ATTENTE']
    );

    if (!etatEnAttente) {
      return res.status(400).json({
        success: false,
        message: 'L\'état "En-Attente" n\'a pas été trouvé dans la base de données'
      });
    }

    const oldEtatId = fiche.id_etat_final;
    const newEtatId = etatEnAttente.id;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Attribuer id_qualite au nouvel agent qualité qui modifie l'état (fiche non verrouillée)
    const isQualiteUser = req.user.fonction === 2 || req.user.fonction === 8 || req.user.fonction === 12;
    if (isQualiteUser) {
      await query(
        `UPDATE fiches SET id_qualite = ? WHERE id = ?`,
        [req.user.id, id]
      );
      console.log(`id_qualite assigné à l'utilisateur ${req.user.id} (${req.user.pseudo}) pour la fiche ${id}`);
    }

    // Mettre à jour l'état vers "En-Attente" et date_appel_time automatiquement lors du changement d'état
    await query(
      'UPDATE fiches SET id_etat_final = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, now, now, id]
    );

    // Enregistrer dans l'historique si changement d'état
    if (parseEtatId(oldEtatId) !== parseEtatId(newEtatId)) {
      const histoConf = getHistoConfirmateur(req, fiche);
      const histoSousEtat = (fiche && (fiche.id_sous_etat != null)) ? fiche.id_sous_etat : null;
      const dateRdvHisto = fiche.date_rdv_time || null;
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, id_confirmateur, id_sous_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, newEtatId, histoConf, histoSousEtat, dateRdvHisto, now]
      );

      // Logger la modification
      await logModification(
        id,
        req.user.id,
        req.user.pseudo || 'Utilisateur',
        'id_etat_final',
        oldEtatId,
        newEtatId
      );

      // Enregistrer l'audit dans controle_qualite
      const ficheInfos = await queryOne('SELECT id_agent, id_centre, date_insert_time FROM fiches WHERE id = ?', [id]);
      if (ficheInfos) {
        await insertControleQualiteAudit({
          id_fiche: id,
          id_qualite: req.user.id,
          id_etat: newEtatId,
          id_sous_etat: null,
          ko: 0,
          hc: 0,
          id_etat_precedent: oldEtatId,
          id_sous_etat_precedent: fiche.id_sous_etat ?? null,
          id_agent_fiche: ficheInfos.id_agent ?? null,
          id_centre: ficheInfos.id_centre ?? null,
          date_audit: now,
          date_fiche: ficheInfos.date_insert_time ?? null
        });
      }
    }

    res.json({
      success: true,
      message: 'Fiche validée et passée en état "En-Attente"',
      data: {
        id,
        id_etat_final: newEtatId,
        old_etat: oldEtatId,
        etat_titre: etatEnAttente.titre
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation qualité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation qualité',
      error: error.message
    });
  }
});

// Valider une fiche qualité en KO : état En-Attente + ko = 1 (fiche utilisée mais non comptabilisée pour l'agent)
router.put('/:hash/valider-qualite-ko', authenticate, hashToIdMiddleware, triggerWorkflowOnEtatChanged, async (req, res) => {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant de fiche invalide ou manquant'
      });
    }
    
    // Récupérer le sous-état et le commentaire depuis le body
    const { id_sous_etat, commentaire_ko } = req.body;
    
    // Vérifier que le sous-état est fourni
    if (!id_sous_etat) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-état KO est obligatoire'
      });
    }
    
    const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
    if (!hasControleQualitePermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de valider des fiches qualité'
      });
    }
    const fiche = await queryOne('SELECT id_etat_final, id_qualite, id_sous_etat, date_rdv_time FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    const canModifyKo = await canQualiteModifierFiche(fiche, req.user.id, req.user.fonction);
    if (!canModifyKo) {
      return res.status(403).json({
        success: false,
        message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
      });
    }
    
    // Vérifier que le sous-état existe et appartient à l'état KO (id 54)
    const sousEtat = await queryOne('SELECT id, titre, id_etat FROM sous_etat WHERE id = ?', [id_sous_etat]);
    if (!sousEtat) {
      return res.status(400).json({
        success: false,
        message: 'Sous-état non trouvé'
      });
    }
    if (sousEtat.id_etat !== 54) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-état sélectionné n\'appartient pas à l\'état KO'
      });
    }
    
    const etatEnAttente = await queryOne(
      'SELECT id, titre FROM etats WHERE id = 1 OR (titre = ? OR titre = ? OR titre = ?) LIMIT 1',
      ['EN-ATTENTE', 'En-Attente', 'EN ATTENTE']
    );
    if (!etatEnAttente) {
      return res.status(400).json({
        success: false,
        message: 'L\'état "En-Attente" n\'a pas été trouvé dans la base de données'
      });
    }
    const oldEtatId = fiche.id_etat_final;
    const oldSousEtatId = fiche.id_sous_etat;
    const newEtatId = etatEnAttente.id;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const isQualiteUser = req.user.fonction === 2 || req.user.fonction === 8 || req.user.fonction === 12;
    if (isQualiteUser) {
      await query('UPDATE fiches SET id_qualite = ? WHERE id = ?', [req.user.id, id]);
    }
    
    // Mettre à jour la fiche avec l'état, le sous-état KO et le commentaire
    await query(
      'UPDATE fiches SET id_etat_final = ?, id_sous_etat = ?, ko = 1, commentaire_qualite = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, id_sous_etat, commentaire_ko || null, now, now, id]
    );
    
    if (parseEtatId(oldEtatId) !== parseEtatId(newEtatId)) {
      const histoConf = getHistoConfirmateur(req, fiche);
      const dateRdvHistoKo = fiche.date_rdv_time || null;
      await query(
        'INSERT INTO fiches_histo (id_fiche, id_etat, id_confirmateur, id_sous_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?, ?, ?)',
        [id, newEtatId, histoConf, id_sous_etat, dateRdvHistoKo, now]
      );
      await logModification(
        id,
        req.user.id,
        req.user.pseudo || 'Utilisateur',
        'id_etat_final',
        oldEtatId,
        newEtatId
      );
    }
    
    // Logger les modifications
    await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'ko', null, 1);
    if (oldSousEtatId !== id_sous_etat) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'id_sous_etat', oldSousEtatId, id_sous_etat);
    }
    if (commentaire_ko) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'commentaire_qualite', null, commentaire_ko);
    }

    // Enregistrer l'audit dans controle_qualite
    const ficheInfosKo = await queryOne('SELECT id_agent, id_centre, date_insert_time FROM fiches WHERE id = ?', [id]);
    if (ficheInfosKo) {
      await insertControleQualiteAudit({
        id_fiche: id,
        id_qualite: req.user.id,
        id_etat: newEtatId,
        id_sous_etat: id_sous_etat,
        commentaire: commentaire_ko || null,
        ko: 1,
        hc: 0,
        id_etat_precedent: oldEtatId,
        id_sous_etat_precedent: oldSousEtatId ?? null,
        id_agent_fiche: ficheInfosKo.id_agent ?? null,
        id_centre: ficheInfosKo.id_centre ?? null,
        date_audit: now,
        date_fiche: ficheInfosKo.date_insert_time ?? null
      });
    }
    
    res.json({
      success: true,
      message: 'Fiche validée (KO) : En-Attente, non comptabilisée pour l\'agent',
      data: {
        id,
        id_etat_final: newEtatId,
        id_sous_etat: id_sous_etat,
        sous_etat_titre: sousEtat.titre,
        ko: 1,
        old_etat: oldEtatId,
        etat_titre: etatEnAttente.titre,
        commentaire_ko: commentaire_ko || null
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation qualité KO:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation qualité KO',
      error: error.message
    });
  }
});

// Valider une fiche qualité en HC : état HC (id 55) + sous-état sélectionné (fiche hors cible)
router.put('/:hash/valider-qualite-hc', authenticate, hashToIdMiddleware, triggerWorkflowOnEtatChanged, async (req, res) => {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant de fiche invalide ou manquant'
      });
    }
    
    // Récupérer le sous-état et le commentaire depuis le body
    const { id_sous_etat, commentaire_hc } = req.body;
    
    // Vérifier que le sous-état est fourni
    if (!id_sous_etat) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-état HC est obligatoire'
      });
    }
    
    const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
    if (!hasControleQualitePermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de valider des fiches qualité'
      });
    }
    const fiche = await queryOne('SELECT id_etat_final, id_qualite, id_sous_etat, date_rdv_time FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    const canModifyHc = await canQualiteModifierFiche(fiche, req.user.id, req.user.fonction);
    if (!canModifyHc) {
      return res.status(403).json({
        success: false,
        message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
      });
    }
    
    // Vérifier que le sous-état existe et appartient à l'état HC (id 55)
    const sousEtat = await queryOne('SELECT id, titre, id_etat FROM sous_etat WHERE id = ?', [id_sous_etat]);
    if (!sousEtat) {
      return res.status(400).json({
        success: false,
        message: 'Sous-état non trouvé'
      });
    }
    if (sousEtat.id_etat !== 55) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-état sélectionné n\'appartient pas à l\'état HC'
      });
    }
    
    const ID_ETAT_HC = 55;
    const oldEtatId = fiche.id_etat_final;
    const oldSousEtatId = fiche.id_sous_etat;
    const newEtatId = ID_ETAT_HC;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const isQualiteUser = req.user.fonction === 2 || req.user.fonction === 8 || req.user.fonction === 12;
    if (isQualiteUser) {
      await query('UPDATE fiches SET id_qualite = ? WHERE id = ?', [req.user.id, id]);
    }
    
    // Mettre à jour la fiche avec l'état, le sous-état HC et le commentaire
    await query(
      'UPDATE fiches SET id_etat_final = ?, id_sous_etat = ?, hc = 1, commentaire_qualite = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, id_sous_etat, commentaire_hc || null, now, now, id]
    );
    
    if (parseEtatId(oldEtatId) !== parseEtatId(newEtatId)) {
      const histoConf = getHistoConfirmateur(req, fiche);
      const dateRdvHistoHc = fiche.date_rdv_time || null;
      await query(
        'INSERT INTO fiches_histo (id_fiche, id_etat, id_confirmateur, id_sous_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?, ?, ?)',
        [id, newEtatId, histoConf, id_sous_etat, dateRdvHistoHc, now]
      );
      await logModification(
        id,
        req.user.id,
        req.user.pseudo || 'Utilisateur',
        'id_etat_final',
        oldEtatId,
        newEtatId
      );
    }
    
    // Logger les modifications
    await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'hc', null, 1);
    if (oldSousEtatId !== id_sous_etat) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'id_sous_etat', oldSousEtatId, id_sous_etat);
    }
    if (commentaire_hc) {
      await logModification(id, req.user.id, req.user.pseudo || 'Utilisateur', 'commentaire_qualite', null, commentaire_hc);
    }

    // Enregistrer l'audit dans controle_qualite
    const ficheInfosHc = await queryOne('SELECT id_agent, id_centre, date_insert_time FROM fiches WHERE id = ?', [id]);
    if (ficheInfosHc) {
      await insertControleQualiteAudit({
        id_fiche: id,
        id_qualite: req.user.id,
        id_etat: newEtatId,
        id_sous_etat: id_sous_etat,
        commentaire: commentaire_hc || null,
        ko: 0,
        hc: 1,
        id_etat_precedent: oldEtatId,
        id_sous_etat_precedent: oldSousEtatId ?? null,
        id_agent_fiche: ficheInfosHc.id_agent ?? null,
        id_centre: ficheInfosHc.id_centre ?? null,
        date_audit: now,
        date_fiche: ficheInfosHc.date_insert_time ?? null
      });
    }
    
    res.json({
      success: true,
      message: 'Fiche validée (HC) : état HC, hors cible',
      data: {
        id,
        id_etat_final: newEtatId,
        id_sous_etat: id_sous_etat,
        sous_etat_titre: sousEtat.titre,
        hc: 1,
        old_etat: oldEtatId,
        etat_titre: 'HC',
        commentaire_hc: commentaire_hc || null
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation qualité HC:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation qualité HC',
      error: error.message
    });
  }
});

// Nombre d'alertes KO pour une fiche + par type (PERSO/TECHNIQUE) pour l'agent du mois (3 de chaque type autorisés/mois)
router.get('/:hash/alertes-ko', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Identifiant de fiche invalide' });
    }
    const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
    if (!hasControleQualitePermission) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }
    const row = await queryOne('SELECT COUNT(*) AS nb_alertes FROM alert_ko WHERE id_fiche = ?', [id]);
    const nb_alertes = row?.nb_alertes ?? 0;
    let nb_alertes_perso_agent_mois = 0;
    let nb_alertes_technique_agent_mois = 0;
    try {
      const fiche = await queryOne('SELECT id_agent FROM fiches WHERE id = ?', [id]);
      if (fiche?.id_agent) {
        const base = `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent = ? AND date_alerte >= DATE_FORMAT(NOW(), '%Y-%m-01')`;
        const rowPerso = await queryOne(`${base} AND type_alerte = 'PERSO'`, [fiche.id_agent]);
        const rowTech = await queryOne(`${base} AND type_alerte = 'TECHNIQUE'`, [fiche.id_agent]);
        nb_alertes_perso_agent_mois = rowPerso?.nb ?? 0;
        nb_alertes_technique_agent_mois = rowTech?.nb ?? 0;
      }
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
    res.json({
      success: true,
      nb_alertes,
      nb_alertes_perso_agent_mois,
      nb_alertes_technique_agent_mois
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        nb_alertes: 0,
        nb_alertes_perso_agent_mois: 0,
        nb_alertes_technique_agent_mois: 0
      });
    }
    console.error('Erreur GET alertes-ko:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Envoyer une alerte KO à l'agent qualification (fonction 3) qui a inséré la fiche.
// type_alerte : PERSO ou TECHNIQUE, + commentaire. La fiche n'est pas modifiée.
router.post('/:hash/alerte-ko', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const id = req.params.id ? parseInt(req.params.id, 10) : null;
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Identifiant de fiche invalide' });
    }
    const hasControleQualitePermission = await hasPermission(req.user.fonction, 'controle_qualite_view');
    if (!hasControleQualitePermission) {
      return res.status(403).json({ success: false, message: 'Vous n\'avez pas la permission d\'envoyer des alertes' });
    }
    const fiche = await queryOne(
      'SELECT id_agent, id_qualite, id_etat_final, nom, prenom, tel FROM fiches WHERE id = ?',
      [id]
    );
    if (!fiche) {
      return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
    }
    const canModifyAlerte = await canQualiteModifierFiche(fiche, req.user.id, req.user.fonction);
    if (!canModifyAlerte) {
      return res.status(403).json({
        success: false,
        message: 'Cette fiche est verrouillée et ne peut pas être modifiée.'
      });
    }
    if (!fiche.id_agent) {
      return res.status(400).json({ success: false, message: 'Cette fiche n\'a pas d\'agent assigné' });
    }
    const { type_alerte, commentaire } = req.body;
    const typeAlerte = (type_alerte === 'TECHNIQUE' || type_alerte === 'PERSO') ? type_alerte : 'PERSO';
    let nb_alertes = 0;
    let nb_alertes_ce_type_agent_mois = 0;
    try {
      const countRow = await queryOne('SELECT COUNT(*) AS nb FROM alert_ko WHERE id_fiche = ?', [id]);
      nb_alertes = countRow?.nb ?? 0;
      // Limite : 3 PERSO et 3 TECHNIQUE par agent par mois
      const agentRow = await queryOne(
        `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent = ? AND date_alerte >= DATE_FORMAT(NOW(), '%Y-%m-01') AND type_alerte = ?`,
        [fiche.id_agent, typeAlerte]
      );
      nb_alertes_ce_type_agent_mois = agentRow?.nb ?? 0;
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      if (e.code === 'ER_BAD_FIELD_ERROR' && e.message && e.message.includes('type_alerte')) {
        const agentRow = await queryOne(
          `SELECT COUNT(*) AS nb FROM alert_ko WHERE id_agent = ? AND date_alerte >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
          [fiche.id_agent]
        );
        nb_alertes_ce_type_agent_mois = agentRow?.nb ?? 0;
      } else {
        throw e;
      }
    }
    if (nb_alertes_ce_type_agent_mois >= 3) {
      return res.status(400).json({
        success: false,
        message: `Cet agent a déjà reçu 3 alertes de type ${typeAlerte} ce mois-ci. Limite mensuelle atteinte (3 PERSO et 3 TECHNIQUE par agent).`
      });
    }
    if (nb_alertes >= 3) {
      return res.status(400).json({
        success: false,
        message: '3 alertes ont déjà été envoyées pour cette fiche. Passage au KO possible.'
      });
    }
    const num_alerte = nb_alertes + 1;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    try {
      await query(
        `INSERT INTO alert_ko (id_fiche, id_agent, id_qualite, type_alerte, num_alerte, date_alerte, nom, prenom, tel, commentaire)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          fiche.id_agent,
          req.user.id,
          typeAlerte,
          num_alerte,
          now,
          fiche.nom ?? null,
          fiche.prenom ?? null,
          fiche.tel ?? null,
          commentaire || null
        ]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
          success: false,
          message: 'Table alert_ko non créée. Exécutez le script create_table_alert_ko.sql.'
        });
      }
      if (insertErr.code === 'ER_BAD_FIELD_ERROR' && insertErr.message && insertErr.message.includes('type_alerte')) {
        return res.status(503).json({
          success: false,
          message: 'Colonne type_alerte manquante. Exécutez le script alter_alert_ko_add_type_alerte.sql.'
        });
      }
      throw insertErr;
    }
    const newTotal = num_alerte;
    res.json({
      success: true,
      message: `Alerte ${num_alerte}/3 envoyée à l'agent`,
      data: { num_alerte, nb_alertes_total: newTotal }
    });
  } catch (error) {
    console.error('Erreur POST alerte-ko:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'envoi de l\'alerte'
    });
  }
});

// Mettre à jour une fiche
router.put('/:id', authenticate, hashToIdMiddleware, checkPermissionCode('fiches_edit'), triggerWorkflowOnFicheUpdated, async (req, res) => {
  try {
    const { id } = req.params;
    const ficheData = req.body;

    if (Object.prototype.hasOwnProperty.call(ficheData, 'entretien_avec')) {
      if (ficheData.entretien == null || ficheData.entretien === '') {
        ficheData.entretien = ficheData.entretien_avec;
      }
      delete ficheData.entretien_avec;
    }

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    // Vérifier les permissions selon la fonction
    if (req.user.fonction === 3) {
      // Agents : seulement leurs fiches du même centre
      if (fiche.id_centre !== req.user.centre) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
    } else if (req.user.fonction === 5) {
      // Commerciaux : seulement leurs fiches
      if (fiche.id_commercial !== req.user.id && fiche.id_commercial_2 !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette fiche'
        });
      }
      
      // Les commerciaux doivent créer un compte rendu au lieu de modifier directement
      // Vérifier qu'il n'y a pas déjà un compte rendu en attente
      const pendingCompteRendu = await queryOne(
        'SELECT id FROM compte_rendu_pending WHERE id_fiche = ? AND id_commercial = ? AND statut = ?',
        [id, req.user.id, 'pending']
      );

      if (pendingCompteRendu) {
        return res.status(400).json({
          success: false,
          message: 'Un compte rendu est déjà en attente pour cette fiche. Veuillez attendre l\'approbation de l\'administrateur.'
        });
      }

      // Préparer les modifications
      const modifications = {};
    const allowedFields = [
      'nom', 'prenom', 'civ', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville',
      'situation_conjugale', 'entretien', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
        'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage', 'complement_chauffage',
        'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
        'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
        'date_rdv_time', 'date_appel_time', 'id_centre', 'id_commercial',
        'id_commercial_2', 'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'motif_qualif', 'type_contrat_mr', 'type_contrat_madame',
        'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
        'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
        'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
        'conf_consommation_electricite', 'conf_rdv_avec',
        'conf_appel_tunisie_avec', 'conf_deja_etude', 'conf_revenu', 'conf_credit',
        'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
        'conf_type_contrat_mr', 'conf_type_contrat_madame'
      ];

      // Extraire id_etat_final et id_sous_etat séparément car ils ne vont pas dans modifications
      const id_etat_final = ficheData.id_etat_final;
      const id_sous_etat = ficheData.id_sous_etat;

      // Extraire les informations de vente (Phase 3) séparément
      const ph3Data = {};
      const ph3Fields = [
        'ph3_installateur', 'ph3_pac', 'ph3_puissance', 'ph3_puissance_pv', 'ph3_rr_model',
        'ph3_ballon', 'ph3_marque_ballon', 'ph3_alimentation', 'ph3_type', 'ph3_prix',
        'ph3_bonus_30', 'ph3_mensualite', 'ph3_attente', 'nbr_annee_finance',
        'credit_immobilier', 'credit_autre'
      ];

      for (const field of ph3Fields) {
        if (ficheData[field] !== undefined) {
          ph3Data[field] = ficheData[field];
        }
      }

      // Extraire conf_commentaire_produit séparément car il va dans le champ commentaire du compte rendu
      const confCommentaireProduit = ficheData.conf_commentaire_produit;
      // Extraire le commentaire commercial (compte rendu) depuis conf_commentaire_produit ou commentaire_compte_rendu
      const commentaireCompteRendu = ficheData.commentaire_compte_rendu || confCommentaireProduit || null;
      
      for (const [key, value] of Object.entries(ficheData)) {
        // Ne pas inclure conf_commentaire_produit dans modifications car il va dans commentaire
        if (allowedFields.includes(key) && value !== undefined && value !== fiche[key] && key !== 'conf_commentaire_produit') {
          modifications[key] = value;
        }
      }

      // Si on a un commentaire compte rendu ou des modifications ou un changement d'état ou des données Phase 3, on peut créer un compte rendu
      if (Object.keys(modifications).length === 0 && !commentaireCompteRendu && !id_etat_final && Object.keys(ph3Data).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucune modification ou compte rendu détecté'
        });
      }

      // Créer un compte rendu au lieu de modifier directement
      
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const compteRenduResult = await query(
        `INSERT INTO compte_rendu_pending 
         (id_fiche, id_commercial, statut, id_etat_final, id_sous_etat, modifications, commentaire, 
          ph3_installateur, ph3_pac, ph3_puissance, ph3_puissance_pv, ph3_rr_model, ph3_ballon, 
          ph3_marque_ballon, ph3_alimentation, ph3_type, ph3_prix, ph3_bonus_30, ph3_mensualite, 
          ph3_attente, nbr_annee_finance, credit_immobilier, credit_autre, date_creation) 
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, 
          req.user.id, 
          id_etat_final || null,
          id_sous_etat || null,
          JSON.stringify(modifications), 
          commentaireCompteRendu,
          ph3Data.ph3_installateur || null,
          ph3Data.ph3_pac || null,
          ph3Data.ph3_puissance || null,
          ph3Data.ph3_puissance_pv || null,
          ph3Data.ph3_rr_model || null,
          ph3Data.ph3_ballon || null,
          ph3Data.ph3_marque_ballon || null,
          ph3Data.ph3_alimentation || null,
          ph3Data.ph3_type || null,
          ph3Data.ph3_prix || null,
          ph3Data.ph3_bonus_30 || null,
          ph3Data.ph3_mensualite || null,
          ph3Data.ph3_attente || null,
          ph3Data.nbr_annee_finance || null,
          ph3Data.credit_immobilier || null,
          ph3Data.credit_autre || null,
          now
        ]
      );

      logUserActivityEvent(req.user.id, 'fiche_compte_rendu_soumis', {
        id_fiche: Number(id),
        id_compte_rendu: compteRenduResult.insertId
      });

      return res.json({
        success: true,
        message: 'Compte rendu créé avec succès, en attente d\'approbation de l\'administrateur',
        data: {
          id_compte_rendu: compteRenduResult.insertId,
          modifications: modifications,
          id_etat_final: id_etat_final,
          id_sous_etat: id_sous_etat,
          ph3_data: ph3Data
        }
      });
    } else if (req.user.fonction === 6 || req.user.fonction === 14 || req.user.fonction === 13 || req.user.fonction === 11) {
      // Confirmateurs (6), RE Confirmation (14), RP Confirmation (13), Backoffice (11) : peuvent modifier toutes les fiches (y compris changer l'état même si déjà confirmé)
      // Pas de vérification d'assignation nécessaire
      //
      // Pour confirmateur (6) uniquement : ne peut pas assigner un autre confirmateur, uniquement s'ajouter lui-même.
      // Source de vérité = fiches_histo (id_etat=7) pour ne pas écraser l'ancien confirmateur.
      if (req.user.fonction === 6 && ficheData && (ficheData.id_confirmateur !== undefined || ficheData.id_confirmateur_2 !== undefined || ficheData.id_confirmateur_3 !== undefined)) {
        const uid = Number(req.user.id);
        let current = [
          fiche.id_confirmateur ? Number(fiche.id_confirmateur) : null,
          fiche.id_confirmateur_2 ? Number(fiche.id_confirmateur_2) : null,
          fiche.id_confirmateur_3 ? Number(fiche.id_confirmateur_3) : null
        ];
        try {
          const histoConfRows = await query(
            `SELECT id_confirmateur FROM fiches_histo WHERE id_fiche = ? AND id_etat = 7 ORDER BY id ASC`,
            [id]
          );
          const seen = new Set();
          const fromHisto = [];
          for (const row of histoConfRows || []) {
            const cid = row.id_confirmateur ? Number(row.id_confirmateur) : null;
            if (cid && cid > 0 && !seen.has(cid) && fromHisto.length < 3) {
              seen.add(cid);
              fromHisto.push(cid);
            }
          }
          if (fromHisto.length > 0) {
            current = [fromHisto[0] || null, fromHisto[1] || null, fromHisto[2] || null];
          } else {
            // Pas d'historique confirmation pour cette fiche => première confirmation, confirmateur connecté = confirmateur 1
            current = [null, null, null];
          }
        } catch (e) {
          console.log('confirmateurs_from_histo (PUT):', e.message);
        }

        const already = current.includes(uid);
        if (!already) {
          const requested = [
            ficheData.id_confirmateur != null ? Number(ficheData.id_confirmateur) : null,
            ficheData.id_confirmateur_2 != null ? Number(ficheData.id_confirmateur_2) : null,
            ficheData.id_confirmateur_3 != null ? Number(ficheData.id_confirmateur_3) : null
          ];
          const wantsSelf = requested.includes(uid);
          if (wantsSelf) {
            // Confirmateur connecté = toujours confirmateur 1 ; anciens décalés : ancien conf1 → conf2, ancien conf2 → conf3
            ficheData.id_confirmateur = uid;
            ficheData.id_confirmateur_2 = current[0] || null;
            ficheData.id_confirmateur_3 = current[1] || null;
          } else {
            ficheData.id_confirmateur = current[0] ?? fiche.id_confirmateur;
            ficheData.id_confirmateur_2 = current[1] ?? fiche.id_confirmateur_2;
            ficheData.id_confirmateur_3 = current[2] ?? fiche.id_confirmateur_3;
          }
        } else {
          ficheData.id_confirmateur = current[0] ?? fiche.id_confirmateur;
          ficheData.id_confirmateur_2 = current[1] ?? fiche.id_confirmateur_2;
          ficheData.id_confirmateur_3 = current[2] ?? fiche.id_confirmateur_3;
        }
      }
    }

    // Changement d'état: stocker le commentaire métier dans motif_qualif côté fiches
    // (rétrocompat: certains écrans envoient encore conf_commentaire_produit).
    const hasEtatChange = parseEtatId(ficheData?.id_etat_final) !== parseEtatId(fiche?.id_etat_final);
    if (
      hasEtatChange &&
      !Object.prototype.hasOwnProperty.call(ficheData, 'motif_qualif') &&
      Object.prototype.hasOwnProperty.call(ficheData, 'conf_commentaire_produit')
    ) {
      ficheData.motif_qualif = ficheData.conf_commentaire_produit;
    }

    // Mettre à jour la date de modification
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    ficheData.date_modif_time = now;

    // Vérifier si un RDV est créé/modifié et si le créneau est fermé
    if (ficheData.date_rdv_time !== undefined && ficheData.date_rdv_time !== null && ficheData.date_rdv_time !== '') {
      try {
        // Extraire la date et l'heure du RDV
        const rdvDateTime = new Date(ficheData.date_rdv_time);
        const rdvDate = rdvDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
        const rdvTime = rdvDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
        
        // Déterminer le créneau horaire
        const hourToSlot = (hour) => {
          const [h, m] = hour.split(':').map(Number);
          const totalMinutes = h * 60 + m;
          
          if (totalMinutes >= 540 && totalMinutes < 660) return '09:00:00'; // 9h-10h59
          if (totalMinutes >= 660 && totalMinutes < 780) return '11:00:00'; // 11h-12h59
          if (totalMinutes >= 780 && totalMinutes < 960) return '13:00:00'; // 13h-15h59
          if (totalMinutes >= 960 && totalMinutes < 1080) return '16:00:00'; // 16h-17h59
          if (totalMinutes >= 1080 && totalMinutes < 1170) return '18:00:00'; // 18h-19h29
          if (totalMinutes >= 1170 && totalMinutes <= 1200) return '19:30:00'; // 19h30-20h
          return null;
        };
        
        const slotHour = hourToSlot(rdvTime);
        if (slotHour) {
          // Calculer la semaine ISO
          const getWeekNumber = (date) => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          };
          
          const week = getWeekNumber(rdvDateTime);
          const year = rdvDateTime.getFullYear();
          
          // Extraire le département depuis le code postal (2 premiers chiffres)
          const cp = fiche.cp || ficheData.cp || '';
          const dep = cp.substring(0, 2) || '01';
          
          // Vérifier si le créneau est fermé
          const closedSlot = await queryOne(
            `SELECT id FROM planning_availablity 
             WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ? AND is_closed = 1`,
            [week, year, dep, rdvDate, slotHour]
          );
          
          if (closedSlot) {
            return res.status(400).json({
              success: false,
              message: 'Ce créneau horaire est fermé. Impossible de créer un RDV dans ce créneau.'
            });
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du créneau fermé:', error);
        // Ne pas bloquer la mise à jour en cas d'erreur de vérification
      }
    }

    // Normaliser le code postal (tous les codes postaux doivent être 5 chiffres)
    // Les codes postaux de 4 chiffres sont complétés avec un 0 devant
    if (ficheData.cp !== undefined && ficheData.cp !== null && ficheData.cp !== '') {
      const cpStr = String(ficheData.cp).trim();
      // Supprimer tous les caractères non numériques
      const cpDigits = cpStr.replace(/\D/g, '');
      
      if (cpDigits.length === 0) {
        // Si pas de chiffres, considérer comme vide
        ficheData.cp = null;
      } else if (cpDigits.length === 4) {
        // Si exactement 4 chiffres, ajouter un 0 devant pour obtenir 5 chiffres
        ficheData.cp = '0' + cpDigits;
      } else if (cpDigits.length === 5) {
        // Si exactement 5 chiffres, accepter tel quel
        ficheData.cp = cpDigits;
      } else {
        // Si moins de 4 chiffres ou plus de 5 chiffres, rejeter
        return res.status(400).json({
          success: false,
          message: `Code postal invalide : "${cpStr}" (doit contenir 4 ou 5 chiffres. Les codes de 4 chiffres seront complétés avec un 0 devant)`
        });
      }
    }

    // Gérer le changement d'état + historique fiches_histo (changement réel ou même état avec infos mises à jour)
    if (shouldInsertFichesHistoPut(ficheData, fiche)) {
      const oldEtatId = parseEtatId(fiche.id_etat_final);
      const newEtatId = parseEtatId(ficheData.id_etat_final);

      // Mettre à jour automatiquement date_appel_time lors d'un enregistrement lié à l'état
      ficheData.date_appel_time = now;

      // Si on passe de l'état CONFIRMER (7) à un état du groupe 2, supprimer la date du RDV
      if (oldEtatId === 7 && newEtatId !== 7) {
        const newEtat = await queryOne(
          'SELECT groupe FROM etats WHERE id = ?',
          [newEtatId]
        );

        if (newEtat && (newEtat.groupe === 2 || newEtat.groupe === '2')) {
          ficheData.date_rdv_time = null;
          console.log(`Date RDV sera supprimée pour la fiche ${id} : passage de l'état CONFIRMER (7) à l'état ${newEtatId} (groupe 2)`);
        }
      }

      // Créer une entrée dans l'historique (id_confirmateur, id_sous_etat) + champs conf_* si état 7 + champs utiles pour les autres états
      const histoConf = getHistoConfirmateur(req, fiche);
      const histoSousEtat = Object.prototype.hasOwnProperty.call(ficheData, 'id_sous_etat')
        ? ficheData.id_sous_etat
        : (fiche && fiche.id_sous_etat != null ? fiche.id_sous_etat : null);
      const dateRdvHisto = Object.prototype.hasOwnProperty.call(ficheData, 'date_rdv_time')
        ? (ficheData.date_rdv_time === '' ? null : ficheData.date_rdv_time)
        : (fiche.date_rdv_time || null);
      const isEtat7 = newEtatId === 7;
      const { cols: confCols, vals: confVals } = isEtat7 ? getConfFieldsForHisto(ficheData, fiche) : { cols: [], vals: [] };
      const histoCols = ['id_fiche', 'id_etat', 'id_confirmateur', 'id_sous_etat', 'date_rdv_time', 'date_creation', ...confCols];
      const histoValues = [id, newEtatId, histoConf, histoSousEtat, dateRdvHisto, now, ...confVals];

      const pushHistoCol = (col, val) => {
        if (histoCols.includes(col)) return;
        histoCols.push(col);
        histoValues.push(val);
      };

      if (!isEtat7) {
        // Historique: enregistrer le commentaire dans conf_commentaire_produit.
        // Priorité à conf_commentaire_produit, sinon fallback motif_qualif.
        const hasConfComment = Object.prototype.hasOwnProperty.call(ficheData, 'conf_commentaire_produit');
        const hasMotifQualif = Object.prototype.hasOwnProperty.call(ficheData, 'motif_qualif');
        if (hasConfComment || hasMotifQualif) {
          const histoComment = hasConfComment ? ficheData.conf_commentaire_produit : ficheData.motif_qualif;
          pushHistoCol('conf_commentaire_produit', histoComment === '' ? null : histoComment);
        }
      }
      if (Object.prototype.hasOwnProperty.call(ficheData, 'conf_rdv_avec')) {
        pushHistoCol('conf_rdv_avec', ficheData.conf_rdv_avec === '' ? null : ficheData.conf_rdv_avec);
      }
      if (Object.prototype.hasOwnProperty.call(ficheData, 'date_sign_time')) {
        pushHistoCol('date_sign_time', ficheData.date_sign_time === '' ? null : ficheData.date_sign_time);
      }
      if (Object.prototype.hasOwnProperty.call(ficheData, 'id_commercial')) {
        const ic = ficheData.id_commercial;
        const n = ic === '' || ic === undefined || ic === null ? NaN : parseInt(ic, 10);
        pushHistoCol('id_commercial', Number.isFinite(n) ? n : null);
      }
      {
        const complementSnap = Object.prototype.hasOwnProperty.call(ficheData, 'complement_chauffage')
          ? (ficheData.complement_chauffage === '' || ficheData.complement_chauffage === null ? null : ficheData.complement_chauffage)
          : (fiche.complement_chauffage ?? null);
        pushHistoCol('complement_chauffage', complementSnap);
      }

      const histoPlaceholders = histoCols.map(() => '?').join(', ');
      await query(
        `INSERT INTO fiches_histo (${histoCols.join(', ')}) VALUES (${histoPlaceholders})`,
        histoValues
      );
    }

    // Calculer la consommation si surface_chauffee ou consommation_chauffage change
    if (ficheData.surface_chauffee || ficheData.consommation_chauffage) {
      const surface = ficheData.surface_chauffee || fiche.surface_chauffee;
      const conso = ficheData.consommation_chauffage || fiche.consommation_chauffage;
      if (surface && conso && parseFloat(surface) > 0) {
        ficheData.conso = (parseFloat(conso) / parseFloat(surface)).toFixed(2);
      }
    }

    // Construire la requête de mise à jour
    const fields = [];
    const values = [];

    // Liste des champs autorisés pour éviter les injections SQL
    const allowedFields = [
      'nom', 'prenom', 'civ', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville',
      'situation_conjugale', 'entretien', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage', 'complement_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'date_rdv_time', 'date_appel_time', 'date_modif_time', 'id_centre', 'id_agent', 'id_commercial', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_commercial_2', 'id_etat_final', 'id_sous_etat',
      'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'motif_qualif', 'type_contrat_mr', 'type_contrat_madame',
      // Champs de confirmation
      'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
      'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
      'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec',
      'conf_appel_tunisie_avec', 'conf_deja_etude', 'conf_revenu', 'conf_credit',
      'conf_mode_chauffage', 'conf_complement_chauffage', 'conf_consommation_chauffage', 'conf_rdv_annule_precedent',
      'conf_type_contrat_mr', 'conf_type_contrat_madame',
      'surface_chauffee', 'consommation_chauffage', 'mode_chauffage', 'annee_systeme_chauffage'
    ];

    for (const [key, value] of Object.entries(ficheData)) {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // Ignorer date_appel_time si envoyé manuellement - elle sera remplie automatiquement lors du changement d'état
        if (key === 'date_appel_time') {
          console.log(`date_appel_time ignorée pour la fiche ${id} : remplie automatiquement lors du changement d'état`);
          continue; // Ne pas inclure ce champ dans la mise à jour
        }
        fields.push(`\`${key}\` = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    if (fields.length > 0) {
      await query(
        `UPDATE fiches SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id]
      );

      // Enregistrer chaque modification dans modifica
      const userPseudo = req.user.pseudo || 'Utilisateur';
      for (const [key, value] of Object.entries(ficheData)) {
        if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
          // Ignorer date_appel_time - remplie automatiquement lors du changement d'état
          if (key === 'date_appel_time') {
            continue; // Ne pas logger cette modification
          }
          const oldValue = fiche[key];
          const newValue = value === '' ? null : value;
          await logModification(
            id,
            req.user.id,
            userPseudo,
            key,
            oldValue,
            newValue
          );
        }
      }
    }

    // =====================================================
    // ENREGISTREMENT DES SIGNATURES (si état final = 13)
    // =====================================================
    if (ficheData.id_etat_final === 13) {
      try {
        // Récupérer la fiche mise à jour pour avoir les confirmateurs
        const ficheUpdated = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
        
        if (ficheUpdated) {
          const ajout = {};
          
          // Distribution des points selon les confirmateurs
          if (ficheUpdated.id_confirmateur > 0) {
            ajout[ficheUpdated.id_confirmateur] = 1;
          }
          if (ficheUpdated.id_confirmateur_2 > 0) {
            ajout[ficheUpdated.id_confirmateur_2] = 0.5;
            if (ficheUpdated.id_confirmateur > 0) {
              ajout[ficheUpdated.id_confirmateur] = 0.5; // Le principal passe à 0.5
            }
          }
          if (ficheUpdated.id_confirmateur_3 > 0) {
            ajout[ficheUpdated.id_confirmateur_2] = 0.5;
            if (ficheUpdated.id_confirmateur > 0) {
              ajout[ficheUpdated.id_confirmateur] = 0.5;
            }
            ajout[ficheUpdated.id_confirmateur_3] = 0.5;
          }

          // Vérifier si une signature existe déjà pour ce numéro de téléphone
          const tel = ficheUpdated.tel || ficheUpdated.gsm1 || ficheUpdated.gsm2;
          if (tel) {
            const existingSignature = await queryOne(
              `SELECT id FROM signature WHERE tel = ? OR tel = ? OR tel = ?`,
              [ficheUpdated.tel || '', ficheUpdated.gsm1 || '', ficheUpdated.gsm2 || '']
            );

            // Si aucune signature n'existe, enregistrer les signatures
            if (!existingSignature) {
              for (const [confirmateurId, points] of Object.entries(ajout)) {
                await query(
                  `INSERT INTO signature (confirmateur, ajoute, date_heure, tel) VALUES (?, ?, ?, ?)`,
                  [confirmateurId, points, now, tel]
                );
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement des signatures:', error);
        // Ne pas bloquer la mise à jour si l'enregistrement de la signature échoue
      }
    }

    // =====================================================
    // ENREGISTREMENT COMPTE RENDU (si permission compte_rendu_write et état Phase 3)
    // Les comptes rendus sont la qualification des commerciaux avec leur commentaire
    // IMPORTANT: Le compte rendu n'est enregistré que pour les états de Phase 3 (groupe = 3)
    // Vérification de la permission compte_rendu_write
    // =====================================================
    // Vérifier si l'utilisateur a la permission de rédiger un compte rendu
    const canWriteCompteRendu = await hasPermission(req.user.fonction, 'compte_rendu_write');
    
    if (canWriteCompteRendu) {
      try {
        // Vérifier si l'état final appartient à la Phase 3 (groupe = 3)
        const etatFiche = ficheData.id_etat_final || fiche.id_etat_final;
        if (etatFiche) {
          // Récupérer le groupe de l'état
          const etatInfo = await queryOne('SELECT groupe FROM etats WHERE id = ?', [etatFiche]);
          
          // Ne créer le compte rendu que si l'état appartient à la Phase 3 (groupe = 3)
          if (!etatInfo || (etatInfo.groupe !== '3' && etatInfo.groupe !== 3)) {
            console.log(`Compte rendu non enregistré : l'état ${etatFiche} n'appartient pas à la Phase 3 (groupe: ${etatInfo?.groupe || 'inconnu'})`);
            // Ne pas bloquer la mise à jour, juste ne pas créer de compte rendu
          } else {
            // Récupérer la qualification (id_qualif) de la fiche
            const qualificationId = ficheData.id_qualif || fiche.id_qualif || null;
            let qualificationCode = null;
            
            // Si une qualification existe, récupérer son code
            if (qualificationId) {
              try {
                // Vérifier si la table qualif existe
                const qualifTableExists = await queryOne(
                  `SELECT COUNT(*) as count 
                   FROM information_schema.tables 
                   WHERE table_schema = DATABASE() 
                   AND table_name = 'qualif'`
                );
                
                if (qualifTableExists && qualifTableExists.count > 0) {
                  // Si la table existe, récupérer le code depuis la table
                  const qualif = await queryOne('SELECT code FROM qualif WHERE id = ?', [qualificationId]);
                  if (qualif) {
                    qualificationCode = qualif.code;
                  }
                } else {
                  // Si la table n'existe pas, id_qualif peut contenir directement le code (ex: 'RDV_URGENT')
                  if (typeof qualificationId === 'string') {
                    qualificationCode = qualificationId;
                  }
                }
              } catch (e) {
                console.log('Erreur lors de la récupération de la qualification:', e.message);
                // Si id_qualif est une string (code direct), l'utiliser
                if (typeof qualificationId === 'string') {
                  qualificationCode = qualificationId;
                }
              }
            }
            
            // Construire le compte rendu avec la qualification et le commentaire
            const commentaire = ficheData.conf_commentaire_produit || '';
            let compteRendu = '';
            
            if (qualificationCode) {
              // Inclure la qualification dans le compte rendu
              compteRendu = `[${qualificationCode}] ${commentaire}`.trim();
            } else {
              compteRendu = commentaire;
            }
            let dateVisite = now;

            // Déterminer la date de visite selon les champs disponibles
            if (ficheData.conf_rdv_date && ficheData.conf_rdv_time) {
              dateVisite = `${ficheData.conf_rdv_date} ${ficheData.conf_rdv_time}:00`;
            } else if (ficheData.date_appel_date && ficheData.date_appel_date_time) {
              dateVisite = `${ficheData.date_appel_date} ${ficheData.date_appel_date_time}:00`;
            } else if (ficheData.date_sign_time_date && ficheData.date_sign_time_time) {
              dateVisite = `${ficheData.date_sign_time_date} ${ficheData.date_sign_time_time}:00`;
            }

            const sousEtat = ficheData.id_sous_etat || 0;
            const rappel = (ficheData.conf_rdv_date && ficheData.conf_rdv_time) 
              ? `${ficheData.conf_rdv_date} ${ficheData.conf_rdv_time}:00` 
              : now;

            // Déterminer le commercial pour le compte rendu
            // Si l'utilisateur est un commercial (fonction 5), utiliser son ID
            // Sinon, utiliser le commercial de la fiche
            let idCommercialCR = req.user.fonction === 5 ? req.user.id : (fiche.id_commercial || req.user.id);
            
            // Si un commercial est spécifié dans les données de mise à jour, l'utiliser
            if (ficheData.id_commercial && ficheData.id_commercial > 0) {
              idCommercialCR = ficheData.id_commercial;
            }

            // Vérifier si un compte rendu existe déjà pour ce commercial
            const existingCR = await queryOne(
              `SELECT id FROM compte_rendu 
               WHERE id_fiche = ? AND id_commercial = ? AND etat < 2 
               ORDER BY id DESC LIMIT 1`,
              [id, idCommercialCR]
            );

            if (existingCR) {
              // Mettre à jour
              await query(
                `UPDATE compte_rendu SET
                 date_visite = ?,
                 date_modif = ?,
                 etat = 0,
                 compte_rendu = ?,
                 etat_fiche = ?,
                 sous_etat = ?,
                 rappel = ?
                 WHERE id = ?`,
                [dateVisite, now, compteRendu, etatFiche, sousEtat, rappel, existingCR.id]
              );
            } else {
              // Créer
              await query(
                `INSERT INTO compte_rendu 
                 (id_fiche, id_commercial, date_visite, date_modif, etat, compte_rendu, etat_fiche, sous_etat, rappel)
                 VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                [id, idCommercialCR, dateVisite, now, compteRendu, etatFiche, sousEtat, rappel]
              );
            }

            // Enregistrer dans visite_name si name_visite est fourni
            if (ficheData.name_visite) {
              await query(
                `INSERT INTO visite_name (id_fiche, id_user, id_etat, name_visite, date_modif)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, req.user.id, etatFiche, ficheData.name_visite, now]
              );
            }

            // Enregistrer dans modifica (structure détectée dynamiquement : type/champ, ancien_valeur/nouvelle_valeur ou last_val/val)
            await logModification(id, req.user.id, req.user.pseudo || '', 'Compte rendu', fiche.id_etat_final || '', etatFiche || '');
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du compte rendu:', error);
        // Ne pas bloquer la mise à jour si l'enregistrement du compte rendu échoue
      }
    }

    // =====================================================
    // ENREGISTREMENT NEW/REPRO (si confirmateur assigné)
    // =====================================================
    if (ficheData.id_confirmateur && ficheData.id_confirmateur > 0) {
      try {
        // Récupérer l'état précédent depuis l'historique
        const lastHisto = await queryOne(
          `SELECT id_etat FROM fiches_histo WHERE id_fiche = ? ORDER BY id DESC LIMIT 1`,
          [id]
        );

        const etatNew = [1, 2, 19, 5, 22, 9, 26, 12, 25, 16, 38];
        let newValue = 0;
        let reproValue = 0;

        if (lastHisto) {
          const etatNr = lastHisto.id_etat;
          if (etatNr === 8) {
            reproValue = 1;
          } else if (etatNew.includes(etatNr)) {
            newValue = 1;
          }
        } else if (ficheData.id_etat_final) {
          // Si pas d'historique, utiliser l'état final actuel
          if (ficheData.id_etat_final === 8) {
            reproValue = 1;
          } else if (etatNew.includes(ficheData.id_etat_final)) {
            newValue = 1;
          }
        }

        // Enregistrer dans new_repro si new ou repro > 0
        if (newValue > 0 || reproValue > 0) {
          await query(
            `INSERT INTO new_repro (id_fiche, id_confirmateur, new, repro, date_modif) VALUES (?, ?, ?, ?, ?)`,
            [id, ficheData.id_confirmateur, newValue, reproValue, now]
          );
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement new_repro:', error);
        // Ne pas bloquer la mise à jour si l'enregistrement new_repro échoue
      }
    }

    logUserActivityEvent(req.user.id, 'fiche_mise_a_jour', { id_fiche: Number(id) });

    res.json({
      success: true,
      message: 'Fiche mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la fiche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la fiche',
      error: error.message
    });
  }
});

// Archiver/Désarchiver une fiche
router.patch('/:id/archive', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { archive } = req.body;

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    // Vérifier les permissions (Admin, Backoffice, RP Confirmation)
    if (!isAdminOrBackofficeOrRPConfirmation(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission d\'archiver des fiches'
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `UPDATE fiches SET archive = ?, date_modif_time = ? WHERE id = ?`,
      [archive ? 1 : 0, now, id]
    );

    logUserActivityEvent(req.user.id, archive ? 'fiche_archivee' : 'fiche_desarchivee', {
      id_fiche: Number(id)
    });

    res.json({
      success: true,
      message: archive ? 'Fiche archivée avec succès' : 'Fiche désarchivée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'archivage de la fiche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage de la fiche'
    });
  }
});

// Mettre une fiche en KO / Retirer le KO
router.patch('/:id/ko', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { ko } = req.body;

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT * FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    // Vérifier les permissions (Admin, Backoffice, Superviseurs, RP)
    const allowedFunctions = [1, 2, 7, 11, 12, 13];
    if (!allowedFunctions.includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de mettre des fiches en KO'
      });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `UPDATE fiches SET ko = ?, date_modif_time = ? WHERE id = ?`,
      [ko ? 1 : 0, now, id]
    );

    logUserActivityEvent(req.user.id, ko ? 'fiche_ko_active' : 'fiche_ko_retire', { id_fiche: Number(id) });

    res.json({
      success: true,
      message: ko ? 'Fiche mise en KO avec succès' : 'Fiche retirée du KO avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise en KO de la fiche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise en KO de la fiche'
    });
  }
});

// =====================================================
// SMS
// =====================================================

// Récupérer les SMS d'une fiche
router.get('/:id/sms', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const smsList = await query(
      `SELECT sms.*, user.pseudo as confirmateur_pseudo
       FROM sms
       LEFT JOIN utilisateurs user ON sms.id_confirmateur = user.id
       WHERE sms.id_fiche = ?
       ORDER BY sms.date_modif_time DESC`,
      [id]
    );
    res.json({ success: true, data: smsList });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Envoyer un SMS
router.post('/:id/sms', authenticate, hashToIdMiddleware, checkPermissionCode('fiche_sms_send'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tel, message } = req.body;
    
    // Validation des paramètres
    if (!tel || typeof tel !== 'string' || tel.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Le numéro de téléphone est requis' 
      });
    }
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Le message est requis' 
      });
    }
    
    // Utiliser l'utilisateur connecté comme confirmateur
    const confirmateurId = req.user.id;
    if (!confirmateurId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non authentifié' 
      });
    }

    // Récupérer le fournisseur SMS par défaut
    const { getDefaultSMSProvider, sendSMSViaProvider } = require('../services/sms.service');
    const provider = await getDefaultSMSProvider();

    if (!provider) {
      return res.status(500).json({
        success: false,
        message: 'Aucun fournisseur SMS configuré. Veuillez configurer un fournisseur SMS dans la gestion ou exécutez insert_fournisseur_sms_default.sql'
      });
    }

    console.log(`[SMS] Utilisation du fournisseur: ${provider.nom} (ID: ${provider.id || 'défaut'})`);

    // Récupérer les données de la fiche pour les variables Octopush et le remplacement des variables
    // La colonne s'appelle 'civ' et non 'civilite'
    const fiche = await queryOne(
      `SELECT nom, prenom, civ, date_rdv_time FROM fiches WHERE id = ?`,
      [id]
    );
    
    // Mapper civ vers civilite pour compatibilité avec le code Octopush
    if (fiche) {
      fiche.civilite = fiche.civ || null;
    }

    // Remplacer les variables dans le message si nécessaire
    let processedMessage = message.trim();
    
    console.log('[SMS Route] Message original:', processedMessage.substring(0, 100));
    console.log('[SMS Route] Fiche data:', {
      hasFiche: !!fiche,
      hasDateRdv: !!fiche?.date_rdv_time,
      dateRdvValue: fiche?.date_rdv_time,
      nom: fiche?.nom,
      prenom: fiche?.prenom
    });
    
    if (fiche) {
      // Remplacer {{prenom}}, {{nom}}, {{civ}}
      processedMessage = processedMessage
        .replace(/\{\{prenom\}\}/g, (fiche.prenom || '').toUpperCase())
        .replace(/\{\{nom\}\}/g, (fiche.nom || '').toUpperCase())
        .replace(/\{\{civ\}\}/g, fiche.civ || '');
      
      // Remplacer {{date_rdv}} et {{heure_rdv}} si date_rdv_time est disponible
      if (fiche.date_rdv_time) {
        try {
          // date_rdv_time peut être au format datetime MySQL (YYYY-MM-DD HH:MM:SS)
          // ou au format timestamp
          let dateRdv;
          if (typeof fiche.date_rdv_time === 'string') {
            // Si c'est une chaîne, essayer de la parser
            dateRdv = new Date(fiche.date_rdv_time);
          } else if (typeof fiche.date_rdv_time === 'number') {
            // Si c'est un nombre (timestamp)
            dateRdv = new Date(fiche.date_rdv_time * 1000);
          } else {
            dateRdv = new Date(fiche.date_rdv_time);
          }
          
          // Vérifier que la date est valide
          if (isNaN(dateRdv.getTime())) {
            console.error('[SMS Route] Date invalide:', fiche.date_rdv_time);
            processedMessage = processedMessage
              .replace(/\{\{date_rdv\}\}/g, '')
              .replace(/\{\{heure_rdv\}\}/g, '');
          } else {
            const dateRdvStr = dateRdv.toLocaleDateString('fr-FR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            const heureRdvStr = dateRdv.toTimeString().slice(0, 5);
            
            console.log('[SMS Route] Date RDV formatée:', { dateRdvStr, heureRdvStr });
            
            processedMessage = processedMessage
              .replace(/\{\{date_rdv\}\}/g, dateRdvStr)
              .replace(/\{\{heure_rdv\}\}/g, heureRdvStr);
          }
        } catch (error) {
          console.error('[SMS Route] Erreur lors du formatage de date_rdv_time:', error, fiche.date_rdv_time);
          // En cas d'erreur, remplacer par des chaînes vides
          processedMessage = processedMessage
            .replace(/\{\{date_rdv\}\}/g, '')
            .replace(/\{\{heure_rdv\}\}/g, '');
        }
      } else {
        console.log('[SMS Route] Pas de date_rdv_time dans la fiche');
        // Si pas de date_rdv_time, remplacer par des chaînes vides
        processedMessage = processedMessage
          .replace(/\{\{date_rdv\}\}/g, '')
          .replace(/\{\{heure_rdv\}\}/g, '');
      }
    }
    
    console.log('[SMS Route] Message après remplacement des variables:', processedMessage.substring(0, 150));
    console.log('[SMS Route] Variables restantes:', {
      hasDateRdv: /\{\{date_rdv\}\}/.test(processedMessage),
      hasHeureRdv: /\{\{heure_rdv\}\}/.test(processedMessage),
      hasPrenom: /\{\{prenom\}\}/.test(processedMessage),
      hasNom: /\{\{nom\}\}/.test(processedMessage)
    });

    // Envoyer le SMS via le fournisseur
    let smsResult;
    try {
      smsResult = await sendSMSViaProvider(provider, tel.trim(), processedMessage, 'RAPPEL', fiche || null);
    } catch (error) {
      console.error('[SMS Route] Erreur lors de l\'envoi du SMS:', error);
      return res.status(500).json({
        success: false,
        message: `Erreur lors de l'envoi du SMS: ${error.message || 'Erreur inconnue'}`,
        error: error.message,
        provider: provider.nom
      });
    }

    if (smsResult.success) {
      // Enregistrer le SMS dans la base
      const dateModif = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query(
        `INSERT INTO sms (id_fiche, id_confirmateur, tel, message, statut, date_modif_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, confirmateurId, tel, message.trim(), smsResult.message || 'successful', dateModif]
      );

      // Enregistrer dans modifica
      // Récupérer le dernier SMS avant celui qu'on vient d'insérer (pour avoir l'ancien_valeur)
      const previousSms = await queryOne(
        `SELECT message FROM sms WHERE id_fiche = ? ORDER BY id DESC LIMIT 1 OFFSET 1`,
        [id]
      );
      
      await query(
        `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, date_modif_time)
         VALUES (?, ?, 'SMS', ?, ?, ?)`,
        [id, req.user.id, previousSms?.message || '', message.trim(), dateModif]
      );

      res.json({
        success: true,
        message: 'SMS envoyé avec succès',
        data: {
          date_modif_time: dateModif,
          statut: smsResult.message || 'successful',
          provider: provider.nom
        }
      });
    } else {
      // Construire un message d'erreur détaillé
      const errorMessage = smsResult.message || smsResult.error || 'Erreur inconnue';
      const statusCode = smsResult.statusCode || 400;
      
      console.error('[SMS Route] Échec envoi SMS:', {
        provider: provider.nom,
        message: errorMessage,
        error: smsResult.error,
        errorCode: smsResult.errorCode,
        statusCode: smsResult.statusCode,
        details: smsResult.details,
        tel: tel
      });

      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 400).json({
        success: false,
        message: `Erreur lors de l'envoi du SMS: ${errorMessage}`,
        error: smsResult.error,
        errorCode: smsResult.errorCode,
        provider: provider.nom,
        details: smsResult.details
      });
    }
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// =====================================================
// MODIFICA (Historique des modifications)
// =====================================================

// Récupérer l'historique des modifications d'une fiche
router.get('/:id/modifica', authenticate, hashToIdMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Récupération des modifications pour la fiche:', id);
    
    // Vérifier d'abord si la table modifica existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'modifica'`
    );
    
    if (!tableExists || tableExists.count === 0) {
      console.log('Table modifica n\'existe pas');
      return res.json({ success: true, data: [] });
    }
    
    // Détecter la structure de la table modifica
    let columns = [];
    try {
      columns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'modifica'`
      );
    } catch (colError) {
      console.error('Erreur lors de la détection des colonnes:', colError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la détection de la structure de la table modifica',
        error: colError.message 
      });
    }
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log('Colonnes de la table modifica:', columnNames);
    
    // Déterminer quelle structure utiliser
    const hasNewStructure = columnNames.includes('type') && columnNames.includes('ancien_valeur') && columnNames.includes('nouvelle_valeur');
    const hasOldStructure = columnNames.includes('champ') && columnNames.includes('last_val') && columnNames.includes('val');
    
    let modificaList = [];
    
    try {
      if (hasNewStructure) {
        // Utiliser la nouvelle structure - lister explicitement les colonnes
        const dateCol = columnNames.includes('date_modif_time') ? 'date_modif_time' : 'date';
        // Construire la liste des colonnes explicitement (toutes les colonnes de modifica)
        // Utiliser 'm' comme alias au lieu de 'mod' car 'mod' est un mot-clé réservé (opérateur modulo)
        const modColumns = columnNames
          .map(col => `m.\`${col}\``)
          .join(', ');
        
        modificaList = await query(
          `SELECT ${modColumns}, user.pseudo as user_pseudo
           FROM modifica m
           LEFT JOIN utilisateurs user ON m.id_user = user.id
           WHERE m.id_fiche = ?
           ORDER BY m.\`${dateCol}\` DESC`,
          [id]
        );
      } else if (hasOldStructure) {
        // Utiliser l'ancienne structure avec mapping
        // Utiliser 'm' comme alias au lieu de 'mod' car 'mod' est un mot-clé réservé (opérateur modulo)
        const dateCol = columnNames.includes('date') ? 'date' : 'date_modif_time';
        modificaList = await query(
          `SELECT 
            m.id,
            m.id_fiche,
            m.id_user,
            m.champ as type,
            m.last_val as ancien_valeur,
            m.val as nouvelle_valeur,
            m.\`${dateCol}\` as date_modif_time,
            user.pseudo as user_pseudo
           FROM modifica m
           LEFT JOIN utilisateurs user ON m.id_user = user.id
           WHERE m.id_fiche = ?
           ORDER BY m.\`${dateCol}\` DESC`,
          [id]
        );
      } else {
        console.error('Structure de la table modifica non reconnue. Colonnes:', columnNames);
        return res.json({ success: true, data: [] });
      }
    } catch (queryError) {
      console.error('Erreur lors de la requête modifica:', queryError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des modifications',
        error: queryError.message,
        sqlState: queryError.sqlState,
        sqlMessage: queryError.sqlMessage
      });
    }
    
    console.log('Modifications trouvées:', modificaList.length);
    console.log('Première modification (exemple):', modificaList[0]);
    res.json({ success: true, data: modificaList });
  } catch (error) {
    console.error('Erreur lors de la récupération des modifications:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Valider/Dévalider une fiche confirmée
router.post('/:id/valider', authenticate, hashToIdMiddleware, checkPermissionCode('fiche_validate'), triggerWorkflowOnRdvValidated, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type_valid,
      conf_rdv_avec,
      conf_presence_couple,
      conf_appel_tunisie_avec,
      conf_deja_etude,
      conf_profession_monsieur,
      conf_type_contrat_mr,
      conf_profession_madame,
      conf_type_contrat_madame,
      conf_revenu,
      conf_credit,
      conf_mode_chauffage,
      conf_consommation_electricite,
      conf_consommation_chauffage,
      conf_rdv_annule_precedent
    } = req.body; // type_valid: "0" pour annuler, "1-Y" pour valider avec Y = conf_rdv_avec
    const userId = req.user.id;
    const dateValider = Math.floor(Date.now() / 1000);
    const dateValiderTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Vérifier que la fiche existe et est confirmée (état 7)
    const fiche = await queryOne(
      'SELECT id, id_etat_final, valider FROM fiches WHERE id = ?',
      [parseInt(id)]
    );

    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
      });
    }

    if (fiche.id_etat_final !== 7) {
      return res.status(400).json({
        success: false,
        message: 'Seules les fiches confirmées peuvent être validées'
      });
    }

    // Parser type_valid
    const tab = String(type_valid).split('-');
    const valider = parseInt(tab[0]) || 0;
    const confRdvAvec = tab[1] || conf_rdv_avec || null;
    // Normaliser conf_presence_couple (OUI ou NON en majuscules)
    const confPresenceCouple = conf_presence_couple ? String(conf_presence_couple).toUpperCase() : null;

    const lastVal = fiche.valider > 0 ? 'Valider' : 'Non Valider';
    const newVal = valider > 0 ? 'Valider' : 'Non Valider';

    // Mettre à jour la fiche (tous les champs conf_ pour la validation)
    const confAppelTunisie = conf_appel_tunisie_avec ? String(conf_appel_tunisie_avec).trim().toUpperCase().slice(0, 10) : null;
    const confDejaEtude = conf_deja_etude ? String(conf_deja_etude).toUpperCase() : null;
    const confRdvAnnule = conf_rdv_annule_precedent ? String(conf_rdv_annule_precedent).toUpperCase() : null;

    if (valider === 0) {
      // Annuler la validation
      await query(
        'UPDATE fiches SET valider = 0, conf_presence_couple = NULL WHERE id = ?',
        [parseInt(id)]
      );
    } else {
      // Valider : mettre à jour tous les champs conf_ envoyés
      await query(
        `UPDATE fiches SET valider = ?, conf_rdv_avec = ?, conf_presence_couple = ?,
         conf_appel_tunisie_avec = ?, conf_deja_etude = ?, conf_profession_monsieur = ?, conf_type_contrat_mr = ?,
         conf_profession_madame = ?, conf_type_contrat_madame = ?, conf_revenu = ?, conf_credit = ?,
         conf_mode_chauffage = ?, conf_consommation_electricite = ?, conf_consommation_chauffage = ?, conf_rdv_annule_precedent = ?
         WHERE id = ?`,
        [
          valider, confRdvAvec, confPresenceCouple,
          confAppelTunisie, confDejaEtude, conf_profession_monsieur || null, conf_type_contrat_mr || null,
          conf_profession_madame || null, conf_type_contrat_madame || null, conf_revenu || null, conf_credit || null,
          conf_mode_chauffage || null, conf_consommation_electricite || null, conf_consommation_chauffage || null, confRdvAnnule,
          parseInt(id)
        ]
      );
    }

    // Enregistrer dans validations
    try {
      await query(
        `INSERT INTO validations (id_fiche, date_valider, date_valider_time, valider, id_user, conf_rdv_avec, conf_presence_couple) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [parseInt(id), dateValider, dateValiderTime, valider, userId, confRdvAvec, confPresenceCouple]
      );
    } catch (validError) {
      console.error('Erreur lors de l\'enregistrement dans validations:', validError);
      // Ne pas bloquer si la table n'existe pas encore
    }

    // Enregistrer dans modifica
    try {
      await logModification(
        parseInt(id),
        userId,
        req.user.pseudo || 'Utilisateur',
        'validation',
        lastVal,
        newVal
      );
    } catch (modifError) {
      console.error('Erreur lors de l\'enregistrement dans modifica:', modifError);
    }

    // Récupérer les informations de l'utilisateur pour l'affichage
    const userInfo = await queryOne(
      'SELECT pseudo FROM utilisateurs WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: valider > 0 
        ? `Validée par ${userInfo?.pseudo?.toUpperCase() || 'Utilisateur'} le ${dateValiderTime}${confRdvAvec ? ` avec ${confRdvAvec}` : ''}${confPresenceCouple ? ` - Présence couple: ${confPresenceCouple}` : ''}`
        : `Validation annulée par ${userInfo?.pseudo?.toUpperCase() || 'Utilisateur'} le ${dateValiderTime}`,
      data: {
        valider,
        conf_rdv_avec: confRdvAvec,
        conf_presence_couple: confPresenceCouple,
        date_valider_time: dateValiderTime
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation',
      error: error.message
    });
  }
});

// =====================================================
// FICHES CONFIRMÉES AUJOURD'HUI (Confirmateur/RE Confirmation)
// =====================================================

// Récupérer les fiches confirmées aujourd'hui par toute l'équipe
router.get('/confirmees-aujourdhui', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const y_m_d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const startTimestamp = Math.floor(new Date(`${y_m_d} 00:00:00`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${y_m_d} 23:59:59`).getTime() / 1000);

    // Récupérer les fiches confirmées aujourd'hui (état 7 - CONFIRMER)
    // Inclure : date_confirmation dans la plage OU date_confirmation NULL avec entrée fiches_histo id_etat=7 aujourd'hui
    const fiches = await query(
      `SELECT 
        f.*,
        u1.pseudo as confirmateur1_pseudo,
        u2.pseudo as confirmateur2_pseudo,
        u3.pseudo as confirmateur3_pseudo,
        e.titre as etat_titre,
        e.color as etat_color,
        p.nom as produit_nom
       FROM fiches f
       LEFT JOIN utilisateurs u1 ON f.id_confirmateur = u1.id
       LEFT JOIN utilisateurs u2 ON f.id_confirmateur_2 = u2.id
       LEFT JOIN utilisateurs u3 ON f.id_confirmateur_3 = u3.id
       LEFT JOIN etats e ON f.id_etat_final = e.id
       LEFT JOIN produits p ON f.produit = p.id
       WHERE f.id_etat_final = 7
       AND (
         (f.date_confirmation IS NOT NULL AND f.date_confirmation >= ? AND f.date_confirmation <= ?)
         OR (f.date_confirmation IS NULL AND EXISTS (
           SELECT 1 FROM fiches_histo h WHERE h.id_fiche = f.id AND h.id_etat = 7 AND DATE(h.date_creation) = ?
         ))
       )
       AND (f.archive = 0 OR f.archive IS NULL)
       ORDER BY COALESCE(f.date_confirmation, 0) DESC, f.date_modif_time DESC
       LIMIT 1000`,
      [startTimestamp, endTimestamp, y_m_d]
    );

    // Calculer les stats par confirmateur
    const statsByConfirmateur = {};
    fiches.forEach(fiche => {
      const confirmateurs = [];
      if (fiche.id_confirmateur) confirmateurs.push(fiche.confirmateur1_pseudo || `ID:${fiche.id_confirmateur}`);
      if (fiche.id_confirmateur_2) confirmateurs.push(fiche.confirmateur2_pseudo || `ID:${fiche.id_confirmateur_2}`);
      if (fiche.id_confirmateur_3) confirmateurs.push(fiche.confirmateur3_pseudo || `ID:${fiche.id_confirmateur_3}`);
      
      confirmateurs.forEach(conf => {
        if (!statsByConfirmateur[conf]) {
          statsByConfirmateur[conf] = 0;
        }
        statsByConfirmateur[conf]++;
      });
    });

    // Convertir en array pour les cards
    const cards = Object.entries(statsByConfirmateur).map(([nom, count]) => ({
      confirmateur: nom,
      count
    }));

    res.json({
      success: true,
      data: {
        fiches,
        cards,
        total: fiches.length
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches confirmées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches confirmées',
      error: error.message
    });
  }
});

// Exporter les fonctions de hash pour utilisation dans d'autres modules si nécessaire
module.exports = router;
module.exports.encodeFicheId = encodeFicheId;
module.exports.decodeFicheId = decodeFicheId;

