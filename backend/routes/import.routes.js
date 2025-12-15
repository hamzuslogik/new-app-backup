const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// Clé secrète pour encoder les IDs (doit correspondre à celle dans fiche.routes.js)
const HASH_SECRET = process.env.FICHE_HASH_SECRET || 'your-secret-key-change-in-production';

// Fonction pour encoder un ID en hash (identique à celle dans fiche.routes.js)
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

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json', '.jsonl'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez CSV, TSV, TXT, Excel (.xlsx, .xls) ou JSON/JSONL (.json, .jsonl)'));
    }
  }
});

// Fonction pour parser un fichier CSV ou TSV
const parseCSV = (filePath, isTSV = false) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    // Lire le fichier pour détecter le séparateur et l'encodage
    let fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Supprimer le BOM UTF-8 si présent
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    
    // Détecter le séparateur (tabulation, point-virgule ou virgule)
    // Compter les occurrences de chaque séparateur dans la première ligne
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      return resolve([]);
    }
    
    const firstLine = lines[0];
    let separator;
    
    if (isTSV) {
      // Fichier TSV : utiliser la tabulation
      separator = '\t';
    } else {
      // Détecter automatiquement le séparateur
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      
      // Utiliser le séparateur le plus fréquent
      if (tabCount > semicolonCount && tabCount > commaCount) {
        separator = '\t'; // Tabulation
      } else if (semicolonCount > commaCount) {
        separator = ';'; // Point-virgule
      } else {
        separator = ','; // Virgule
      }
    }
    
    // Extraire les en-têtes de la première ligne
    const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Écrire le contenu nettoyé dans un fichier temporaire
    const tempFilePath = filePath + '.temp';
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');
    
    fs.createReadStream(tempFilePath, { encoding: 'utf8' })
      .pipe(csv({
        separator: separator,
        skipEmptyLines: true,
        skipLinesWithError: true,
        headers: headers, // Utiliser les en-têtes détectés
        skipLinesWithEmptyValues: false
      }))
      .on('data', (data) => {
        // Nettoyer les clés des objets (supprimer les espaces et guillemets)
        const cleanedData = {};
        let hasValue = false;
        
        Object.keys(data).forEach(key => {
          const cleanKey = key.trim().replace(/^"|"$/g, '');
          let cleanValue = typeof data[key] === 'string' ? data[key].trim().replace(/^"|"$/g, '') : data[key];
          
          // Convertir null, undefined, 'null', 'undefined' en chaîne vide
          if (cleanValue === null || cleanValue === undefined || 
              String(cleanValue).toLowerCase() === 'null' || 
              String(cleanValue).toLowerCase() === 'undefined') {
            cleanValue = '';
          }
          
          cleanedData[cleanKey] = cleanValue;
          
          // Vérifier si cette ligne a au moins une valeur non vide
          if (cleanValue && String(cleanValue).trim() !== '') {
            hasValue = true;
          }
        });
        
        // Ne pas ajouter les lignes complètement vides
        if (hasValue) {
          results.push(cleanedData);
        }
      })
      .on('end', () => {
        // Supprimer le fichier temporaire
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        resolve(results);
      })
      .on('error', (error) => {
        // Supprimer le fichier temporaire en cas d'erreur
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        reject(error);
      });
  });
};

// Fonction pour parser un fichier Excel
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  // Utiliser la première ligne comme en-têtes
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  
  // Nettoyer les données et gérer les colonnes vides d'Excel (__EMPTY, __EMPTY_1, etc.)
  return data.map((row, index) => {
    const cleanedRow = {};
    Object.keys(row).forEach(key => {
      let cleanKey = key.trim();
      
      // Gérer les colonnes vides d'Excel (__EMPTY, __EMPTY_1, etc.)
      // Essayer de détecter le contenu réel de la colonne
      if (cleanKey.startsWith('__EMPTY') || cleanKey === '' || cleanKey === 'undefined') {
        // Pour les colonnes vides, on garde la clé mais on essaie de trouver un nom alternatif
        // En regardant la première ligne de données (index 0)
        if (index === 0 && data.length > 1) {
          // On ne peut pas vraiment deviner le nom, donc on garde la clé originale
          // mais on la marque pour traitement ultérieur
          cleanKey = `__EMPTY_${key}`;
        } else {
          cleanKey = key; // Garder la clé originale pour pouvoir mapper
        }
      }
      
      let value = row[key];
      
      // Gérer les nombres scientifiques (ex: 6.12345678e+8)
      if (typeof value === 'number' && !isNaN(value)) {
        // Si c'est un nombre très grand, c'est probablement un téléphone en notation scientifique
        if (value > 1000000000 && value < 100000000000) {
          // Convertir en entier puis en string (supprime la notation scientifique)
          value = Math.floor(value).toString();
        } else {
          value = value.toString();
        }
      } else if (value !== null && value !== undefined) {
        value = value.toString().trim();
      } else {
        value = '';
      }
      
      cleanedRow[cleanKey] = value;
    });
    return cleanedRow;
  });
};

// Fonction pour parser un fichier JSONL (JSON Lines) - chaque ligne est un objet JSON
const parseJSONL = (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Supprimer le BOM UTF-8 si présent
    let content = fileContent;
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // Diviser par lignes et parser chaque ligne comme JSON
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const results = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const parsed = JSON.parse(line);
        // S'assurer que c'est un objet
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          results.push(parsed);
        } else {
          console.warn(`Ligne ${i + 1} ignorée: n'est pas un objet JSON valide`);
        }
      } catch (parseError) {
        console.warn(`Erreur de parsing JSON ligne ${i + 1}:`, parseError.message);
        // Continuer avec les autres lignes
      }
    }
    
    return results;
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier JSONL:', error);
    throw new Error(`Erreur lors de la lecture du fichier JSONL: ${error.message}`);
  }
};

// Fonction pour parser un fichier JSON (tableau d'objets)
const parseJSON = (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Supprimer le BOM UTF-8 si présent
    let content = fileContent;
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    const parsed = JSON.parse(content);
    
    // Si c'est un tableau, retourner directement
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    // Si c'est un objet unique, le mettre dans un tableau
    if (typeof parsed === 'object' && parsed !== null) {
      return [parsed];
    }
    
    throw new Error('Le fichier JSON doit contenir un objet ou un tableau d\'objets');
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier JSON:', error);
    throw new Error(`Erreur lors de la lecture du fichier JSON: ${error.message}`);
  }
};

// Fonction pour convertir automatiquement CSV/Excel/JSON en JSONL
// Cette fonction standardise le format pour améliorer la fiabilité de l'import
const convertToJSONL = async (filePath, fileExt) => {
  try {
    console.log(`Conversion automatique vers JSONL: ${filePath} (${fileExt})`);
    
    let data = [];
    
    // Parser selon le type de fichier
    if (fileExt === '.csv' || fileExt === '.txt') {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const firstLine = fileContent.split(/\r?\n/)[0] || '';
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const isTSV = fileExt === '.tsv' || tabCount > 5;
      data = await parseCSV(filePath, isTSV);
    } else if (fileExt === '.tsv') {
      data = await parseCSV(filePath, true);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      data = parseExcel(filePath);
    } else if (fileExt === '.json') {
      // Détecter si c'est JSONL ou JSON classique
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const firstLine = fileContent.split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.startsWith('{') && firstLine.endsWith('}')) {
        try {
          JSON.parse(firstLine);
          const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
          if (lines.length > 1) {
            data = parseJSONL(filePath);
          } else {
            data = parseJSON(filePath);
          }
        } catch {
          data = parseJSON(filePath);
        }
      } else {
        data = parseJSON(filePath);
      }
    } else {
      // Si c'est déjà JSONL, pas besoin de conversion
      return filePath;
    }
    
    if (data.length === 0) {
      throw new Error('Aucune donnée trouvée dans le fichier après conversion');
    }
    
    // Nettoyer les données
    const cleanedData = data.map(row => {
      const cleaned = {};
      Object.keys(row).forEach(key => {
        let value = row[key];
        if (value !== undefined && value !== null) {
          value = String(value).trim();
          if (value === '' || value === 'null' || value === 'undefined') {
            value = '';
          }
        } else {
          value = '';
        }
        cleaned[key.trim()] = value;
      });
      return cleaned;
    }).filter(row => {
      // Filtrer les lignes complètement vides
      return Object.values(row).some(v => v !== '');
    });
    
    // Créer le fichier JSONL dans le répertoire uploads
    const tempDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Créer un nom de fichier unique pour éviter les conflits
    const convertedFileName = `converted-${Date.now()}-${Math.random().toString(36).substring(7)}.jsonl`;
    const jsonlPath = path.join(tempDir, convertedFileName);
    const jsonlContent = cleanedData.map(obj => JSON.stringify(obj)).join('\n');
    fs.writeFileSync(jsonlPath, jsonlContent, 'utf8');
    
    console.log(`✓ Fichier converti en JSONL: ${jsonlPath} (${cleanedData.length} lignes)`);
    
    return jsonlPath;
  } catch (error) {
    console.error('Erreur lors de la conversion en JSONL:', error);
    throw new Error(`Erreur lors de la conversion en JSONL: ${error.message}`);
  }
};

// Fonction pour vérifier si une ligne est un en-tête (toutes les valeurs correspondent aux clés)
const isHeaderRow = (row, headers) => {
  const rowValues = Object.values(row).map(v => String(v || '').toLowerCase().trim());
  const headerKeys = headers.map(h => String(h || '').toLowerCase().trim());
  
  // Si toutes les valeurs de la ligne correspondent aux en-têtes, c'est probablement un en-tête
  if (rowValues.length === headerKeys.length) {
    const matches = rowValues.filter((val, idx) => {
      const header = headerKeys[idx];
      return val === header || val.includes(header) || header.includes(val);
    });
    // Si plus de 50% des valeurs correspondent, c'est probablement un en-tête
    return matches.length > rowValues.length * 0.5;
  }
  return false;
};

