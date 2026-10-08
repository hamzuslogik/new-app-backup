-- =====================================================
-- TEST (5 fiches) : backfill id_commercial sur fiches_histo
-- état SIGNER (id_etat = 13) depuis yj_histo_fiche / yj_fiche_histo
-- =====================================================
-- Source des cibles : premières lignes de « fiches_histo (1).csv »
--   (id_etat=13, id_commercial vide ou 0)
--
-- Ce script :
--   1) diagnostique pourquoi id_commercial n'est pas renseigné (jointure YJ)
--   2) met à jour UNIQUEMENT id_commercial (et préserve date_modif*)
--   3) limite à 5 lignes histo pour valider la fiabilité
--
-- Ne touche PAS au script de migration complète.
-- Après validation, on pourra étendre à tout le CSV.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;
SET @TEST_LIMIT = 5;

-- =====================================================
-- ÉTAPE 0 : cibles TEST (5 premières lignes du CSV)
-- =====================================================
DROP TEMPORARY TABLE IF EXISTS tmp_fh_signer_test;
CREATE TEMPORARY TABLE tmp_fh_signer_test (
  fh_id INT NOT NULL PRIMARY KEY,
  id_fiche INT NOT NULL,
  date_creation DATETIME NOT NULL,
  id_commercial_csv VARCHAR(32) NULL
);

INSERT INTO tmp_fh_signer_test (fh_id, id_fiche, date_creation, id_commercial_csv) VALUES
  (40,  14,  '2016-06-23 09:40:00', NULL),
  (142, 63,  '2016-06-24 09:30:00', '0'),
  (497, 246, '2016-08-03 11:30:00', '0'),
  (507, 250, '2016-09-25 20:09:00', '0'),
  (556, 269, '2016-07-22 13:13:00', '0');

SELECT '=== CIBLES TEST (CSV) ===' AS info;
SELECT * FROM tmp_fh_signer_test ORDER BY fh_id;

-- =====================================================
-- ÉTAPE 1 : détecter table YJ + colonnes utiles
-- =====================================================
SET @yj_source_table = (
  SELECT t.table_name
  FROM information_schema.tables t
  WHERE t.table_schema = DATABASE()
    AND t.table_name IN ('yj_histo_fiche', 'yj_fiche_histo')
  ORDER BY FIELD(t.table_name, 'yj_histo_fiche', 'yj_fiche_histo')
  LIMIT 1
);

SELECT IFNULL(@yj_source_table, 'AUCUNE') AS table_yj_utilisee;

DROP TEMPORARY TABLE IF EXISTS temp_yj_cols;
CREATE TEMPORARY TABLE temp_yj_cols (col_name VARCHAR(128) PRIMARY KEY);
INSERT INTO temp_yj_cols (col_name)
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = @yj_source_table;

SET @id_fiche_col = (
  SELECT col_name FROM temp_yj_cols
  WHERE LOWER(TRIM(col_name)) IN ('id_fiche', 'fiche_id', 'id')
  ORDER BY FIELD(LOWER(TRIM(col_name)), 'id_fiche', 'fiche_id', 'id')
  LIMIT 1
);
SET @etat_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'etat' LIMIT 1);
SET @id_etat_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'id_etat' LIMIT 1);
SET @etat_final_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'etat_final' LIMIT 1);
SET @date_heure_mod_col = (
  SELECT col_name FROM temp_yj_cols
  WHERE LOWER(TRIM(col_name)) IN ('date_heure_mod', 'date_modif_time', 'date_heure_modif')
  ORDER BY FIELD(LOWER(TRIM(col_name)), 'date_heure_mod', 'date_modif_time', 'date_heure_modif')
  LIMIT 1
);
SET @date_creation_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'date_creation' LIMIT 1);
SET @date_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'date' LIMIT 1);
SET @id_commercial_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'id_commercial' LIMIT 1);
SET @pseudo_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'pseudo' LIMIT 1);

-- Colonnes date_modif* côté fiches_histo (à préserver)
SET @fh_has_date_modif = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'date_modif'
);
SET @fh_has_date_modif_time = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'date_modif_time'
);
SET @fh_has_date_modification = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'date_modification'
);

