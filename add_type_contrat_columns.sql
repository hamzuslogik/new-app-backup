-- =====================================================
-- Script pour ajouter les colonnes type_contrat_mr et type_contrat_madame
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Vérifier et ajouter la colonne type_contrat_mr si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'fiches';
SET @columnname = 'type_contrat_mr';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` int(11) DEFAULT NULL AFTER `profession_mr`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérifier et ajouter la colonne type_contrat_madame si elle n'existe pas
SET @columnname = 'type_contrat_madame';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` int(11) DEFAULT NULL AFTER `profession_madame`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérifier et ajouter la colonne circuit_eau si elle n'existe pas
SET @columnname = 'circuit_eau';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `consommation_electricite`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérifier et ajouter la colonne site_classe si elle n'existe pas
SET @columnname = 'site_classe';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `orientation_toiture`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérifier et ajouter la colonne zones_ombres si elle n'existe pas
SET @columnname = 'zones_ombres';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `site_classe`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérification
SELECT 'Colonnes type_contrat_mr, type_contrat_madame, circuit_eau, site_classe et zones_ombres ajoutées avec succès' AS message;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches' 
  AND COLUMN_NAME IN ('type_contrat_mr', 'type_contrat_madame', 'circuit_eau', 'site_classe', 'zones_ombres');

