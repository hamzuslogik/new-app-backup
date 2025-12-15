const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { checkPermissionCode, hasPermission } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// Clé secrète pour encoder/décoder les IDs (à mettre dans .env en production)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

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
const hashToIdMiddleware = (req, res, next) => {
  try {
    // Gérer le paramètre 'id'
    if (req.params.id) {
      // Essayer de décoder le hash
      const decodedId = decodeFicheId(req.params.id);
      if (decodedId) {
        req.params.id = decodedId;
      } else {
        // Si le décodage échoue, essayer de parser comme ID direct (pour compatibilité)
        const directId = parseInt(req.params.id, 10);
        if (!isNaN(directId) && directId > 0) {
          req.params.id = directId;
        } else {
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
        // Si le décodage échoue, essayer de parser comme ID direct (pour compatibilité)
        const directId = parseInt(req.params.hash, 10);
        if (!isNaN(directId) && directId > 0) {
          req.params.id = directId;
          delete req.params.hash;
        } else {
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
  console.log(`[PERF-${requestId}] Début requête GET /fiches - Query params:`, req.query);
  
  try {
    const {
      page = 1,
      limit = 500,
      nom,
      prenom,
      critere,
      critere_champ,
      tel,
      cp,
      produit,
      id_etat_final,
      id_commercial,
      id_confirmateur,
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
      tomorrow
    } = req.query;

    let whereConditions = ['fiche.archive = 0', 'fiche.ko = 0', 'fiche.active = 1'];
    let params = [];

    // Filtres par fonction - Par défaut pour commerciaux : fiches confirmées du jour
    const today = new Date().toISOString().split('T')[0];
    const y_m_d = today;
    
    // Vérifier si c'est une recherche active (critere ou autres filtres spécifiques)
    const isActiveSearch = req.query.fiche_search || req.query.affectation || req.query.suivi || 
                          req.query.critere || req.query.nom || req.query.prenom || 
                          req.query.tel || req.query.cp || req.query.produit || 
                          req.query.id_etat_final || req.query.id_commercial || 
                          req.query.id_confirmateur || req.query.id_centre;
    
    if (!isActiveSearch) {
      if (req.user.fonction === 5) {
        // Commerciaux : RDV du jour avec état final 7
        whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
        whereConditions.push('fiche.id_etat_final = ?');
        whereConditions.push('fiche.id_commercial = ?');
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, 7, req.user.id);
      } else if (req.user.fonction === 3) {
        // Agents Qualification : Fiches créées aujourd'hui par l'agent avec états du groupe 0
        whereConditions.push('fiche.date_insert_time >= ? AND fiche.date_insert_time <= ?');
        whereConditions.push('fiche.id_agent = ?');
        // Filtrer uniquement les états du groupe 0
        whereConditions.push(`EXISTS (
          SELECT 1 FROM etats e 
          WHERE e.id = fiche.id_etat_final 
          AND (e.groupe = '0' OR e.groupe = 0)
        )`);
        params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, req.user.id);
      } else if (req.user.fonction === 6) {
        // Confirmateurs : Vérifier la permission VIEW_ALL_FICHES
        const hasViewAllPermission = await hasPermission(req.user.fonction, 'VIEW_ALL_FICHES');
        
        if (!hasViewAllPermission) {
          // Si pas de permission, filtrer uniquement les fiches assignées au confirmateur
          whereConditions.push('fiche.date_modif_time >= ? AND fiche.date_modif_time <= ?');
          whereConditions.push(`(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)`);
          params.push(`${y_m_d} 00:00:00`, `${y_m_d} 23:59:59`, req.user.id, req.user.id, req.user.id);
        }
        // Si la permission existe, pas de filtre supplémentaire (voit toutes les fiches)
      }
    } else {
      // Filtres par fonction quand recherche active
      if (req.user.fonction === 3) {
        // Agents Qualification : Filtrer par id_agent pour limiter aux fiches de l'agent
        whereConditions.push('fiche.id_agent = ?');
        params.push(req.user.id);
      } else if (req.user.fonction === 5 && !affectation) {
        whereConditions.push('fiche.id_commercial = ?');
        params.push(req.user.id);
      } else if (req.user.fonction === 6) {
        // Confirmateurs : Vérifier la permission VIEW_ALL_FICHES
        const hasViewAllPermission = await hasPermission(req.user.fonction, 'VIEW_ALL_FICHES');
        
        if (!hasViewAllPermission) {
          // Si pas de permission, filtrer uniquement les fiches assignées au confirmateur
          whereConditions.push(`(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)`);
          params.push(req.user.id, req.user.id, req.user.id);
        }
        // Si la permission existe, pas de filtre supplémentaire (voit toutes les fiches)
      }
    }

    // Filtre par groupes d'états autorisés (selon les permissions)
    // Pour les agents qualification (fonction 3), on a déjà filtré par groupe 0 dans le filtre par défaut
    // Donc on ne doit pas appliquer le filtre de permissions si c'est un agent qualification sans recherche
    const shouldApplyPermissionFilter = !(req.user.fonction === 3 && !req.query.fiche_search && !req.query.affectation && !req.query.suivi);
    
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
        
        // Filtrer selon les groupes autorisés
        // Note: groupe est un VARCHAR, donc on compare avec des chaînes
        // Pour les commerciaux (fonction 5), ajouter aussi l'état CONFIRMER (7) en plus des groupes autorisés
        if (req.user.fonction === 5) {
          // Commerciaux : Phase 3 (groupe 3) + CONFIRMER (état 7)
          whereConditions.push(`EXISTS (
            SELECT 1 FROM etats e 
            WHERE e.id = fiche.id_etat_final 
            AND (CAST(e.groupe AS CHAR) IN (${allowedGroups.map(() => '?').join(',')}) OR fiche.id_etat_final = 7)
          )`);
          params.push(...allowedGroups.map(g => String(g)));
        } else {
          whereConditions.push(`EXISTS (
            SELECT 1 FROM etats e 
            WHERE e.id = fiche.id_etat_final 
            AND CAST(e.groupe AS CHAR) IN (${allowedGroups.map(() => '?').join(',')})
          )`);
          params.push(...allowedGroups.map(g => String(g)));
        }
      }
      // Si aucune permission n'existe dans la base, ne pas filtrer (rétrocompatibilité)
    }

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
    
    if (id_etat_final) {
      if (id_etat_final === 't_s') {
        whereConditions.push('(fiche.id_etat_final = 13 OR fiche.id_etat_final = 45 OR fiche.id_etat_final = 44 OR fiche.id_etat_final = 16 OR fiche.id_etat_final = 38)');
      } else if (Array.isArray(id_etat_final)) {
        // Support pour plusieurs états
        // Si qualification_code est aussi fourni, utiliser OR
        if (qualificationCondition) {
          whereConditions.push(`(fiche.id_etat_final IN (${id_etat_final.map(() => '?').join(',')}) OR ${qualificationCondition})`);
          params.push(...id_etat_final, req.query.qualification_code);
        } else {
          whereConditions.push(`fiche.id_etat_final IN (${id_etat_final.map(() => '?').join(',')})`);
          params.push(...id_etat_final);
        }
      } else {
        // Si qualification_code est aussi fourni, utiliser OR
        if (qualificationCondition) {
          whereConditions.push(`(fiche.id_etat_final = ? OR ${qualificationCondition})`);
          params.push(id_etat_final, req.query.qualification_code);
        } else {
          whereConditions.push('fiche.id_etat_final = ?');
          params.push(id_etat_final);
        }
      }
    } else if (qualificationCondition) {
      // Si seulement qualification_code est fourni (sans id_etat_final)
      whereConditions.push(qualificationCondition);
      params.push(req.query.qualification_code);
    }
    if (id_commercial) {
      whereConditions.push('(fiche.id_commercial = ? OR fiche.id_commercial_2 = ?)');
      params.push(id_commercial, id_commercial);
    }
    if (id_confirmateur) {
      whereConditions.push('(fiche.id_confirmateur = ? OR fiche.id_confirmateur_2 = ? OR fiche.id_confirmateur_3 = ?)');
      params.push(id_confirmateur, id_confirmateur, id_confirmateur);
    }
    if (id_centre) {
      whereConditions.push('fiche.id_centre = ?');
      params.push(id_centre);
    }
    if (id_agent) {
      whereConditions.push('fiche.id_agent = ?');
      params.push(id_agent);
    }
    if (ko !== undefined && ko !== '') {
      whereConditions.push('fiche.ko = ?');
      params.push(ko);
    }
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
      const allowedDateColumns = ['date_insert_time', 'date_modif_time', 'date_rdv_time', 'date_appel_time', 'date_confirmation', 'date_qualif', 'date_sign_time'];
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
        // S'assurer que la colonne de date n'est pas NULL ou vide
        whereConditions.push(`fiche.${date_champ} IS NOT NULL`);
        whereConditions.push(`fiche.${date_champ} != ''`);
        
        const timeStart = time_debut && String(time_debut).trim() !== '' ? time_debut : '00:00:00';
        const timeEnd = time_fin && String(time_fin).trim() !== '' ? time_fin : '23:59:59';
        
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
        console.log(`[PERF-${requestId}] Filtre par défaut ajouté: fiches créées aujourd'hui (date_insert_time)`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Log de la clause WHERE et des paramètres pour debugging
    console.log(`[PERF-${requestId}] WHERE clause: ${whereClause}`);
    console.log(`[PERF-${requestId}] WHERE params:`, JSON.stringify(params));

    // Configurer GROUP_CONCAT pour éviter les troncatures
    await query('SET SESSION group_concat_max_len = 1000000');

    // Compter le total (inclure le JOIN qualif si nécessaire)
    const qualifJoinForCount = needsQualifJoin && qualifTableExists 
      ? 'LEFT JOIN qualif ON fiche.id_qualif = qualif.id' 
      : '';

    // Compter le total
    const countStartTime = Date.now();
    const countResult = await queryOne(
      `SELECT COUNT(DISTINCT fiche.id) as total FROM fiches fiche ${qualifJoinForCount} ${whereClause}`,
      params
    );
    const total = countResult.total;
    const countDuration = Date.now() - countStartTime;
    console.log(`[PERF-${requestId}] COUNT query terminé en ${countDuration}ms - Total: ${total}`);

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
       cq_e.titre as cqe,
       cq_d.titre as cqd,
       install.nom as installeur,
       (SELECT GROUP_CONCAT(DISTINCT id_etat ORDER BY id ASC SEPARATOR ',') 
        FROM fiches_histo 
        WHERE id_fiche = fiche.id 
        LIMIT 100) as id_etat_histo,
       decale.message as decale_message,
       decale.expediteur as decale_expediteur,
       decale_etat.titre as etat_dec
       ${qualifSelect}
       FROM fiches fiche
       LEFT JOIN cq_etat cq_e ON fiche.cq_etat = cq_e.id
       LEFT JOIN cq_dossier cq_d ON fiche.cq_dossier = cq_d.id
       LEFT JOIN installateurs install ON fiche.ph3_installateur = install.id
       LEFT JOIN decalages decale ON fiche.id = decale.id_fiche
       LEFT JOIN etat_decalage decale_etat ON decale.id_etat = decale_etat.id
       ${qualifJoin}
       ${whereClause}
       GROUP BY fiche.id
       ORDER BY fiche.date_rdv_time ASC
       LIMIT ? OFFSET ?`;
    console.log(`[PERF-${requestId}] Début SELECT query - Limit: ${limit}, Offset: ${offset}`);
    const fiches = await query(selectQuery, [...params, parseInt(limit), offset]);
    const selectDuration = Date.now() - selectStartTime;
    console.log(`[PERF-${requestId}] SELECT query terminé en ${selectDuration}ms - ${fiches.length} fiches récupérées`);

    // Ajouter le hash pour chaque fiche (masquer l'ID)
    const hashStartTime = Date.now();
    const fichesWithHash = fiches.map(fiche => ({
      ...fiche,
      hash: encodeFicheId(fiche.id),
      // Ne pas exposer l'ID dans la réponse
      id: undefined
    }));
    const hashDuration = Date.now() - hashStartTime;
    console.log(`[PERF-${requestId}] Hash encoding terminé en ${hashDuration}ms`);

    const totalDuration = Date.now() - requestStartTime;
    console.log(`[PERF-${requestId}] === RÉSUMÉ PERFORMANCE ===`);
    console.log(`[PERF-${requestId}] COUNT: ${countDuration}ms (${((countDuration/totalDuration)*100).toFixed(1)}%)`);
    console.log(`[PERF-${requestId}] SELECT: ${selectDuration}ms (${((selectDuration/totalDuration)*100).toFixed(1)}%)`);
    console.log(`[PERF-${requestId}] HASH: ${hashDuration}ms`);
    console.log(`[PERF-${requestId}] TOTAL: ${totalDuration}ms`);
    console.log(`[PERF-${requestId}] =========================`);

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
    console.error(`[PERF-${requestId}] Erreur après ${totalDuration}ms:`, error);
    console.error('Erreur lors de la récupération des fiches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches'
    });
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

    let whereConditions = [
      'fiche.archive = 0',
      'fiche.ko = 0',
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
    
    if (date_debut && date_fin) {
      const dateStart = time_debut ? `${date_debut} ${time_debut}` : `${date_debut} 00:00:00`;
      const dateEnd = time_fin ? `${date_fin} ${time_fin}` : `${date_fin} 23:59:59`;
      whereConditions.push('fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ?');
      params.push(dateStart, dateEnd);
    } else if (date_debut) {
      const dateStart = time_debut ? `${date_debut} ${time_debut}` : `${date_debut} 00:00:00`;
      whereConditions.push('fiche.date_rdv_time >= ?');
      params.push(dateStart);
    } else if (date_fin) {
      const dateEnd = time_fin ? `${date_fin} ${time_fin}` : `${date_fin} 23:59:59`;
      whereConditions.push('fiche.date_rdv_time <= ?');
      params.push(dateEnd);
    }

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

    // Compter le total
    const countResult = await queryOne(
      `SELECT COUNT(DISTINCT fiche.id) as total
       FROM fiches fiche
       WHERE ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

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

    // Enrichir les fiches avec l'information sur les comptes rendu
    // Récupérer les IDs des fiches qui ont des comptes rendu
    if (fiches.length > 0) {
      const ficheIds = fiches.map(f => f.id);
      const placeholders = ficheIds.map(() => '?').join(',');
      
      let compteRenduQuery;
      let compteRenduParams;
      
      if (req.user.fonction === 5) {
        // Pour les commerciaux : vérifier seulement leurs propres comptes rendu
        compteRenduQuery = `SELECT DISTINCT id_fiche 
                           FROM compte_rendu_pending 
                           WHERE id_fiche IN (${placeholders})
                             AND id_commercial = ?
                             AND statut IN ('pending', 'approved')`;
        compteRenduParams = [...ficheIds, req.user.id];
      } else {
        // Pour les admins : vérifier tous les comptes rendu de la fiche
        compteRenduQuery = `SELECT DISTINCT id_fiche 
                           FROM compte_rendu_pending 
                           WHERE id_fiche IN (${placeholders})
                             AND statut IN ('pending', 'approved')`;
        compteRenduParams = ficheIds;
      }
      
      const fichesAvecCompteRendu = await query(compteRenduQuery, compteRenduParams);
      const ficheIdsAvecCompteRendu = new Set(fichesAvecCompteRendu.map(cr => cr.id_fiche));
      
      // Ajouter l'information has_compte_rendu à chaque fiche
      fiches.forEach(fiche => {
        fiche.has_compte_rendu = ficheIdsAvecCompteRendu.has(fiche.id);
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
        fiche.commentaire_commercial,
        agent.pseudo as agent_pseudo,
        agent.nom as agent_nom,
        agent.prenom as agent_prenom,
        centre.titre as centre_nom,
        etat.titre as etat_titre,
        etat.color as etat_color,
        etat.abbreviation as etat_abbreviation
       FROM fiches fiche
       LEFT JOIN utilisateurs agent ON fiche.id_agent = agent.id
       LEFT JOIN centres centre ON fiche.id_centre = centre.id
       LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
       WHERE ${whereClause}
       ORDER BY fiche.date_insert_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

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
      
      // Récupérer les agents de tous ces superviseurs
      if (superviseurIds.length > 0) {
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseurIds
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
    // Pour les autres (RE Qualification), filtrer uniquement groupe 0 + EN-ATTENTE
    if (req.user.fonction === 12) {
      // Pour RP Qualification : inclure tous les états (pas de filtre sur les états)
      // Le filtre par état se fera côté frontend si nécessaire
    } else {
      // Pour RE Qualification : filtrer uniquement les états du groupe 0 + EN-ATTENTE
      whereConditions.push(`EXISTS (
        SELECT 1 FROM etats e 
        WHERE e.id = fiche.id_etat_final 
        AND (
          (e.groupe = '0' OR e.groupe = 0) OR
          (e.id = 1 OR e.titre = 'EN-ATTENTE' OR e.titre = 'En-Attente' OR e.titre = 'EN ATTENTE')
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

    if (id_etat_final) {
      whereConditions.push('fiche.id_etat_final = ?');
      params.push(parseInt(id_etat_final));
    }

    // S'assurer que date_insert_time n'est pas NULL ou vide
    whereConditions.push('fiche.date_insert_time IS NOT NULL');
    whereConditions.push('fiche.date_insert_time != ""');
    
    // Par défaut, filtrer par date d'aujourd'hui si aucune date n'est fournie
    const today = new Date().toISOString().split('T')[0];
    if (date_debut) {
      whereConditions.push('fiche.date_insert_time >= ?');
      params.push(`${date_debut} 00:00:00`);
    } else {
      // Par défaut, fiches créées aujourd'hui
      whereConditions.push('DATE(fiche.date_insert_time) = ?');
      params.push(today);
    }

    if (date_fin) {
      whereConditions.push('fiche.date_insert_time <= ?');
      params.push(`${date_fin} 23:59:59`);
    } else if (!date_debut) {
      // Si pas de date_debut non plus, ajouter la fin de journée pour aujourd'hui
      whereConditions.push('fiche.date_insert_time <= ?');
      params.push(`${today} 23:59:59`);
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
        agent.pseudo as agent_pseudo,
        agent.nom as agent_nom,
        agent.prenom as agent_prenom,
        centre.titre as centre_nom,
        etat.titre as etat_titre,
        etat.color as etat_color,
        etat.abbreviation as etat_abbreviation
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
router.get('/validation-rdv', authenticate, async (req, res) => {
  try {
    const { valider, date_debut, date_fin } = req.query;
    
    // Vérifier que l'utilisateur est Confirmateur (fonction 6), RE Confirmation (fonction 14) ou Admin (fonction 1, 2, 7)
    if (![1, 2, 6, 7, 14].includes(req.user.fonction)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux Confirmateurs, RE Confirmation et Administrateurs'
      });
    }

    const whereConditions = [
      'f.id_etat_final = 7', // Fiches confirmées uniquement
      '(f.archive = 0 OR f.archive IS NULL)',
      'f.date_rdv_time IS NOT NULL' // Uniquement les fiches avec un RDV
    ];
    const params = [];

    // Pour les confirmateurs (fonction 6), ils voient tous les RDV confirmés dans la plage de dates
    // Le filtrage par confirmateur assigné n'est pas nécessaire ici car ils doivent valider tous les RDV
    
    // Pour RE Confirmation (fonction 14), filtrer par confirmateurs sous responsabilité
    if (req.user.fonction === 14) {
      // Récupérer les IDs des confirmateurs sous responsabilité (chef_equipe = RE Confirmation)
      const confirmateursIds = await query(
        'SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 6 AND etat > 0',
        [req.user.id]
      );
      
      if (confirmateursIds.length === 0) {
        // Aucun confirmateur sous responsabilité, retourner vide
        return res.json({
          success: true,
          data: {
            fiches: [],
            stats: { valides: 0, nonValides: 0, total: 0 },
            statsByDepartement: [],
            totals: { valides: 0, nonValides: 0, total: 0 }
          }
        });
      }
      
      const ids = confirmateursIds.map(c => c.id);
      whereConditions.push(`(f.id_confirmateur IN (${ids.map(() => '?').join(',')}) OR f.id_confirmateur_2 IN (${ids.map(() => '?').join(',')}) OR f.id_confirmateur_3 IN (${ids.map(() => '?').join(',')}))`);
      params.push(...ids, ...ids, ...ids);
      console.log(`[Validation RDV] RE Confirmation - Confirmateurs sous responsabilité:`, ids);
    }
    
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
    
    if (!dateDebut || !dateFin) {
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
    
    if (dateDebut) {
      whereConditions.push('f.date_rdv_time >= ?');
      params.push(`${dateDebut} 00:00:00`);
      console.log(`[Validation RDV] Date début: ${dateDebut} 00:00:00`);
    }
    if (dateFin) {
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
router.get('/demandes-insertion', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
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
router.put('/demandes-insertion/:id', authenticate, checkPermission(1, 2, 7, 11), async (req, res) => {
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
    
    // Récupérer les informations de l'agent et de son superviseur
    const agentInfo = await queryOne(
      `SELECT u.id, u.pseudo, u.chef_equipe, s.pseudo as superviseur_pseudo
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
          'nb_chemines', 'mode_chauffage', 'consommation_electricite', 'age_mr', 'age_madame',
          'revenu_foyer', 'credit_foyer', 'situation_conjugale', 'nb_enfants', 'profession_mr',
          'profession_madame', 'commentaire', 'id_agent', 'id_centre', 'id_insert', 'id_confirmateur',
          'id_confirmateur_2', 'id_confirmateur_3', 'id_qualite', 'id_qualif', 'id_commercial',
          'id_commercial_2', 'id_etat_final', 'date_appel', 'date_insert', 'date_insert_time',
          'date_audit', 'date_confirmation', 'date_qualif', 'date_rdv', 'date_rdv_time',
          'date_affect', 'date_sign', 'date_sign_time', 'date_modif_time', 'archive', 'ko', 'hc',
          'active', 'valider', 'conf_commentaire_produit', 'conf_consommations',
          'conf_profession_monsieur', 'conf_profession_madame', 'conf_presence_couple',
          'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
          'conf_consommation_electricite', 'conf_rdv_avec', 'cq_etat', 'cq_dossier',
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
        
        // Créer l'entrée dans l'historique
        await query(
          `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation)
           VALUES (?, ?, NOW())`,
          [insertId, donneesFiche.id_etat_final || 1]
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
        await query(
          `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          ['demande_insertion_acceptee', insertId, messageAcceptation, demande.id_agent, now, metadataAcceptation]
        ).catch(err => {
          console.error('Erreur lors de la création de la notification pour l\'agent:', err);
        });
        
        // Notification pour le superviseur (si existe)
        if (agentInfo?.chef_equipe) {
          await query(
            `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            ['demande_insertion_acceptee', insertId, messageAcceptation, agentInfo.chef_equipe, now, metadataAcceptation]
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
      // Créer des notifications pour l'agent et son superviseur (si existe) en cas de refus
      const messageRefus = `Votre demande d'insertion de fiche pour ${ficheExistante?.nom || ''} ${ficheExistante?.prenom || ''} a été rejetée par ${traitantPseudo}.${commentaire ? ` Raison : ${commentaire}` : ''}`;
      const metadataRefus = JSON.stringify({
        id_demande: id,
        id_fiche_existante: demande.id_fiche_existante,
        commentaire: commentaire || null
      });
      
      // Notification pour l'agent
      await query(
        `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        ['demande_insertion_refusee', demande.id_fiche_existante, messageRefus, demande.id_agent, now, metadataRefus]
      ).catch(err => {
        console.error('Erreur lors de la création de la notification pour l\'agent:', err);
      });
      
      // Notification pour le superviseur (si existe)
      if (agentInfo?.chef_equipe) {
        await query(
          `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          ['demande_insertion_refusee', demande.id_fiche_existante, messageRefus, agentInfo.chef_equipe, now, metadataRefus]
        ).catch(err => {
          console.error('Erreur lors de la création de la notification pour le superviseur:', err);
        });
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
      etat_final_titre: etat?.titre || null,
      etat_final_color: etat?.color || null,
      etat_final_groupe: etat?.groupe || null,
      // Ajouter id_etat_final pour vérification côté frontend
      id_etat_final_verified: fiche.id_etat_final,
      produit_nom: produit?.nom || null,
      produit_color: produit?.color || null,
      qualification_code: qualification_code || null
    };

    // Récupérer l'historique complet avec détails
    // Enrichir avec les informations de la fiche actuelle (sous-état, confirmateur, commentaire, etc.)
    let historique;
    try {
      // D'abord récupérer l'historique de base
      historique = await query(
        `SELECT histo.*,
         etat.titre as etat_titre,
         etat.color as etat_color
         FROM fiches_histo histo
         LEFT JOIN etats etat ON histo.id_etat = etat.id
         WHERE histo.id_fiche = ? 
         ORDER BY histo.id ASC`,
        [id]
      );
      
      // Enrichir chaque entrée de l'historique avec les données de la fiche actuelle
      if (historique && historique.length > 0 && fiche) {
        // Vérifier si id_sous_etat existe dans la table
        let sousEtatInfo = null;
        try {
          if (fiche.id_sous_etat) {
            sousEtatInfo = await queryOne('SELECT titre FROM sous_etat WHERE id = ?', [fiche.id_sous_etat]);
          }
        } catch (e) {
          // Colonne id_sous_etat n'existe probablement pas dans fiches
          console.log('Impossible de récupérer le sous-état (colonne peut ne pas exister):', e.message);
        }
        
        historique = historique.map(histo => ({
          ...histo,
          id_confirmateur: fiche.id_confirmateur,
          id_confirmateur_2: fiche.id_confirmateur_2,
          id_confirmateur_3: fiche.id_confirmateur_3,
          confirmateur_pseudo: confirmateur?.pseudo || null,
          confirmateur_2_pseudo: confirmateur2?.pseudo || null,
          confirmateur_3_pseudo: confirmateur3?.pseudo || null,
          conf_commentaire_produit: fiche.conf_commentaire_produit || null,
          conf_rdv_avec: fiche.conf_rdv_avec || null,
          date_rdv_time: fiche.date_rdv_time || null,
          date_appel_time: fiche.date_appel_time || null,
          profession_mr: fiche.profession_mr || null,
          profession_madame: fiche.profession_madame || null,
          type_contrat_mr: fiche.type_contrat_mr || null,
          type_contrat_madame: fiche.type_contrat_madame || null,
          revenu_foyer: fiche.revenu_foyer || null,
          credit_foyer: fiche.credit_foyer || null,
          mode_chauffage: fiche.mode_chauffage || null,
          produit: fiche.produit || null,
          surface_chauffee: fiche.surface_chauffee || null,
          consommation_chauffage: fiche.consommation_chauffage || null,
          annee_systeme_chauffage: fiche.annee_systeme_chauffage || null,
          conf_orientation_toiture: fiche.conf_orientation_toiture || null,
          conf_zones_ombres: fiche.conf_zones_ombres || null,
          conf_site_classe: fiche.conf_site_classe || null,
          conf_consommation_electricite: fiche.conf_consommation_electricite || null,
          nb_pans: fiche.nb_pans || null,
          sous_etat_titre: sousEtatInfo?.titre || null,
          cq_etat: cq_etat || null,
          cq_dossier: cq_dossier || null,
          commentaire_qualite: fiche.commentaire_qualite || null,
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
    }
    // Admins (1, 2, 7) : peuvent tout modifier, pas de vérification supplémentaire
    
    // Si modification de l'état final, créer une entrée dans l'historique
    if (field === 'id_etat_final' && value && value !== fiche.id_etat_final) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Mettre à jour automatiquement date_appel_time lors du changement d'état
      await query(
        `UPDATE fiches SET date_appel_time = ?, date_modif_time = ? WHERE id = ?`,
        [now, now, id]
      );
      
      // Note: fiches_histo n'a pas de colonne id_user selon le schéma
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, ?, ?)`,
        [id, value, now]
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
      'situation_conjugale', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'date_rdv_time', 'id_centre', 'id_agent', 'id_commercial', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_commercial_2', 'id_etat_final',
      'rdv_urgent', 'commentaire', 'commentaire_qualite', 'commentaire_commercial', 'type_contrat_mr', 'type_contrat_madame'
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Le champ "${field}" n'est pas autorisé à être modifié`
      });
    }

    // Ne pas permettre la modification de date_appel_time (rempli automatiquement lors du changement d'état)
    if (field === 'date_appel_time') {
      return res.status(400).json({
        success: false,
        message: 'date_appel_time ne peut pas être modifiée manuellement. Elle est remplie automatiquement lors du changement d\'état.'
      });
    }

    // Récupérer l'ancienne valeur avant la mise à jour
    const oldValue = fiche[field];

    // Mettre à jour le champ
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      `UPDATE fiches SET \`${field}\` = ?, date_modif_time = ? WHERE id = ?`,
      [value || null, now, id]
    );

    // Enregistrer la modification dans modifica
    await logModification(
      id,
      req.user.id,
      req.user.pseudo || 'Utilisateur',
      field,
      oldValue,
      value || null
    );

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

// Créer une nouvelle fiche
// Permissions : Admin (1, 2), Agents (3), Qualité (4), Commerciaux (5), Confirmateurs (6), Dev (7), Autres (8)
router.post('/', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const ficheData = req.body;
    
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
    
    // Si une fiche existante est trouvée, créer une demande d'insertion
    if (existingFiche) {
      const agentId = ficheData.id_agent || req.user.id;
      
      // Vérifier si une demande d'insertion existe déjà pour ce numéro, cet agent et aujourd'hui
      // Utiliser CURDATE() pour comparer uniquement la date (sans l'heure)
      // Vérifier tous les statuts pour éviter les doublons même si la demande a été traitée
      const existingDemande = await queryOne(
        `SELECT id, date_demande, statut 
         FROM demandes_insertion 
         WHERE id_agent = ? 
           AND id_fiche_existante = ?
           AND date_demande IS NOT NULL
           AND DATE(date_demande) = CURDATE()
         ORDER BY id DESC
         LIMIT 1`,
        [agentId, existingFiche.id]
      );
      
      console.log('[DEMANDE INSERTION] Vérification doublon:', {
        agentId,
        ficheExistanteId: existingFiche.id,
        existingDemande: existingDemande ? existingDemande.id : null,
        dateDemande: existingDemande ? existingDemande.date_demande : null,
        statut: existingDemande ? existingDemande.statut : null,
        curdate: new Date().toISOString().split('T')[0]
      });
      
      // Si une demande existe déjà pour aujourd'hui, ne pas créer de doublon
      if (existingDemande) {
        console.log('[DEMANDE INSERTION] Doublon détecté - demande existante ID:', existingDemande.id);
        return res.status(200).json({
          success: true,
          message: 'Une demande d\'insertion existe déjà pour ce numéro de téléphone, cet agent et aujourd\'hui.',
          data: {
            demandeId: existingDemande.id,
            existingFicheId: existingFiche.id,
            demandeCreated: false,
            existingDemande: true
          }
        });
      }
      
      // Récupérer les informations de l'agent pour le message
      const agentInfo = await queryOne(
        `SELECT pseudo FROM utilisateurs WHERE id = ?`,
        [agentId]
      );
      
      // Créer la demande d'insertion
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Double vérification avant insertion (sécurité supplémentaire)
      const doubleCheck = await queryOne(
        `SELECT id FROM demandes_insertion 
         WHERE id_agent = ? 
           AND id_fiche_existante = ?
           AND date_demande IS NOT NULL
           AND DATE(date_demande) = CURDATE()
         LIMIT 1`,
        [agentId, existingFiche.id]
      );
      
      if (doubleCheck) {
        console.log('[DEMANDE INSERTION] Double vérification - doublon détecté ID:', doubleCheck.id);
        return res.status(200).json({
          success: true,
          message: 'Une demande d\'insertion existe déjà pour ce numéro de téléphone, cet agent et aujourd\'hui.',
          data: {
            demandeId: doubleCheck.id,
            existingFicheId: existingFiche.id,
            demandeCreated: false,
            existingDemande: true
          }
        });
      }
      
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
      
      // Créer des notifications pour tous les utilisateurs backoffice (fonction 11)
      // Récupérer tous les utilisateurs backoffice actifs (fonction 11) et l'utilisateur spécifique 2668
      const backofficeUsers = await query(
        `SELECT id FROM utilisateurs WHERE (fonction = 11 OR id = 2668) AND etat > 0`
      );
      
      if (backofficeUsers && backofficeUsers.length > 0) {
        const agentPseudo = agentInfo?.pseudo || 'Agent inconnu';
        const ficheNom = ficheExistanteInfo?.nom || '';
        const fichePrenom = ficheExistanteInfo?.prenom || '';
        const ficheTel = ficheExistanteInfo?.tel || '';
        const ficheHash = ficheExistanteInfo?.hash || encodeFicheId(existingFiche.id);
        
        const message = `Nouvelle demande d'insertion de fiche par ${agentPseudo}. Fiche existante : ${ficheNom} ${fichePrenom} (${ficheTel}).`;
        const metadata = JSON.stringify({
          id_demande: demandeResult.insertId,
          id_fiche_existante: existingFiche.id,
          id_agent: agentId,
          agent_pseudo: agentPseudo,
          fiche_nom: ficheNom,
          fiche_prenom: fichePrenom,
          fiche_tel: ficheTel
        });
        
        // Créer une notification pour chaque utilisateur backoffice
        const notificationValues = backofficeUsers.map(user => [
          'demande_insertion',
          existingFiche.id,
          message,
          user.id,
          now,
          0, // lu = 0 (non lue)
          metadata
        ]);
        
        if (notificationValues.length > 0) {
          const placeholders = notificationValues.map(() => '(?, ?, ?, ?, ?, 0, ?)').join(', ');
          const flatValues = notificationValues.flat();
          
          await query(
            `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
             VALUES ${placeholders}`,
            flatValues
          ).catch(err => {
            console.error('Erreur lors de la création des notifications pour les utilisateurs backoffice:', err);
          });
        }
      }
      
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
      'civ', 'nom', 'prenom', 'tel', 'gsm1', 'gsm2', 'adresse', 'cp', 'ville', 'etude',
      'consommation_chauffage', 'surface_habitable', 'annee_systeme_chauffage', 'surface_chauffee',
      'proprietaire_maison', 'nb_pieces', 'nb_pans', 'age_maison', 'orientation_toiture', 'produit',
      'nb_chemines', 'mode_chauffage', 'consommation_electricite', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'situation_conjugale', 'nb_enfants', 'profession_mr',
      'profession_madame', 'commentaire', 'id_agent', 'id_centre', 'id_insert', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_qualite', 'id_qualif', 'id_commercial',
      'id_commercial_2', 'id_etat_final', 'date_appel', 'date_insert', 'date_insert_time',
      'date_audit', 'date_confirmation', 'date_qualif', 'date_rdv', 'date_rdv_time',
      'date_affect', 'date_sign', 'date_sign_time', 'date_modif_time', 'archive', 'ko', 'hc',
      'active', 'valider', 'conf_commentaire_produit', 'conf_consommations',
      'conf_profession_monsieur', 'conf_profession_madame', 'conf_presence_couple',
      'conf_produit', 'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec', 'cq_etat', 'cq_dossier',
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

    // Créer l'entrée dans l'historique
    if (ficheData.id_etat_final) {
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, ?, ?)`,
        [insertId, ficheData.id_etat_final, now]
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
router.put('/:id/etat-rapide', hashToIdMiddleware, authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_etat_final } = req.body;

    if (!id_etat_final) {
      return res.status(400).json({
        success: false,
        message: 'L\'état est requis'
      });
    }

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT id_etat_final FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
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

    // Mettre à jour l'état et date_appel_time automatiquement lors du changement d'état
    await query(
      'UPDATE fiches SET id_etat_final = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, now, now, id]
    );

    // Enregistrer dans l'historique
    if (oldEtatId !== newEtatId) {
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?)`,
        [id, newEtatId, null, now]
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
router.put('/:hash/valider-qualite', authenticate, hashToIdMiddleware, async (req, res) => {
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

    // Vérifier que la fiche existe
    const fiche = await queryOne('SELECT id_etat_final FROM fiches WHERE id = ?', [id]);
    if (!fiche) {
      return res.status(404).json({
        success: false,
        message: 'Fiche non trouvée'
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

    // Mettre à jour l'état vers "En-Attente" et date_appel_time automatiquement lors du changement d'état
    await query(
      'UPDATE fiches SET id_etat_final = ?, date_appel_time = ?, date_modif_time = ? WHERE id = ?',
      [newEtatId, now, now, id]
    );

    // Enregistrer dans l'historique si changement d'état
    if (oldEtatId !== newEtatId) {
      await query(
        `INSERT INTO fiches_histo (id_fiche, id_etat, date_creation) VALUES (?, ?, ?)`,
        [id, newEtatId, now]
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

// Mettre à jour une fiche
router.put('/:id', authenticate, hashToIdMiddleware, checkPermissionCode('fiches_edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const ficheData = req.body;

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
        'situation_conjugale', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
        'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
        'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage',
        'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
        'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
        'date_rdv_time', 'date_appel_time', 'id_centre', 'id_commercial',
        'id_commercial_2', 'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'type_contrat_mr', 'type_contrat_madame',
        'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
        'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
        'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
        'conf_consommation_electricite', 'conf_rdv_avec'
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
    } else if (req.user.fonction === 6) {
      // Confirmateurs : peuvent modifier toutes les fiches (pas de restriction)
      // Pas de vérification d'assignation nécessaire
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

    // Gérer le changement d'état
    if (ficheData.id_etat_final && ficheData.id_etat_final !== fiche.id_etat_final) {
    const oldEtatId = fiche.id_etat_final;
    const newEtatId = parseInt(ficheData.id_etat_final);
    
    // Mettre à jour automatiquement date_appel_time lors du changement d'état
    ficheData.date_appel_time = now;
    
    // Si on passe de l'état CONFIRMER (7) à un état du groupe 2, supprimer la date du RDV
    if (oldEtatId === 7 && newEtatId !== 7) {
      // Récupérer le groupe du nouvel état
      const newEtat = await queryOne(
        'SELECT groupe FROM etats WHERE id = ?',
        [newEtatId]
      );
      
      // Si le nouvel état est dans le groupe 2, supprimer date_rdv_time
      if (newEtat && (newEtat.groupe === 2 || newEtat.groupe === '2')) {
        ficheData.date_rdv_time = null;
        console.log(`Date RDV sera supprimée pour la fiche ${id} : passage de l'état CONFIRMER (7) à l'état ${newEtatId} (groupe 2)`);
      }
    }
    
    // Créer une entrée dans l'historique
    await query(
      `INSERT INTO fiches_histo (id_fiche, id_etat, date_rdv_time, date_creation) VALUES (?, ?, ?, ?)`,
      [
        id,
        ficheData.id_etat_final,
        ficheData.date_rdv_time || fiche.date_rdv_time || null,
        now
      ]
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
      'situation_conjugale', 'profession_mr', 'profession_madame', 'age_mr', 'age_madame',
      'revenu_foyer', 'credit_foyer', 'nb_enfants', 'proprietaire_maison',
      'surface_habitable', 'surface_chauffee', 'annee_systeme_chauffage', 'mode_chauffage',
      'consommation_chauffage', 'consommation_electricite', 'circuit_eau', 'nb_pieces', 'nb_pans',
      'produit', 'etude', 'orientation_toiture', 'site_classe', 'zones_ombres',
      'date_rdv_time', 'date_appel_time', 'date_modif_time', 'id_centre', 'id_agent', 'id_commercial', 'id_confirmateur',
      'id_confirmateur_2', 'id_confirmateur_3', 'id_commercial_2', 'id_etat_final',
      'id_qualif', 'rdv_urgent', 'commentaire', 'commentaire_qualite', 'type_contrat_mr', 'type_contrat_madame',
      // Champs de confirmation
      'conf_commentaire_produit', 'conf_consommations', 'conf_profession_monsieur',
      'conf_profession_madame', 'conf_presence_couple', 'conf_produit',
      'conf_orientation_toiture', 'conf_zones_ombres', 'conf_site_classe',
      'conf_consommation_electricite', 'conf_rdv_avec',
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

            // Enregistrer dans modifica
            await query(
              `INSERT INTO modifica (id_fiche, id_user, champ, ancien_valeur, nouvelle_valeur, date_modif_time)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [id, req.user.id, 'Compte rendu', fiche.id_etat_final || '', etatFiche || '', now]
            );
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

    // Vérifier les permissions
    if (req.user.fonction !== 1 && req.user.fonction !== 2 && req.user.fonction !== 7) {
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
    const { tel, message, id_confirmateur } = req.body;
    
    if (!tel || !message || !id_confirmateur) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le téléphone, le message et le confirmateur sont requis' 
      });
    }

    // Appeler l'API Manivox pour envoyer le SMS
    const axios = require('axios');
    const formattedTel = tel.startsWith('0') ? `0033${tel.substring(1)}` : tel;
    
    try {
      const smsResponse = await axios.post('https://www.manivox.com/api_v2/json_api.php', null, {
        params: {
          action: 'send_sms',
          auth_email: 'provoicecc@gmail.com',
          auth_password: 'x))MTU-e5Ma62y6',
          from: 'RAPPEL',
          to: formattedTel,
          text: message
        }
      });

      const result = smsResponse.data;
      const isSuccess = result.message === 'successful';

      if (isSuccess) {
        // Enregistrer le SMS dans la base
        const dateModif = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await query(
          `INSERT INTO sms (id_fiche, id_confirmateur, tel, message, statut, date_modif_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, id_confirmateur, tel, message, result.message || 'successful', dateModif]
        );

        // Enregistrer dans modifica
        const lastSms = await queryOne(
          `SELECT message FROM sms WHERE id_fiche = ? ORDER BY id DESC LIMIT 1, 1`
        );
        await query(
          `INSERT INTO modifica (id_fiche, id_user, type, ancien_valeur, nouvelle_valeur, date_modif_time)
           VALUES (?, ?, 'SMS', ?, ?, ?)`,
          [id, req.user.id, lastSms?.message || '', message, dateModif]
        );

        res.json({
          success: true,
          message: 'SMS envoyé avec succès',
          data: {
            date_modif_time: dateModif,
            statut: result.message || 'successful'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erreur lors de l\'envoi du SMS',
          data: result
        });
      }
    } catch (smsError) {
      console.error('Erreur API SMS:', smsError);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du SMS',
        error: smsError.message
      });
    }
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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
router.post('/:id/valider', authenticate, hashToIdMiddleware, checkPermissionCode('fiche_validate'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type_valid, conf_rdv_avec, conf_presence_couple } = req.body; // type_valid: "0" pour annuler, "1-Y" pour valider avec Y = conf_rdv_avec
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

    // Mettre à jour la fiche
    if (valider === 0) {
      // Annuler la validation
      await query(
        'UPDATE fiches SET valider = 0, conf_presence_couple = NULL WHERE id = ?',
        [parseInt(id)]
      );
    } else {
      // Valider
      await query(
        'UPDATE fiches SET valider = ?, conf_rdv_avec = ?, conf_presence_couple = ? WHERE id = ?',
        [valider, confRdvAvec, confPresenceCouple, parseInt(id)]
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
       AND f.date_confirmation >= ?
       AND f.date_confirmation <= ?
       AND (f.archive = 0 OR f.archive IS NULL)
       ORDER BY f.date_confirmation DESC
       LIMIT 1000`,
      [startTimestamp, endTimestamp]
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

