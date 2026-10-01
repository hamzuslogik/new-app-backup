-- =====================================================
-- Diagnostic RAPIDE : fiches sept. 2026 dans `crm.backup`
-- absentes de `crm`.`fiches` (match par téléphone)
-- =====================================================
-- Optimisation :
--   1) extraire les ensembles utiles en tables TEMP
--   2) normaliser le tel une seule fois
--   3) indexer, puis LEFT JOIN (évite TRIM() sur JOIN)
-- Affiche : quantité + 10 absentes + 10 trouvées
-- =====================================================

SET @annee_septembre = 2026;

-- ---------------------------------------------------------------------------
-- A) Backup : fiches sept. 2026, archive=0, tel non vide
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_backup_sept;
CREATE TEMPORARY TABLE tmp_backup_sept (
  id INT NOT NULL,
  nom VARCHAR(255),
  prenom VARCHAR(255),
  tel VARCHAR(50) NOT NULL,
  date_insert_time DATETIME,
  id_etat_final INT,
  id_agent INT,
  id_commercial INT,
  PRIMARY KEY (id),
  KEY idx_tel (tel)
) ENGINE=InnoDB;

INSERT INTO tmp_backup_sept (id, nom, prenom, tel, date_insert_time, id_etat_final, id_agent, id_commercial)
SELECT
  b.id,
  b.nom,
  b.prenom,
  TRIM(b.tel) AS tel,
  b.date_insert_time,
  b.id_etat_final,
  b.id_agent,
  b.id_commercial
FROM `crm.backup`.`fiches` b
WHERE IFNULL(b.archive, 0) = 0
  AND b.date_insert_time >= CONCAT(@annee_septembre, '-09-01 00:00:00')
  AND b.date_insert_time <  CONCAT(@annee_septembre, '-10-01 00:00:00')
  AND b.tel IS NOT NULL
  AND b.tel != '';

SELECT COUNT(*) AS nb_backup_septembre_archive0 FROM tmp_backup_sept;

-- ---------------------------------------------------------------------------
-- B) CRM : téléphones distincts archive=0 (pas de filtre date)
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_crm_tel;
CREATE TEMPORARY TABLE tmp_crm_tel (
  tel VARCHAR(50) NOT NULL,
  id_crm INT NOT NULL,
  date_insert_time DATETIME,
  PRIMARY KEY (tel)
) ENGINE=InnoDB;

-- Un id_crm représentatif par tel (MAX id)
INSERT INTO tmp_crm_tel (tel, id_crm, date_insert_time)
SELECT
  TRIM(c.tel) AS tel,
  MAX(c.id) AS id_crm,
  MAX(c.date_insert_time) AS date_insert_time
FROM `crm`.`fiches` c
WHERE IFNULL(c.archive, 0) = 0
  AND c.tel IS NOT NULL
  AND c.tel != ''
GROUP BY TRIM(c.tel);

SELECT COUNT(*) AS nb_tels_crm_archive0 FROM tmp_crm_tel;

-- ---------------------------------------------------------------------------
-- 1) Quantité absentes (backup sept. sans tel dans crm)
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_fiches_backup_septembre_absentes_de_crm_par_tel
FROM tmp_backup_sept b
LEFT JOIN tmp_crm_tel t ON t.tel = b.tel
WHERE t.tel IS NULL;

-- ---------------------------------------------------------------------------
-- 2) 10 exemples absentes
-- ---------------------------------------------------------------------------
SELECT
  b.id,
  b.nom,
  b.prenom,
  b.tel,
  b.date_insert_time,
  b.id_etat_final,
  b.id_agent,
  b.id_commercial
FROM tmp_backup_sept b
LEFT JOIN tmp_crm_tel t ON t.tel = b.tel
WHERE t.tel IS NULL
ORDER BY b.date_insert_time DESC, b.id DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- 3) 10 exemples trouvées (même tel, dates peuvent différer)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS id_backup,
  b.tel,
  b.date_insert_time AS date_insert_backup,
  t.id_crm,
  t.date_insert_time AS date_insert_crm
FROM tmp_backup_sept b
INNER JOIN tmp_crm_tel t ON t.tel = b.tel
ORDER BY b.date_insert_time DESC, b.id DESC
LIMIT 10;

DROP TEMPORARY TABLE IF EXISTS tmp_backup_sept;
DROP TEMPORARY TABLE IF EXISTS tmp_crm_tel;

SELECT 'Script terminé.' AS message;
