-- =====================================================
-- Colonnes qualité confirmation sur la table fiches
-- =====================================================
-- id_qualite_confirmation : agent qualité confirmation (fonction 4) ayant audité / traité la fiche
-- observation_qualite       : observations qualité confirmation (distinct de commentaire_qualite qualification)
--
-- Parallèle à id_qualite + commentaire_qualite (qualification).

USE `crm`;

SET @dbname = DATABASE();
SET @tablename = 'fiches';

-- id_qualite_confirmation
SET @columnname = 'id_qualite_confirmation';
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` INT(11) DEFAULT NULL COMMENT ''Agent qualité confirmation (fonction 4)'' AFTER `id_qualite`'),
  'SELECT "Colonne id_qualite_confirmation existe déjà" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- observation_qualite
SET @columnname = 'observation_qualite';
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT DEFAULT NULL COMMENT ''Observations qualité confirmation'' AFTER `id_qualite_confirmation`'),
  'SELECT "Colonne observation_qualite existe déjà" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index (optionnel, idempotent)
SET @indexname = 'idx_fiches_id_qualite_confirmation';
SELECT COUNT(*) INTO @idx_exists
FROM INFORMATION_SCHEMA.STATISTICS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND index_name = @indexname;

SET @sql = IF(@idx_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD KEY `', @indexname, '` (`id_qualite_confirmation`)'),
  'SELECT "Index idx_fiches_id_qualite_confirmation existe déjà" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Colonnes id_qualite_confirmation et observation_qualite ajoutées ou déjà présentes' AS message;
