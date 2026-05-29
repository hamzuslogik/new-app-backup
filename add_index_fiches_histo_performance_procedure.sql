-- =====================================================
-- Variante idempotente (mysql en ligne de commande uniquement)
-- Crée les index seulement s’ils manquent — pas de PREPARE.
-- =====================================================
-- mysql -u user -p crm < add_index_fiches_histo_performance_procedure.sql

USE `crm`;

DROP PROCEDURE IF EXISTS sp_add_fiches_histo_perf_indexes;

DELIMITER //

CREATE PROCEDURE sp_add_fiches_histo_perf_indexes()
BEGIN
  DECLARE dbname VARCHAR(64) CHARACTER SET utf8mb4;
  SET dbname = DATABASE();

  IF (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = dbname
      AND table_name = 'fiches_histo'
      AND index_name = 'idx_fiches_histo_confirmateur_date_fiche'
  ) = 0 THEN
    CREATE INDEX idx_fiches_histo_confirmateur_date_fiche
      ON fiches_histo (id_confirmateur, date_creation, id_fiche);
  END IF;

  IF (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = dbname
      AND table_name = 'fiches_histo'
      AND index_name = 'idx_fh_date_fiche_id'
  ) = 0 THEN
    CREATE INDEX idx_fh_date_fiche_id
      ON fiches_histo (date_creation, id_fiche, id);
  END IF;

  IF (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = dbname
      AND table_name = 'fiches_histo'
      AND index_name = 'idx_fh_fiche_id'
  ) = 0 THEN
    CREATE INDEX idx_fh_fiche_id
      ON fiches_histo (id_fiche, id);
  END IF;

  IF (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = dbname
      AND table_name = 'fiches_histo'
      AND index_name = 'idx_fh_etat_date_fiche'
  ) = 0 THEN
    CREATE INDEX idx_fh_etat_date_fiche
      ON fiches_histo (id_etat, date_creation, id_fiche);
  END IF;
END //

DELIMITER ;

CALL sp_add_fiches_histo_perf_indexes();
DROP PROCEDURE IF EXISTS sp_add_fiches_histo_perf_indexes;

SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS colonnes
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'fiches_histo'
  AND index_name IN (
    'idx_fiches_histo_confirmateur_date_fiche',
    'idx_fh_date_fiche_id',
    'idx_fh_fiche_id',
    'idx_fh_etat_date_fiche'
  )
GROUP BY index_name
ORDER BY index_name;
