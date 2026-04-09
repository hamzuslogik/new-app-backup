-- =====================================================
-- Mode de chauffage : stockage texte (libellé) dans fiches
-- - fiches.mode_chauffage : déjà souvent VARCHAR ; convertit les ids numériques en nom
-- - fiches.conf_mode_chauffage : INT -> VARCHAR(255) si besoin, puis id -> nom
-- - fiches_histo.conf_mode_chauffage : idem si la colonne existe
-- Base : crm
-- Prérequis : table mode_chauffage peuplée (insert_modes_chauffage.sql)
-- =====================================================

USE `crm`;

-- ----------------------------------------------------------------
-- fiches.conf_mode_chauffage : garantir VARCHAR
-- ----------------------------------------------------------------
SET @has_conf := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches' AND COLUMN_NAME = 'conf_mode_chauffage'
);

SET @sql_conf := IF(
  @has_conf > 0,
  'ALTER TABLE `fiches` MODIFY COLUMN `conf_mode_chauffage` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT ''Colonne fiches.conf_mode_chauffage absente : ajouter via add_fiches_conf_confirmations.sql'' AS info'
);
PREPARE stmt_conf FROM @sql_conf;
EXECUTE stmt_conf;
DEALLOCATE PREPARE stmt_conf;

-- Remplacer les valeurs encore numériques (id) par le nom
UPDATE `fiches` f
INNER JOIN `mode_chauffage` mc
  ON TRIM(CAST(f.`conf_mode_chauffage` AS CHAR)) REGEXP '^[0-9]+$'
  AND CAST(TRIM(f.`conf_mode_chauffage`) AS UNSIGNED) = mc.`id`
SET f.`conf_mode_chauffage` = mc.`nom`;

-- ----------------------------------------------------------------
-- fiches.mode_chauffage : ids -> libellés
-- ----------------------------------------------------------------
UPDATE `fiches` f
INNER JOIN `mode_chauffage` mc
  ON TRIM(CAST(f.`mode_chauffage` AS CHAR)) REGEXP '^[0-9]+$'
  AND CAST(TRIM(f.`mode_chauffage`) AS UNSIGNED) = mc.`id`
SET f.`mode_chauffage` = mc.`nom`;

-- ----------------------------------------------------------------
-- fiches_histo.conf_mode_chauffage (si présente)
-- ----------------------------------------------------------------
SET @has_histo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_mode_chauffage'
);

SET @sql_histo := IF(
  @has_histo > 0,
  'ALTER TABLE `fiches_histo` MODIFY COLUMN `conf_mode_chauffage` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT ''fiches_histo.conf_mode_chauffage absente : rien à faire'' AS info'
);
PREPARE stmt_histo FROM @sql_histo;
EXECUTE stmt_histo;
DEALLOCATE PREPARE stmt_histo;

SET @sql_histo_upd := IF(
  @has_histo > 0,
  'UPDATE `fiches_histo` fh INNER JOIN `mode_chauffage` mc ON TRIM(CAST(fh.`conf_mode_chauffage` AS CHAR)) REGEXP ''^[0-9]+$'' AND CAST(TRIM(fh.`conf_mode_chauffage`) AS UNSIGNED) = mc.`id` SET fh.`conf_mode_chauffage` = mc.`nom`',
  'SELECT ''fiches_histo.conf_mode_chauffage absente : pas de mise à jour histo'' AS info'
);
PREPARE stmt_histo_upd FROM @sql_histo_upd;
EXECUTE stmt_histo_upd;
DEALLOCATE PREPARE stmt_histo_upd;

-- Contrôle rapide (lignes encore strictement numériques = sans correspondance dans mode_chauffage)
SELECT
  'fiches.mode_chauffage encore valeur numerique seule' AS info,
  COUNT(*) AS nb
FROM `fiches`
WHERE `mode_chauffage` IS NOT NULL
  AND TRIM(`mode_chauffage`) REGEXP '^[0-9]+$';

SELECT
  'fiches.conf_mode_chauffage encore valeur numerique seule' AS info,
  COUNT(*) AS nb
FROM `fiches`
WHERE `conf_mode_chauffage` IS NOT NULL
  AND TRIM(`conf_mode_chauffage`) REGEXP '^[0-9]+$';
