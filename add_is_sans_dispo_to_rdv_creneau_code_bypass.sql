-- =====================================================
-- Ajoute is_sans_dispo : créneau sans valeur de disponibilité
-- (nbr_com NULL / pas de ligne) — distinct de 0 et de > 0
-- =====================================================

USE `crm`;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rdv_creneau_code_bypass'
    AND COLUMN_NAME = 'is_sans_dispo'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `rdv_creneau_code_bypass`
     ADD COLUMN `is_sans_dispo` tinyint(1) NOT NULL DEFAULT 0
       COMMENT ''Aucune disponibilité saisie (null / sans valeur)''
       AFTER `is_zero_dispo`',
  'SELECT ''Colonne is_sans_dispo déjà présente'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'OK is_sans_dispo' AS message;