SELECT
  @id_fiche_col AS yj_id_fiche_col,
  @etat_col AS yj_etat_col,
  @id_etat_col AS yj_id_etat_col,
  @etat_final_col AS yj_etat_final_col,
  @date_heure_mod_col AS yj_date_heure_mod_col,
  @date_creation_col AS yj_date_creation_col,
  @id_commercial_col AS yj_id_commercial_col,
  @pseudo_col AS yj_pseudo_col,
  @fh_has_date_modif AS fh_has_date_modif,
  @fh_has_date_modif_time AS fh_has_date_modif_time,
  @fh_has_date_modification AS fh_has_date_modification;

-- Expressions dynamiques
SET @yj_id_fiche_expr = CONCAT('yj.`', REPLACE(@id_fiche_col, '`', ''), '`');
SET @yj_date_expr = CASE
  WHEN @date_heure_mod_col IS NOT NULL AND @date_creation_col IS NOT NULL
    THEN CONCAT('COALESCE(yj.`', REPLACE(@date_heure_mod_col, '`', ''), '`, yj.`', REPLACE(@date_creation_col, '`', ''), '`)')
  WHEN @date_heure_mod_col IS NOT NULL AND @date_col IS NOT NULL
    THEN CONCAT('COALESCE(yj.`', REPLACE(@date_heure_mod_col, '`', ''), '`, yj.`', REPLACE(@date_col, '`', ''), '`)')
  WHEN @date_heure_mod_col IS NOT NULL
    THEN CONCAT('yj.`', REPLACE(@date_heure_mod_col, '`', ''), '`')
  WHEN @date_creation_col IS NOT NULL
    THEN CONCAT('yj.`', REPLACE(@date_creation_col, '`', ''), '`')
  WHEN @date_col IS NOT NULL
    THEN CONCAT('yj.`', REPLACE(@date_col, '`', ''), '`')
  ELSE 'NULL'
END;
SET @yj_id_commercial_expr = IF(
  @id_commercial_col IS NOT NULL,
  CONCAT('CAST(yj.`', REPLACE(@id_commercial_col, '`', ''), '` AS UNSIGNED)'),
  'NULL'
);
SET @yj_pseudo_expr = IF(
  @pseudo_col IS NOT NULL,
  CONCAT('yj.`', REPLACE(@pseudo_col, '`', ''), '`'),
  'NULL'
);

-- Match état SIGNER / 13 (même logique large que la migration)
SET @yj_etat_match = CONCAT(
  '(',
  IF(@id_etat_col IS NOT NULL,
     CONCAT('CAST(yj.`', REPLACE(@id_etat_col, '`', ''), '` AS UNSIGNED) = 13 OR '),
     ''),
  IF(@etat_col IS NOT NULL,
     CONCAT(
       'CAST(yj.`', REPLACE(@etat_col, '`', ''), '` AS CHAR) REGEXP ''^[0-9]+$'' AND CAST(yj.`', REPLACE(@etat_col, '`', ''), '` AS UNSIGNED) = 13 OR ',
       'UPPER(CAST(yj.`', REPLACE(@etat_col, '`', ''), '` AS CHAR)) LIKE ''%SIGNER%'' OR '
     ),
     ''),
  IF(@etat_final_col IS NOT NULL,
     CONCAT(
       'CAST(yj.`', REPLACE(@etat_final_col, '`', ''), '` AS CHAR) REGEXP ''^[0-9]+$'' AND CAST(yj.`', REPLACE(@etat_final_col, '`', ''), '` AS UNSIGNED) = 13 OR ',
       'UPPER(CAST(yj.`', REPLACE(@etat_final_col, '`', ''), '` AS CHAR)) LIKE ''%SIGNER%'' OR '
     ),
     ''),
  '0)'
);

-- =====================================================
-- ÉTAPE 2 : DIAGNOSTIC (avant UPDATE)
-- =====================================================
-- Pour chaque cible : état actuel fiches_histo + match YJ éventuel
SELECT '=== DIAGNOSTIC AVANT UPDATE (5 cibles) ===' AS info;

SET @diag_when_yj_empty = IF(
  @id_commercial_col IS NOT NULL,
  CONCAT(
    'WHEN ', @yj_id_fiche_expr, ' IS NOT NULL AND (',
    @yj_id_commercial_expr, ' IS NULL OR ', @yj_id_commercial_expr, ' = 0) ',
    'THEN ''YJ trouvé mais id_commercial vide/0 (cause principale)'' '
  ),
  CONCAT(
    'WHEN ', @yj_id_fiche_expr, ' IS NOT NULL ',
    'THEN ''YJ trouvé mais colonne id_commercial absente dans YJ'' '
  )
);

