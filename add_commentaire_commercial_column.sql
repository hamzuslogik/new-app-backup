-- =====================================================
-- Ajouter la colonne commentaire_commercial à la table fiches
-- =====================================================
-- Cette colonne permet aux commerciaux d'ajouter
-- des commentaires spécifiques sur les fiches

USE `crm`;

-- Vérifier et ajouter la colonne commentaire_commercial si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'commentaire_commercial';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Vérifier si commentaire_qualite existe pour déterminer la position
SELECT COUNT(*) INTO @qualite_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = 'commentaire_qualite';

-- Déterminer la colonne après laquelle insérer
SET @after_column = IF(@qualite_exists > 0, 'commentaire_qualite', 'commentaire');

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT CHARACTER SET utf8 DEFAULT NULL AFTER `', @after_column, '`'),
  'SELECT "Column already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification
SELECT 'Colonne commentaire_commercial ajoutée avec succès' AS message;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fiches'
  AND COLUMN_NAME = 'commentaire_commercial';

