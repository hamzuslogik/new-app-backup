-- =====================================================
-- Script pour corriger le login manquant pour Manivox
-- Base de données: crm
-- =====================================================
-- 
-- Ce script :
-- 1. Vérifie la structure de la table fournisseurs_sms
-- 2. Ajoute la colonne 'login' si elle n'existe pas
-- 3. Met à jour le fournisseur Manivox avec le login
--
-- =====================================================

USE `crm`;

-- Étape 1: Vérifier la structure actuelle de la table
SELECT 
    '=== STRUCTURE ACTUELLE DE LA TABLE ===' as info,
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms'
ORDER BY ORDINAL_POSITION;

-- Étape 2: Vérifier si la colonne 'login' existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Colonne login existe'
        ELSE '✗ Colonne login n''existe pas - Elle sera ajoutée'
    END as verification_login
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms' 
  AND COLUMN_NAME = 'login';

-- Étape 3: Ajouter la colonne 'login' si elle n'existe pas
-- Vérifier d'abord si elle existe pour éviter l'erreur si elle existe déjà
SET @login_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fournisseurs_sms' 
      AND COLUMN_NAME = 'login'
);

-- Ajouter la colonne seulement si elle n'existe pas
SET @sql = IF(@login_exists = 0,
    'ALTER TABLE `fournisseurs_sms` ADD COLUMN `login` VARCHAR(255) CHARACTER SET utf8 NULL AFTER `nom`',
    'SELECT "Colonne login existe déjà" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Étape 4: Vérifier l'état actuel du fournisseur Manivox
-- (en utilisant seulement les colonnes qui existent)
SELECT 
    id,
    nom,
    IFNULL(login, 'NULL') as login,
    IFNULL(api_key, 'NULL') as api_key,
    IFNULL(api_url, 'NULL') as api_url
FROM `fournisseurs_sms`
WHERE nom = 'Manivox' OR id = 1;

-- Étape 5: Mettre à jour le fournisseur Manivox avec le login
-- Utiliser une requête conditionnelle pour éviter les erreurs
UPDATE `fournisseurs_sms`
SET 
    `login` = 'provoicecc@gmail.com',
    `api_key` = COALESCE(`api_key`, 'x))MTU-e5Ma62y6'),
    `api_url` = COALESCE(`api_url`, 'https://www.manivox.com/api_v2/json_api.php')
WHERE (`nom` = 'Manivox' OR `id` = 1);

-- Si la colonne date_modification existe, la mettre à jour aussi
SET @date_modif_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fournisseurs_sms' 
      AND COLUMN_NAME = 'date_modification'
);

SET @sql2 = IF(@date_modif_exists > 0,
    'UPDATE `fournisseurs_sms` SET `date_modification` = NOW() WHERE (`nom` = ''Manivox'' OR `id` = 1)',
    'SELECT "Colonne date_modification n''existe pas" as message'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Étape 6: Vérifier le résultat après mise à jour
SELECT 
    '=== RÉSULTAT APRÈS MISE À JOUR ===' as info,
    id,
    nom,
    login,
    CASE 
        WHEN login IS NULL OR login = '' THEN 'MANQUANT'
        ELSE 'PRÉSENT'
    END as statut_login,
    CASE 
        WHEN api_key IS NULL OR api_key = '' THEN 'MANQUANT'
        ELSE 'PRÉSENT'
    END as statut_api_key,
    api_url
FROM `fournisseurs_sms`
WHERE nom = 'Manivox' OR id = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

