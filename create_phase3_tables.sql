-- =====================================================
-- Script pour créer/mettre à jour les tables Phase 3
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- Mise à jour de la table compte_rendu
-- =====================================================
-- Vérifier si les colonnes existent et les ajouter si nécessaire
SET @dbname = SCHEMA();
SET @tablename = 'compte_rendu';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'date_visite')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `date_visite` datetime DEFAULT NULL AFTER `id_commercial`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'etat')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `etat` int(11) DEFAULT 0 AFTER `date_creation`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'compte_rendu')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `compte_rendu` text CHARACTER SET utf8 DEFAULT NULL AFTER `etat`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'etat_fiche')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `etat_fiche` int(11) DEFAULT NULL AFTER `compte_rendu`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'sous_etat')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `sous_etat` int(11) DEFAULT 0 AFTER `etat_fiche`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'rappel')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `rappel` datetime DEFAULT NULL AFTER `sous_etat`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Renommer la colonne contenu en compte_rendu si elle existe
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'contenu')
      AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE table_name = @tablename AND table_schema = @dbname AND column_name = 'compte_rendu') = 0
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' CHANGE COLUMN `contenu` `compte_rendu` text CHARACTER SET utf8 DEFAULT NULL;'),
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Renommer date_creation en date_modif si nécessaire
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'date_creation')
      AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE table_name = @tablename AND table_schema = @dbname AND column_name = 'date_modif') = 0
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' CHANGE COLUMN `date_creation` `date_modif` datetime DEFAULT NULL;'),
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- TABLE: visite_name
-- =====================================================
CREATE TABLE IF NOT EXISTS `visite_name` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_user` int(11) DEFAULT NULL,
  `id_etat` int(11) DEFAULT NULL,
  `name_visite` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `date_modif` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_user` (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification
SELECT 'Tables Phase 3 créées/mises à jour avec succès' AS message;

