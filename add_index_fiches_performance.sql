-- Ajouter des index pour optimiser les requêtes de fiches
-- Ces index amélioreront les performances des requêtes filtrées par date_insert_time, archive, ko, active
-- 
-- IMPORTANT: MariaDB ne supporte pas "IF NOT EXISTS" pour CREATE INDEX
-- Si un index existe déjà, vous obtiendrez une erreur que vous pouvez ignorer

-- Index composite pour les filtres les plus courants (archive, ko, active, date_insert_time)
-- Exécuter cette commande même si elle peut donner une erreur si l'index existe déjà
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
SHOW INDEX FROM `fiches`;

