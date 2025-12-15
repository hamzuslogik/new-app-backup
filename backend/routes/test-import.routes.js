/**
 * Route de test pour l'importation en masse
 * Utilise les contacts de test sans fichier CSV
 * 
 * GET /api/import/test-contacts/preview - Prévisualiser les contacts de test
 * POST /api/import/test-contacts/process - Importer les contacts de test
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const fs = require('fs');
const path = require('path');

// Importer les fonctions depuis import.routes
// Note: Ces fonctions doivent être exportées depuis import.routes.js
const importModule = require('./import.routes');
const insertFiche = importModule.insertFiche;
const checkDuplicates = importModule.checkDuplicates;
const resetInsertFicheLog = importModule.resetInsertFicheLog;

// Charger les contacts de test
const loadTestContacts = () => {
  const testContactsPath = path.join(__dirname, '../../test_contacts.json');
  try {
    const data = fs.readFileSync(testContactsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors du chargement des contacts de test:', error);
    // Retourner des contacts par défaut si le fichier n'existe pas
    return [
      {
        "nom": "Dupont",
        "prenom": "Jean",
        "tel": "0123456789",
        "gsm1": "0612345678",
        "email": "jean.dupont@example.com",
        "adresse": "123 Rue de la République",
        "cp": "75001",
        "ville": "Paris",
        "civ": "MR"
      },
      {
        "nom": "Martin",
        "prenom": "Marie",
        "tel": "0234567890",
        "gsm1": "0623456789",
        "email": "marie.martin@example.com",
        "adresse": "456 Avenue des Champs",
        "cp": "69001",
        "ville": "Lyon",
        "civ": "MME"
      }
    ];
  }
};

// GET /api/import/test-contacts/preview
// Prévisualiser les contacts de test
router.get('/test-contacts/preview', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const testContacts = loadTestContacts();
    
    if (testContacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun contact de test trouvé'
      });
    }
    
    // Détecter les colonnes du fichier
    const fileColumns = testContacts.length > 0 ? Object.keys(testContacts[0]) : [];
    
    // Récupérer les champs disponibles de la table fiches
    const { query } = require('../config/database');
    const ficheFields = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = SCHEMA()
      AND TABLE_NAME = 'fiches'
      AND COLUMN_NAME NOT IN ('id', 'date_insert', 'date_insert_time', 'date_modif', 'date_modif_time', 'archive')
      ORDER BY ORDINAL_POSITION
    `);
    
    res.json({
      success: true,
      data: {
        fileColumns,
        previewData: testContacts.slice(0, 10),
        totalRows: testContacts.length
      },
      fields: ficheFields.map(f => ({
        name: f.COLUMN_NAME,
        type: f.COLUMN_TYPE,
        nullable: f.IS_NULLABLE === 'YES',
        default: f.COLUMN_DEFAULT
      }))
    });
  } catch (error) {
    console.error('Erreur lors de la prévisualisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la prévisualisation',
      error: error.message
    });
  }
});

// POST /api/import/test-contacts/process
// Importer les contacts de test
router.post('/test-contacts/process', authenticate, checkPermissionCode('fiches_create'), async (req, res) => {
  try {
    const { mapping, id_centre } = req.body;
    
    if (!mapping) {
      return res.status(400).json({
        success: false,
        message: 'Mapping requis'
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

    // Vérifier que le centre existe et est actif
    const { queryOne } = require('../config/database');
    const centre = await queryOne('SELECT id, etat FROM centres WHERE id = ?', [centreId]);
    if (!centre || centre.etat === 0) {
      return res.status(400).json({
        success: false,
        message: 'Centre invalide ou inactif'
      });
    }

    // Vérifier que l'utilisateur appartient au centre sélectionné (sauf pour les admins)
    if (req.user.fonction !== 1 && req.user.fonction !== 7) {
      if (req.user.centre !== parseInt(centreId)) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez importer des fiches que pour votre propre centre'
        });
      }
    }

    // Charger les contacts de test
    const testContacts = loadTestContacts();
    
    if (testContacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun contact de test trouvé'
      });
    }

    // Récupérer les colonnes du fichier depuis le mapping
    const fileColumns = Object.values(mapping).filter(col => col && col !== '');
    
    // Réinitialiser le flag de log
    resetInsertFicheLog();
    
    // Vérifier les doublons
    const { duplicates, validContacts } = await checkDuplicates(testContacts, fileColumns);
    
    console.log(`=== TEST IMPORT ===`);
    console.log(`Contacts de test: ${testContacts.length}`);
    console.log(`Contacts valides: ${validContacts.length}`);
    console.log(`Doublons: ${duplicates.length}`);
    
    // Insérer les contacts valides
    let inserted = 0;
    const errors = [];
    
    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i];
      try {
        await insertFiche(contact, mapping, req.user.id, centreId);
        inserted++;
        
        // Afficher la progression
        if ((i + 1) % 5 === 0) {
          console.log(`Progression: ${i + 1}/${validContacts.length} contacts traités, ${inserted} insérés`);
        }
      } catch (error) {
        console.error(`Erreur insertion contact ${i + 1}/${validContacts.length}:`, error.message);
        if (errors.length < 100) {
          errors.push({
            contact: {
              nom: contact.nom || 'N/A',
              prenom: contact.prenom || 'N/A',
              tel: contact.tel || contact.gsm1 || contact.gsm2 || 'N/A'
            },
            error: error.message
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Importation de test terminée',
      data: {
        total: testContacts.length,
        inserted,
        duplicates: duplicates.length,
        duplicatesList: duplicates,
        errors: errors.length,
        errorsList: errors
      }
    });
    
  } catch (error) {
    console.error('Erreur lors du test d\'importation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test d\'importation',
      error: error.message
    });
  }
});

module.exports = router;

