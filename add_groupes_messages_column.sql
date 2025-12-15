-- =====================================================
-- Script pour ajouter la colonne groupes_messages_autorises à la table fonctions
-- Base de données: crm
-- Cette colonne stocke les IDs des fonctions auxquelles cette fonction peut envoyer des messages
-- Format JSON: [1, 2, 3] ou NULL pour autoriser toutes les fonctions
-- =====================================================

USE `crm`;

-- Vérifier et ajouter la colonne groupes_messages_autorises si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'fonctions';
SET @columnname = 'groupes_messages_autorises';

-- Vérifier si la colonne existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

-- Ajouter la colonne si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT NULL DEFAULT NULL AFTER `page_accueil`'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification
SELECT 'Colonne groupes_messages_autorises ajoutée avec succès à la table fonctions' AS message;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fonctions'
  AND COLUMN_NAME = 'groupes_messages_autorises';

-- Afficher les valeurs actuelles (NULL par défaut = toutes les fonctions autorisées)
SELECT id, titre, groupes_messages_autorises FROM fonctions ORDER BY id;

