-- =====================================================
-- Migration: Ajout du champ nb_pans à la table fiches
-- =====================================================
-- Description: Ajoute le champ nb_pans pour les produits PV
-- Date: 2024

-- Vérifier si la colonne existe déjà avant de l'ajouter
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'fiches' 
    AND COLUMN_NAME = 'nb_pans'
);

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `fiches` ADD COLUMN `nb_pans` INT(11) DEFAULT NULL AFTER `nb_pieces`',
    'SELECT "La colonne nb_pans existe déjà" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter un index si nécessaire (optionnel)
-- ALTER TABLE `fiches` ADD INDEX `idx_nb_pans` (`nb_pans`);

SELECT 'Migration terminée: Colonne nb_pans ajoutée à la table fiches' AS result;

