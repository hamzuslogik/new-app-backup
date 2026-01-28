-- =====================================================
-- Script pour supprimer la colonne cibles_centres
-- de la table system_messages
-- Base de données: crm
-- =====================================================
-- 
-- Ce script supprime la colonne cibles_centres qui n'est
-- plus utilisée pour le ciblage des messages système.
-- Le ciblage se fait maintenant uniquement par fonction
-- et/ou par utilisateur.
--
-- =====================================================

USE `crm`;

-- Vérifier si la colonne existe avant de la supprimer
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'system_messages' 
    AND COLUMN_NAME = 'cibles_centres'
);

-- Supprimer la colonne si elle existe
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE `system_messages` DROP COLUMN `cibles_centres`',
  'SELECT "La colonne cibles_centres n''existe pas ou a déjà été supprimée" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Colonne cibles_centres supprimée avec succès'
        ELSE '✓ La colonne cibles_centres n''existait pas'
    END AS statut
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'system_messages' 
  AND COLUMN_NAME = 'cibles_centres'
HAVING COUNT(*) = 0;
