-- =====================================================
-- Script pour insérer le fournisseur SMS par défaut (Manivox)
-- Base de données: crm
-- =====================================================
-- 
-- Ce script insère Manivox comme fournisseur SMS actif par défaut
-- avec les identifiants qui étaient utilisés dans le code
--
-- =====================================================

USE `crm`;

-- Vérifier si la table existe
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
      AND table_name = 'fournisseurs_sms'
);

-- Si la table n'existe pas, afficher un message
SELECT 
    CASE 
        WHEN @table_exists > 0 THEN '✓ Table fournisseurs_sms existe'
        ELSE '✗ Table fournisseurs_sms n''existe pas - Exécutez d''abord create_fournisseurs_sms_table.sql'
    END as verification;

-- Insérer Manivox comme fournisseur par défaut (actif)
-- Utilise ON DUPLICATE KEY UPDATE pour éviter les doublons
INSERT INTO `fournisseurs_sms` (
    `nom`,
    `login`,
    `api_key`,
    `api_url`,
    `actif`,
    `date_creation`
)
VALUES (
    'Manivox',
    'provoicecc@gmail.com',
    'x))MTU-e5Ma62y6',
    'https://www.manivox.com/api_v2/json_api.php',
    1,
    NOW()
)
ON DUPLICATE KEY UPDATE
    `login` = VALUES(`login`),
    `api_key` = VALUES(`api_key`),
    `api_url` = VALUES(`api_url`),
    `actif` = 1,
    `date_modification` = IFNULL(`date_modification`, NOW());

-- Alternative si pas de contrainte UNIQUE sur nom
-- Utiliser cette version si la version ci-dessus échoue
/*
-- Vérifier si Manivox existe déjà
SET @manivox_exists = (
    SELECT COUNT(*) 
    FROM `fournisseurs_sms` 
    WHERE `nom` = 'Manivox'
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
    'Manivox',
    'provoicecc@gmail.com',
    'x))MTU-e5Ma62y6',
    'https://www.manivox.com/api_v2/json_api.php',
    1,
    NOW()
WHERE @manivox_exists = 0;

-- Si existe, mettre à jour pour s'assurer qu'il est actif
UPDATE `fournisseurs_sms`
SET 
    `login` = 'provoicecc@gmail.com',
    `api_key` = 'x))MTU-e5Ma62y6',
    `api_url` = 'https://www.manivox.com/api_v2/json_api.php',
    `actif` = 1,
    `date_modification` = NOW()
WHERE `nom` = 'Manivox';
*/

-- Vérifier l'insertion
SELECT 
    '=== FOURNISSEUR SMS PAR DÉFAUT ===' as info;

SELECT 
    id,
    nom,
    login,
    api_url,
    actif,
    date_creation
FROM `fournisseurs_sms`
WHERE `nom` = 'Manivox'
LIMIT 1;

-- Vérifier qu'il y a au moins un fournisseur actif
SELECT 
    COUNT(*) as fournisseurs_actifs
FROM `fournisseurs_sms`
WHERE `actif` = 1;

SELECT '✅ Fournisseur SMS Manivox configuré avec succès' as message;

