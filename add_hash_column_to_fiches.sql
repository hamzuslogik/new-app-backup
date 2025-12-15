-- Ajouter la colonne hash à la table fiches
-- Cette colonne contiendra l'ID de la fiche après hashage pour la sécurité

-- Vérifier si la colonne existe déjà avant de l'ajouter
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'hash';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(255) NULL DEFAULT NULL AFTER `id`'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Créer un index sur la colonne hash pour améliorer les performances de recherche
-- Vérifier si l'index existe déjà
SET @indexname = 'idx_fiches_hash';
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND index_name = @indexname;

-- Créer l'index s'il n'existe pas
SET @sql = IF(@idx_exists = 0,
  CONCAT('CREATE INDEX `', @indexname, '` ON `', @tablename, '` (`', @columnname, '`)'),
  'SELECT "Index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mettre à jour les fiches existantes avec leur hash
-- Note: Cette requête mettra à jour toutes les fiches existantes
-- Vous pouvez l'exécuter séparément si nécessaire
-- UPDATE fiches SET hash = (
--   SELECT CONCAT(
--     SUBSTRING(SHA2(CONCAT(id, 'your-secret-key-change-in-production'), 256), 1, 16),
--     TO_BASE64(id)
--   )
-- ) WHERE hash IS NULL;

