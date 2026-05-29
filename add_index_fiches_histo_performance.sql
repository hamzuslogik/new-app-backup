-- =====================================================
-- Index performance : fiches_histo (« Mes actions sur la fiche »)
-- =====================================================
--
-- #1061 Duplicate key name sur TOUTES les CREATE = les index existent DÉJÀ → c'est bon.
-- Si l'étape C est vide : mauvaise base sélectionnée dans phpMyAdmin, ou table absente.
--
-- phpMyAdmin :
--   1. Cliquez votre base CRM dans la colonne de gauche
--   2. Onglet SQL → exécutez UNIQUEMENT la section DIAGNOSTIC ci-dessous
--   3. Ne relancez pas la section B si vous avez déjà #1061 partout

-- ⚠️ Remplacez crm par le nom exact de votre base si ce n'est pas « crm »
USE `crm`;

-- ---------------------------------------------------------------------
-- DIAGNOSTIC (exécuter en premier — une seule requête à la fois si besoin)
-- ---------------------------------------------------------------------

-- Quelle base est active ?
SELECT DATABASE() AS base_mysql_active;

-- La table existe ?
SELECT COUNT(*) AS table_fiches_histo_existe
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'fiches_histo';

-- TOUS les index de fiches_histo (le plus fiable dans phpMyAdmin)
SHOW INDEX FROM fiches_histo;

-- Index ciblés performance (noms exacts)
SELECT
  index_name,
  GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ', ') AS colonnes,
  index_type,
  non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'fiches_histo'
  AND index_name IN (
    'idx_fiches_histo_confirmateur_date_fiche',
    'idx_fh_date_fiche_id',
    'idx_fh_fiche_id',
    'idx_fh_etat_date_fiche'
  )
GROUP BY index_name, index_type, non_unique
ORDER BY index_name;

-- Couverture fonctionnelle : colonnes requises présentes dans AU MOINS un index ?
SELECT 'confirmateur+date' AS besoin,
  SUM(column_name = 'id_confirmateur') > 0
  AND SUM(column_name = 'date_creation') > 0 AS couvert
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'fiches_histo'
UNION ALL
SELECT 'date+fiche+id',
  SUM(column_name = 'date_creation') > 0
  AND SUM(column_name = 'id_fiche') > 0
  AND SUM(column_name = 'id') > 0
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'fiches_histo'
UNION ALL
SELECT 'fiche+id (max global)',
  SUM(column_name = 'id_fiche') > 0 AND SUM(column_name = 'id') > 0
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'fiches_histo'
UNION ALL
SELECT 'etat+date',
  SUM(column_name = 'id_etat') > 0 AND SUM(column_name = 'date_creation') > 0
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'fiches_histo';

-- ---------------------------------------------------------------------
-- B) Création — seulement si le DIAGNOSTIC montre des index MANQUANTS
--    Erreur #1061 = déjà créé, ne pas réessayer
-- ---------------------------------------------------------------------

-- CREATE INDEX idx_fiches_histo_confirmateur_date_fiche
--   ON fiches_histo (id_confirmateur, date_creation, id_fiche);

-- CREATE INDEX idx_fh_date_fiche_id
--   ON fiches_histo (date_creation, id_fiche, id);

-- CREATE INDEX idx_fh_fiche_id
--   ON fiches_histo (id_fiche, id);

-- CREATE INDEX idx_fh_etat_date_fiche
--   ON fiches_histo (id_etat, date_creation, id_fiche);