// Fonction pour vérifier les doublons par téléphone
const checkDuplicates = async (contacts, fileColumns = []) => {
  const duplicates = [];
  const validContacts = [];
  
  console.log(`Vérification des doublons pour ${contacts.length} contacts`);
  
  // OPTIMISATION: Récupérer tous les numéros de téléphone existants en une seule requête
  // au lieu de faire une requête par contact
  // Ignorer les fiches archivées (archive = 1 ou archive > 0)
  console.log('📊 Récupération des numéros de téléphone existants dans la base...');
  const existingPhones = await query(`
    SELECT id, nom, prenom, tel, gsm1, gsm2, id_etat_final, hash,
           (SELECT titre FROM etats WHERE id = fiches.id_etat_final) as etat_titre
    FROM fiches 
    WHERE (archive = 0 OR archive IS NULL) 
    AND (tel != '' AND tel IS NOT NULL 
         OR gsm1 != '' AND gsm1 IS NOT NULL 
         OR gsm2 != '' AND gsm2 IS NOT NULL)
  `);
  
  // Créer un Map pour associer les numéros normalisés aux informations des fiches
  // IMPORTANT: Normaliser les numéros de la base de données de la même manière
  const phoneMap = new Map(); // Map<numéro_normalisé, fiche_info>
  
  existingPhones.forEach(row => {
    if (row.tel) {
      const normalizedTel = cleanPhoneNumber(row.tel);
      if (normalizedTel) {
        if (!phoneMap.has(normalizedTel)) {
          phoneMap.set(normalizedTel, {
            id: row.id,
            hash: row.hash,
            nom: row.nom,
            prenom: row.prenom,
            tel: row.tel,
            id_etat_final: row.id_etat_final,
            etat_titre: row.etat_titre
          });
        }
      }
    }
    if (row.gsm1) {
      const normalizedGsm1 = cleanPhoneNumber(row.gsm1);
      if (normalizedGsm1) {
        if (!phoneMap.has(normalizedGsm1)) {
          phoneMap.set(normalizedGsm1, {
            id: row.id,
            hash: row.hash,
            nom: row.nom,
            prenom: row.prenom,
            tel: row.tel,
            id_etat_final: row.id_etat_final,
            etat_titre: row.etat_titre
          });
        }
      }
    }
    if (row.gsm2) {
      const normalizedGsm2 = cleanPhoneNumber(row.gsm2);
      if (normalizedGsm2) {
        if (!phoneMap.has(normalizedGsm2)) {
          phoneMap.set(normalizedGsm2, {
            id: row.id,
            hash: row.hash,
            nom: row.nom,
            prenom: row.prenom,
            tel: row.tel,
            id_etat_final: row.id_etat_final,
            etat_titre: row.etat_titre
          });
        }
      }
    }
  });
  
  // Créer aussi un Set pour vérification rapide
  const phoneSet = new Set(phoneMap.keys());
  
  console.log(`✓ ${phoneSet.size} numéros de téléphone uniques trouvés dans la base (normalisés)`);
  console.log(`🔄 Vérification des doublons en cours...`);
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    
    // Ignorer les lignes qui sont probablement des en-têtes (seulement pour CSV/Excel)
    // Pour JSON/JSONL, on ne fait pas cette vérification car ils n'ont pas d'en-têtes
    if (fileColumns.length > 0 && isHeaderRow(contact, fileColumns)) {
      if (i < 3) {
        console.log(`Ligne ${i} en-tête ignorée lors de checkDuplicates`);
      }
      continue;
    }
    
    // Ignorer les lignes complètement vides
    const hasAnyValue = Object.values(contact).some(v => v && String(v).trim() !== '');
    if (!hasAnyValue) {
      if (i < 3) {
        console.log(`Ligne ${i} vide ignorée lors de checkDuplicates`);
      }
      continue;
    }
    
    // Extraire les numéros de téléphone (peuvent être dans différentes clés selon le mapping)
    // On cherche dans toutes les clés possibles
    let tel = '';
    let gsm1 = '';
    let gsm2 = '';
    
    // Chercher tel
    if (contact.tel !== undefined && contact.tel !== null) {
      tel = String(contact.tel).trim();
    } else {
      // Chercher des variantes : tel, telephone, phone, phone_number, mobile, portable, etc.
      const telVariants = ['tel', 'telephone', 'phone', 'phone_number', 'mobile', 'portable', 'numtel', 'num_tel'];
      let telKey = null;
      
      // D'abord chercher une correspondance exacte (après normalisation)
      for (const key in contact) {
        const normalizedKey = normalizeKey(key);
        if (telVariants.some(variant => normalizeKey(variant) === normalizedKey)) {
          telKey = key;
          break;
        }
      }
      
      // Si pas trouvé, chercher des clés qui contiennent "tel" ou "phone" (mais pas "gsm")
      if (!telKey) {
        const telKeys = Object.keys(contact).filter(k => {
          const normalized = normalizeKey(k);
          return (normalized.includes('tel') || normalized.includes('phone') || normalized.includes('mobile')) 
                 && !normalized.includes('gsm');
        });
        if (telKeys.length > 0) {
          telKey = telKeys[0];
        }
      }
      
      if (telKey) {
        tel = String(contact[telKey] || '').trim();
      }
    }
    
    // Chercher gsm1
    if (contact.gsm1 !== undefined && contact.gsm1 !== null) {
      gsm1 = String(contact.gsm1).trim();
    } else {
      // Chercher des variantes pour gsm1
      const gsm1Variants = ['gsm1', 'gsm', 'mobile1', 'cellphone', 'portable1', 'alt_phone', 'altphone', 'telephone2', 'tel2'];
      let gsm1Key = null;
      
      // D'abord chercher une correspondance exacte (après normalisation)
      for (const key in contact) {
        const normalizedKey = normalizeKey(key);
        if (gsm1Variants.some(variant => normalizeKey(variant) === normalizedKey)) {
          gsm1Key = key;
          break;
        }
      }
      
      // Si pas trouvé, chercher des clés qui contiennent "gsm" mais pas "gsm2"
      if (!gsm1Key) {
        const gsm1Keys = Object.keys(contact).filter(k => {
          const normalized = normalizeKey(k);
          return normalized.includes('gsm') && !normalized.includes('gsm2') && normalized !== 'gsm2';
        });
        if (gsm1Keys.length > 0) {
          gsm1Key = gsm1Keys[0];
        }
      }
      
      if (gsm1Key) {
        gsm1 = String(contact[gsm1Key] || '').trim();
      }
    }
    
    // Chercher gsm2
    if (contact.gsm2 !== undefined && contact.gsm2 !== null) {
      gsm2 = String(contact.gsm2).trim();
    } else {
      // Chercher des variantes pour gsm2
      const gsm2Variants = ['gsm2', 'mobile2', 'phone2', 'portable2', 'telephone3', 'tel3'];
      let gsm2Key = null;
      
      // D'abord chercher une correspondance exacte (après normalisation)
      for (const key in contact) {
        const normalizedKey = normalizeKey(key);
        if (gsm2Variants.some(variant => normalizeKey(variant) === normalizedKey)) {
          gsm2Key = key;
          break;
        }
      }
      
      // Si pas trouvé, chercher des clés qui contiennent "gsm2"
      if (!gsm2Key) {
        const gsm2Keys = Object.keys(contact).filter(k => normalizeKey(k) === 'gsm2');
        if (gsm2Keys.length > 0) {
          gsm2Key = gsm2Keys[0];
        }
      }
      
      if (gsm2Key) {
        gsm2 = String(contact[gsm2Key] || '').trim();
      }
    }
    
    // Log pour les premiers contacts
    if (i < 3) {
      console.log(`\n--- Contact ${i} - Recherche téléphone ---`);
      console.log(`  Clés du contact:`, Object.keys(contact));
      console.log(`  tel brut: "${tel}"`);
      console.log(`  gsm1 brut: "${gsm1}"`);
      console.log(`  gsm2 brut: "${gsm2}"`);
    }
    
    // Nettoyer les numéros de téléphone
    const telBefore = tel;
    const gsm1Before = gsm1;
    const gsm2Before = gsm2;
    tel = cleanPhoneNumber(tel);
    gsm1 = cleanPhoneNumber(gsm1);
    gsm2 = cleanPhoneNumber(gsm2);
    
    if (i < 3) {
      console.log(`  tel après nettoyage: "${tel}" (était: "${telBefore}")`);
      console.log(`  gsm1 après nettoyage: "${gsm1}" (était: "${gsm1Before}")`);
      console.log(`  gsm2 après nettoyage: "${gsm2}" (était: "${gsm2Before}")`);
    }
    
    // Si aucun numéro de téléphone valide n'est fourni, considérer comme invalide
    // Mais ne pas le mettre dans les doublons, juste l'ignorer
    if (!tel && !gsm1 && !gsm2) {
      if (i < 3) {
        console.log(`  ❌ Contact ${i} ignoré: aucun numéro de téléphone valide trouvé`);
        console.log(`  Clés du contact:`, Object.keys(contact));
        console.log(`  Valeurs:`, Object.values(contact).slice(0, 5));
      }
      
      // Extraire les informations du contact original pour l'affichage
      let contactNom = '';
      let contactPrenom = '';
      let contactTel = '';
      let contactCp = '';
      let contactVille = '';
      
      // Chercher dans toutes les clés possibles du contact
      Object.keys(contact).forEach(key => {
        const normalizedKey = normalizeKey(key);
        if (normalizedKey.includes('nom') && !normalizedKey.includes('prenom')) {
          contactNom = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('prenom') || normalizedKey.includes('firstname')) {
          contactPrenom = String(contact[key] || '').trim();
        } else if ((normalizedKey.includes('tel') || normalizedKey.includes('phone') || normalizedKey.includes('mobile'))) {
          contactTel = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('cp') || normalizedKey.includes('postal') || normalizedKey.includes('zip')) {
          contactCp = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('ville') || normalizedKey.includes('city')) {
          contactVille = String(contact[key] || '').trim();
        }
      });
      
      duplicates.push({
        ...contact,
        _extractedNom: contactNom,
        _extractedPrenom: contactPrenom,
        _extractedTel: contactTel || telBefore || '',
        _extractedCp: contactCp,
        _extractedVille: contactVille,
        reason: 'Aucun numéro de téléphone valide fourni',
        reasonType: 'no_phone',
        existingId: null
      });
      continue;
    }
    
    // Vérifier les doublons en utilisant le Set en mémoire (beaucoup plus rapide)
    let duplicateInfo = null;
    let duplicatePhone = null;
    
    if (tel && phoneSet.has(tel)) {
      duplicateInfo = phoneMap.get(tel);
      duplicatePhone = tel;
    } else if (gsm1 && phoneSet.has(gsm1)) {
      duplicateInfo = phoneMap.get(gsm1);
      duplicatePhone = gsm1;
    } else if (gsm2 && phoneSet.has(gsm2)) {
      duplicateInfo = phoneMap.get(gsm2);
      duplicatePhone = gsm2;
    }
    
    if (duplicateInfo) {
      // Extraire les informations du contact original pour l'affichage
      let contactNom = '';
      let contactPrenom = '';
      let contactTel = '';
      let contactCp = '';
      let contactVille = '';
      
      // Chercher dans toutes les clés possibles du contact
      Object.keys(contact).forEach(key => {
        const normalizedKey = normalizeKey(key);
        if (normalizedKey.includes('nom') && !normalizedKey.includes('prenom')) {
          contactNom = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('prenom') || normalizedKey.includes('firstname')) {
          contactPrenom = String(contact[key] || '').trim();
        } else if ((normalizedKey.includes('tel') || normalizedKey.includes('phone') || normalizedKey.includes('mobile')) && !normalizedKey.includes('gsm')) {
          contactTel = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('cp') || normalizedKey.includes('postal') || normalizedKey.includes('zip')) {
          contactCp = String(contact[key] || '').trim();
        } else if (normalizedKey.includes('ville') || normalizedKey.includes('city')) {
          contactVille = String(contact[key] || '').trim();
        }
      });
      
      // Si on n'a pas trouvé de tel dans les clés, utiliser les valeurs extraites
      if (!contactTel) {
        contactTel = telBefore || tel || gsm1Before || gsm1 || gsm2Before || gsm2 || '';
      }
      
      duplicates.push({
        ...contact,
        _extractedNom: contactNom,
        _extractedPrenom: contactPrenom,
        _extractedTel: contactTel || telBefore || tel || gsm1Before || gsm1 || gsm2Before || gsm2 || '',
        _extractedCp: contactCp,
        _extractedVille: contactVille,
        reason: 'Doublon - Contact existant dans la base de données',
        reasonType: 'duplicate',
        duplicatePhone: duplicatePhone,
        existingFiche: {
          id: duplicateInfo.id,
          hash: duplicateInfo.hash,
          nom: duplicateInfo.nom || '',
          prenom: duplicateInfo.prenom || '',
          tel: duplicateInfo.tel || '',
          id_etat_final: duplicateInfo.id_etat_final || null,
          etat_titre: duplicateInfo.etat_titre || 'Non défini'
        }
      });
    } else {
      validContacts.push(contact);
    }
    
    // Afficher la progression tous les 500 contacts
    if ((i + 1) % 500 === 0 || i === contacts.length - 1) {
      console.log(`  Progression: ${i + 1}/${contacts.length} contacts vérifiés (${validContacts.length} valides, ${duplicates.length} doublons)`);
    }
  }
  
  return { duplicates, validContacts };
};

// Fonction pour normaliser les clés (supprimer espaces, guillemets, accents, etc.)
const normalizeKey = (key) => {
  if (!key) return '';
  let normalized = key.toString().trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ').toLowerCase();
  
  // Supprimer les accents
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Supprimer les caractères spéciaux courants
  normalized = normalized.replace(/[._-]/g, '');
  
  // Supprimer les préfixes/suffixes courants
  normalized = normalized.replace(/^(colonne|column|champ|field|header|en-tête|entete)\s*/i, '');
  normalized = normalized.replace(/\s*(colonne|column|champ|field|header|en-tête|entete)$/i, '');
  
  return normalized;
};

