-- =====================================================
-- FULL : backfill id_commercial sur fiches_histo (SIGNER = 13)
-- =====================================================
-- Cibles :
--   fiches_histo WHERE id_etat = 13
--   AND (id_commercial IS NULL OR id_commercial = 0)
--
-- Source YJ : yj_histo_fiche.nom_commercial
--
-- Utilisateurs — règle UNIQUE basée sur LOGIN :
--   - existe si TRIM(UPPER(login)) = TRIM(UPPER(nom_commercial))
--   - si OUI  → réutiliser cet id (pas d'INSERT)
--   - si NON  → INSERT (login = nom_commercial, pseudo = nom_commercial,
--                       fonction = 5, etat = 0 INACTIF)
--
-- Puis UPDATE fiches_histo.id_commercial uniquement
-- (date_modif* préservées ; table fiches non touchée)
--
-- Périmètre date :
--   fiches_histo.date_creation <= 2026-09-30 23:59:59
--
-- Sécurité :
--   SET @EXECUTE = 0  → diagnostic seulement
--   SET @EXECUTE = 1  → INSERT + UPDATE réels
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- >>> PASSER À 1 APRÈS AVOIR LU LES COMPTEURS <<<
SET @EXECUTE = 0;

-- Borne haute inclusive du diagnostic / traitement
SET @DATE_MAX = '2026-09-30 23:59:59';

SET @FONCTION_COMMERCIAL = 5;
SET @ETAT_INACTIF = 0;

SELECT
  @EXECUTE AS mode_execute,
  CASE WHEN @EXECUTE = 1 THEN 'ÉCRITURE ACTIVÉE' ELSE 'DIAGNOSTIC SEULEMENT' END AS mode_libelle,
  @DATE_MAX AS date_max_incluse,
  @ETAT_INACTIF AS etat_utilisateurs_crees;

-- =====================================================
-- ÉTAPE 0 : cibles fiches_histo
-- =====================================================
DROP TEMPORARY TABLE IF EXISTS tmp_fh_signer_cibles;
CREATE TEMPORARY TABLE tmp_fh_signer_cibles (
  fh_id INT NOT NULL PRIMARY KEY,
  id_fiche INT NOT NULL,
  date_creation DATETIME NOT NULL,
  KEY idx_id_fiche_date (id_fiche, date_creation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tmp_fh_signer_cibles (fh_id, id_fiche, date_creation)
SELECT fh.`id`, fh.`id_fiche`, fh.`date_creation`
FROM `fiches_histo` fh
WHERE fh.`id_etat` = 13
  AND (fh.`id_commercial` IS NULL OR fh.`id_commercial` = 0)
  AND fh.`id_fiche` IS NOT NULL
  AND fh.`id_fiche` > 0
  AND fh.`date_creation` IS NOT NULL
  AND fh.`date_creation` > '1000-01-01'
  AND fh.`date_creation` <= @DATE_MAX;

SELECT '=== CIBLES (jusqu''au 30/09/2026 inclus) ===' AS info;
SELECT COUNT(*) AS nb_lignes_histo_signer_sans_commercial FROM tmp_fh_signer_cibles;
SELECT COUNT(DISTINCT id_fiche) AS nb_fiches_distinctes FROM tmp_fh_signer_cibles;
SELECT MIN(date_creation) AS date_min, MAX(date_creation) AS date_max FROM tmp_fh_signer_cibles;

-- =====================================================
-- ÉTAPE 1 : détection YJ
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
SET @nom_commercial_col = (SELECT col_name FROM temp_yj_cols WHERE LOWER(TRIM(col_name)) = 'nom_commercial' LIMIT 1);

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
  @nom_commercial_col AS yj_nom_commercial_col,
  @date_heure_mod_col AS yj_date_heure_mod_col,
  @date_creation_col AS yj_date_creation_col;

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

SET @yj_nom_commercial_expr = IF(
  @nom_commercial_col IS NOT NULL,
  CONCAT('TRIM(yj.`', REPLACE(@nom_commercial_col, '`', ''), '`)'),
  'NULL'
);

-- Résolution par LOGIN (= nom_commercial)
SET @yj_resolved_id_commercial_expr = IF(
  @nom_commercial_col IS NOT NULL,
  CONCAT(
    '(SELECT u.`id` FROM `utilisateurs` u ',
    'WHERE TRIM(UPPER(IFNULL(u.`login`, ''''))) = TRIM(UPPER(', @yj_nom_commercial_expr, ')) ',
    'LIMIT 1)'
  ),
  'NULL'
);

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

SET @can_run = IF(
  @yj_source_table IS NOT NULL
  AND @id_fiche_col IS NOT NULL
  AND @nom_commercial_col IS NOT NULL,
  1, 0
);

SELECT
  @can_run AS peut_continuer,
  CASE
    WHEN @yj_source_table IS NULL THEN 'Table YJ introuvable'
    WHEN @id_fiche_col IS NULL THEN 'Colonne id_fiche YJ introuvable'
    WHEN @nom_commercial_col IS NULL THEN 'Colonne nom_commercial absente dans YJ'
    ELSE 'OK (match utilisateurs sur login)'
  END AS motif;

-- =====================================================
-- ÉTAPE 2 : noms commerciaux distincts depuis YJ
-- =====================================================
DROP TEMPORARY TABLE IF EXISTS tmp_noms_commerciaux;
CREATE TEMPORARY TABLE tmp_noms_commerciaux (
  nom_commercial VARCHAR(191) NOT NULL,
  PRIMARY KEY (nom_commercial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql_fill_noms = IF(
  @can_run = 1,
  CONCAT(
    'INSERT IGNORE INTO tmp_noms_commerciaux (nom_commercial) ',
    'SELECT DISTINCT LEFT(', @yj_nom_commercial_expr, ', 191) ',
    'FROM tmp_fh_signer_cibles t ',
    'INNER JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ',
    '  ON ', @yj_id_fiche_expr, ' = t.id_fiche ',
    ' AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, ', @yj_date_expr, ')) <= 5 ',
    ' AND ', @yj_etat_match, ' ',
    'WHERE ', @yj_nom_commercial_expr, ' IS NOT NULL ',
    '  AND ', @yj_nom_commercial_expr, ' != '''''
  ),
  'SELECT 1'
);

PREPARE stmt_fill_noms FROM @sql_fill_noms;
EXECUTE stmt_fill_noms;
DEALLOCATE PREPARE stmt_fill_noms;

SELECT '=== NOMS COMMERCIAUX (distincts) — match sur LOGIN ===' AS info;
SELECT COUNT(*) AS nb_noms_distincts FROM tmp_noms_commerciaux;

SELECT
  SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) AS nb_login_existe_reutiliser,
  SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) AS nb_login_absent_a_creer
FROM tmp_noms_commerciaux n
LEFT JOIN `utilisateurs` u
  ON TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(n.nom_commercial));

