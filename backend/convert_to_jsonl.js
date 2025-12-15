/**
 * Script de conversion de fichiers CSV/Excel vers JSONL
 * 
 * Usage: node convert_to_jsonl.js <fichier_source> [fichier_destination]
 * 
 * Exemples:
 *   node convert_to_jsonl.js contacts.csv contacts.jsonl
 *   node convert_to_jsonl.js contacts.xlsx contacts.jsonl
 *   node convert_to_jsonl.js contacts.csv  (génère contacts.jsonl automatiquement)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const csv = require('csv-parser');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Fonction pour parser CSV
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];
    let isFirstRow = true;
    
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: true
      }))
      .on('headers', (headerList) => {
        headers = headerList;
        logInfo(`Colonnes détectées: ${headers.join(', ')}`);
      })
      .on('data', (data) => {
        // Nettoyer les données
        const cleanedData = {};
        headers.forEach(header => {
          let value = data[header];
          if (value !== undefined && value !== null) {
            value = String(value).trim();
            if (value === '' || value === 'null' || value === 'undefined') {
              value = '';
            }
          } else {
            value = '';
          }
          cleanedData[header] = value;
        });
        
        // Vérifier qu'il y a au moins une valeur non vide
        const hasValue = Object.values(cleanedData).some(v => v !== '');
        if (hasValue) {
          results.push(cleanedData);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Fonction pour parser Excel
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  
  // Nettoyer les données
  return data.map(row => {
    const cleanedRow = {};
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
      cleanedRow[key.trim()] = value;
    });
    return cleanedRow;
  }).filter(row => {
    // Filtrer les lignes complètement vides
    return Object.values(row).some(v => v !== '');
  });
}

// Fonction pour convertir en JSONL
function convertToJSONL(data, outputPath) {
  const lines = data.map(obj => JSON.stringify(obj));
  const content = lines.join('\n');
  
  fs.writeFileSync(outputPath, content, 'utf8');
  logSuccess(`Fichier JSONL créé: ${outputPath}`);
  logInfo(`Nombre de lignes: ${data.length}`);
  
  return outputPath;
}

// Fonction principale
async function convertFile(inputPath, outputPath = null) {
  try {
    log('\n=== CONVERSION VERS JSONL ===', 'cyan');
    
    // Vérifier que le fichier source existe
    if (!fs.existsSync(inputPath)) {
      logError(`Le fichier source n'existe pas: ${inputPath}`);
      process.exit(1);
    }
    
    // Déterminer le fichier de sortie
    if (!outputPath) {
      const ext = path.extname(inputPath);
      outputPath = inputPath.replace(ext, '.jsonl');
    }
    
    logInfo(`Fichier source: ${inputPath}`);
    logInfo(`Fichier destination: ${outputPath}`);
    
    const fileExt = path.extname(inputPath).toLowerCase();
    let data = [];
    
    // Parser selon le type de fichier
    if (fileExt === '.csv' || fileExt === '.txt') {
      logInfo('Parsing CSV...');
      data = await parseCSV(inputPath);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      logInfo('Parsing Excel...');
      data = parseExcel(inputPath);
    } else if (fileExt === '.json' || fileExt === '.jsonl') {
      logInfo('Parsing JSON/JSONL...');
      const content = fs.readFileSync(inputPath, 'utf8');
      
      // Détecter si c'est JSONL (chaque ligne est un JSON) ou JSON (un seul objet/tableau)
      const firstLine = content.split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.startsWith('{') && firstLine.endsWith('}')) {
        // Probablement JSONL
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length > 1) {
          // JSONL: parser ligne par ligne
          data = [];
          lines.forEach((line, index) => {
            try {
              const parsed = JSON.parse(line.trim());
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                data.push(parsed);
              }
            } catch (e) {
              log(`⚠ Ligne ${index + 1} ignorée (JSON invalide)`, 'yellow');
            }
          });
        } else {
          // JSON simple
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            data = parsed;
          } else if (typeof parsed === 'object') {
            data = [parsed];
          }
        }
      } else {
        // JSON classique
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          data = parsed;
        } else if (typeof parsed === 'object') {
          data = [parsed];
        }
      }
    } else {
      logError(`Format non supporté: ${fileExt}`);
      logInfo('Formats supportés: CSV, TXT, XLSX, XLS, JSON, JSONL');
      process.exit(1);
    }
    
    if (data.length === 0) {
      logError('Aucune donnée trouvée dans le fichier');
      process.exit(1);
    }
    
    logSuccess(`${data.length} lignes parsées`);
    
    // Afficher un aperçu
    if (data.length > 0) {
      logInfo('\nAperçu de la première ligne:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    
    // Convertir en JSONL
    convertToJSONL(data, outputPath);
    
    log('\n=== CONVERSION TERMINÉE ===', 'cyan');
    logSuccess(`Vous pouvez maintenant utiliser le fichier: ${outputPath}`);
    
  } catch (error) {
    logError(`Erreur lors de la conversion: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Lancer la conversion
const args = process.argv.slice(2);
if (args.length === 0) {
  logError('Usage: node convert_to_jsonl.js <fichier_source> [fichier_destination]');
  logInfo('Exemples:');
  logInfo('  node convert_to_jsonl.js contacts.csv contacts.jsonl');
  logInfo('  node convert_to_jsonl.js contacts.xlsx');
  logInfo('  node convert_to_jsonl.js data.csv');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || null;

convertFile(inputPath, outputPath);

