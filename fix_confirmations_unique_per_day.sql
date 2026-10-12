-- =====================================================
-- confirmations : anti-doublon (1 ligne / fiche / jour de confirmation)
-- Compatible MariaDB (PERSISTENT, pas STORED)
-- =====================================================
-- 1) Dédoublonne les lignes existantes (garde l'id le plus récent)
-- 2) Ajoute confirmation_day (colonne générée PERSISTENT ou colonne DATE classique)
-- 3) UNIQUE (id_fiche, confirmation_day)
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- 1) Garder la ligne la plus récente par (id_fiche, jour de confirmation)
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND DATE(COALESCE(c_old.date_confirmation, c_old.date_creation, c_old.date_rdv_time))
   = DATE(COALESCE(c_keep.date_confirmation, c_keep.date_creation, c_keep.date_rdv_time))
 AND c_old.id < c_keep.id;

-- 2) Colonne confirmation_day si absente
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'confirmations'
    AND COLUMN_NAME = 'confirmation_day'
);

-- MariaDB : AS (...) PERSISTENT  |  MySQL 5.7+/8 : GENERATED ALWAYS AS (...) STORED
-- On utilise une colonne DATE classique + UPDATE (portable partout).
SET @sql_add_col := IF(
  @col_exists = 0,
  'ALTER TABLE `confirmations` ADD COLUMN `confirmation_day` DATE DEFAULT NULL AFTER `date_confirmation`',
  'SELECT ''colonne confirmation_day déjà présente'' AS info'
);
PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remplir / rafraîchir confirmation_day
UPDATE `confirmations`
SET `confirmation_day` = DATE(COALESCE(`date_confirmation`, `date_creation`, `date_rdv_time`))
WHERE `confirmation_day` IS NULL
   OR `confirmation_day` <> DATE(COALESCE(`date_confirmation`, `date_creation`, `date_rdv_time`));

-- Dédoublonner encore au cas où confirmation_day crée des collisions après UPDATE
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.confirmation_day <=> c_keep.confirmation_day
 AND c_old.id < c_keep.id;

-- 3) Index unique
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'confirmations'
    AND INDEX_NAME = 'uk_fiche_confirmation_day'
);
SET @sql_add_idx := IF(
  @idx_exists = 0,
  'ALTER TABLE `confirmations` ADD UNIQUE KEY `uk_fiche_confirmation_day` (`id_fiche`, `confirmation_day`)',
  'SELECT ''index uk_fiche_confirmation_day déjà présent'' AS info'
);
PREPARE stmt2 FROM @sql_add_idx;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SELECT 'confirmations : dédoublonnage + UNIQUE (id_fiche, confirmation_day) OK' AS message;
