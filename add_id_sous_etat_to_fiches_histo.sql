-- =====================================================
-- Ajout de la colonne id_sous_etat à la table fiches_histo
-- =====================================================
-- À exécuter si la table fiches_histo existe sans cette colonne.
-- Si la colonne existe déjà, ignorer l'erreur "Duplicate column".
-- =====================================================

USE `crm`;

-- Ajouter la colonne id_sous_etat (sous-état de la fiche au moment de l'enregistrement historique)
ALTER TABLE `fiches_histo`
  ADD COLUMN `id_sous_etat` int(11) DEFAULT NULL COMMENT 'Sous-état de la fiche' AFTER `id_etat`;

-- Index pour les requêtes par sous-état (optionnel, ignorer si l'index existe déjà)
ALTER TABLE `fiches_histo`
  ADD INDEX `idx_id_sous_etat` (`id_sous_etat`);

SELECT 'Colonne id_sous_etat ajoutée à fiches_histo.' AS message;
