-- =====================================================
-- Ajout de la colonne date_planning à la table confirmations
-- =====================================================
-- À exécuter une fois si la table confirmations existe
-- sans cette colonne (ex. table créée avant cette évolution).
-- =====================================================

USE `crm`;

-- Ajouter la colonne date_planning (date/heure du RDV)
ALTER TABLE `confirmations`
  ADD COLUMN `date_planning` datetime DEFAULT NULL COMMENT 'Date/heure du RDV' AFTER `id_fiche`;

-- Index pour les requêtes par date (commenter si l'index existe déjà)
ALTER TABLE `confirmations`
  ADD INDEX `idx_date_planning` (`date_planning`);

SELECT 'Colonne date_planning ajoutée à confirmations.' AS message;
