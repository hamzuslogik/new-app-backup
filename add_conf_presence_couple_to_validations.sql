-- =====================================================
-- Script pour ajouter conf_presence_couple à la table validations
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Vérifier si la colonne existe déjà, sinon l'ajouter
SET @dbname = DATABASE();
SET @tablename = 'validations';
SET @columnname = 'conf_presence_couple';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- La colonne existe déjà
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(10) DEFAULT NULL COMMENT ''Présence du couple: OUI ou NON''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Vérification
SELECT 'Script exécuté avec succès. Colonne conf_presence_couple ajoutée (ou déjà existante) dans la table validations' AS message;

