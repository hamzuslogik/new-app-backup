-- =====================================================
-- Ajouter la colonne observations_cq à la table fiches
-- =====================================================
-- Champ dédié aux observations du Contrôle Qualité
-- signature (CQ ETAT, CQ DOSSIER, OBSERVATIONS).
-- Distinct de commentaire_qualite (usage général qualité).

USE `crm`;

SET @dbname = DATABASE();
SET @tablename = 'fiches';
SET @columnname = 'observations_cq';

SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT DEFAULT NULL'),
  'SELECT "Colonne observations_cq existe déjà" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Colonne observations_cq ajoutée ou déjà présente' AS message;
