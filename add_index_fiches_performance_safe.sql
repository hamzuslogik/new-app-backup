-- Ajouter des index pour optimiser les requêtes de fiches (Version compatible MariaDB)
-- IMPORTANT: Si les index existent déjà, vous obtiendrez une erreur que vous pouvez ignorer
-- Pour supprimer les index existants avant de les recréer, exécutez d'abord les commandes DROP INDEX ci-dessous

-- ÉTAPE 1 (optionnelle): Supprimer les index s'ils existent déjà
-- Décommentez les lignes suivantes si vous voulez supprimer les index existants:
-- DROP INDEX `idx_fiches_archive_ko_active_date_insert` ON `fiches`;
-- DROP INDEX `idx_date_insert_time` ON `fiches`;
-- DROP INDEX `idx_fiches_archive_ko_active_date_modif` ON `fiches`;
-- DROP INDEX `idx_fiches_archive_ko_active_date_rdv` ON `fiches`;

-- ÉTAPE 2: Créer les index
-- Si un index existe déjà, vous obtiendrez une erreur "Duplicate key name" que vous pouvez ignorer

-- Index composite pour les filtres les plus courants (archive, ko, active, date_insert_time)
CREATE INDEX `idx_fiches_archive_ko_active_date_insert` 
ON `fiches` (`archive`, `ko`, `active`, `date_insert_time`);

-- Index pour date_insert_time seul (si utilisé sans les autres filtres)
CREATE INDEX `idx_date_insert_time` 
ON `fiches` (`date_insert_time`);

-- Index composite pour date_modif_time avec archive, ko, active
CREATE INDEX `idx_fiches_archive_ko_active_date_modif` 
ON `fiches` (`archive`, `ko`, `active`, `date_modif_time`);

-- Index pour date_rdv_time avec les filtres de base
CREATE INDEX `idx_fiches_archive_ko_active_date_rdv` 
ON `fiches` (`archive`, `ko`, `active`, `date_rdv_time`);

-- Vérifier les index existants
SHOW INDEX FROM `fiches` WHERE Key_name LIKE 'idx_%';

