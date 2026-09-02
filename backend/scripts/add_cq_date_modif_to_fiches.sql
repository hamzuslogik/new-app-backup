-- Date/heure du dernier contrôle qualité (CQ ETAT + CQ DOSSIER) enregistré depuis FicheDetail.
-- Idempotent : ne fait rien si la colonne existe déjà.

SET @db := DATABASE();

SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'fiches'
  AND COLUMN_NAME = 'cq_date_modif';

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `fiches` ADD COLUMN `cq_date_modif` datetime DEFAULT NULL COMMENT ''Date/heure du dernier contrôle qualité (SIGNER)'' AFTER `cq_dossier`',
  'SELECT ''Colonne cq_date_modif déjà présente sur fiches.'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
