-- Ajouter la colonne isolation à la table fiches (détail étude / isolation)
-- Exécuter une seule fois. Si la colonne existe déjà, ignorer l'erreur "Duplicate column".

USE `crm`;

ALTER TABLE `fiches` ADD COLUMN `isolation` VARCHAR(255) DEFAULT NULL;
