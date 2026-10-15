-- =====================================================
-- Ajoute la colonne `from` (expéditeur / sender SMS)
-- à la table fournisseurs_sms si elle n'existe pas
-- =====================================================

USE `crm`;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fournisseurs_sms'
    AND COLUMN_NAME = 'from'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `fournisseurs_sms` ADD COLUMN `from` VARCHAR(11) CHARACTER SET utf8 DEFAULT ''RAPPEL'' COMMENT ''Expéditeur SMS (sender)'' AFTER `api_url`',
  'SELECT ''Colonne from déjà présente'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `fournisseurs_sms`
SET `from` = 'RAPPEL'
WHERE `from` IS NULL OR TRIM(`from`) = '';

SELECT id, nom, `from`, actif
FROM `fournisseurs_sms`
ORDER BY id;
