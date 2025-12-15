-- Script simple pour ajouter la colonne conf_rdv_avec à la table fiches
-- Exécuter ce script dans votre base de données MySQL

ALTER TABLE `fiches` 
ADD COLUMN `conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL 
AFTER `conf_consommation_electricite`;

