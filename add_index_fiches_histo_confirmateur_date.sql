-- =====================================================
-- Index pour optimiser le filtre "fiches statuées par le confirmateur"
-- (date_champ = fiches_histo) sur le Dashboard
-- =====================================================
--
-- Problème : La requête EXISTS sur fiches_histo (id_confirmateur, date_creation) 
-- est lente (~5s) car l'optimiseur scanne fiches puis exécute le sous-requête pour chaque ligne.
--
-- Solution : Index composite permettant une recherche rapide par
-- id_confirmateur + plage date_creation + id_fiche
--
-- À exécuter : mysql -u user -p crm < add_index_fiches_histo_confirmateur_date.sql
-- =====================================================

USE `crm`;

-- Index pour la requête JOIN (plus rapide) : partir de fiches_histo filtré par confirmateur+date
-- SELECT DISTINCT id_fiche FROM fiches_histo WHERE id_confirmateur=? AND date_creation BETWEEN ? AND ?
-- (MariaDB et MySQL < 8.0.13 : pas de IF NOT EXISTS sur CREATE INDEX)
CREATE INDEX idx_fiches_histo_confirmateur_date_fiche 
ON fiches_histo (id_confirmateur, date_creation, id_fiche);

SELECT 'Index idx_fiches_histo_confirmateur_date_fiche créé sur fiches_histo.' AS message;
