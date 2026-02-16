-- =====================================================
-- Ajouter la colonne date_planning à la table signature
-- =====================================================
-- date_planning = date de RDV de la fiche (date planning).
-- Requis pour l'insertion des signatures lors de l'acceptation
-- d'un compte rendu signer (date_heure = date d'acceptation,
-- date_planning = date RDV de la fiche).
-- =====================================================

USE `crm`;

-- Ajouter date_planning si elle n'existe pas (MySQL 8 / MariaDB 10.5+)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'signature'
    AND COLUMN_NAME = 'date_planning'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `signature` ADD COLUMN `date_planning` DATETIME DEFAULT NULL COMMENT ''Date RDV de la fiche (planning)'' AFTER `date_heure`',
  'SELECT ''Colonne date_planning existe déjà.'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Colonne date_planning ajoutée ou déjà présente dans signature.' AS message;
