/**
 * Script de diagnostic pour tester la conversion de fichiers en JSONL
 * 
 * Usage: node test_conversion.js <chemin_vers_fichier>
 * 
 * Exemple: node test_conversion.js ../uploads/test.csv
 */

const fs = require('fs');
const path = require('path');

// Changer vers le répertoire backend
const backendPath = path.join(__dirname);
process.chdir(backendPath);

// Importer les fonctions de conversion depuis import.routes.js
// Pour simplifier, on va recréer les fonctions essentielles ici

function normalizeKey(key) {
  if (!key) return '';
  return String(key).toLowerCase().trim().replace(/[_\s-]/g, '');
}

function findKeyInObject(obj, targetKey) {
  if (!targetKey || !obj) return null;
  const normalizedTarget = normalizeKey(targetKey);
  
  // D'abord, chercher une correspondance exacte
  for (const key in obj) {
    if (normalizeKey(key) === normalizedTarget) {
      return key;
    }
  }
  
  // Ensuite, chercher des variantes communes
  const commonVariants = {
    'tel': ['telephone', 'phone', 'tel', 'gsm', 'mobile', 'portable'],
    'gsm1': ['gsm1', 'gsm', 'mobile1', 'cellphone'],
    'gsm2': ['gsm2', 'mobile2', 'phone2']
  };
  
  if (commonVariants[targetKey]) {
    for (const variant of commonVariants[targetKey]) {
      for (const key in obj) {
        if (normalizeKey(key) === normalizeKey(variant)) {
          return key;
        }
      }
    }
  }
  
  return null;
}

// Fonction pour parser CSV
async function parseCSV(filePath, isTSV = false) {
  const csv = require('csv-parser');
  const results = [];
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    const separator = isTSV ? '\t' : ',';
    
    stream
      .pipe(csv({ separator, skipEmptyLines: true }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Fonction pour parser Excel
function parseExcel(filePath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

// Fonction pour parser JSONL
function parseJSONL(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  let content = fileContent;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const results = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        results.push(parsed);
      }
    } catch (parseError) {
      console.warn(`Ligne ${i + 1} ignorée: ${parseError.message}`);
    }
  }
  
  return results;
}

// Fonction pour parser JSON
function parseJSON(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  let content = fileContent;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const parsed = JSON.parse(content);
  
  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  if (typeof parsed === 'object' && parsed !== null) {
    return [parsed];
  }
  
  throw new Error('Le fichier JSON doit contenir un objet ou un tableau d\'objets');
}

// Fonction de conversion
async function convertToJSONL(filePath, fileExt) {
  console.log(`\n🔄 Conversion de ${filePath} (${fileExt}) vers JSONL...`);
  
  let data = [];
  
  // Parser selon le type de fichier
  if (fileExt === '.csv' || fileExt === '.txt') {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const firstLine = fileContent.split(/\r?\n/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const isTSV = fileExt === '.tsv' || tabCount > 5;
    console.log(`  → Parsing CSV${isTSV ? ' (TSV)' : ''}...`);
    data = await parseCSV(filePath, isTSV);
  } else if (fileExt === '.tsv') {
    console.log(`  → Parsing TSV...`);
    data = await parseCSV(filePath, true);
  } else if (fileExt === '.xlsx' || fileExt === '.xls') {
    console.log(`  → Parsing Excel...`);
    data = parseExcel(filePath);
  } else if (fileExt === '.json') {
    console.log(`  → Détection du type JSON...`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const firstLine = fileContent.split(/\r?\n/)[0]?.trim();
    if (firstLine && firstLine.startsWith('{') && firstLine.endsWith('}')) {
      try {
        JSON.parse(firstLine);
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
        if (lines.length > 1) {
          console.log(`  → Format JSONL détecté`);
          data = parseJSONL(filePath);
        } else {
          console.log(`  → Format JSON classique détecté`);
          data = parseJSON(filePath);
        }
      } catch {
        console.log(`  → Format JSON classique détecté (fallback)`);
        data = parseJSON(filePath);
      }
    } else {
      console.log(`  → Format JSON classique détecté`);
      data = parseJSON(filePath);
    }
  } else if (fileExt === '.jsonl') {
    console.log(`  → Fichier déjà en JSONL`);
    data = parseJSONL(filePath);
  } else {
    throw new Error(`Format de fichier non supporté: ${fileExt}`);
  }
  
  console.log(`  ✓ ${data.length} lignes parsées`);
  
  if (data.length === 0) {
    throw new Error('Aucune donnée trouvée dans le fichier');
  }
  
  // Nettoyer les données
  console.log(`  → Nettoyage des données...`);
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
    return Object.values(row).some(v => v !== '');
  });
  
  console.log(`  ✓ ${cleanedData.length} lignes après nettoyage`);
  
  // Afficher un échantillon
  if (cleanedData.length > 0) {
    console.log(`\n  📋 Échantillon (première ligne):`);
    console.log(JSON.stringify(cleanedData[0], null, 2));
  }
  
  // Créer le fichier JSONL
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const jsonlFileName = `test-converted-${Date.now()}.jsonl`;
  const jsonlPath = path.join(uploadDir, jsonlFileName);
  const jsonlContent = cleanedData.map(obj => JSON.stringify(obj)).join('\n');
  fs.writeFileSync(jsonlPath, jsonlContent, 'utf8');
  
  console.log(`\n  ✓ Fichier JSONL créé: ${jsonlPath}`);
  console.log(`  ✓ Taille: ${(fs.statSync(jsonlPath).size / 1024).toFixed(2)} KB`);
  
  return jsonlPath;
}

// Main
async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Usage: node test_conversion.js <chemin_vers_fichier>');
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier non trouvé: ${filePath}`);
    process.exit(1);
  }
  
  const fileExt = path.extname(filePath).toLowerCase();
  console.log(`\n📁 Fichier: ${filePath}`);
  console.log(`📄 Extension: ${fileExt}`);
  console.log(`📊 Taille: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB`);
  
  try {
    const jsonlPath = await convertToJSONL(filePath, fileExt);
    console.log(`\n✅ Conversion réussie!`);
    console.log(`📄 Fichier JSONL: ${jsonlPath}`);
  } catch (error) {
    console.error(`\n❌ Erreur lors de la conversion:`, error);
    console.error(`Stack:`, error.stack);
    process.exit(1);
  }
}

main();