// Fonction pour nettoyer les numéros de téléphone
const cleanPhoneNumber = (phone) => {
  // Gérer les cas null/undefined
  if (phone === null || phone === undefined) return '';
  
  // Convertir en string en préservant le format original
  let cleaned = String(phone).trim();
  
  // Si c'est vide après trim, retourner vide
  if (cleaned === '' || cleaned === 'null' || cleaned === 'undefined' || cleaned === 'N/A') {
    return '';
  }
  
  // Gérer la notation scientifique (ex: 6.12345678e+8)
  if (cleaned.includes('e+') || cleaned.includes('E+')) {
    try {
      const numValue = parseFloat(cleaned);
      if (!isNaN(numValue)) {
        // Si c'est un nombre très grand, c'est probablement un téléphone en notation scientifique
        if (numValue > 1000000000 && numValue < 100000000000) {
          // Convertir en string sans notation scientifique
          cleaned = numValue.toFixed(0);
        } else {
          // Pour les autres cas, essayer quand même
          cleaned = numValue.toString();
        }
      }
    } catch (e) {
      console.log('Erreur conversion notation scientifique:', e);
      return '';
    }
  }
  
  // Si c'est un nombre pur (pas une string), le convertir en string
  // MAIS attention : si c'est un nombre qui commence par 0, il sera perdu
  // Donc on préfère travailler avec la string originale
  if (typeof phone === 'number' && !cleaned.includes('e+') && !cleaned.includes('E+')) {
    // Si le nombre est très grand, c'est probablement un téléphone sans le 0 initial
    // Sinon, on le convertit normalement
    if (phone > 1000000000 && phone < 100000000000) {
      // C'est probablement un téléphone français sans le 0 (ex: 612345678 au lieu de 0612345678)
      // On garde tel quel
      cleaned = phone.toString();
    } else {
      // Pour les petits nombres, on garde tel quel
      cleaned = phone.toString();
    }
  }
  
  // Nettoyer mais garder les chiffres et le + au début
  const hasPlus = cleaned.startsWith('+');
  const digitsBefore = cleaned.replace(/[^\d+]/g, '');
  
  // Si on avait un + au début, le remettre
  if (hasPlus && !digitsBefore.startsWith('+')) {
    cleaned = '+' + digitsBefore.replace(/\+/g, '');
  } else {
    // Sinon, enlever tous les + sauf au début
    cleaned = digitsBefore.replace(/\+/g, '');
  }
  
  // Vérifier qu'il reste des chiffres (au moins 8 chiffres pour un numéro valide)
  let digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return '';
  }
  
  // Accepter les numéros avec au moins 8 chiffres (numéros français valides)
  // Les numéros français peuvent avoir 10 chiffres (avec 0) ou 9 chiffres (sans 0)
  if (digitsOnly.length < 8) {
    console.log(`⚠ Numéro de téléphone trop court (${digitsOnly.length} chiffres): "${cleaned}"`);
    // On accepte quand même, peut-être que c'est un numéro international
  }
  
  // IMPORTANT: Si c'est un numéro français (9 chiffres sans 0 initial), ajouter le 0
  // Les numéros français ont 10 chiffres avec le 0 initial, ou 9 chiffres sans
  // Les numéros français commencent par 0 (fixe) ou 6/7 (mobile)
  if (digitsOnly.length === 9) {
    // Numéro à 9 chiffres sans 0 initial - c'est un numéro français, ajouter le 0
    digitsOnly = '0' + digitsOnly;
  } else if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
    // Numéro à 10 chiffres qui ne commence pas par 0 - peut-être un numéro international
    // On garde tel quel
  } else if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    // Numéro à 10 chiffres avec 0 - c'est bon
  } else if (digitsOnly.length > 10) {
    // Numéro international (plus de 10 chiffres) - on garde tel quel
  }
  
  return digitsOnly;
};

// Fonction pour trouver une clé dans un objet (insensible à la casse, espaces, accents)
const findKeyInObject = (obj, targetKey) => {
  if (!targetKey || !obj) return null;
  
  const normalizedTarget = normalizeKey(targetKey);
  
  // D'abord, chercher une correspondance exacte (après normalisation)
  for (const key in obj) {
    if (normalizeKey(key) === normalizedTarget) {
      return key;
    }
  }
  
  // Ensuite, chercher des variantes communes pour les champs de téléphone
  const commonVariants = {
    'tel': ['telephone', 'phone', 'tel', 'gsm', 'mobile', 'portable', 'numtel', 'num_tel'],
    'gsm1': ['gsm1', 'gsm', 'mobile1', 'cellphone', 'portable1', 'alt_phone', 'altphone', 'telephone2', 'tel2'],
    'gsm2': ['gsm2', 'mobile2', 'phone2', 'portable2', 'telephone3', 'tel3']
  };
  
  // Détecter si on cherche un champ de téléphone
  const targetLower = targetKey.toLowerCase();
  let variantsToCheck = [];
  
  if (commonVariants.tel.some(v => normalizeKey(v) === normalizedTarget)) {
    variantsToCheck = commonVariants.tel;
  } else if (commonVariants.gsm1.some(v => normalizeKey(v) === normalizedTarget)) {
    variantsToCheck = commonVariants.gsm1;
  } else if (commonVariants.gsm2.some(v => normalizeKey(v) === normalizedTarget)) {
    variantsToCheck = commonVariants.gsm2;
  }
  
  // Chercher avec les variantes
  if (variantsToCheck.length > 0) {
    for (const variant of variantsToCheck) {
      const normalizedVariant = normalizeKey(variant);
      for (const key in obj) {
        if (normalizeKey(key) === normalizedVariant) {
          return key;
        }
      }
    }
  }
  
  // Liste des variantes possibles pour les autres champs courants
  const fieldVariants = {
    'nom': ['nom', 'name', 'lastname', 'last_name', 'surname', 'familyname'],
    'prenom': ['prenom', 'firstname', 'first_name', 'givenname'],
    'adresse': ['adresse', 'address', 'address1', 'street', 'rue'],
    'cp': ['cp', 'postal_code', 'postalcode', 'zip', 'zipcode', 'code_postal'],
    'ville': ['ville', 'city', 'town', 'commune']
  };
  
  // Obtenir les variantes pour le champ cible
  const variants = fieldVariants[targetLower] || [];
  
  // Chercher avec les variantes des autres champs
  for (const variant of variants) {
    const normalizedVariant = normalizeKey(variant);
    for (const key in obj) {
      if (normalizeKey(key) === normalizedVariant) {
        return key;
      }
    }
  }
  
  // En dernier recours, essayer une correspondance partielle (mais plus stricte)
  for (const key in obj) {
    const normalizedKey = normalizeKey(key);
    // Correspondance partielle seulement si la différence de longueur est < 30%
    const lengthDiff = Math.abs(normalizedKey.length - normalizedTarget.length);
    const maxLength = Math.max(normalizedKey.length, normalizedTarget.length);
    if (maxLength > 0 && lengthDiff / maxLength < 0.3) {
      if (normalizedKey.includes(normalizedTarget) || normalizedTarget.includes(normalizedKey)) {
        // Vérifier que ce n'est pas un faux positif (ex: "intitule" contient "tel")
        // On accepte seulement si c'est au début ou à la fin
        if (normalizedKey.startsWith(normalizedTarget) || normalizedKey.endsWith(normalizedTarget) ||
            normalizedTarget.startsWith(normalizedKey) || normalizedTarget.endsWith(normalizedKey)) {
          return key;
        }
      }
    }
  }
  
  return null;
};

