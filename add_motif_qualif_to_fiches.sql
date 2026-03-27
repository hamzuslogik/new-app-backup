-- Ajoute le champ motif_qualif sur fiches (idempotent)
-- Utilisation:
--   mysql -u <user> -p <base> < add_motif_qualif_to_fiches.sql

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiches'
    AND COLUMN_NAME = 'motif_qualif'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `fiches` ADD COLUMN `motif_qualif` TEXT NULL',
  'SELECT ''motif_qualif already exists'' AS message'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
