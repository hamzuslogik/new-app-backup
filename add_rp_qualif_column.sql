-- Ajouter la colonne id_rp_qualif à la table utilisateurs
-- Cette colonne permet de lier chaque superviseur qualification (RE Qualification) à un RP Qualification
-- 
-- Hiérarchie (relation 1-to-many) :
-- - RP Qualification (fonction 2) : peut avoir plusieurs superviseurs sous sa responsabilité
-- - RE Qualification (utilisateurs avec agents sous leur responsabilité) : supervise les agents (fonction 3), assigné à un RP Qualification via id_rp_qualif
-- - Agent Qualification (fonction 3) : créent les fiches, assignés à un RE Qualification via chef_equipe

USE `crm`;

-- Vérifier et ajouter la colonne id_rp_qualif si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'utilisateurs';
SET @columnname = 'id_rp_qualif';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` INT(11) NULL DEFAULT NULL AFTER `chef_equipe`, ADD KEY `idx_id_rp_qualif` (`', @columnname, '`)'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification
SELECT 'Colonne id_rp_qualif ajoutée avec succès à la table utilisateurs' AS message;

-- Afficher la structure de la table
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'utilisateurs'
  AND COLUMN_NAME IN ('chef_equipe', 'id_rp_qualif', 'fonction')
ORDER BY ORDINAL_POSITION;