-- Utilisateurs DÉJÀ présents (match login) + fonction
SELECT '=== UTILISATEURS EXISTANTS (login trouvé) + FONCTION ===' AS info;
SELECT
  n.nom_commercial AS login_cible,
  u.id AS id_utilisateur,
  u.login,
  u.pseudo,
  u.etat,
  u.fonction AS id_fonction,
  f.titre AS fonction_titre,
  'EXISTE → réutiliser' AS action_prevue
FROM tmp_noms_commerciaux n
INNER JOIN `utilisateurs` u
  ON TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(n.nom_commercial))
LEFT JOIN `fonctions` f ON f.`id` = u.`fonction`
ORDER BY f.titre, u.login;

-- Logins absents → à créer
SELECT '=== LOGINS ABSENTS → À CRÉER (etat=0, fonction=5) ===' AS info;
SELECT
  n.nom_commercial AS login_cible,
  'ABSENT → À CRÉER' AS action_prevue
FROM tmp_noms_commerciaux n
WHERE NOT EXISTS (
  SELECT 1 FROM `utilisateurs` u
  WHERE TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(n.nom_commercial))
)
ORDER BY n.nom_commercial;

-- =====================================================
-- ÉTAPE 3 : liste à créer = login absent uniquement
-- =====================================================
DROP TEMPORARY TABLE IF EXISTS tmp_users_a_creer;
CREATE TEMPORARY TABLE tmp_users_a_creer (
  nom_commercial VARCHAR(191) NOT NULL,
  PRIMARY KEY (nom_commercial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tmp_users_a_creer (nom_commercial)
SELECT n.nom_commercial
FROM tmp_noms_commerciaux n
WHERE NOT EXISTS (
  SELECT 1 FROM `utilisateurs` u
  WHERE TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(n.nom_commercial))
);

SELECT '=== À CRÉER (login inexistant) ===' AS info;
SELECT COUNT(*) AS nb_a_inserer FROM tmp_users_a_creer;
SELECT
  c.nom_commercial AS login,
  c.nom_commercial AS pseudo,
  @FONCTION_COMMERCIAL AS fonction,
  @ETAT_INACTIF AS etat
FROM tmp_users_a_creer c
ORDER BY c.nom_commercial
LIMIT 100;

SET @sql_insert_users = IF(
  @EXECUTE = 1 AND @can_run = 1,
  CONCAT(
    'INSERT INTO `utilisateurs` (`pseudo`, `login`, `fonction`, `etat`) ',
    'SELECT c.nom_commercial, c.nom_commercial, ', @FONCTION_COMMERCIAL, ', ', @ETAT_INACTIF, ' ',
    'FROM tmp_users_a_creer c ',
    'WHERE NOT EXISTS (',
    '  SELECT 1 FROM `utilisateurs` u ',
    '  WHERE TRIM(UPPER(IFNULL(u.`login`, ''''))) = TRIM(UPPER(c.nom_commercial))',
    ')'
  ),
  'SELECT 0 AS skip_insert_users'
);

SELECT @sql_insert_users AS sql_insert_users_preview;
PREPARE stmt_ins_u FROM @sql_insert_users;
EXECUTE stmt_ins_u;
SELECT ROW_COUNT() AS nb_utilisateurs_crees;
DEALLOCATE PREPARE stmt_ins_u;

-- Contrôle : pour chaque nom, un login doit maintenant pointer vers un user
SELECT '=== CONTRÔLE résolution par LOGIN ===' AS info;
SELECT
  SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) AS nb_resolus_par_login,
  SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) AS nb_toujours_sans_login,
  SUM(CASE WHEN u.id IS NOT NULL AND IFNULL(u.etat, 0) = 0 THEN 1 ELSE 0 END) AS nb_resolus_inactifs,
  SUM(CASE WHEN u.id IS NOT NULL AND IFNULL(u.etat, 0) > 0 THEN 1 ELSE 0 END) AS nb_resolus_actifs
FROM tmp_noms_commerciaux n
LEFT JOIN `utilisateurs` u
  ON TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(n.nom_commercial));

-- =====================================================
-- ÉTAPE 4 : diagnostic matching (1 seule ref temp table)
-- =====================================================
SELECT '=== DIAGNOSTIC MATCHING ===' AS info;

DROP TEMPORARY TABLE IF EXISTS tmp_match_diag;
CREATE TEMPORARY TABLE tmp_match_diag (
  fh_id INT NOT NULL PRIMARY KEY,
  id_fiche INT NOT NULL,
  yj_nom_commercial VARCHAR(191) NULL,
  id_commercial_resolu INT NULL,
  diagnostic VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql_fill_diag = IF(
  @can_run = 1,
  CONCAT(
    'INSERT INTO tmp_match_diag (fh_id, id_fiche, yj_nom_commercial, id_commercial_resolu, diagnostic) ',
    'SELECT ',
    '  t.fh_id, ',
    '  t.id_fiche, ',
    '  LEFT(MAX(', @yj_nom_commercial_expr, '), 191) AS yj_nom, ',
    '  MAX(', @yj_resolved_id_commercial_expr, ') AS id_com, ',
    '  CASE ',
    '    WHEN MAX(CASE WHEN ', @yj_id_fiche_expr, ' IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN ''AUCUN match YJ'' ',
    '    WHEN MAX(', @yj_nom_commercial_expr, ') IS NULL OR MAX(', @yj_nom_commercial_expr, ') = '''' THEN ''nom_commercial vide'' ',
    '    WHEN MAX(', @yj_resolved_id_commercial_expr, ') IS NULL THEN ''login introuvable dans utilisateurs'' ',
    '    ELSE ''OK a updater'' ',
    '  END AS diagnostic ',
    'FROM tmp_fh_signer_cibles t ',
    'LEFT JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ',
    '  ON ', @yj_id_fiche_expr, ' = t.id_fiche ',
    ' AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, ', @yj_date_expr, ')) <= 5 ',
    ' AND ', @yj_etat_match, ' ',
    'GROUP BY t.fh_id, t.id_fiche'
  ),
  'SELECT 1'
);

PREPARE stmt_fill_diag FROM @sql_fill_diag;
EXECUTE stmt_fill_diag;
DEALLOCATE PREPARE stmt_fill_diag;

SELECT diagnostic, COUNT(*) AS nb
FROM tmp_match_diag
GROUP BY diagnostic
ORDER BY nb DESC;

SELECT * FROM tmp_match_diag
WHERE diagnostic != 'OK a updater'
ORDER BY diagnostic, fh_id
LIMIT 50;

SELECT * FROM tmp_match_diag
WHERE diagnostic = 'OK a updater'
ORDER BY fh_id
LIMIT 20;

-- =====================================================
-- ÉTAPE 5 : UPDATE fiches_histo.id_commercial
-- =====================================================
SELECT '=== UPDATE fiches_histo.id_commercial ===' AS info;

SET @preserve_dates = CONCAT(
  IF(@fh_has_date_modif > 0, ', fh.`date_modif` = fh.`date_modif`', ''),
  IF(@fh_has_date_modif_time > 0, ', fh.`date_modif_time` = fh.`date_modif_time`', ''),
  IF(@fh_has_date_modification > 0, ', fh.`date_modification` = fh.`date_modification`', '')
);

SELECT COUNT(*) AS nb_lignes_eligibles_update
FROM tmp_match_diag
WHERE diagnostic = 'OK a updater';

SET @sql_update = IF(
  @EXECUTE = 1 AND @can_run = 1,
  CONCAT(
    'UPDATE `fiches_histo` fh ',
    'INNER JOIN (',
    '  SELECT t.fh_id, MAX(', @yj_resolved_id_commercial_expr, ') AS new_id_commercial ',
    '  FROM tmp_fh_signer_cibles t ',
    '  INNER JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ',
    '    ON ', @yj_id_fiche_expr, ' = t.id_fiche ',
    '   AND ABS(TIMESTAMPDIFF(SECOND, t.date_creation, ', @yj_date_expr, ')) <= 5 ',
    '   AND ', @yj_etat_match, ' ',
    '  WHERE ', @yj_nom_commercial_expr, ' IS NOT NULL ',
    '    AND ', @yj_nom_commercial_expr, ' != '''' ',
    '    AND ', @yj_resolved_id_commercial_expr, ' IS NOT NULL ',
    '    AND ', @yj_resolved_id_commercial_expr, ' > 0 ',
    '  GROUP BY t.fh_id',
    ') src ON src.fh_id = fh.`id` ',
    'SET fh.`id_commercial` = src.new_id_commercial',
    @preserve_dates, ' ',
    'WHERE fh.`id_etat` = 13 ',
    '  AND (fh.`id_commercial` IS NULL OR fh.`id_commercial` = 0)'
  ),
  'SELECT 0 AS skip_update_diagnostic_mode'
);

SELECT @sql_update AS sql_update_preview;
PREPARE stmt_upd FROM @sql_update;
EXECUTE stmt_upd;
SELECT ROW_COUNT() AS nb_lignes_fiches_histo_maj;
DEALLOCATE PREPARE stmt_upd;

-- =====================================================
-- ÉTAPE 6 : vérification
-- =====================================================
SELECT '=== VÉRIFICATION ===' AS info;

SELECT COUNT(*) AS reste_signer_sans_commercial
FROM `fiches_histo` fh
WHERE fh.`id_etat` = 13
  AND (fh.`id_commercial` IS NULL OR fh.`id_commercial` = 0);

SELECT COUNT(*) AS signer_avec_commercial
FROM `fiches_histo` fh
WHERE fh.`id_etat` = 13
  AND fh.`id_commercial` IS NOT NULL
  AND fh.`id_commercial` > 0;

SELECT u.id, u.login, u.pseudo, u.fonction, u.etat
FROM `utilisateurs` u
INNER JOIN tmp_users_a_creer c
  ON TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(c.nom_commercial))
ORDER BY u.id
LIMIT 50;

DROP TEMPORARY TABLE IF EXISTS tmp_fh_signer_cibles;
DROP TEMPORARY TABLE IF EXISTS tmp_noms_commerciaux;
DROP TEMPORARY TABLE IF EXISTS tmp_users_a_creer;
DROP TEMPORARY TABLE IF EXISTS tmp_match_diag;
DROP TEMPORARY TABLE IF EXISTS temp_yj_cols;

SET SQL_SAFE_UPDATES = 1;

SELECT '=== FIN FULL ===' AS info;
SELECT
  'Match / création utilisateurs = LOGIN (= nom_commercial)' AS regle,
  'Nouveaux : login=pseudo=nom_commercial, fonction=5, etat=0' AS creation,
  '1) @EXECUTE=0 diagnostic  2) @EXECUTE=1 écriture' AS usage_mode;
