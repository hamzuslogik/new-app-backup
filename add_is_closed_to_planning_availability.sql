-- Ajouter le champ is_closed à la table planning_availablity
-- Ce champ permet de fermer un créneau horaire (uniquement par les administrateurs)
-- Lorsqu'un créneau est fermé (is_closed = 1), personne ne peut créer un RDV dans ce créneau

ALTER TABLE `planning_availablity` 
ADD COLUMN `is_closed` TINYINT(1) DEFAULT 0 AFTER `force_crenaux`;

-- Ajouter un index pour améliorer les performances des requêtes
ALTER TABLE `planning_availablity` 
ADD INDEX `idx_is_closed` (`is_closed`);

