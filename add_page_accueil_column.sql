-- =====================================================
-- Script pour ajouter la colonne page_accueil à la table fonctions
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Vérifier et ajouter la colonne page_accueil si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'fonctions';
SET @columnname = 'page_accueil';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(255) NULL DEFAULT NULL AFTER `etat`'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mettre à jour les valeurs par défaut pour les fonctions existantes
-- Fonction 3 (Agent) : /fiches
UPDATE `fonctions` SET `page_accueil` = '/fiches' WHERE `id` = 3 AND (`page_accueil` IS NULL OR `page_accueil` = '');

-- Fonction 4 (Qualité Qualification) : /controle-qualite
UPDATE `fonctions` SET `page_accueil` = '/controle-qualite' WHERE `id` = 4 AND (`page_accueil` IS NULL OR `page_accueil` = '');

-- Fonction 5 (Commercial) : /planning-commercial
UPDATE `fonctions` SET `page_accueil` = '/planning-commercial' WHERE `id` = 5 AND (`page_accueil` IS NULL OR `page_accueil` = '');

-- Fonction 12 (RP Qualification) : /production-qualif
UPDATE `fonctions` SET `page_accueil` = '/production-qualif' WHERE `id` = 12 AND (`page_accueil` IS NULL OR `page_accueil` = '');

-- Autres fonctions : /dashboard (par défaut)
UPDATE `fonctions` SET `page_accueil` = '/dashboard' WHERE (`page_accueil` IS NULL OR `page_accueil` = '');

-- Vérification
SELECT 'Colonne page_accueil ajoutée avec succès à la table fonctions' AS message;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fonctions'
  AND COLUMN_NAME = 'page_accueil';

-- Afficher les valeurs configurées
SELECT id, titre, page_accueil FROM fonctions ORDER BY id;

