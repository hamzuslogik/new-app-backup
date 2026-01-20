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

-- =====================================================
-- DÉTECTION DES COLONNES ET INSERTION
-- =====================================================

-- Afficher toutes les colonnes disponibles dans la table
SELECT 
    '=== TOUTES LES COLONNES DE LA TABLE ===' as info,
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms'
ORDER BY ORDINAL_POSITION;

-- Vérifier quelles colonnes existent
SELECT 
    '=== COLONNES DÉTECTÉES ===' as info,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'nom') as has_nom,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'login') as has_login,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'email') as has_email,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'username') as has_username,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'user') as has_user,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'api_key') as has_api_key,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'api_url') as has_api_url,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'actif') as has_actif,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'date_creation') as has_date_creation,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fournisseurs_sms' AND COLUMN_NAME = 'date_modification') as has_date_modification;

-- =====================================================
-- ESSAYER DIFFÉRENTES VARIANTES D'INSERTION
-- =====================================================
-- 
-- Exécutez la variante qui correspond à votre structure de table
-- Si une variante échoue, essayez la suivante
--

-- VARIANTE 1: Avec colonne 'login'
-- Décommentez cette section si votre table a une colonne 'login'
/*
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
*/

-- VARIANTE 2: Avec colonne 'email' au lieu de 'login'
-- Décommentez cette section si votre table a une colonne 'email' mais pas 'login'
/*
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `email`,
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
    `email` = VALUES(`email`),
    `api_key` = VALUES(`api_key`),
    `api_url` = VALUES(`api_url`),
    `actif` = VALUES(`actif`),
    `date_modification` = NOW();
*/

-- VARIANTE 3: Sans colonne de login/email (seulement nom, api_key, api_url)
-- Décommentez cette section si votre table n'a pas de colonne pour le login
/*
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `api_key`,
    `api_url`,
    `actif`,
    `date_creation`
)
VALUES (
    'Octopush',
    'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
    'https://api.octopush.com/v1/public',
    1,
    NOW()
)
ON DUPLICATE KEY UPDATE
    `api_key` = VALUES(`api_key`),
    `api_url` = VALUES(`api_url`),
    `actif` = VALUES(`actif`),
    `date_modification` = NOW();
*/

-- VARIANTE 4: Structure minimale (seulement les colonnes essentielles)
-- Décommentez cette section et adaptez selon votre structure réelle
/*
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `api_key`,
    `api_url`
)
VALUES (
    'Octopush',
    'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
    'https://api.octopush.com/v1/public'
)
ON DUPLICATE KEY UPDATE
    `api_key` = VALUES(`api_key`),
    `api_url` = VALUES(`api_url`);
*/

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
-- Cette requête affichera toutes les colonnes disponibles pour le fournisseur Octopush
SELECT 
    '=== FOURNISSEUR SMS PAR DÉFAUT ===' as info;

SELECT *
FROM `fournisseurs_sms`
WHERE nom = 'Octopush'
LIMIT 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

