-- Ajouter les colonnes conf_ à la table fiches_histo (alignées sur fiches)
-- Script idempotent : n'ajoute que les colonnes absentes (pas d'erreur "Duplicate column").
--
-- Ces colonnes permettent de conserver dans l'historique les données de confirmation
-- (état 7, création rapide RDV) pour chaque entrée fiches_histo.

USE `crm`;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_fiches_histo_conf_columns_if_missing$$

CREATE PROCEDURE add_fiches_histo_conf_columns_if_missing()
BEGIN
  DECLARE db_name VARCHAR(64) DEFAULT DATABASE();

  -- conf_commentaire_produit
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_commentaire_produit') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_commentaire_produit` TEXT DEFAULT NULL;
  END IF;
  -- conf_consommations
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_consommations') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_consommations` INT(11) DEFAULT NULL;
  END IF;
  -- conf_profession_monsieur
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_profession_monsieur') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_profession_monsieur` INT(11) DEFAULT NULL;
  END IF;
  -- conf_profession_madame
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_profession_madame') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_profession_madame` INT(11) DEFAULT NULL;
  END IF;
  -- conf_presence_couple
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_presence_couple') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_presence_couple` VARCHAR(100) DEFAULT NULL;
  END IF;
  -- conf_produit
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_produit') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_produit` INT(11) DEFAULT NULL;
  END IF;
  -- conf_orientation_toiture
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_orientation_toiture') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_orientation_toiture` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_zones_ombres
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_zones_ombres') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_zones_ombres` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_site_classe
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_site_classe') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_site_classe` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_consommation_electricite
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_consommation_electricite') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_consommation_electricite` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_rdv_avec
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_rdv_avec') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_rdv_avec` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_appel_tunisie_avec
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_appel_tunisie_avec') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_appel_tunisie_avec` VARCHAR(10) DEFAULT NULL COMMENT 'MR/MME';
  END IF;
  -- conf_deja_etude
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_deja_etude') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_deja_etude` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';
  END IF;
  -- conf_revenu
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_revenu') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_revenu` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_credit
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_credit') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_credit` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_mode_chauffage
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_mode_chauffage') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_mode_chauffage` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_complement_chauffage
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_complement_chauffage') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_complement_chauffage` VARCHAR(512) DEFAULT NULL;
  END IF;
  -- complement_chauffage (qualification, snapshot par ligne d'historique)
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'complement_chauffage') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `complement_chauffage` VARCHAR(512) DEFAULT NULL;
  END IF;
  -- conf_consommation_chauffage
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_consommation_chauffage') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_consommation_chauffage` VARCHAR(255) DEFAULT NULL;
  END IF;
  -- conf_rdv_annule_precedent
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_rdv_annule_precedent') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_rdv_annule_precedent` VARCHAR(10) DEFAULT NULL COMMENT 'OUI/NON';
  END IF;
  -- conf_type_contrat_mr
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_type_contrat_mr') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_type_contrat_mr` INT(11) DEFAULT NULL;
  END IF;
  -- conf_type_contrat_madame
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_type_contrat_madame') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_type_contrat_madame` INT(11) DEFAULT NULL;
  END IF;

END$$

DELIMITER ;

CALL add_fiches_histo_conf_columns_if_missing();
DROP PROCEDURE IF EXISTS add_fiches_histo_conf_columns_if_missing;

SELECT 'Colonnes conf_ pour fiches_histo : vérification terminée (colonnes manquantes ajoutées).' AS message;
