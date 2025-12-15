-- =====================================================
-- Script pour ajouter la colonne date_appel_time à la table fiches
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Vérifier et ajouter la colonne date_appel_time si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'fiches';
SET @columnname = 'date_appel_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` datetime DEFAULT NULL AFTER `date_appel`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérification
SELECT 'Colonne date_appel_time ajoutée avec succès (ou existe déjà)' AS message;

