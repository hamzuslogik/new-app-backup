-- Script pour ajouter la colonne conf_rdv_avec à la table fiches
-- Exécuter ce script si la colonne n'existe pas déjà

-- Vérifier si la colonne existe déjà avant de l'ajouter
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'conf_rdv_avec';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `conf_consommation_electricite`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

