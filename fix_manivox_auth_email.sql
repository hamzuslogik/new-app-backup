-- =====================================================
-- Script pour corriger auth_email pour Manivox
-- Base de données: crm
-- =====================================================
-- 
-- Ce script met à jour le fournisseur Manivox avec auth_email
-- (le login est stocké dans le champ auth_email)
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

-- Étape 2: Vérifier l'état actuel du fournisseur Manivox
SELECT 
    id,
    nom,
    auth_email,
    login,
    api_key,
    api_url
FROM `fournisseurs_sms`
WHERE nom = 'Manivox' OR id = 1;

-- Étape 3: Mettre à jour le fournisseur Manivox avec auth_email
-- Mise à jour de base (sans date_modification)
UPDATE `fournisseurs_sms`
SET 
    `auth_email` = 'provoicecc@gmail.com',
    `api_key` = COALESCE(`api_key`, 'x))MTU-e5Ma62y6'),
    `api_url` = COALESCE(`api_url`, 'https://www.manivox.com/api_v2/json_api.php')
WHERE (`nom` = 'Manivox' OR `id` = 1);

-- Si la colonne date_modification existe, la mettre à jour aussi
-- Note: Si cette requête génère une erreur, ignorez-la (la colonne n'existe pas)
-- Vous pouvez commenter cette section si nécessaire
/*
UPDATE `fournisseurs_sms`
SET `date_modification` = NOW()
WHERE (`nom` = 'Manivox' OR `id` = 1);
*/

-- Étape 4: Vérifier le résultat final
SELECT 
    '=== RÉSULTAT FINAL ===' as info,
    id,
    nom,
    auth_email,
    CASE 
        WHEN auth_email IS NULL OR auth_email = '' THEN 'MANQUANT'
        ELSE 'PRÉSENT'
    END as statut_auth_email,
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