// Fonction pour insérer une fiche
const insertFiche = async (contact, mapping, userId, idCentre, produitId = null) => {
  // Variable statique pour logger seulement le premier contact
  const isFirstContact = !insertFiche.firstContactLogged;
  if (isFirstContact) {
    insertFiche.firstContactLogged = true;
    console.log('=== DÉBUT INSERT FICHE (PREMIER CONTACT) ===');
    console.log('Mapping:', JSON.stringify(mapping, null, 2));
    console.log('Contact keys:', Object.keys(contact));
    console.log('Contact:', JSON.stringify(contact, null, 2));
  }
  
  const now = Math.floor(Date.now() / 1000);
  const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  // Filtrer le mapping pour enlever les colonnes problématiques
  const filteredMapping = { ...mapping };
  if (filteredMapping.date_modif) {
    if (isFirstContact) {
      console.log('Colonne date_modif ignorée car elle n\'existe pas dans la table');
    }
    delete filteredMapping.date_modif;
  }
  
  const ficheData = {};
  
  // Mapper les champs
  Object.keys(filteredMapping).forEach(dbField => {
    const fileColumn = filteredMapping[dbField];
    if (fileColumn && fileColumn.trim() !== '') {
      
      // Méthode de recherche améliorée
      let value = null;
      let sourceKey = null;
      
      // 1. Essayer la clé exacte d'abord (sensible à la casse)
      if (contact[fileColumn] !== undefined && contact[fileColumn] !== null) {
        value = contact[fileColumn];
        sourceKey = fileColumn;
      } 
      // 2. Essayer avec findKeyInObject (insensible à la casse et aux accents)
      else {
        const foundKey = findKeyInObject(contact, fileColumn);
        if (foundKey && contact[foundKey] !== undefined && contact[foundKey] !== null) {
          value = contact[foundKey];
          sourceKey = foundKey;
        }
      }
      
      // 3. Pour les champs de téléphone, essayer aussi une recherche plus large
      // si les méthodes précédentes n'ont pas fonctionné
      if (!value && (dbField === 'tel' || dbField === 'gsm1' || dbField === 'gsm2')) {
        // Chercher dans toutes les clés du contact pour trouver un numéro de téléphone
        for (const key in contact) {
          const keyNormalized = normalizeKey(key);
          const fileColumnNormalized = normalizeKey(fileColumn);
          
          // Si la clé normalisée correspond à la colonne normalisée
          if (keyNormalized === fileColumnNormalized) {
            const testValue = contact[key];
            if (testValue !== undefined && testValue !== null && String(testValue).trim() !== '') {
              // Vérifier si ça ressemble à un numéro de téléphone
              const testStr = String(testValue).trim();
              const digits = testStr.replace(/\D/g, '');
              if (digits.length >= 8) {
                value = testValue;
                sourceKey = key;
                if (isFirstContact) {
                  console.log(`  🔍 Recherche élargie: trouvé ${dbField} dans "${key}"`);
                }
                break;
              }
            }
          }
        }
      }
      
      // Log pour le premier contact et les champs importants
      if (isFirstContact && (dbField === 'tel' || dbField === 'gsm1' || dbField === 'gsm2')) {
        console.log(`\n--- Recherche ${dbField} ---`);
        console.log(`Colonne mappée: "${fileColumn}"`);
        console.log(`Clé trouvée: "${sourceKey}", valeur brute: "${value}" (type: ${typeof value})`);
      }
      
      if (value !== null && value !== undefined) {
        // Convertir en string si nécessaire et nettoyer
        const originalValue = value;
        value = String(value).trim();
        
        // Log pour les téléphones avant nettoyage
        if (isFirstContact && (dbField === 'tel' || dbField === 'gsm1' || dbField === 'gsm2')) {
          console.log(`  Valeur après trim: "${value}"`);
        }
        
        // Ignorer les valeurs vides (sauf pour les champs numériques qui peuvent être 0)
        if (value === '' || value === 'null' || value === 'undefined' || value === 'N/A') {
          // Pour les champs numériques, on peut avoir 0 comme valeur valide
          if (!dbField.includes('id_') && dbField !== 'produit' && dbField !== 'etude' && dbField !== 'archive' && 
              dbField !== 'nb_pieces' && dbField !== 'annee_systeme_chauffage') {
            if (isFirstContact && (dbField === 'tel' || dbField === 'gsm1' || dbField === 'gsm2')) {
              console.log(`  ⚠ Valeur vide ignorée pour ${dbField}`);
            }
            return; // Ignorer cette valeur vide
          }
        }
        
        // Nettoyer les numéros de téléphone
        if (dbField === 'tel' || dbField === 'gsm1' || dbField === 'gsm2') {
          const beforeClean = value;
          value = cleanPhoneNumber(value);
          if (isFirstContact) {
            console.log(`  Nettoyage: "${beforeClean}" -> "${value}"`);
          }
          if (!value || value === '') {
            if (isFirstContact) {
              console.log(`  ❌ ATTENTION: ${dbField} devient vide après nettoyage (original: "${originalValue}")`);
            }
            return; // Ignorer cette valeur
          }
          if (isFirstContact) {
            console.log(`  ✓ ${dbField} nettoyé avec succès: "${value}"`);
          }
        }
        
        // Convertir les valeurs numériques (après nettoyage des téléphones)
        if (dbField.includes('id_') || dbField === 'produit' || dbField === 'etude' || dbField === 'archive' || 
            dbField === 'nb_pieces' || dbField === 'annee_systeme_chauffage') {
          if (value !== '' && value !== 'null' && value !== 'undefined' && value !== 'N/A') {
            value = parseInt(value);
            if (isNaN(value)) {
              value = null;
            }
          } else {
            value = null;
          }
        }
        
        if (dbField.includes('date_') && !dbField.includes('_time')) {
          // Si c'est une date (sans heure), convertir en timestamp
          if (value && typeof value === 'string' && value !== '' && value !== 'null' && value !== 'undefined') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = Math.floor(date.getTime() / 1000);
            } else {
              value = null;
            }
          } else if (value && typeof value === 'number') {
            // Si c'est déjà un timestamp
            value = Math.floor(value);
          } else {
            value = null;
          }
        }
        
        // Ajouter la valeur à ficheData si elle n'est pas null/vide
        if (value !== null && value !== '' && value !== undefined) {
          ficheData[dbField] = value;
        }
      }
    }
  });
  
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
      if (isFirstContact) {
        console.log(`✓ Code postal normalisé: "${cpStr}" -> "${ficheData.cp}"`);
      }
    } else if (cpDigits.length === 5) {
      // Si exactement 5 chiffres, accepter tel quel
      ficheData.cp = cpDigits;
    } else {
      // Si moins de 4 chiffres ou plus de 5 chiffres, rejeter
      throw new Error(`Code postal invalide : "${cpStr}" (doit contenir 4 ou 5 chiffres. Les codes de 4 chiffres seront complétés avec un 0 devant)`);
    }
  }

  // Valeurs par défaut obligatoires
  // Toujours utiliser l'ID de l'utilisateur connecté comme id_agent
  ficheData.id_agent = userId;
  // Toujours utiliser le centre sélectionné
  ficheData.id_centre = idCentre;
  // Utiliser le produit sélectionné si fourni et si le mapping ne contient pas déjà un produit
  if (produitId && !ficheData.produit) {
    ficheData.produit = parseInt(produitId);
  }
  ficheData.date_insert = now;
  ficheData.date_insert_time = nowTime;
  // Note: La table fiches n'a pas de colonne date_modif (bigint), seulement date_modif_time (datetime)
  ficheData.date_modif_time = nowTime; // DateTime de modification
  ficheData.archive = 0;
  ficheData.active = 1; // Par défaut, la fiche est active
  ficheData.ko = 0;
  ficheData.hc = 0;
  ficheData.valider = 0;
  
  // Définir l'état initial à "EN-ATTENTE"
  // Récupérer l'ID de l'état "EN-ATTENTE" depuis la base de données
  try {
    const etatEnAttente = await queryOne('SELECT id FROM etats WHERE titre = ? LIMIT 1', ['EN-ATTENTE']);
    if (etatEnAttente && etatEnAttente.id) {
      ficheData.id_etat_final = etatEnAttente.id;
      if (isFirstContact) {
        console.log(`✓ État initial défini: EN-ATTENTE (ID: ${etatEnAttente.id})`);
      }
    } else {
      // Si l'état "EN-ATTENTE" n'existe pas, essayer avec des variantes
      const etatVariants = await queryOne('SELECT id FROM etats WHERE UPPER(titre) LIKE ? OR UPPER(titre) = ? LIMIT 1', 
        ['%ATTENTE%', 'EN ATTENTE']);
      if (etatVariants && etatVariants.id) {
        ficheData.id_etat_final = etatVariants.id;
        if (isFirstContact) {
          console.log(`✓ État initial défini: ${etatVariants.titre || 'EN-ATTENTE'} (ID: ${etatVariants.id})`);
        }
      } else {
        console.warn('⚠ État "EN-ATTENTE" non trouvé dans la base de données. La fiche sera créée sans état initial.');
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'état EN-ATTENTE:', error);
    // Continuer sans définir l'état si erreur
  }
  
  // Vérifier que tel est présent (obligatoire dans la logique métier)
  // Mais on accepte aussi gsm1 ou gsm2 comme alternative
  const hasPhone = (ficheData.tel && ficheData.tel !== '') || 
                   (ficheData.gsm1 && ficheData.gsm1 !== '') || 
                   (ficheData.gsm2 && ficheData.gsm2 !== '');
  
  if (!hasPhone) {
    // Construire un message d'erreur détaillé
    let errorDetails = [];
    
    // Vérifier tel
    if (filteredMapping.tel) {
      const foundKey = findKeyInObject(contact, filteredMapping.tel);
      const value = foundKey ? contact[foundKey] : contact[filteredMapping.tel];
      errorDetails.push(`tel (colonne "${filteredMapping.tel}"): ${value || 'vide'}`);
    } else {
      errorDetails.push('tel: non mappé');
    }
    
    // Vérifier gsm1
    if (filteredMapping.gsm1) {
      const foundKey = findKeyInObject(contact, filteredMapping.gsm1);
      const value = foundKey ? contact[foundKey] : contact[filteredMapping.gsm1];
      errorDetails.push(`gsm1 (colonne "${filteredMapping.gsm1}"): ${value || 'vide'}`);
    } else {
      errorDetails.push('gsm1: non mappé');
    }
    
    // Vérifier gsm2
    if (filteredMapping.gsm2) {
      const foundKey = findKeyInObject(contact, filteredMapping.gsm2);
      const value = foundKey ? contact[foundKey] : contact[filteredMapping.gsm2];
      errorDetails.push(`gsm2 (colonne "${filteredMapping.gsm2}"): ${value || 'vide'}`);
    } else {
      errorDetails.push('gsm2: non mappé');
    }
    
    const errorMessage = `Au moins un numéro de téléphone (tel, gsm1 ou gsm2) est obligatoire. Détails: ${errorDetails.join('; ')}`;
    
    // Log pour débogage détaillé (seulement pour le premier contact)
    if (isFirstContact) {
      console.log('=== ERREUR: tel manquant ===');
      console.log('Mapping:', JSON.stringify(filteredMapping, null, 2));
      console.log('Contact complet:', JSON.stringify(contact, null, 2));
      console.log('Clés du contact:', Object.keys(contact));
      console.log('FicheData construite:', JSON.stringify(ficheData, null, 2));
      console.log('=== FIN ERREUR ===');
    }
    
    throw new Error(errorMessage);
  }
  
  // Construire et exécuter la requête
  const fields = Object.keys(ficheData);
  const values = fields.map(field => ficheData[field]);
  const placeholders = fields.map(() => '?').join(', ');
  
  const sql = `INSERT INTO fiches (${fields.join(', ')}) VALUES (${placeholders})`;
  
  if (isFirstContact) {
    console.log('Requête SQL:', sql);
    console.log('Valeurs:', values);
    console.log('=== FIN INSERT FICHE (PREMIER CONTACT) ===\n');
  }
  
  try {
    const result = await query(sql, values);
    const insertId = result.insertId;
    
    // Calculer et stocker le hash de l'ID (toujours calculé pour chaque nouvelle fiche)
    if (insertId) {
      const hash = encodeFicheId(insertId);
      await query('UPDATE fiches SET hash = ? WHERE id = ?', [hash, insertId]);
      
      if (isFirstContact) {
        console.log(`✓ Hash calculé et stocké pour la fiche ID ${insertId}: ${hash}`);
      }
    } else {
      throw new Error('Impossible de récupérer l\'ID de la fiche insérée');
    }
    
    return true;
  } catch (sqlError) {
    // Log détaillé de l'erreur SQL
    console.error('Erreur SQL lors de l\'insertion:');
    console.error('SQL:', sql);
    console.error('Valeurs:', values);
    console.error('Erreur:', sqlError.message);
    console.error('Code erreur:', sqlError.code);
    throw new Error(`Erreur SQL: ${sqlError.message}`);
  }
};

// Initialiser le flag pour le premier contact (sera réinitialisé à chaque import)
insertFiche.firstContactLogged = false;

// Fonction pour réinitialiser le flag (appelée au début de chaque import)
const resetInsertFicheLog = () => {
  insertFiche.firstContactLogged = false;
};

