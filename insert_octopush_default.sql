-- =====================================================
-- Script pour insérer le fournisseur SMS Octopush par défaut
-- Base de données: crm
-- =====================================================
--
-- Ce script insère le fournisseur SMS Octopush avec les identifiants par défaut
-- dans la table fournisseurs_sms
--
-- =====================================================

USE `crm`;

-- Vérifier si la table existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Table fournisseurs_sms existe'
        ELSE '✗ Table fournisseurs_sms n''existe pas'
    END as verification_table
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'fournisseurs_sms';

-- Afficher la structure de la table si elle existe
SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms'
ORDER BY ORDINAL_POSITION;

-- Vérifier si Octopush existe déjà
SELECT COUNT(*) as octopush_exists
FROM `fournisseurs_sms` 
WHERE `nom` = 'Octopush';

-- Vérifier si la colonne date_modification existe
SELECT COUNT(*) as has_date_modification
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms' 
  AND COLUMN_NAME = 'date_modification';

-- Insérer ou mettre à jour Octopush
-- Cette requête utilise INSERT ... ON DUPLICATE KEY UPDATE pour gérer à la fois
-- l'insertion (si n'existe pas) et la mise à jour (si existe déjà)
-- 
-- Si votre table a une contrainte UNIQUE sur 'nom', cette requête fonctionnera parfaitement.
-- Si votre table n'a pas de contrainte UNIQUE sur 'nom', cette requête insérera toujours
-- un nouvel enregistrement (même si un autre avec le même nom existe).
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `login`,
    `api_key`,
    `api_url`,
    `actif`,
    `date_creation`
)
VALUES (
    'Octopush',
    'pro_c52@sub-accounts.com',
    'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
    'https://api.octopush.com/v1/public',
    1,
    NOW()
)
ON DUPLICATE KEY UPDATE
    `login` = VALUES(`login`),
    `api_key` = VALUES(`api_key`),
    `api_url` = VALUES(`api_url`),
    `actif` = VALUES(`actif`),
    `date_modification` = NOW();

-- Alternative si la table n'a pas de contrainte UNIQUE sur 'nom'
-- Utilisez cette approche si la requête ci-dessus ne fonctionne pas correctement
-- (décommentez cette section et commentez la section ci-dessus)

/*
-- Vérifier si Octopush existe
SET @octopush_id = (
    SELECT id FROM `fournisseurs_sms` WHERE `nom` = 'Octopush' LIMIT 1
);

-- Si n'existe pas, insérer
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `login`,
    `api_key`,
    `api_url`,
    `actif`,
    `date_creation`
)
SELECT 
    'Octopush',
    'pro_c52@sub-accounts.com',
    'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
    'https://api.octopush.com/v1/public',
    1,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM `fournisseurs_sms` WHERE `nom` = 'Octopush'
);

-- Si existe, mettre à jour
UPDATE `fournisseurs_sms`
SET 
    `login` = 'pro_c52@sub-accounts.com',
    `api_key` = 'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
    `api_url` = 'https://api.octopush.com/v1/public',
    `actif` = 1,
    `date_modification` = NOW()
WHERE `nom` = 'Octopush';
*/

-- Vérifier l'insertion
SELECT 
    '=== FOURNISSEUR SMS PAR DÉFAUT ===' as info,
    id,
    nom,
    login,
    LEFT(api_key, 10) as api_key_preview,
    api_url,
    actif,
    date_creation
FROM `fournisseurs_sms`
WHERE nom = 'Octopush'
LIMIT 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

