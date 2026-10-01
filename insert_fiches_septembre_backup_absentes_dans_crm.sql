-- =====================================================
-- Insertion dans `crm`.`fiches` des fiches sept. 2026
-- présentes dans `crm.backup` mais absentes de `crm`
-- (absentes = aucun tel archive=0 correspondant)
-- =====================================================
-- Critères source (`crm.backup`.`fiches`) :
--   - archive = 0
--   - date_insert_time = septembre 2026
--   - tel non vide
--   - tel absent de `crm`.`fiches` (archive = 0) — date crm non exigée
--   - id absent de `crm`.`fiches` (évite conflit PK)
--   - 1 fiche par tel (MAX id) si plusieurs absentes partagent le même tel
--
-- Colonnes : intersection des colonnes communes entre les 2 tables.
-- =====================================================

SET @annee_septembre = 2026;
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- A) Backup septembre 2026 archive=0
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_backup_sept;
CREATE TEMPORARY TABLE tmp_backup_sept (
  id INT NOT NULL,
  tel VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tel (tel)
) ENGINE=InnoDB;

INSERT INTO tmp_backup_sept (id, tel)
SELECT b.id, TRIM(b.tel)
FROM `crm.backup`.`fiches` b
WHERE IFNULL(b.archive, 0) = 0
  AND b.date_insert_time >= CONCAT(@annee_septembre, '-09-01 00:00:00')
  AND b.date_insert_time <  CONCAT(@annee_septembre, '-10-01 00:00:00')
  AND b.tel IS NOT NULL
  AND b.tel != '';

-- ---------------------------------------------------------------------------
-- B) Tels déjà présents dans crm (archive=0)
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_crm_tel;
CREATE TEMPORARY TABLE tmp_crm_tel (
  tel VARCHAR(50) NOT NULL,
  PRIMARY KEY (tel)
) ENGINE=InnoDB;

INSERT INTO tmp_crm_tel (tel)
SELECT TRIM(c.tel)
FROM `crm`.`fiches` c
WHERE IFNULL(c.archive, 0) = 0
  AND c.tel IS NOT NULL
  AND c.tel != ''
GROUP BY TRIM(c.tel);

-- ---------------------------------------------------------------------------
-- C) Ids à insérer : tel absent + id absent + 1 ligne par tel
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_ids_a_inserer;
CREATE TEMPORARY TABLE tmp_ids_a_inserer (
  id INT NOT NULL,
  tel VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tel (tel)
) ENGINE=InnoDB;

INSERT INTO tmp_ids_a_inserer (id, tel)
SELECT x.id, x.tel
FROM (
  SELECT b.id, b.tel
  FROM tmp_backup_sept b
  LEFT JOIN tmp_crm_tel t ON t.tel = b.tel
  WHERE t.tel IS NULL
    AND NOT EXISTS (SELECT 1 FROM `crm`.`fiches` c WHERE c.id = b.id)
) x
INNER JOIN (
  SELECT b.tel, MAX(b.id) AS max_id
  FROM tmp_backup_sept b
  LEFT JOIN tmp_crm_tel t ON t.tel = b.tel
  WHERE t.tel IS NULL
    AND NOT EXISTS (SELECT 1 FROM `crm`.`fiches` c WHERE c.id = b.id)
  GROUP BY b.tel
) d ON d.max_id = x.id AND d.tel = x.tel;

SELECT COUNT(*) AS nb_a_inserer FROM tmp_ids_a_inserer;

SELECT
  b.id, b.nom, b.prenom, b.tel, b.date_insert_time, b.id_etat_final
FROM `crm.backup`.`fiches` b
INNER JOIN tmp_ids_a_inserer i ON i.id = b.id
ORDER BY b.date_insert_time DESC, b.id DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- D) Colonnes communes (même nom dans backup et crm)
-- ---------------------------------------------------------------------------
SELECT GROUP_CONCAT(CONCAT('`', c1.COLUMN_NAME, '`') ORDER BY c1.ORDINAL_POSITION SEPARATOR ', ')
INTO @cols
FROM INFORMATION_SCHEMA.COLUMNS c1
INNER JOIN INFORMATION_SCHEMA.COLUMNS c2
  ON c2.TABLE_SCHEMA = 'crm'
 AND c2.TABLE_NAME = 'fiches'
 AND c2.COLUMN_NAME = c1.COLUMN_NAME
WHERE c1.TABLE_SCHEMA = 'crm.backup'
  AND c1.TABLE_NAME = 'fiches';

SELECT GROUP_CONCAT(CONCAT('b.`', c1.COLUMN_NAME, '`') ORDER BY c1.ORDINAL_POSITION SEPARATOR ', ')
INTO @cols_b
FROM INFORMATION_SCHEMA.COLUMNS c1
INNER JOIN INFORMATION_SCHEMA.COLUMNS c2
  ON c2.TABLE_SCHEMA = 'crm'
 AND c2.TABLE_NAME = 'fiches'
 AND c2.COLUMN_NAME = c1.COLUMN_NAME
WHERE c1.TABLE_SCHEMA = 'crm.backup'
  AND c1.TABLE_NAME = 'fiches';

SELECT IF(@cols IS NULL OR @cols = '', 'ERREUR: aucune colonne commune', CONCAT('Colonnes communes OK (',
  (LENGTH(@cols) - LENGTH(REPLACE(@cols, ',', '')) + 1), ')')) AS verif_colonnes;

-- ---------------------------------------------------------------------------
-- E) Insertion
-- ---------------------------------------------------------------------------
SET @sql = CONCAT(
  'INSERT INTO `crm`.`fiches` (', @cols, ') ',
  'SELECT ', @cols_b, ' ',
  'FROM `crm.backup`.`fiches` b ',
  'INNER JOIN tmp_ids_a_inserer i ON i.id = b.id'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT ROW_COUNT() AS nb_inserees;

-- ---------------------------------------------------------------------------
-- F) Contrôle
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_encore_absentes_apres_insert
FROM tmp_backup_sept b
LEFT JOIN (
  SELECT TRIM(c.tel) AS tel
  FROM `crm`.`fiches` c
  WHERE IFNULL(c.archive, 0) = 0
    AND c.tel IS NOT NULL AND c.tel != ''
  GROUP BY TRIM(c.tel)
) t ON t.tel = b.tel
WHERE t.tel IS NULL
  AND NOT EXISTS (SELECT 1 FROM `crm`.`fiches` c WHERE c.id = b.id);

DROP TEMPORARY TABLE IF EXISTS tmp_backup_sept;
DROP TEMPORARY TABLE IF EXISTS tmp_crm_tel;
DROP TEMPORARY TABLE IF EXISTS tmp_ids_a_inserer;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

SELECT 'Insertion terminée.' AS message;