// POST /api/import/preview
// Prévisualiser le fichier et détecter les colonnes
router.post('/preview', authenticate, checkPermissionCode('fiches_create'), upload.single('file'), async (req, res) => {
  let originalFilePath = null;
  let convertedFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    originalFilePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    // Convertir automatiquement en JSONL si ce n'est pas déjà du JSONL
    // Cela standardise le format et améliore la fiabilité de l'import
    if (fileExt !== '.jsonl') {
      console.log(`🔄 Conversion automatique de ${fileExt} vers JSONL...`);
      try {
        convertedFilePath = await convertToJSONL(originalFilePath, fileExt);
        console.log(`✓ Conversion réussie: ${convertedFilePath}`);
        
        // Supprimer le fichier original après conversion (sauf si c'est déjà JSONL)
        if (originalFilePath !== convertedFilePath && fs.existsSync(originalFilePath)) {
          fs.unlinkSync(originalFilePath);
          console.log(`✓ Fichier original supprimé: ${originalFilePath}`);
        }
      } catch (conversionError) {
        console.error('❌ Erreur lors de la conversion:', conversionError);
        throw new Error(`Erreur lors de la conversion du fichier: ${conversionError.message}`);
      }
    } else {
      convertedFilePath = originalFilePath;
      console.log(`✓ Fichier déjà en JSONL, pas de conversion nécessaire`);
    }
    
    // Vérifier que le fichier converti existe
    if (!fs.existsSync(convertedFilePath)) {
      throw new Error(`Le fichier converti n'existe pas: ${convertedFilePath}`);
    }
    
    // Maintenant, parser uniquement le fichier JSONL (standardisé)
    let data = [];
    try {
      data = parseJSONL(convertedFilePath);
      console.log(`✓ Fichier JSONL parsé: ${data.length} lignes`);
    } catch (parseError) {
      console.error('❌ Erreur lors du parsing JSONL:', parseError);
      throw new Error(`Erreur lors du parsing du fichier JSONL: ${parseError.message}`);
    }

    // Filtrer les lignes vides (les fichiers JSONL n'ont pas d'en-têtes comme les CSV)
    const filteredData = data.filter((row, index) => {
      // Ignorer les lignes complètement vides
      const hasValue = Object.values(row).some(v => {
        const val = String(v || '').trim();
        return val !== '' && val !== 'null' && val !== 'undefined';
      });
      
      if (!hasValue) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée: complètement vide`);
        }
        return false;
      }
      
      // Pour JSONL, on ne filtre pas les en-têtes car ils n'en ont généralement pas
      // On vérifie seulement que c'est un objet valide
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée: n'est pas un objet valide`);
        }
        return false;
      }
      
      return true;
    });
    
    console.log(`Données parsées: ${data.length} lignes, ${filteredData.length} lignes valides après filtrage`);
    
    // Limiter à 100 lignes pour la prévisualisation
    const previewData = filteredData.slice(0, 100);
    
    // Détecter les colonnes du fichier (depuis les données filtrées)
    const fileColumns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
    
    console.log('Colonnes détectées dans le fichier:', fileColumns);
    
    // Récupérer les champs disponibles de la table fiches
    const ficheFields = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = SCHEMA()
      AND TABLE_NAME = 'fiches'
      AND COLUMN_NAME NOT IN ('id', 'date_insert', 'date_insert_time', 'date_modif', 'date_modif_time', 'archive')
      ORDER BY ORDINAL_POSITION
    `);
    
    // Stocker le chemin du fichier JSONL converti (on va utiliser un fichier temporaire avec l'ID de l'utilisateur)
    const tempFileName = `import-${req.user.id}-${Date.now()}.jsonl`;
    const tempFilePath = path.join(__dirname, '../../uploads', tempFileName);
    // Stocker les données filtrées en format JSONL (sans les lignes vides)
    const jsonlContent = filteredData.map(obj => JSON.stringify(obj)).join('\n');
    fs.writeFileSync(tempFilePath, jsonlContent, 'utf8');
    console.log(`✓ Fichier temporaire JSONL créé: ${tempFileName} avec ${filteredData.length} lignes`);
    
    // Supprimer le fichier converti intermédiaire s'il existe et est différent
    if (convertedFilePath && convertedFilePath !== tempFilePath && fs.existsSync(convertedFilePath)) {
      fs.unlinkSync(convertedFilePath);
    }
    
    res.json({
      success: true,
      data: {
        fileColumns,
        previewData,
        totalRows: data.length,
        tempFile: tempFileName
      },
      fields: ficheFields.map(f => ({
        name: f.COLUMN_NAME,
        type: f.COLUMN_TYPE,
        nullable: f.IS_NULLABLE === 'YES',
        default: f.COLUMN_DEFAULT
      }))
    });
  } catch (error) {
    console.error('❌ Erreur lors de la prévisualisation:', error);
    console.error('Stack trace:', error.stack);
    // Nettoyer les fichiers temporaires en cas d'erreur
    if (originalFilePath && fs.existsSync(originalFilePath)) {
      try {
        fs.unlinkSync(originalFilePath);
        console.log(`✓ Fichier original nettoyé: ${originalFilePath}`);
      } catch (cleanupError) {
        console.error('Erreur lors du nettoyage du fichier original:', cleanupError);
      }
    }
    if (convertedFilePath && convertedFilePath !== originalFilePath && fs.existsSync(convertedFilePath)) {
      try {
        fs.unlinkSync(convertedFilePath);
        console.log(`✓ Fichier converti nettoyé: ${convertedFilePath}`);
      } catch (cleanupError) {
        console.error('Erreur lors du nettoyage du fichier converti:', cleanupError);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la lecture du fichier',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/import/process
// Traiter l'import avec le mapping fourni
router.post('/process', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const { mapping, tempFile, skipDuplicates, id_centre, produit } = req.body;
    
    if (!mapping || !tempFile) {
      return res.status(400).json({
        success: false,
        message: 'Mapping et fichier temporaire requis'
      });
    }

    // Vérifier que le centre est fourni
    const centreId = id_centre || req.user.centre;
    if (!centreId) {
      return res.status(400).json({
        success: false,
        message: 'Centre requis'
      });
    }

    // Vérifier que le produit est fourni
    if (!produit) {
      return res.status(400).json({
        success: false,
        message: 'Produit requis'
      });
    }

    // Vérifier que le centre existe et est actif
    const centre = await queryOne('SELECT id, etat FROM centres WHERE id = ?', [centreId]);
    if (!centre || centre.etat === 0) {
      return res.status(400).json({
        success: false,
        message: 'Centre invalide ou désactivé'
      });
    }

    // Vérifier que le produit existe
    const produitData = await queryOne('SELECT id FROM produits WHERE id = ?', [parseInt(produit)]);
    if (!produitData) {
      return res.status(400).json({
        success: false,
        message: 'Produit invalide'
      });
    }

    // Charger les données du fichier temporaire
    const tempFilePath = path.join(__dirname, '../../uploads', tempFile);
    if (!fs.existsSync(tempFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier temporaire non trouvé'
      });
    }

    // Le fichier temporaire est maintenant en format JSONL (converti automatiquement)
    let data = [];
    if (tempFile.endsWith('.jsonl')) {
      // Parser le fichier JSONL
      data = parseJSONL(tempFilePath);
      console.log(`✓ Fichier JSONL chargé: ${data.length} lignes`);
    } else {
      // Compatibilité avec les anciens fichiers JSON
      data = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
      console.log(`✓ Fichier JSON chargé (ancien format): ${data.length} lignes`);
    }
    
    // Récupérer les colonnes du fichier depuis le mapping (pour détecter les en-têtes)
    const fileColumns = Object.values(mapping).filter(col => col && col !== '');
    
    // Filtrer les lignes vides ou invalides avant de vérifier les doublons
    // Les données viennent déjà du fichier temporaire qui a été filtré lors de la prévisualisation
    // Mais on refait un filtrage léger pour s'assurer
    const filteredData = data.filter((contact, index) => {
      // Ignorer les lignes complètement vides
      const hasAnyValue = Object.values(contact).some(v => {
        const val = String(v || '').trim();
        return val !== '' && val !== 'null' && val !== 'undefined';
      });
      
      if (!hasAnyValue) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée lors du process: complètement vide`);
        }
        return false;
      }
      
      // Pour les fichiers JSON/JSONL, on ne filtre pas les en-têtes car ils n'en ont généralement pas
      // On vérifie seulement si c'est un objet valide
      if (typeof contact !== 'object' || contact === null || Array.isArray(contact)) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée: n'est pas un objet valide`);
        }
        return false;
      }
      
      // Pour CSV/Excel, détecter si c'est une ligne d'en-têtes (mais moins agressif)
      const keys = Object.keys(contact);
      if (keys.length < 2) {
        // Si moins de 2 clés, probablement pas une ligne valide
        return false;
      }
      
      // Détecter les en-têtes seulement si on a au moins 3 colonnes et que 90%+ correspondent
      // (plus strict pour éviter les faux positifs)
      if (keys.length >= 3) {
        let matchingKeys = 0;
        for (const key of keys) {
          const value = String(contact[key] || '').trim();
          const normalizedKey = normalizeKey(key);
          const normalizedValue = normalizeKey(value);
          // Si la valeur correspond exactement à la clé (après normalisation), c'est probablement un en-tête
          if (normalizedValue === normalizedKey || value === key) {
            matchingKeys++;
          }
        }
        
        // Si plus de 90% des valeurs correspondent aux clés ET qu'on a au moins 3 colonnes, c'est une ligne d'en-têtes
        if (matchingKeys > keys.length * 0.9) {
          if (index < 3) {
            console.log(`Ligne ${index} détectée comme en-tête lors du process (${matchingKeys}/${keys.length} correspondances)`);
          }
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Données filtrées: ${filteredData.length} lignes valides sur ${data.length} lignes totales`);
    
    // Vérifier les doublons si demandé
    let duplicates = [];
    let validContacts = filteredData;
    
    if (!skipDuplicates) {
      const duplicateCheck = await checkDuplicates(validContacts, fileColumns);
      duplicates = duplicateCheck.duplicates;
      validContacts = duplicateCheck.validContacts;
      console.log(`${duplicates.length} doublons détectés, ${validContacts.length} contacts valides à insérer`);
    } else {
      console.log('Vérification des doublons ignorée (skipDuplicates = true)');
    }
    
    // Réinitialiser le flag de log pour le premier contact
    resetInsertFicheLog();
    
    // Log pour le premier contact avant insertion
    if (validContacts.length > 0) {
      console.log('\n=== PREMIER CONTACT AVANT INSERTION ===');
      console.log('Contact:', JSON.stringify(validContacts[0], null, 2));
      console.log('Mapping:', JSON.stringify(mapping, null, 2));
      console.log('Clés du contact:', Object.keys(validContacts[0]));
      console.log('=== FIN PREMIER CONTACT ===\n');
    }
    
    // Insérer les contacts valides
    console.log(`\n🚀 Début de l'insertion de ${validContacts.length} contacts dans la base de données...`);
    let inserted = 0;
    const errors = [];
    const invalidPostalCodes = []; // Contacts avec code postal invalide
    const otherErrors = []; // Autres erreurs
    const startTime = Date.now();
    
    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i];
      try {
        await insertFiche(contact, mapping, req.user.id, centreId, produit);
        inserted++;
        
        // Afficher la progression tous les 100 contacts (ou tous les 10 pour les petits imports)
        const progressInterval = validContacts.length > 100 ? 100 : 10;
        if ((i + 1) % progressInterval === 0 || i === validContacts.length - 1) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = ((i + 1) / elapsed).toFixed(1);
          const remaining = validContacts.length - (i + 1);
          const estimatedTime = remaining > 0 ? ((remaining / rate) / 60).toFixed(1) : 0;
          console.log(`📊 Progression: ${i + 1}/${validContacts.length} contacts insérés (${inserted} réussis, ${errors.length} erreurs) - ${rate} contacts/sec - Temps estimé restant: ${estimatedTime} min`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'insertion du contact ${i + 1}:`, error.message);
        
        // Extraire les informations du contact pour l'affichage
        let contactInfo = {
          nom: '',
          prenom: '',
          tel: '',
          cp: '',
          ville: ''
        };
        
        // Essayer de récupérer les infos via le mapping
        if (mapping.nom) {
          const foundKey = findKeyInObject(contact, mapping.nom);
          contactInfo.nom = foundKey ? (contact[foundKey] || '') : (contact[mapping.nom] || '');
        }
        if (mapping.prenom) {
          const foundKey = findKeyInObject(contact, mapping.prenom);
          contactInfo.prenom = foundKey ? (contact[foundKey] || '') : (contact[mapping.prenom] || '');
        }
        if (mapping.tel) {
          const foundKey = findKeyInObject(contact, mapping.tel);
          contactInfo.tel = foundKey ? (contact[foundKey] || '') : (contact[mapping.tel] || '');
        } else if (mapping.gsm1) {
          const foundKey = findKeyInObject(contact, mapping.gsm1);
          contactInfo.tel = foundKey ? (contact[foundKey] || '') : (contact[mapping.gsm1] || '');
        }
        if (mapping.cp) {
          const foundKey = findKeyInObject(contact, mapping.cp);
          contactInfo.cp = foundKey ? (contact[foundKey] || '') : (contact[mapping.cp] || '');
        }
        if (mapping.ville) {
          const foundKey = findKeyInObject(contact, mapping.ville);
          contactInfo.ville = foundKey ? (contact[foundKey] || '') : (contact[mapping.ville] || '');
        }
        
        // Catégoriser les erreurs
        if (error.message.includes('Code postal invalide')) {
          invalidPostalCodes.push({
            ...contactInfo,
            contact: contact,
            reason: error.message,
            reasonType: 'invalid_postal_code'
          });
        } else {
          otherErrors.push({
            ...contactInfo,
            contact: contact,
            reason: error.message,
            reasonType: 'other_error'
          });
        }
        
        errors.push({
          index: i + 1,
          contact: contactInfo,
          error: error.message,
          reasonType: error.message.includes('Code postal invalide') ? 'invalid_postal_code' : 'other_error'
        });
        
        // Afficher aussi la progression en cas d'erreur pour montrer que ça avance
        if ((i + 1) % 100 === 0 || i === validContacts.length - 1) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`📊 Progression: ${i + 1}/${validContacts.length} contacts traités (${inserted} réussis, ${errors.length} erreurs) - ${elapsed}s écoulés`);
        }
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Insertion terminée: ${inserted} contacts insérés, ${errors.length} erreurs, ${totalTime}s total`);
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`✓ Fichier temporaire supprimé: ${tempFile}`);
    } catch (cleanupError) {
      console.error('Erreur lors de la suppression du fichier temporaire:', cleanupError);
    }
    
    // Préparer le tableau des contacts non insérés
    const notInserted = [];
    
    // Ajouter les doublons
    duplicates.forEach(dup => {
      // Utiliser les valeurs extraites si disponibles, sinon chercher dans le contact original
      notInserted.push({
        nom: dup._extractedNom || dup.nom || '',
        prenom: dup._extractedPrenom || dup.prenom || '',
        tel: dup._extractedTel || dup.tel || dup.gsm1 || dup.gsm2 || '',
        cp: dup._extractedCp || dup.cp || '',
        ville: dup._extractedVille || dup.ville || '',
        raison: dup.reason || 'Doublon',
        typeRaison: dup.reasonType || 'duplicate',
        ficheExistante: dup.existingFiche || null
      });
    });
    
    // Ajouter les erreurs de code postal
    invalidPostalCodes.forEach(err => {
      notInserted.push({
        nom: err.nom || '',
        prenom: err.prenom || '',
        tel: err.tel || '',
        cp: err.cp || '',
        ville: err.ville || '',
        raison: err.reason || 'Code postal invalide',
        typeRaison: err.reasonType || 'invalid_postal_code',
        ficheExistante: null
      });
    });
    
    // Ajouter les autres erreurs
    otherErrors.forEach(err => {
      notInserted.push({
        nom: err.nom || '',
        prenom: err.prenom || '',
        tel: err.tel || '',
        cp: err.cp || '',
        ville: err.ville || '',
        raison: err.reason || 'Erreur lors de l\'insertion',
        typeRaison: err.reasonType || 'other_error',
        ficheExistante: null
      });
    });
    
    res.json({
      success: true,
      data: {
        total: data.length,
        inserted,
        duplicates: duplicates.length,
        duplicatesList: duplicates,
        errors: errors.length,
        errorsList: errors,
        invalidPostalCodes: invalidPostalCodes.length,
        otherErrors: otherErrors.length,
        // Nouveau tableau structuré des contacts non insérés
        notInserted: {
          total: notInserted.length,
          list: notInserted
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors du traitement de l\'import:', error);
    console.error('Stack trace:', error.stack);
    // Nettoyer le fichier temporaire en cas d'erreur
    if (tempFile) {
      const tempFilePath = path.join(__dirname, '../../uploads', tempFile);
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`✓ Fichier temporaire nettoyé: ${tempFile}`);
        } catch (cleanupError) {
          console.error('Erreur lors du nettoyage du fichier temporaire:', cleanupError);
        }
      }
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement de l\'import',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/import/diagnose
// Route de diagnostic pour identifier les problèmes d'import
router.post('/diagnose', authenticate, checkPermissionCode('fiches_create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    const diagnosis = {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileExtension: fileExt,
      steps: []
    };
    
    // Étape 1: Parser le fichier
    let data = [];
    try {
      diagnosis.steps.push({ step: '1. Parsing', status: 'in_progress' });
      
      if (fileExt === '.csv' || fileExt === '.txt') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const firstLine = fileContent.split(/\r?\n/)[0] || '';
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const isTSV = fileExt === '.tsv' || tabCount > 5;
        data = await parseCSV(filePath, isTSV);
      } else if (fileExt === '.tsv') {
        data = await parseCSV(filePath, true);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        data = parseExcel(filePath);
      } else if (fileExt === '.jsonl') {
        data = parseJSONL(filePath);
      } else if (fileExt === '.json') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const firstLine = fileContent.split(/\r?\n/)[0]?.trim();
        if (firstLine && firstLine.startsWith('{') && firstLine.endsWith('}')) {
          try {
            JSON.parse(firstLine);
            const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
            if (lines.length > 1) {
              data = parseJSONL(filePath);
            } else {
              data = parseJSON(filePath);
            }
          } catch {
            data = parseJSON(filePath);
          }
        } else {
          data = parseJSON(filePath);
        }
      } else {
        throw new Error(`Format non supporté: ${fileExt}`);
      }
      
      diagnosis.steps.push({ 
        step: '1. Parsing', 
        status: 'success', 
        dataRows: data.length,
        sampleRow: data.length > 0 ? data[0] : null
      });
    } catch (error) {
      diagnosis.steps.push({ 
        step: '1. Parsing', 
        status: 'error', 
        error: error.message 
      });
      fs.unlinkSync(filePath);
      return res.json({ success: false, diagnosis });
    }
    
    // Étape 2: Détecter les colonnes
    const fileColumns = data.length > 0 ? Object.keys(data[0]) : [];
    diagnosis.steps.push({ 
      step: '2. Détection colonnes', 
      status: 'success', 
      columns: fileColumns,
      columnCount: fileColumns.length
    });
    
    // Étape 3: Filtrer les données
    const filteredData = data.filter((row, index) => {
      const hasValue = Object.values(row).some(v => {
        const val = String(v || '').trim();
        return val !== '' && val !== 'null' && val !== 'undefined';
      });
      return hasValue;
    });
    
    diagnosis.steps.push({ 
      step: '3. Filtrage', 
      status: filteredData.length > 0 ? 'success' : 'warning',
      originalRows: data.length,
      filteredRows: filteredData.length,
      removedRows: data.length - filteredData.length
    });
    
    // Étape 4: Analyser les téléphones
    const phoneAnalysis = {
      hasTel: 0,
      hasGsm1: 0,
      hasGsm2: 0,
      hasAnyPhone: 0,
      noPhone: 0
    };
    
    filteredData.forEach(contact => {
      const tel = (contact.tel || '').toString().trim();
      const gsm1 = (contact.gsm1 || '').toString().trim();
      const gsm2 = (contact.gsm2 || '').toString().trim();
      
      if (tel) phoneAnalysis.hasTel++;
      if (gsm1) phoneAnalysis.hasGsm1++;
      if (gsm2) phoneAnalysis.hasGsm2++;
      if (tel || gsm1 || gsm2) {
        phoneAnalysis.hasAnyPhone++;
      } else {
        phoneAnalysis.noPhone++;
      }
    });
    
    diagnosis.steps.push({ 
      step: '4. Analyse téléphones', 
      status: phoneAnalysis.hasAnyPhone > 0 ? 'success' : 'error',
      analysis: phoneAnalysis
    });
    
    // Nettoyer le fichier
    fs.unlinkSync(filePath);
    
    res.json({ 
      success: true, 
      diagnosis,
      recommendation: phoneAnalysis.hasAnyPhone === 0 
        ? 'Aucun numéro de téléphone trouvé. Vérifiez que les colonnes contiennent des numéros de téléphone.'
        : filteredData.length === 0
        ? 'Toutes les lignes ont été filtrées. Vérifiez le format du fichier.'
        : 'Le fichier semble correct. Vous pouvez procéder à l\'import.'
    });
  } catch (error) {
    console.error('Erreur diagnostic:', error);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors du diagnostic',
      error: error.message
    });
  }
});

// GET /api/import/download/:filename
// Télécharger le fichier CSV des contacts non insérés
router.get('/download/:filename', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Sécuriser le nom de fichier (empêcher les accès à des fichiers en dehors du dossier uploads)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Nom de fichier invalide'
      });
    }
    
    // Vérifier que le fichier commence par "contacts-non-inseres-"
    if (!filename.startsWith('contacts-non-inseres-')) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce fichier'
      });
    }
    
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    // Envoyer le fichier
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement du fichier:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement du fichier'
          });
        }
      } else {
        console.log(`✓ Fichier téléchargé: ${filename}`);
        // Optionnel: supprimer le fichier après téléchargement (après un délai)
        // setTimeout(() => {
        //   if (fs.existsSync(filePath)) {
        //     fs.unlinkSync(filePath);
        //   }
        // }, 60000); // Supprimer après 1 minute
      }
    });
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
});

// Exporter les fonctions pour utilisation dans d'autres modules
module.exports = router;
if (typeof insertFiche !== 'undefined') module.exports.insertFiche = insertFiche;
if (typeof checkDuplicates !== 'undefined') module.exports.checkDuplicates = checkDuplicates;
if (typeof resetInsertFicheLog !== 'undefined') module.exports.resetInsertFicheLog = resetInsertFicheLog;
if (typeof findKeyInObject !== 'undefined') module.exports.findKeyInObject = findKeyInObject;
if (typeof cleanPhoneNumber !== 'undefined') module.exports.cleanPhoneNumber = cleanPhoneNumber;
// Traiter l'import avec le mapping fourni
router.post('/process', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const { mapping, tempFile, skipDuplicates, id_centre, produit } = req.body;
    
    if (!mapping || !tempFile) {
      return res.status(400).json({
        success: false,
        message: 'Mapping et fichier temporaire requis'
      });
    }

    // Vérifier que le centre est fourni
    const centreId = id_centre || req.user.centre;
    if (!centreId) {
      return res.status(400).json({
        success: false,
        message: 'Centre requis'
      });
    }

    // Vérifier que le produit est fourni
    if (!produit) {
      return res.status(400).json({
        success: false,
        message: 'Produit requis'
      });
    }

    // Vérifier que le centre existe et est actif
    const centre = await queryOne('SELECT id, etat FROM centres WHERE id = ?', [centreId]);
    if (!centre || centre.etat === 0) {
      return res.status(400).json({
        success: false,
        message: 'Centre invalide ou inactif'
      });
    }

    // Vérifier que le produit existe
    const produitData = await queryOne('SELECT id FROM produits WHERE id = ?', [parseInt(produit)]);
    if (!produitData) {
      return res.status(400).json({
        success: false,
        message: 'Produit invalide'
      });
    }

    // Vérifier que l'utilisateur appartient au centre sélectionné (sauf pour les admins)
    // Les admins (fonction 1, 7) peuvent importer pour n'importe quel centre
    if (req.user.fonction !== 1 && req.user.fonction !== 7) {
      if (req.user.centre !== parseInt(centreId)) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez importer des fiches que pour votre propre centre'
        });
      }
    }

    // Charger les données du fichier temporaire
    const tempFilePath = path.join(__dirname, '../../uploads', tempFile);
    if (!fs.existsSync(tempFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier temporaire non trouvé'
      });
    }

    // Le fichier temporaire est maintenant en format JSONL (converti automatiquement)
    let data = [];
    if (tempFile.endsWith('.jsonl')) {
      // Parser le fichier JSONL
      data = parseJSONL(tempFilePath);
      console.log(`✓ Fichier JSONL chargé: ${data.length} lignes`);
    } else {
      // Compatibilité avec les anciens fichiers JSON
      data = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
      console.log(`✓ Fichier JSON chargé (ancien format): ${data.length} lignes`);
    }
    
    // Récupérer les colonnes du fichier depuis le mapping (pour détecter les en-têtes)
    const fileColumns = Object.values(mapping).filter(col => col && col !== '');
    
    // Filtrer les lignes vides ou invalides avant de vérifier les doublons
    // Les données viennent déjà du fichier temporaire qui a été filtré lors de la prévisualisation
    // Mais on refait un filtrage léger pour s'assurer
    const filteredData = data.filter((contact, index) => {
      // Ignorer les lignes complètement vides
      const hasAnyValue = Object.values(contact).some(v => {
        const val = String(v || '').trim();
        return val !== '' && val !== 'null' && val !== 'undefined';
      });
      
      if (!hasAnyValue) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée lors du process: complètement vide`);
        }
        return false;
      }
      
      // Pour les fichiers JSON/JSONL, on ne filtre pas les en-têtes car ils n'en ont généralement pas
      // On vérifie seulement si c'est un objet valide
      if (typeof contact !== 'object' || contact === null || Array.isArray(contact)) {
        if (index < 3) {
          console.log(`Ligne ${index} ignorée: n'est pas un objet valide`);
        }
        return false;
      }
      
      // Pour CSV/Excel, détecter si c'est une ligne d'en-têtes (mais moins agressif)
      const keys = Object.keys(contact);
      if (keys.length < 2) {
        // Si moins de 2 clés, probablement pas une ligne valide
        return false;
      }
      
      // Détecter les en-têtes seulement si on a au moins 3 colonnes et que 90%+ correspondent
      // (plus strict pour éviter les faux positifs)
      if (keys.length >= 3) {
        let matchingKeys = 0;
        for (const key of keys) {
          const value = String(contact[key] || '').trim();
          const normalizedKey = normalizeKey(key);
          const normalizedValue = normalizeKey(value);
          // Si la valeur correspond exactement à la clé (après normalisation), c'est probablement un en-tête
          if (normalizedValue === normalizedKey || value === key) {
            matchingKeys++;
          }
        }
        
        // Si plus de 90% des valeurs correspondent aux clés ET qu'on a au moins 3 colonnes, c'est une ligne d'en-têtes
        if (matchingKeys > keys.length * 0.9) {
          if (index < 3) {
            console.log(`Ligne ${index} détectée comme en-tête lors du process (${matchingKeys}/${keys.length} correspondances)`);
          }
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Données filtrées: ${filteredData.length} lignes valides sur ${data.length} total`);
    
    // Si aucune donnée après filtrage, retourner une erreur explicite avec plus d'infos
    if (filteredData.length === 0) {
      console.error('ERREUR: Aucune donnée valide après filtrage');
      console.error('Nombre total de lignes parsées:', data.length);
      if (data.length > 0) {
        console.error('Première ligne brute:', JSON.stringify(data[0], null, 2));
        console.error('Clés de la première ligne:', Object.keys(data[0]));
        console.error('Valeurs de la première ligne:', Object.values(data[0]));
      }
      
      // Essayer de comprendre pourquoi les données sont filtrées
      const reasons = [];
      if (data.length > 0) {
        const firstRow = data[0];
        const hasValue = Object.values(firstRow).some(v => {
          const val = String(v || '').trim();
          return val !== '' && val !== 'null' && val !== 'undefined';
        });
        if (!hasValue) {
          reasons.push('Ligne complètement vide');
        }
        
        // Vérifier si c'est détecté comme en-tête
        const keys = Object.keys(firstRow);
        let matchingKeys = 0;
        for (const key of keys) {
          const value = String(firstRow[key] || '').trim();
          const normalizedKey = normalizeKey(key);
          const normalizedValue = normalizeKey(value);
          if (normalizedValue === normalizedKey || value === key) {
            matchingKeys++;
          }
        }
        if (keys.length > 0 && matchingKeys > keys.length * 0.8) {
          reasons.push(`Détecté comme en-tête (${matchingKeys}/${keys.length} correspondances)`);
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée valide trouvée dans le fichier après filtrage',
        debug: {
          totalRows: data.length,
          filteredRows: 0,
          reasons: reasons,
          sampleData: data.slice(0, 2),
          suggestion: 'Vérifiez que le fichier contient des données et que le format est correct. Les lignes vides et les lignes d\'en-têtes sont automatiquement filtrées.'
        }
      });
    }
    
    // Réinitialiser le flag de log pour ce nouvel import
    resetInsertFicheLog();
    
    // Vérifier les doublons
    const { duplicates, validContacts } = await checkDuplicates(filteredData, fileColumns);
    
    console.log(`Après vérification doublons: ${validContacts.length} contacts valides, ${duplicates.length} doublons`);
    
    // Si aucun contact valide après vérification des doublons, mais qu'on a des données filtrées
    if (validContacts.length === 0 && filteredData.length > 0) {
      console.warn('Aucun contact valide après vérification des doublons, mais des données filtrées existent');
      console.warn('Cela peut signifier que tous les contacts sont des doublons ou qu\'ils n\'ont pas de téléphone valide');
      
      // Analyser pourquoi les contacts sont rejetés
      const analysis = {
        totalFiltered: filteredData.length,
        duplicates: duplicates.length,
        noPhone: 0
      };
      
      filteredData.forEach(contact => {
        const tel = (contact.tel || '').toString().trim();
        const gsm1 = (contact.gsm1 || '').toString().trim();
        const gsm2 = (contact.gsm2 || '').toString().trim();
        if (!tel && !gsm1 && !gsm2) {
          analysis.noPhone++;
        }
      });
      
      // Préparer le tableau des contacts non insérés (pour ce cas spécial)
      const notInsertedSpecial = duplicates.map(dup => ({
        nom: dup._extractedNom || dup.nom || '',
        prenom: dup._extractedPrenom || dup.prenom || '',
        tel: dup._extractedTel || dup.tel || dup.gsm1 || dup.gsm2 || '',
        cp: dup._extractedCp || dup.cp || '',
        ville: dup._extractedVille || dup.ville || '',
        raison: dup.reason || 'Doublon',
        typeRaison: dup.reasonType || 'duplicate',
        ficheExistante: dup.existingFiche || null
      }));
      
      // Générer un fichier CSV avec les contacts non insérés si il y en a
      let downloadFile = null;
      if (notInsertedSpecial.length > 0) {
        try {
          // S'assurer que le dossier uploads existe
          const uploadDir = path.join(__dirname, '../../uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          // Créer le contenu CSV
          const csvHeaders = ['Nom', 'Prénom', 'Téléphone', 'Code Postal', 'Ville', 'Raison', 'Type Raison', 'Fiche Existante (ID)', 'Fiche Existante (Nom)', 'Fiche Existante (Prénom)', 'Fiche Existante (Téléphone)', 'Fiche Existante (État)'];
          const csvRows = notInsertedSpecial.map(item => {
            const ficheExistante = item.ficheExistante || {};
            return [
              item.nom || '',
              item.prenom || '',
              item.tel || '',
              item.cp || '',
              item.ville || '',
              item.raison || '',
              item.typeRaison || '',
              ficheExistante.id || '',
              ficheExistante.nom || '',
              ficheExistante.prenom || '',
              ficheExistante.tel || '',
              ficheExistante.etat_titre || ''
            ].map(cell => {
              // Échapper les guillemets et entourer de guillemets si nécessaire
              const cellStr = String(cell || '').replace(/"/g, '""');
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr}"`;
              }
              return cellStr;
            });
          });
          
          const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.join(','))
          ].join('\n');
          
          // Créer un nom de fichier unique
          const timestamp = Date.now();
          const fileName = `contacts-non-inseres-${timestamp}.csv`;
          const filePath = path.join(uploadDir, fileName);
          
          // Écrire le fichier
          fs.writeFileSync(filePath, csvContent, 'utf8');
          downloadFile = fileName;
          
          console.log(`✓ Fichier CSV des contacts non insérés créé: ${fileName} (${notInsertedSpecial.length} contacts)`);
        } catch (fileError) {
          console.error('Erreur lors de la création du fichier CSV:', fileError);
          // Ne pas bloquer la réponse si la création du fichier échoue
        }
      }
      
      return res.json({
        success: true,
        data: {
          total: data.length,
          inserted: 0,
          duplicates: duplicates.length,
          duplicatesList: duplicates.slice(0, 50), // Limiter à 50 pour la réponse
          errors: 0,
          errorsList: [],
          invalidPostalCodes: 0,
          otherErrors: 0,
          analysis: analysis,
          message: duplicates.length > 0 
            ? `Tous les contacts sont des doublons (${duplicates.length} doublons détectés)` 
            : analysis.noPhone > 0
            ? `Aucun contact n'a de numéro de téléphone valide (${analysis.noPhone} contacts sans téléphone)`
            : 'Aucun contact valide trouvé',
          // Nouveau tableau structuré des contacts non insérés
          notInserted: {
            total: notInsertedSpecial.length,
            list: notInsertedSpecial
          },
          // Lien de téléchargement du fichier CSV
          downloadFile: downloadFile ? `/api/import/download/${downloadFile}` : null
        }
      });
    }
    
    // Insérer les contacts valides
    let inserted = 0;
    const errors = [];
    const invalidPostalCodes = []; // Contacts avec code postal invalide
    const otherErrors = []; // Autres erreurs
    
    // Log pour débogage
    console.log('=== DÉBUT IMPORT ===');
    console.log('Mapping reçu:', JSON.stringify(mapping, null, 2));
    console.log('Nombre de contacts valides:', validContacts.length);
    console.log('Nombre de doublons:', duplicates.length);
    if (validContacts.length > 0) {
      const firstContact = validContacts[0];
      console.log('Premier contact exemple:', JSON.stringify(firstContact, null, 2));
      console.log('Colonnes du premier contact:', Object.keys(firstContact));
      
      // Vérifier le mapping du tel, gsm1, gsm2
      ['tel', 'gsm1', 'gsm2'].forEach(field => {
        const mappedColumn = mapping[field];
        if (mappedColumn) {
          console.log(`\n--- Vérification ${field} ---`);
          console.log(`Colonne mappée: "${mappedColumn}"`);
          console.log(`Valeur directe [${mappedColumn}]:`, firstContact[mappedColumn]);
          console.log(`Type:`, typeof firstContact[mappedColumn]);
          
          // Chercher avec findKeyInObject
          const foundKey = findKeyInObject(firstContact, mappedColumn);
          console.log(`Clé trouvée par findKeyInObject:`, foundKey);
          if (foundKey) {
            console.log(`Valeur avec clé trouvée:`, firstContact[foundKey]);
          }
          
          // Afficher toutes les clés qui contiennent "phone" ou "tel"
          const phoneKeys = Object.keys(firstContact).filter(k => 
            k.toLowerCase().includes('phone') || 
            k.toLowerCase().includes('tel') ||
            k.toLowerCase().includes('gsm')
          );
          if (phoneKeys.length > 0) {
            console.log(`Clés contenant phone/tel/gsm:`, phoneKeys);
            phoneKeys.forEach(key => {
              console.log(`  - ${key}: "${firstContact[key]}" (type: ${typeof firstContact[key]})`);
            });
          } else {
            console.log(`Aucune clé contenant phone/tel/gsm trouvée`);
          }
          
          // Comparer caractère par caractère
          console.log(`Comparaison exacte:`);
          console.log(`  - Colonne mappée: "${mappedColumn}" (longueur: ${mappedColumn.length})`);
          Object.keys(firstContact).forEach(key => {
            if (key.toLowerCase() === mappedColumn.toLowerCase()) {
              console.log(`  ✓ Correspondance exacte trouvée: "${key}" = "${firstContact[key]}"`);
            } else if (normalizeKey(key) === normalizeKey(mappedColumn)) {
              console.log(`  ✓ Correspondance après normalisation: "${key}" = "${firstContact[key]}"`);
            }
          });
        } else {
          console.log(`ATTENTION: Aucune colonne mappée pour "${field}"`);
        }
      });
    } else {
      console.log('Aucun contact valide après filtrage');
      if (data.length > 0) {
        console.log('Premier élément des données brutes:', JSON.stringify(data[0], null, 2));
      }
    }
    console.log('=== FIN LOGS DÉBOGAGE ===');
    
    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i];
      try {
        await insertFiche(contact, mapping, req.user.id, centreId, produit);
        inserted++;
        
        // Afficher la progression tous les 100 contacts
        if ((i + 1) % 100 === 0) {
          console.log(`Progression: ${i + 1}/${validContacts.length} contacts traités, ${inserted} insérés`);
        }
      } catch (error) {
        console.error(`Erreur insertion fiche ${i + 1}/${validContacts.length}:`, error.message);
        console.error('Stack:', error.stack);
        
        // Extraire les informations du contact pour l'affichage
        let contactInfo = {
          nom: 'N/A',
          prenom: 'N/A',
          tel: 'N/A',
          cp: 'N/A',
          ville: 'N/A'
        };
        
        // Chercher dans le contact avec le mapping
        if (mapping.nom) {
          const foundKey = findKeyInObject(contact, mapping.nom);
          contactInfo.nom = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.nom] || 'N/A');
        }
        if (mapping.prenom) {
          const foundKey = findKeyInObject(contact, mapping.prenom);
          contactInfo.prenom = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.prenom] || 'N/A');
        }
        if (mapping.tel) {
          const foundKey = findKeyInObject(contact, mapping.tel);
          contactInfo.tel = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.tel] || 'N/A');
        } else if (mapping.gsm1) {
          const foundKey = findKeyInObject(contact, mapping.gsm1);
          contactInfo.tel = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.gsm1] || 'N/A');
        } else if (mapping.gsm2) {
          const foundKey = findKeyInObject(contact, mapping.gsm2);
          contactInfo.tel = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.gsm2] || 'N/A');
        }
        if (mapping.cp) {
          const foundKey = findKeyInObject(contact, mapping.cp);
          contactInfo.cp = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.cp] || 'N/A');
        }
        if (mapping.ville) {
          const foundKey = findKeyInObject(contact, mapping.ville);
          contactInfo.ville = foundKey ? (contact[foundKey] || 'N/A') : (contact[mapping.ville] || 'N/A');
        }
        
        // Catégoriser les erreurs
        if (error.message.includes('Code postal invalide')) {
          invalidPostalCodes.push({
            ...contactInfo,
            contact: contact,
            reason: error.message,
            reasonType: 'invalid_postal_code'
          });
        } else {
          otherErrors.push({
            ...contactInfo,
            contact: contact,
            reason: error.message,
            reasonType: 'other_error'
          });
        }
        
        // Limiter la taille des erreurs pour éviter des réponses trop grandes
        if (errors.length < 100) {
          errors.push({
            contact: contactInfo,
            error: error.message,
            reasonType: error.message.includes('Code postal invalide') ? 'invalid_postal_code' : 'other_error'
          });
        }
      }
    }
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);
    
    // Préparer le tableau des contacts non insérés
    const notInserted = [];
    
    // Ajouter les doublons
    duplicates.forEach(dup => {
      // Utiliser les valeurs extraites si disponibles, sinon chercher dans le contact original
      notInserted.push({
        nom: dup._extractedNom || dup.nom || '',
        prenom: dup._extractedPrenom || dup.prenom || '',
        tel: dup._extractedTel || dup.tel || dup.gsm1 || dup.gsm2 || '',
        cp: dup._extractedCp || dup.cp || '',
        ville: dup._extractedVille || dup.ville || '',
        raison: dup.reason || 'Doublon',
        typeRaison: dup.reasonType || 'duplicate',
        ficheExistante: dup.existingFiche || null
      });
    });
    
    // Ajouter les erreurs de code postal
    invalidPostalCodes.forEach(err => {
      notInserted.push({
        nom: err.nom || '',
        prenom: err.prenom || '',
        tel: err.tel || '',
        cp: err.cp || '',
        ville: err.ville || '',
        raison: err.reason || 'Code postal invalide',
        typeRaison: err.reasonType || 'invalid_postal_code',
        ficheExistante: null
      });
    });
    
    // Ajouter les autres erreurs
    otherErrors.forEach(err => {
      notInserted.push({
        nom: err.nom || '',
        prenom: err.prenom || '',
        tel: err.tel || '',
        cp: err.cp || '',
        ville: err.ville || '',
        raison: err.reason || 'Erreur lors de l\'insertion',
        typeRaison: err.reasonType || 'other_error',
        ficheExistante: null
      });
    });
    
    // Générer un fichier CSV avec les contacts non insérés si il y en a
    let downloadFile = null;
    if (notInserted.length > 0) {
      try {
        // S'assurer que le dossier uploads existe
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Créer le contenu CSV
        const csvHeaders = ['Nom', 'Prénom', 'Téléphone', 'Code Postal', 'Ville', 'Raison', 'Type Raison', 'Fiche Existante (ID)', 'Fiche Existante (Nom)', 'Fiche Existante (Prénom)', 'Fiche Existante (Téléphone)', 'Fiche Existante (État)'];
        const csvRows = notInserted.map(item => {
          const ficheExistante = item.ficheExistante || {};
          return [
            item.nom || '',
            item.prenom || '',
            item.tel || '',
            item.cp || '',
            item.ville || '',
            item.raison || '',
            item.typeRaison || '',
            ficheExistante.id || '',
            ficheExistante.nom || '',
            ficheExistante.prenom || '',
            ficheExistante.tel || '',
            ficheExistante.etat_titre || ''
          ].map(cell => {
            // Échapper les guillemets et entourer de guillemets si nécessaire
            const cellStr = String(cell || '').replace(/"/g, '""');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr}"`;
            }
            return cellStr;
          });
        });
        
        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.join(','))
        ].join('\n');
        
        // Créer un nom de fichier unique
        const timestamp = Date.now();
        const fileName = `contacts-non-inseres-${timestamp}.csv`;
        const filePath = path.join(uploadDir, fileName);
        
        // Écrire le fichier
        fs.writeFileSync(filePath, csvContent, 'utf8');
        downloadFile = fileName;
        
        console.log(`✓ Fichier CSV des contacts non insérés créé: ${fileName} (${notInserted.length} contacts)`);
      } catch (fileError) {
        console.error('Erreur lors de la création du fichier CSV:', fileError);
        // Ne pas bloquer la réponse si la création du fichier échoue
      }
    }
    
    res.json({
      success: true,
      data: {
        total: data.length,
        inserted,
        duplicates: duplicates.length,
        duplicatesList: duplicates,
        errors: errors.length,
        errorsList: errors,
        invalidPostalCodes: invalidPostalCodes.length,
        otherErrors: otherErrors.length,
        // Nouveau tableau structuré des contacts non insérés
        notInserted: {
          total: notInserted.length,
          list: notInserted
        },
        // Lien de téléchargement du fichier CSV
        downloadFile: downloadFile ? `/api/import/download/${downloadFile}` : null
      }
    });
  } catch (error) {
    console.error('Erreur lors du traitement de l\'import:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement de l\'import',
      error: error.message
    });
  }
});

// POST /api/import/test-mapping
// Route de test pour le mapping (débogage)
router.post('/test-mapping', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const { contact, mapping } = req.body;
    
    if (!contact || !mapping) {
      return res.status(400).json({
        success: false,
        message: 'Contact et mapping requis'
      });
    }
    
    console.log('=== TEST MAPPING ===');
    console.log('Contact:', JSON.stringify(contact, null, 2));
    console.log('Mapping:', JSON.stringify(mapping, null, 2));
    
    const result = {};
    Object.keys(mapping).forEach(dbField => {
      const fileColumn = mapping[dbField];
      const foundKey = findKeyInObject(contact, fileColumn);
      result[dbField] = {
        mappedColumn: fileColumn,
        foundKey: foundKey,
        value: foundKey ? contact[foundKey] : null,
        directValue: contact[fileColumn] || null
      };
    });
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Erreur test mapping:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/import/diagnose
// Route de diagnostic pour identifier les problèmes d'import
router.post('/diagnose', authenticate, checkPermissionCode('fiches_create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    const diagnosis = {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileExtension: fileExt,
      steps: []
    };
    
    // Étape 1: Parser le fichier
    let data = [];
    try {
      diagnosis.steps.push({ step: '1. Parsing', status: 'in_progress' });
      
      if (fileExt === '.csv' || fileExt === '.txt') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const firstLine = fileContent.split(/\r?\n/)[0] || '';
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const isTSV = fileExt === '.tsv' || tabCount > 5;
        data = await parseCSV(filePath, isTSV);
      } else if (fileExt === '.tsv') {
        data = await parseCSV(filePath, true);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        data = await parseExcel(filePath);
      } else if (fileExt === '.jsonl') {
        data = parseJSONL(filePath);
      } else if (fileExt === '.json') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const firstLine = fileContent.split(/\r?\n/)[0]?.trim();
        if (firstLine && firstLine.startsWith('{') && firstLine.endsWith('}')) {
          try {
            JSON.parse(firstLine);
            const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
            if (lines.length > 1) {
              data = parseJSONL(filePath);
            } else {
              data = parseJSON(filePath);
            }
          } catch {
            data = parseJSON(filePath);
          }
        } else {
          data = parseJSON(filePath);
        }
      } else {
        throw new Error(`Format non supporté: ${fileExt}`);
      }
      
      diagnosis.steps.push({ 
        step: '1. Parsing', 
        status: 'success', 
        dataRows: data.length,
        sampleRow: data.length > 0 ? data[0] : null
      });
    } catch (error) {
      diagnosis.steps.push({ 
        step: '1. Parsing', 
        status: 'error', 
        error: error.message 
      });
      fs.unlinkSync(filePath);
      return res.json({ success: false, diagnosis });
    }
    
    // Étape 2: Détecter les colonnes
    const fileColumns = data.length > 0 ? Object.keys(data[0]) : [];
    diagnosis.steps.push({ 
      step: '2. Détection colonnes', 
      status: 'success', 
      columns: fileColumns,
      columnCount: fileColumns.length
    });
    
    // Étape 3: Filtrer les données
    const filteredData = data.filter((row, index) => {
      const hasValue = Object.values(row).some(v => {
        const val = String(v || '').trim();
        return val !== '' && val !== 'null' && val !== 'undefined';
      });
      return hasValue;
    });
    
    diagnosis.steps.push({ 
      step: '3. Filtrage', 
      status: filteredData.length > 0 ? 'success' : 'warning',
      originalRows: data.length,
      filteredRows: filteredData.length,
      removedRows: data.length - filteredData.length
    });
    
    // Étape 4: Analyser les téléphones
    const phoneAnalysis = {
      hasTel: 0,
      hasGsm1: 0,
      hasGsm2: 0,
      hasAnyPhone: 0,
      noPhone: 0
    };
    
    filteredData.forEach(contact => {
      const tel = (contact.tel || '').toString().trim();
      const gsm1 = (contact.gsm1 || '').toString().trim();
      const gsm2 = (contact.gsm2 || '').toString().trim();
      
      if (tel) phoneAnalysis.hasTel++;
      if (gsm1) phoneAnalysis.hasGsm1++;
      if (gsm2) phoneAnalysis.hasGsm2++;
      if (tel || gsm1 || gsm2) {
        phoneAnalysis.hasAnyPhone++;
      } else {
        phoneAnalysis.noPhone++;
      }
    });
    
    diagnosis.steps.push({ 
      step: '4. Analyse téléphones', 
      status: phoneAnalysis.hasAnyPhone > 0 ? 'success' : 'error',
      analysis: phoneAnalysis
    });
    
    // Nettoyer le fichier
    fs.unlinkSync(filePath);
    
    res.json({ 
      success: true, 
      diagnosis,
      recommendation: phoneAnalysis.hasAnyPhone === 0 
        ? 'Aucun numéro de téléphone trouvé. Vérifiez que les colonnes contiennent des numéros de téléphone.'
        : filteredData.length === 0
        ? 'Toutes les lignes ont été filtrées. Vérifiez le format du fichier.'
        : 'Le fichier semble correct. Vous pouvez procéder à l\'import.'
    });
  } catch (error) {
    console.error('Erreur diagnostic:', error);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors du diagnostic',
      error: error.message
    });
  }
});

// Exporter les fonctions pour les tests
// Exporter le router et les fonctions pour les tests
module.exports = router;
// Exporter les fonctions pour utilisation dans d'autres modules
if (typeof insertFiche !== 'undefined') module.exports.insertFiche = insertFiche;
if (typeof checkDuplicates !== 'undefined') module.exports.checkDuplicates = checkDuplicates;
if (typeof resetInsertFicheLog !== 'undefined') module.exports.resetInsertFicheLog = resetInsertFicheLog;
if (typeof findKeyInObject !== 'undefined') module.exports.findKeyInObject = findKeyInObject;
if (typeof cleanPhoneNumber !== 'undefined') module.exports.cleanPhoneNumber = cleanPhoneNumber;

