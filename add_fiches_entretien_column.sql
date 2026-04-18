-- Colonne « Entretien avec » (Vicidial: entretien_avec, yj_fiche: entretient)
-- À exécuter une fois. En cas d'erreur « Duplicate column », la colonne existe déjà : ignorer.

USE `crm`;

ALTER TABLE `fiches` ADD COLUMN `entretien` VARCHAR(200) DEFAULT NULL COMMENT 'Entretien avec (Monsieur/Madame/Couple)' AFTER `situation_conjugale`;

SELECT 'Colonne fiches.entretien ajoutée.' AS message;
