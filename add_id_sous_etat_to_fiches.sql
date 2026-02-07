-- =====================================================
-- Ajout de la colonne id_sous_etat à la table fiches
-- =====================================================
-- À exécuter pour activer le filtre par sous-état sur
-- le Dashboard et la page Fiches. Si la colonne existe
-- déjà, vous pouvez ignorer l'erreur "Duplicate column".
-- =====================================================

USE `crm`;

ALTER TABLE `fiches`
  ADD COLUMN `id_sous_etat` int(11) DEFAULT NULL COMMENT 'Sous-état de la fiche' AFTER `id_etat_final`;

ALTER TABLE `fiches`
  ADD INDEX `idx_id_sous_etat` (`id_sous_etat`);

SELECT 'Colonne id_sous_etat ajoutée à fiches.' AS message;
