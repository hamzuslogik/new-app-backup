-- =====================================================
-- Copie brute de yj_histo_fiche vers fiches_histo
-- Objectif : insérer TOUTES les lignes, sans déduplication,
-- en conservant l'id_fiche tel quel.
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- Détection des colonnes
DROP TEMPORARY TABLE IF EXISTS temp_yj_cols;
CREATE TEMPORARY TABLE temp_yj_cols (col_name VARCHAR(100));
INSERT INTO temp_yj_cols
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'yj_histo_fiche';

DROP TEMPORARY TABLE IF EXISTS temp_fh_cols;
CREATE TEMPORARY TABLE temp_fh_cols (col_name VARCHAR(100));
INSERT INTO temp_fh_cols
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo';

-- Fonctions de présence
SET @has = 'SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = ';
SET @has_fh = 'SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = ';

-- Sélection id_fiche (priorité à id_fiche, sinon id)
SET @has_id_fiche_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id_fiche');
SET @has_id_yj       = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id');
-- Priorité : id_fiche si présent et non nul/non zéro, sinon id si non nul/non zéro, sinon NULL
SET @id_fiche_select = CASE
    WHEN @has_id_fiche_yj > 0 THEN 'CASE WHEN hf.`id_fiche` IS NOT NULL AND hf.`id_fiche` <> 0 THEN hf.`id_fiche` ELSE NULL END'
    WHEN @has_id_yj > 0 THEN 'CASE WHEN hf.`id` IS NOT NULL AND hf.`id` <> 0 THEN hf.`id` ELSE NULL END'
    ELSE 'NULL'
END;

-- id_etat : tenter d'abord id_etat numérique, sinon chercher via etat (titre) dans la table etats, sinon 1
SET @has_id_etat_yj  = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id_etat');
SET @has_etat_txt_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'etat');

SET @id_etat_numeric_part = CASE
    WHEN @has_id_etat_yj > 0 THEN 'CASE WHEN CAST(hf.`id_etat` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`id_etat` AS UNSIGNED) ELSE NULL END, '
    ELSE ''
END;

SET @id_etat_text_part = CASE
    WHEN @has_etat_txt_yj > 0 THEN '(SELECT e.`id` FROM `etats` e WHERE e.`titre` = CAST(hf.`etat` AS CHAR) OR e.`titre` LIKE CONCAT(''%'', CAST(hf.`etat` AS CHAR), ''%'') LIMIT 1), '
    ELSE ''
END;

SET @id_etat_select = CONCAT('COALESCE(', @id_etat_numeric_part, @id_etat_text_part, '1)');

-- date_rdv_time
SET @has_date_rdv_time_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'date_rdv_time');
SET @has_date_rdv_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'date_rdv');
SET @date_rdv_select = CASE
    WHEN @has_date_rdv_time_yj > 0 THEN 'hf.`date_rdv_time`'
    WHEN @has_date_rdv_yj > 0 THEN 'hf.`date_rdv`'
    ELSE 'NULL'
END;

-- date_creation
SET @has_date_creation_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'date_creation');
SET @has_date_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'date');
SET @has_date_heure_mod_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'date_heure_mod');
SET @date_creation_select = CASE
    WHEN @has_date_heure_mod_yj > 0 THEN 'hf.`date_heure_mod`'
    WHEN @has_date_creation_yj > 0 THEN 'hf.`date_creation`'
    WHEN @has_date_yj > 0 THEN 'hf.`date`'
    ELSE 'NOW()'
END;

-- Confirmateurs : détection des colonnes id et nom côté source et cible
SET @has_id_confirmateur_yj   = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id_confirmateur');
SET @has_id_confirmateur_2_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id_confirmateur_2');
SET @has_id_confirmateur_3_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'id_confirmateur_3');
SET @has_nom_confirmateur_yj   = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'nom_confirmateur');
SET @has_nom_confirmateur_2_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'nom_confirmateur_2');
SET @has_nom_confirmateur_3_yj = (SELECT COUNT(*) FROM temp_yj_cols WHERE col_name = 'nom_confirmateur_3');

