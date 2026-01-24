-- =====================================================
-- Script pour ajouter la colonne login et corriger Manivox
-- Base de données: crm
-- =====================================================
-- 
-- Ce script :
-- 1. Ajoute la colonne 'login' à la table fournisseurs_sms (si elle n'existe pas)
-- 2. Met à jour le fournisseur Manivox avec le login
--
-- =====================================================

USE `crm`;

-- Étape 1: Afficher la structure actuelle de la table
SELECT 
    '=== STRUCTURE ACTUELLE ===' as info,
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms'
ORDER BY ORDINAL_POSITION;

-- Étape 2: Ajouter la colonne 'login' si elle n'existe pas
-- Note: Si la colonne existe déjà, cette commande générera une erreur
-- mais vous pouvez l'ignorer et continuer avec l'étape suivante
ALTER TABLE `fournisseurs_sms` 
ADD COLUMN `login` VARCHAR(255) CHARACTER SET utf8 NULL AFTER `nom`;

-- Si l'erreur #1060 "Duplicate column name" apparaît, c'est normal,
-- cela signifie que la colonne existe déjà. Continuez avec l'étape suivante.

-- Étape 3: Vérifier l'état actuel du fournisseur Manivox
SELECT 
    id,
    nom,
    login,
    api_key,
    api_url
FROM `fournisseurs_sms`
WHERE nom = 'Manivox' OR id = 1;

-- Étape 4: Mettre à jour le fournisseur Manivox avec le login
UPDATE `fournisseurs_sms`
SET 
    `login` = 'provoicecc@gmail.com',
    `api_key` = COALESCE(`api_key`, 'x))MTU-e5Ma62y6'),
    `api_url` = COALESCE(`api_url`, 'https://www.manivox.com/api_v2/json_api.php')
WHERE (`nom` = 'Manivox' OR `id` = 1);

-- Si la colonne date_modification existe, la mettre à jour aussi
UPDATE `fournisseurs_sms`
SET `date_modification` = NOW()
WHERE (`nom` = 'Manivox' OR `id` = 1)
AND EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fournisseurs_sms' 
      AND COLUMN_NAME = 'date_modification'
);

-- Étape 5: Vérifier le résultat final
SELECT 
    '=== RÉSULTAT FINAL ===' as info,
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

