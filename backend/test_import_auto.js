/**
 * Script de test automatique pour l'importation en masse
 * 
 * Usage: node test_import_auto.js [email] [password] [centre_id]
 * 
 * Exemple: node test_import_auto.js admin@example.com password123 1
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5000';
const DEFAULT_LOGIN = process.env.TEST_LOGIN || 'admin';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD || 'admin123';
const DEFAULT_CENTRE = process.env.TEST_CENTRE_ID || '1';

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Fonction pour se connecter
async function login(login, password) {
  try {
    logSection('1. CONNEXION');
    logInfo(`Tentative de connexion avec: ${login}`);
    
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      login: login,
      password: password
    });
    
    if (response.data.success && response.data.token) {
      logSuccess('Connexion réussie');
      return response.data.token;
    } else {
      throw new Error('Token non reçu dans la réponse');
    }
  } catch (error) {
    logError(`Erreur de connexion: ${error.response?.data?.message || error.message}`);
    if (error.response?.status === 401) {
      logError('Identifiants incorrects');
    }
    throw error;
  }
}

// Fonction pour prévisualiser les contacts de test
async function previewContacts(token) {
  try {
    logSection('2. PRÉVISUALISATION DES CONTACTS');
    
    const response = await axios.get(`${API_URL}/api/import/test-contacts/preview`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      logSuccess('Prévisualisation réussie');
      logInfo(`Nombre de contacts: ${response.data.data.totalRows}`);
      logInfo(`Colonnes disponibles: ${response.data.data.fileColumns.join(', ')}`);
      
      if (response.data.data.previewData.length > 0) {
        logInfo('\nPremier contact:');
        console.log(JSON.stringify(response.data.data.previewData[0], null, 2));
      }
      
      return response.data;
    } else {
      throw new Error('Échec de la prévisualisation');
    }
  } catch (error) {
    logError(`Erreur de prévisualisation: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

// Fonction pour créer un mapping automatique
function createAutoMapping(fileColumns) {
  logSection('3. CRÉATION DU MAPPING AUTOMATIQUE');
  
  const mapping = {};
  const fieldMappings = {
    'nom': ['nom', 'name', 'lastname', 'last_name', 'surname'],
    'prenom': ['prenom', 'firstname', 'first_name', 'givenname'],
    'tel': ['tel', 'telephone', 'phone', 'numtel'],
    'gsm1': ['gsm1', 'gsm', 'mobile1', 'portable1'],
    'gsm2': ['gsm2', 'mobile2', 'portable2'],
    // Note: email n'existe pas dans la table fiches, on l'exclut
    'adresse': ['adresse', 'address', 'street'],
    'cp': ['cp', 'postal_code', 'code_postal', 'zip'],
    'ville': ['ville', 'city', 'town'],
    'civ': ['civ', 'civilite', 'civility']
  };
  
  // Créer le mapping automatique
  // D'abord, faire une passe pour les correspondances exactes
  fileColumns.forEach(column => {
    const colLower = column.toLowerCase().trim();
    
    for (const [dbField, variants] of Object.entries(fieldMappings)) {
      // Vérifier si ce champ n'a pas déjà été mappé
      if (mapping[dbField]) {
        continue;
      }
      
      // Vérifier la correspondance exacte d'abord
      if (variants.some(v => colLower === v.toLowerCase())) {
        mapping[dbField] = column;
        logSuccess(`${dbField} <- ${column} (exact)`);
        break;
      }
    }
  });
  
  // Ensuite, faire une passe pour les correspondances partielles (seulement pour les champs non mappés)
  fileColumns.forEach(column => {
    const colLower = column.toLowerCase().trim();
    
    for (const [dbField, variants] of Object.entries(fieldMappings)) {
      // Vérifier si ce champ n'a pas déjà été mappé
      if (mapping[dbField]) {
        continue;
      }
      
      // Vérifier les correspondances partielles (mais éviter les faux positifs)
      if (variants.some(v => {
        const vLower = v.toLowerCase();
        // Correspondance partielle seulement si c'est au début ou à la fin
        return colLower.startsWith(vLower) || colLower.endsWith(vLower) ||
               vLower.startsWith(colLower) || vLower.endsWith(colLower);
      })) {
        mapping[dbField] = column;
        logSuccess(`${dbField} <- ${column} (partiel)`);
        break;
      }
    }
  });
  
  // Exclure email du mapping car cette colonne n'existe pas dans la table fiches
  if (mapping.email) {
    logWarning('Colonne "email" exclue du mapping (n\'existe pas dans la table fiches)');
    delete mapping.email;
  }
  
  // Vérifier qu'au moins un téléphone est mappé
  if (!mapping.tel && !mapping.gsm1 && !mapping.gsm2) {
    logWarning('Aucun champ de téléphone mappé automatiquement');
    logInfo('Tentative de mapping manuel...');
    
    // Essayer de trouver n'importe quelle colonne qui pourrait être un téléphone
    const phoneColumns = fileColumns.filter(col => {
      const colLower = col.toLowerCase();
      return colLower.includes('tel') || colLower.includes('phone') || 
             colLower.includes('gsm') || colLower.includes('mobile');
    });
    
    if (phoneColumns.length > 0) {
      mapping.tel = phoneColumns[0];
      logSuccess(`tel <- ${phoneColumns[0]} (mapping manuel)`);
    }
  }
  
  logInfo('\nMapping créé:');
  console.log(JSON.stringify(mapping, null, 2));
  
  return mapping;
}

// Fonction pour importer les contacts
async function importContacts(token, mapping, centreId) {
  try {
    logSection('4. IMPORTATION DES CONTACTS');
    
    logInfo(`Centre ID: ${centreId}`);
    logInfo('Envoi de la requête d\'importation...');
    
    const response = await axios.post(`${API_URL}/api/import/test-contacts/process`, {
      mapping: mapping,
      id_centre: parseInt(centreId)
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      logSuccess('Importation terminée');
      return response.data;
    } else {
      throw new Error('Échec de l\'importation');
    }
  } catch (error) {
    logError(`Erreur d'importation: ${error.response?.data?.message || error.message}`);
    if (error.response?.data?.error) {
      logError(`Détails: ${error.response.data.error}`);
    }
    throw error;
  }
}

// Fonction pour afficher les résultats
function displayResults(result) {
  logSection('5. RÉSULTATS');
  
  const data = result.data;
  
  logInfo(`Total de contacts: ${data.total}`);
  logSuccess(`Contacts insérés: ${data.inserted}`);
  
  if (data.duplicates > 0) {
    logWarning(`Doublons détectés: ${data.duplicates}`);
    if (data.duplicatesList && data.duplicatesList.length > 0) {
      logInfo('Liste des doublons:');
      data.duplicatesList.slice(0, 5).forEach((dup, idx) => {
        console.log(`  ${idx + 1}. ${dup.nom || 'N/A'} ${dup.prenom || 'N/A'} - ${dup.reason}`);
      });
      if (data.duplicatesList.length > 5) {
        logInfo(`  ... et ${data.duplicatesList.length - 5} autres`);
      }
    }
  }
  
  if (data.errors > 0) {
    logError(`Erreurs: ${data.errors}`);
    if (data.errorsList && data.errorsList.length > 0) {
      logInfo('Liste des erreurs:');
      data.errorsList.slice(0, 5).forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.contact.nom || 'N/A'} ${err.contact.prenom || 'N/A'}: ${err.error}`);
      });
      if (data.errorsList.length > 5) {
        logInfo(`  ... et ${data.errorsList.length - 5} autres`);
      }
    }
  }
  
  // Calculer le taux de succès
  const successRate = data.total > 0 ? ((data.inserted / data.total) * 100).toFixed(1) : 0;
  logInfo(`\nTaux de succès: ${successRate}%`);
  
  if (successRate === 100) {
    logSuccess('Tous les contacts ont été importés avec succès !');
  } else if (successRate >= 80) {
    logWarning('La plupart des contacts ont été importés');
  } else {
    logError('Beaucoup de contacts n\'ont pas pu être importés');
  }
}

// Fonction principale
async function runTest() {
  try {
    logSection('TEST AUTOMATIQUE D\'IMPORTATION EN MASSE');
    
    // Récupérer les arguments
    const args = process.argv.slice(2);
    const loginUser = args[0] || DEFAULT_LOGIN;
    const password = args[1] || DEFAULT_PASSWORD;
    const centreId = args[2] || DEFAULT_CENTRE;
    
    logInfo(`API URL: ${API_URL}`);
    logInfo(`Login: ${loginUser}`);
    logInfo(`Centre ID: ${centreId}`);
    
    if (loginUser === DEFAULT_LOGIN && password === DEFAULT_PASSWORD) {
      logWarning('\n⚠ Utilisation des identifiants par défaut');
      logInfo('Pour utiliser vos propres identifiants:');
      logInfo('  node test_import_auto.js <login> <password> [centre_id]');
      logInfo('Exemple: node test_import_auto.js monlogin monpassword 1\n');
    }
    
    // 1. Se connecter
    const token = await login(loginUser, password);
    
    // 2. Prévisualiser les contacts
    const previewData = await previewContacts(token);
    
    // 3. Créer le mapping automatique
    const mapping = createAutoMapping(previewData.data.fileColumns);
    
    // Vérifier qu'au moins un téléphone est mappé
    if (!mapping.tel && !mapping.gsm1 && !mapping.gsm2) {
      logError('ERREUR: Aucun champ de téléphone n\'a pu être mappé !');
      logError('Veuillez vérifier que les colonnes du fichier contiennent des champs de téléphone.');
      process.exit(1);
    }
    
    // 4. Importer les contacts
    const result = await importContacts(token, mapping, centreId);
    
    // 5. Afficher les résultats
    displayResults(result);
    
    logSection('TEST TERMINÉ');
    logSuccess('Le test s\'est terminé avec succès !');
    
    process.exit(0);
  } catch (error) {
    logSection('ERREUR');
    logError(`Le test a échoué: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Réponse: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Lancer le test
runTest();

