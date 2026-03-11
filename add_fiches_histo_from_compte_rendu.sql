-- Ajouter from_compte_rendu et id_commercial_cr à fiches_histo pour afficher <CR> + nom commercial
-- Exécuter une seule fois. Si les colonnes existent déjà, ignorer l'erreur "Duplicate column".

USE `crm`;

ALTER TABLE `fiches_histo` ADD COLUMN `from_compte_rendu` TINYINT(1) DEFAULT 0;
ALTER TABLE `fiches_histo` ADD COLUMN `id_commercial_cr` INT(11) DEFAULT NULL;
