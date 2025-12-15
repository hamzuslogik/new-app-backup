-- =====================================================
-- Ajouter la colonne commentaire_qualite à la table fiches
-- =====================================================
-- Cette colonne permet à la Qualité Qualification d'ajouter
-- des commentaires spécifiques sur les fiches lors du contrôle qualité

USE `crm`;

-- Vérifier et ajouter la colonne commentaire_qualite si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'commentaire_qualite';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT CHARACTER SET utf8 DEFAULT NULL AFTER `commentaire`'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification
SELECT 'Colonne commentaire_qualite ajoutée avec succès' AS message;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fiches'
  AND COLUMN_NAME = 'commentaire_qualite';