SET @sql_diag = CONCAT(
  'SELECT ',
  '  t.fh_id, ',
  '  t.id_fiche, ',
  '  t.date_creation AS fh_date_creation, ',
  '  fh.id_etat AS fh_id_etat, ',
  '  fh.id_commercial AS fh_id_commercial_actuel, ',
  '  ', @yj_id_commercial_expr, ' AS yj_id_commercial, ',
  '  ', @yj_pseudo_expr, ' AS yj_pseudo, ',
  '  ', @yj_date_expr, ' AS yj_date_match, ',
  IF(@etat_col IS NOT NULL, CONCAT('yj.`', REPLACE(@etat_col, '`', ''), '` AS yj_etat, '), 'NULL AS yj_etat, '),
  '  CASE ',
  '    WHEN ', @yj_id_fiche_expr, ' IS NULL THEN ''AUCUN match YJ (id_fiche + date ±5s + SIGNER)'' ',
  '    ', @diag_when_yj_empty,
  '    WHEN fh.id_commercial IS NOT NULL AND fh.id_commercial > 0 THEN ''Déjà renseigné côté fiches_histo'' ',
  '    ELSE ''OK à mettre à jour depuis YJ'' ',
  '  END AS diagnostic ',
  'FROM tmp_fh_signer_test t ',
  'INNER JOIN `fiches_histo` fh ON fh.`id` = t.fh_id ',
  'LEFT JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ',
  '  ON ', @yj_id_fiche_expr, ' = t.id_fiche ',
  ' AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, ', @yj_date_expr, ')) <= 5 ',
  ' AND ', @yj_etat_match, ' ',
  'ORDER BY t.fh_id'
);

PREPARE stmt_diag FROM @sql_diag;
EXECUTE stmt_diag;
DEALLOCATE PREPARE stmt_diag;

-- Compteurs diagnostic
SET @sql_diag_count = CONCAT(
  'SELECT ',
  '  COUNT(*) AS nb_cibles, ',
  '  SUM(CASE WHEN yj_row.id_fiche_yj IS NULL THEN 1 ELSE 0 END) AS nb_sans_match_yj, ',
  '  SUM(CASE WHEN yj_row.id_fiche_yj IS NOT NULL AND (yj_row.yj_id_commercial IS NULL OR yj_row.yj_id_commercial = 0) THEN 1 ELSE 0 END) AS nb_yj_commercial_vide, ',
  '  SUM(CASE WHEN yj_row.yj_id_commercial IS NOT NULL AND yj_row.yj_id_commercial > 0 THEN 1 ELSE 0 END) AS nb_ok_a_updater ',
  'FROM tmp_fh_signer_test t ',
  'LEFT JOIN (',
  '  SELECT ',
  '    ', @yj_id_fiche_expr, ' AS id_fiche_yj, ',
  '    ', @yj_date_expr, ' AS yj_date_match, ',
  '    ', @yj_id_commercial_expr, ' AS yj_id_commercial ',
  '  FROM `', REPLACE(@yj_source_table, '`', ''), '` yj ',
  '  WHERE ', @yj_etat_match,
  ') yj_row ',
  '  ON yj_row.id_fiche_yj = t.id_fiche ',
  ' AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, yj_row.yj_date_match)) <= 5'
);

PREPARE stmt_diag_count FROM @sql_diag_count;
EXECUTE stmt_diag_count;
DEALLOCATE PREPARE stmt_diag_count;

-- =====================================================
-- ÉTAPE 3 : UPDATE id_commercial uniquement (5 lignes max)
-- =====================================================
-- Règles :
--   - cible = lignes TEST
--   - fh.id_etat = 13
--   - fh.id_commercial IS NULL OR = 0
--   - YJ a un id_commercial > 0
--   - match id_fiche + date ±5s + état SIGNER/13
--   - date_modif* = elles-mêmes (pas de bump ON UPDATE CURRENT_TIMESTAMP)
-- =====================================================

SELECT '=== UPDATE TEST (max 5) ===' AS info;

SET @preserve_dates = CONCAT(
  IF(@fh_has_date_modif > 0, ', fh.`date_modif` = fh.`date_modif`', ''),
  IF(@fh_has_date_modif_time > 0, ', fh.`date_modif_time` = fh.`date_modif_time`', ''),
  IF(@fh_has_date_modification > 0, ', fh.`date_modification` = fh.`date_modification`', '')
);

