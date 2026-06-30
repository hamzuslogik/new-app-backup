-- Détails étude (agent) + champs conf_ pour la confirmation
-- À exécuter une seule fois. En cas d'erreur "Duplicate column", la colonne existe déjà : ignorer.

USE `crm`;

ALTER TABLE `fiches` ADD COLUMN `details_etude` TEXT DEFAULT NULL COMMENT 'Détails si etude=OUI';
ALTER TABLE `fiches` ADD COLUMN `conf_deja_fait_etude` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';
ALTER TABLE `fiches` ADD COLUMN `conf_details_etude` TEXT DEFAULT NULL COMMENT 'Détails si conf_deja_fait_etude=OUI';

ALTER TABLE `fiches_histo` ADD COLUMN `conf_deja_fait_etude` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';
ALTER TABLE `fiches_histo` ADD COLUMN `conf_details_etude` TEXT DEFAULT NULL;

SELECT 'Colonnes details_etude / conf_deja_fait_etude / conf_details_etude ajoutées.' AS message;