SET @has_id_confirmateur_fh   = (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur');
SET @has_id_confirmateur_2_fh = (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur_2');
SET @has_id_confirmateur_3_fh = (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur_3');

-- Colonnes optionnelles : toutes les colonnes communes (intersection) sauf les colonnes de base déjà gérées
DROP TEMPORARY TABLE IF EXISTS temp_opt_cols;
CREATE TEMPORARY TABLE temp_opt_cols (col_name VARCHAR(100));
INSERT INTO temp_opt_cols (col_name)
SELECT y.col_name
FROM temp_yj_cols y
JOIN temp_fh_cols f ON f.col_name = y.col_name
WHERE y.col_name NOT IN ('id_fiche','id_etat','date_rdv_time','date_creation',
                         'id_confirmateur','id_confirmateur_2','id_confirmateur_3');

SET @insert_opt = (
  SELECT GROUP_CONCAT(CONCAT('`', c.col_name, '`') ORDER BY c.col_name SEPARATOR ', ')
  FROM temp_opt_cols c
);
SET @select_opt = (
  SELECT GROUP_CONCAT(CONCAT('hf.`', c.col_name, '`') ORDER BY c.col_name SEPARATOR ', ')
  FROM temp_opt_cols c
);

-- Construire dynamiquement la liste des colonnes/valeurs
SET @insert_columns = '`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`';
SET @select_values  = CONCAT(@id_fiche_select, ' AS `id_fiche`, ', @id_etat_select, ' AS `id_etat`, ', @date_rdv_select, ' AS `date_rdv_time`, ', @date_creation_select, ' AS `date_creation`');

-- Confirmateurs : mapping vers utilisateurs.id
SET @id_conf_expr = CASE
    WHEN (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur') > 0 THEN CONCAT(
        'COALESCE(',
        CASE WHEN @has_id_confirmateur_yj > 0 THEN 'CASE WHEN hf.`id_confirmateur` REGEXP ''^[0-9]+$'' THEN CAST(hf.`id_confirmateur` AS UNSIGNED) ELSE NULL END, ' ELSE '' END,
        CASE WHEN @has_nom_confirmateur_yj > 0 THEN '(SELECT u.`id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(hf.`nom_confirmateur`)) LIMIT 1), ' ELSE '' END,
        'NULL)'
    )
    ELSE NULL
END;

SET @id_conf_2_expr = CASE
    WHEN (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur_2') > 0 THEN CONCAT(
        'COALESCE(',
        CASE WHEN @has_id_confirmateur_2_yj > 0 THEN 'CASE WHEN hf.`id_confirmateur_2` REGEXP ''^[0-9]+$'' THEN CAST(hf.`id_confirmateur_2` AS UNSIGNED) ELSE NULL END, ' ELSE '' END,
        CASE WHEN @has_nom_confirmateur_2_yj > 0 THEN '(SELECT u.`id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(hf.`nom_confirmateur_2`)) LIMIT 1), ' ELSE '' END,
        'NULL)'
    )
    ELSE NULL
END;

SET @id_conf_3_expr = CASE
    WHEN (SELECT COUNT(*) FROM temp_fh_cols WHERE col_name = 'id_confirmateur_3') > 0 THEN CONCAT(
        'COALESCE(',
        CASE WHEN @has_id_confirmateur_3_yj > 0 THEN 'CASE WHEN hf.`id_confirmateur_3` REGEXP ''^[0-9]+$'' THEN CAST(hf.`id_confirmateur_3` AS UNSIGNED) ELSE NULL END, ' ELSE '' END,
        CASE WHEN @has_nom_confirmateur_3_yj > 0 THEN '(SELECT u.`id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(hf.`nom_confirmateur_3`)) LIMIT 1), ' ELSE '' END,
        'NULL)'
    )
    ELSE NULL
END;

SET @insert_columns = IF(@id_conf_expr   IS NOT NULL, CONCAT(@insert_columns, ', `id_confirmateur`'),   @insert_columns);
SET @select_values  = IF(@id_conf_expr   IS NOT NULL, CONCAT(@select_values , ', ', @id_conf_expr,   ' AS `id_confirmateur`'),   @select_values);
SET @insert_columns = IF(@id_conf_2_expr IS NOT NULL, CONCAT(@insert_columns, ', `id_confirmateur_2`'), @insert_columns);
SET @select_values  = IF(@id_conf_2_expr IS NOT NULL, CONCAT(@select_values , ', ', @id_conf_2_expr, ' AS `id_confirmateur_2`'), @select_values);
SET @insert_columns = IF(@id_conf_3_expr IS NOT NULL, CONCAT(@insert_columns, ', `id_confirmateur_3`'), @insert_columns);
SET @select_values  = IF(@id_conf_3_expr IS NOT NULL, CONCAT(@select_values , ', ', @id_conf_3_expr, ' AS `id_confirmateur_3`'), @select_values);

SET @insert_columns = IF(@insert_opt IS NOT NULL AND @insert_opt <> '', CONCAT(@insert_columns, ', ', @insert_opt), @insert_columns);
SET @select_values  = IF(@insert_opt IS NOT NULL AND @insert_opt <> '', CONCAT(@select_values , ', ', @select_opt), @select_values);

-- Requête finale : aucune déduplication
SET @sql = CONCAT(
  'INSERT INTO `fiches_histo` (', @insert_columns, ') ',
  'SELECT ', @select_values, ' ',
  'FROM `yj_histo_fiche` hf ',
  'WHERE (', @id_fiche_select, ') IS NOT NULL ',
  'AND (', @id_fiche_select, ') <> 0 ',
  'ORDER BY ', @id_fiche_select, ', ', @date_creation_select
);

SELECT '=== REQUÊTE GÉNÉRÉE ===' as info, @sql as requete_sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Nettoyage
DROP TEMPORARY TABLE IF EXISTS temp_yj_cols;
DROP TEMPORARY TABLE IF EXISTS temp_fh_cols;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