-- Garde-fou : pas d'UPDATE si table/colonnes YJ absentes
SET @can_update = IF(
  @yj_source_table IS NOT NULL
  AND @id_fiche_col IS NOT NULL
  AND @id_commercial_col IS NOT NULL,
  1, 0
);

SELECT
  @can_update AS peut_updater,
  CASE
    WHEN @yj_source_table IS NULL THEN 'Table YJ introuvable'
    WHEN @id_fiche_col IS NULL THEN 'Colonne id_fiche YJ introuvable'
    WHEN @id_commercial_col IS NULL THEN 'Colonne id_commercial absente dans YJ → impossible de backfiller'
    ELSE 'OK'
  END AS motif;

-- Sous-requête : 1 ligne YJ par cible (id_commercial > 0)
SET @sql_update = IF(
  @can_update = 1,
  CONCAT(
    'UPDATE `fiches_histo` fh ',
    'INNER JOIN (',
    '  SELECT t.fh_id, MAX(', @yj_id_commercial_expr, ') AS new_id_commercial ',
    '  FROM tmp_fh_signer_test t ',
    '  INNER JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ',
    '    ON ', @yj_id_fiche_expr, ' = t.id_fiche ',
    '   AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, ', @yj_date_expr, ')) <= 5 ',
    '   AND ', @yj_etat_match, ' ',
    '  WHERE ', @yj_id_commercial_expr, ' IS NOT NULL ',
    '    AND ', @yj_id_commercial_expr, ' > 0 ',
    '  GROUP BY t.fh_id ',
    '  LIMIT ', @TEST_LIMIT,
    ') src ON src.fh_id = fh.`id` ',
    'SET fh.`id_commercial` = src.new_id_commercial',
    @preserve_dates, ' ',
    'WHERE fh.`id_etat` = 13 ',
    '  AND (fh.`id_commercial` IS NULL OR fh.`id_commercial` = 0)'
  ),
  'SELECT 0 AS nb_lignes_mises_a_jour_skip'
);

SELECT @sql_update AS sql_update_preview;

PREPARE stmt_upd FROM @sql_update;
EXECUTE stmt_upd;
SELECT ROW_COUNT() AS nb_lignes_mises_a_jour;
DEALLOCATE PREPARE stmt_upd;

-- =====================================================
-- ÉTAPE 4 : VÉRIFICATION après UPDATE
-- =====================================================
SELECT '=== VÉRIFICATION APRÈS UPDATE ===' AS info;

SELECT
  t.fh_id,
  t.id_fiche,
  t.date_creation,
  fh.id_etat,
  fh.id_commercial AS id_commercial_apres,
  CASE
    WHEN fh.id_commercial IS NOT NULL AND fh.id_commercial > 0 THEN 'OK rempli'
    ELSE 'Toujours vide (YJ sans valeur ou pas de match)'
  END AS statut
FROM tmp_fh_signer_test t
INNER JOIN `fiches_histo` fh ON fh.`id` = t.fh_id
ORDER BY t.fh_id;

-- Contrôle date_modif* inchangées (si colonnes présentes) : afficher valeurs actuelles
SET @sql_dates = CONCAT(
  'SELECT fh.`id` AS fh_id, fh.`id_commercial`',
  IF(@fh_has_date_modif > 0, ', fh.`date_modif`', ''),
  IF(@fh_has_date_modif_time > 0, ', fh.`date_modif_time`', ''),
  IF(@fh_has_date_modification > 0, ', fh.`date_modification`', ''),
  ' FROM `fiches_histo` fh ',
  'INNER JOIN tmp_fh_signer_test t ON t.fh_id = fh.`id` ',
  'ORDER BY fh.`id`'
);
PREPARE stmt_dates FROM @sql_dates;
EXECUTE stmt_dates;
DEALLOCATE PREPARE stmt_dates;

-- Nettoyage
DROP TEMPORARY TABLE IF EXISTS tmp_fh_signer_test;
DROP TEMPORARY TABLE IF EXISTS temp_yj_cols;

SET SQL_SAFE_UPDATES = 1;

SELECT '=== FIN TEST 5 FICHES ===' AS info;
SELECT
  'Relancer le diagnostic : si nb_yj_commercial_vide > 0, la source YJ n''a pas id_commercial pour ces SIGNER.' AS lecture_resultat,
  'Si nb_ok_a_updater = nb mises à jour, le matching est fiable → on pourra étendre au CSV complet.' AS suite;
