-- Ajouter les colonnes conf_ pour le formulaire de confirmation (état 7) et création rapide RDV
-- À exécuter une seule fois. En cas d'erreur "Duplicate column", la colonne existe déjà : ignorer.

USE `crm`;

-- Appel en Tunisie avec : Mr ou Mme
ALTER TABLE `fiches` ADD COLUMN `conf_appel_tunisie_avec` VARCHAR(10) DEFAULT NULL COMMENT 'MR/MME';
-- A déjà fait une étude : OUI/NON
ALTER TABLE `fiches` ADD COLUMN `conf_deja_etude` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';
-- Revenu, Crédit
ALTER TABLE `fiches` ADD COLUMN `conf_revenu` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `fiches` ADD COLUMN `conf_credit` VARCHAR(255) DEFAULT NULL;
-- Mode de chauffage (libellé texte, aligné sur fiches.mode_chauffage)
ALTER TABLE `fiches` ADD COLUMN `conf_mode_chauffage` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;
-- Consommation chauffage (conf_consommation_electricite existe déjà)
ALTER TABLE `fiches` ADD COLUMN `conf_consommation_chauffage` VARCHAR(255) DEFAULT NULL;
-- RDV déjà annulé précédemment : OUI/NON
ALTER TABLE `fiches` ADD COLUMN `conf_rdv_annule_precedent` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';

SELECT 'Colonnes conf_ pour confirmation ajoutées.' AS message;
