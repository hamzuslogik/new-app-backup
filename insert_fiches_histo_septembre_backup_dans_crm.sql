-- =====================================================
-- Insertion dans `crm`.`fiches_histo` depuis `crm.backup`
-- pour les fiches septembre 2026 du diagnostic
-- =====================================================
-- Prérequis : les fiches ont déjà été insérées dans `crm`.`fiches`
--   (ex. insert_fiches_septembre_backup_absentes_dans_crm.sql)
--
-- Cibles :
--   - fiches dans `crm.backup` : archive=0, date_insert_time = sept. 2026
--   - id présent dans `crm`.`fiches` (sinon histo orphelin → ignoré)
--   - lignes `crm.backup`.`fiches_histo` dont l'id n'existe PAS encore
--     dans `crm`.`fiches_histo`
--
-- Colonnes : intersection des colonnes communes entre les 2 tables histo.
-- Idempotent : relancer n'insère que les lignes manquantes.
-- =====================================================

SET @annee_septembre = 2026;
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- A) Ids fiches cibles (backup sept. 2026 déjà présentes dans crm.fiches)
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_fiches_cibles;
CREATE TEMPORARY TABLE tmp_fiches_cibles (
  id INT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO tmp_fiches_cibles (id)
SELECT b.id
FROM `crm.backup`.`fiches` b
INNER JOIN `crm`.`fiches` c ON c.id = b.id
WHERE IFNULL(b.archive, 0) = 0
  AND b.date_insert_time >= CONCAT(@annee_septembre, '-09-01 00:00:00')
  AND b.date_insert_time <  CONCAT(@annee_septembre, '-10-01 00:00:00');

SELECT COUNT(*) AS nb_fiches_cibles FROM tmp_fiches_cibles;

-- ---------------------------------------------------------------------------
-- B) Lignes histo backup à insérer (id histo absent de crm)
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_histo_a_inserer;
CREATE TEMPORARY TABLE tmp_histo_a_inserer (
  id INT NOT NULL,
  id_fiche INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_id_fiche (id_fiche)
) ENGINE=InnoDB;

INSERT INTO tmp_histo_a_inserer (id, id_fiche)
SELECT h.id, h.id_fiche
FROM `crm.backup`.`fiches_histo` h
INNER JOIN tmp_fiches_cibles f ON f.id = h.id_fiche
WHERE NOT EXISTS (
  SELECT 1 FROM `crm`.`fiches_histo` c WHERE c.id = h.id
);

SELECT COUNT(*) AS nb_lignes_histo_a_inserer FROM tmp_histo_a_inserer;
SELECT COUNT(DISTINCT id_fiche) AS nb_fiches_concernées FROM tmp_histo_a_inserer;

-- 10 exemples
SELECT
  h.id AS id_histo,
  h.id_fiche,
  h.id_etat,
  h.date_creation,
  h.date_rdv_time,
  h.id_commercial
FROM `crm.backup`.`fiches_histo` h
INNER JOIN tmp_histo_a_inserer i ON i.id = h.id
ORDER BY h.date_creation DESC, h.id DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- C) Colonnes communes fiches_histo
-- ---------------------------------------------------------------------------
SELECT GROUP_CONCAT(CONCAT('`', c1.COLUMN_NAME, '`') ORDER BY c1.ORDINAL_POSITION SEPARATOR ', ')
INTO @cols
FROM INFORMATION_SCHEMA.COLUMNS c1
INNER JOIN INFORMATION_SCHEMA.COLUMNS c2
  ON c2.TABLE_SCHEMA = 'crm'
 AND c2.TABLE_NAME = 'fiches_histo'
 AND c2.COLUMN_NAME = c1.COLUMN_NAME
WHERE c1.TABLE_SCHEMA = 'crm.backup'
  AND c1.TABLE_NAME = 'fiches_histo';

SELECT GROUP_CONCAT(CONCAT('h.`', c1.COLUMN_NAME, '`') ORDER BY c1.ORDINAL_POSITION SEPARATOR ', ')
INTO @cols_h
FROM INFORMATION_SCHEMA.COLUMNS c1
INNER JOIN INFORMATION_SCHEMA.COLUMNS c2
  ON c2.TABLE_SCHEMA = 'crm'
 AND c2.TABLE_NAME = 'fiches_histo'
 AND c2.COLUMN_NAME = c1.COLUMN_NAME
WHERE c1.TABLE_SCHEMA = 'crm.backup'
  AND c1.TABLE_NAME = 'fiches_histo';

SELECT IF(@cols IS NULL OR @cols = '', 'ERREUR: aucune colonne commune', CONCAT('Colonnes communes OK (',
  (LENGTH(@cols) - LENGTH(REPLACE(@cols, ',', '')) + 1), ')')) AS verif_colonnes;

-- ---------------------------------------------------------------------------
-- D) Insertion
-- ---------------------------------------------------------------------------
SET @sql = CONCAT(
  'INSERT INTO `crm`.`fiches_histo` (', @cols, ') ',
  'SELECT ', @cols_h, ' ',
  'FROM `crm.backup`.`fiches_histo` h ',
  'INNER JOIN tmp_histo_a_inserer i ON i.id = h.id'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT ROW_COUNT() AS nb_histo_inserees;

-- ---------------------------------------------------------------------------
-- E) Contrôle
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_histo_backup_encore_absentes
FROM `crm.backup`.`fiches_histo` h
INNER JOIN tmp_fiches_cibles f ON f.id = h.id_fiche
WHERE NOT EXISTS (
  SELECT 1 FROM `crm`.`fiches_histo` c WHERE c.id = h.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_fiches_cibles;
DROP TEMPORARY TABLE IF EXISTS tmp_histo_a_inserer;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

SELECT 'Insertion historique terminée.' AS message;
