-- Script pour supprimer et recréer les index (Version compatible MariaDB)
-- Exécutez ce script si vous voulez supprimer les index existants avant de les recréer

-- ÉTAPE 1: Supprimer les index existants
-- Note: Si un index n'existe pas, vous obtiendrez une erreur que vous pouvez ignorer

DROP INDEX `idx_fiches_archive_ko_active_date_insert` ON `fiches`;
DROP INDEX `idx_date_insert_time` ON `fiches`;
DROP INDEX `idx_fiches_archive_ko_active_date_modif` ON `fiches`;
DROP INDEX `idx_fiches_archive_ko_active_date_rdv` ON `fiches`;

-- ÉTAPE 2: Créer les nouveaux index
-- Exécutez maintenant le fichier add_index_fiches_performance.sql

