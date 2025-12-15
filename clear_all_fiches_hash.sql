-- =====================================================
-- Script SQL pour VIDER tous les hash des fiches
-- =====================================================
-- 
-- ATTENTION: Ce script va supprimer tous les hash existants
-- Exécutez ensuite update_existing_fiches_hash.sql pour les régénérer
--
-- Usage:
-- 1. Exécutez ce script pour vider tous les hash
-- 2. Exécutez update_existing_fiches_hash.sql pour les régénérer avec le bon HASH_SECRET
--
-- =====================================================

USE `crm`;

-- Afficher le nombre de fiches avant
SELECT 
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Vider tous les hash
UPDATE `fiches`
SET `hash` = NULL
WHERE `hash` IS NOT NULL;

-- Vérifier le résultat
SELECT 
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Afficher un message de confirmation
SELECT '✅ Tous les hash ont été vidés. Exécutez maintenant update_existing_fiches_hash.sql pour les régénérer avec le bon HASH_SECRET.' as message;
