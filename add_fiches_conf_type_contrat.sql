-- Ajouter les colonnes conf_type_contrat_mr et conf_type_contrat_madame à la table fiches
-- Exécuter une seule fois. Si les colonnes existent déjà, ignorer l'erreur "Duplicate column".

USE `crm`;

ALTER TABLE `fiches` ADD COLUMN `conf_type_contrat_mr` INT(11) DEFAULT NULL;
ALTER TABLE `fiches` ADD COLUMN `conf_type_contrat_madame` INT(11) DEFAULT NULL;
