-- =====================================================
-- Index performance : Dashboard « Mes actions (fiches_histo) »
-- et stats confirmateur (dernière ligne dans la plage)
-- =====================================================
-- Exécuter une fois : mysql -u user -p crm < add_index_fiches_histo_performance.sql
-- Les CREATE INDEX échouent si l'index existe déjà (ignorer l'erreur ou vérifier SHOW INDEX).

USE `crm`;

-- Confirmateur + plage (si absent : voir aussi add_index_fiches_histo_confirmateur_date.sql)
CREATE INDEX idx_fiches_histo_confirmateur_date_fiche
  ON fiches_histo (id_confirmateur, date_creation, id_fiche);

-- MAX(id) par fiche dans une plage de dates (« dernière action dans la période »)
CREATE INDEX idx_fh_date_fiche_id
  ON fiches_histo (date_creation, id_fiche, id);

-- MAX(id) global par fiche (candidats filtrés)
CREATE INDEX idx_fh_fiche_id
  ON fiches_histo (id_fiche, id);

-- Fiches confirmées du jour (id_etat = 7)
CREATE INDEX idx_fh_etat_date_fiche
  ON fiches_histo (id_etat, date_creation, id_fiche);

SELECT 'Index fiches_histo performance : exécution terminée (ignorer Duplicate key name si index déjà présent).' AS message;
