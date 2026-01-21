-- =====================================================
-- Script de diagnostic pour identifier les lignes non migrées
-- =====================================================
-- 
-- Ce script permet d'identifier pourquoi certaines lignes de yj_histo_fiche
-- n'ont pas été migrées vers fiches_histo
--
-- Exécutez ce script APRÈS avoir exécuté migrate_yj_histo_fiche_to_fiches_histo_complete.sql
--
-- =====================================================

USE `crm`;

-- Désactiver temporairement les vérifications
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Détecter les colonnes disponibles
-- =====================================================

-- Détecter les colonnes de yj_histo_fiche
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;
CREATE TEMPORARY TABLE temp_yj_columns (
    col_name VARCHAR(100),
    col_type VARCHAR(50)
);

INSERT INTO temp_yj_columns
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche';

-- Variables de détection
SET @has_id_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id');
SET @has_id_fiche_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id_fiche');
SET @has_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'etat');
SET @has_id_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id_etat');
SET @has_etat_final_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'etat_final');
SET @has_date_creation_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_creation');
SET @has_date_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date');
SET @has_date_rdv_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_rdv');
SET @has_date_rdv_time_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_rdv_time');

-- Construire les sélecteurs dynamiques (avec alias pour SELECT)
SET @id_fiche_select = CASE 
    WHEN @has_id_col > 0 THEN 'hf.`id`'
    WHEN @has_id_fiche_col > 0 THEN 'hf.`id_fiche`'
    ELSE 'NULL'
END;

-- Construire les noms de colonnes bruts (sans alias) pour WHERE et autres clauses
SET @id_fiche_col = CASE 
    WHEN @has_id_col > 0 THEN '`id`'
    WHEN @has_id_fiche_col > 0 THEN '`id_fiche`'
    ELSE '`id`'  -- Par défaut, utiliser 'id' même si non détecté
END;

-- Construire id_etat_select (simplifié pour le diagnostic)
SET @id_etat_parts = '';
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_id_etat_col > 0 THEN 'CAST(hf.`id_etat` AS UNSIGNED), ' ELSE '' END
);
SET @etat_part1 = CASE WHEN @has_etat_col > 0 THEN 
    'CASE WHEN CAST(hf.`etat` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`etat` AS UNSIGNED) ELSE NULL END, '
ELSE '' END;
SET @etat_part2 = CASE WHEN @has_etat_col > 0 THEN 
    '(SELECT e.`id` FROM `etats` e WHERE e.`titre` = CAST(hf.`etat` AS CHAR) OR e.`titre` LIKE CONCAT(''%'', CAST(hf.`etat` AS CHAR), ''%'') LIMIT 1), '
ELSE '' END;
SET @id_etat_parts = CONCAT(@id_etat_parts, @etat_part1, @etat_part2);
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_etat_final_col > 0 THEN 
        'CASE WHEN CAST(hf.`etat_final` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`etat_final` AS UNSIGNED) ELSE NULL END, '
    ELSE '' END
);
SET @id_etat_parts = CONCAT(@id_etat_parts, '1');
SET @id_etat_select = CASE 
    WHEN LENGTH(@id_etat_parts) > 1 AND @id_etat_parts != '1' THEN 
        CONCAT('COALESCE(', @id_etat_parts, ')')
    ELSE 
        '1'
END;

SET @date_creation_select = CASE
    WHEN @has_date_creation_col > 0 THEN 'hf.`date_creation`'
    WHEN @has_date_col > 0 THEN 'hf.`date`'
    ELSE 'NOW()'
END;

-- =====================================================
-- ÉTAPE 2 : Statistiques générales
-- =====================================================

SELECT 
    '=== STATISTIQUES GÉNÉRALES ===' as info;

SET @count_yj_query = CONCAT('SELECT COUNT(*) INTO @total_yj FROM `yj_histo_fiche` WHERE ', @id_fiche_col, ' IS NOT NULL');
PREPARE stmt_count FROM @count_yj_query;
EXECUTE stmt_count;
DEALLOCATE PREPARE stmt_count;

SELECT 
    @total_yj as total_lignes_yj_histo_fiche,
    (SELECT COUNT(*) FROM `fiches_histo`) as total_lignes_fiches_histo,
    @total_yj - (SELECT COUNT(*) FROM `fiches_histo`) as lignes_non_migrees;

-- =====================================================
-- ÉTAPE 3 : Identifier les lignes non migrées
-- =====================================================

SELECT 
    '=== LIGNES NON MIGRÉES (50 premières) ===' as info;

SET @non_migrated_query = CONCAT(
    'SELECT ',
    '    hf.', @id_fiche_col, ' as id_fiche, ',
    '    ', @id_etat_select, ' as id_etat_calcule, ',
    '    ', @date_creation_select, ' as date_creation_calculee, ',
    '    hf.* ',
    'FROM `yj_histo_fiche` hf ',
    'WHERE ',
    'hf.', @id_fiche_col, ' IS NOT NULL ',
    'AND NOT EXISTS (',
        'SELECT 1 FROM `fiches_histo` fh ',
        'WHERE fh.`id_fiche` = hf.', @id_fiche_col, ' ',
        'AND fh.`id_etat` = ', @id_etat_select, ' ',
        'AND ABS(TIMESTAMPDIFF(SECOND, fh.`date_creation`, ', @date_creation_select, ')) <= 5',
    ') ',
    'ORDER BY hf.', @id_fiche_col, ', ', @date_creation_select, ' ',
    'LIMIT 50'
);
PREPARE stmt_non_migrated FROM @non_migrated_query;
EXECUTE stmt_non_migrated;
DEALLOCATE PREPARE stmt_non_migrated;

-- =====================================================
-- ÉTAPE 4 : Analyser les raisons possibles
-- =====================================================

SELECT 
    '=== ANALYSE DES RAISONS POSSIBLES ===' as info;

-- Compter les lignes avec id_fiche NULL
SET @count_null_query = CONCAT('SELECT COUNT(*) INTO @count_null FROM `yj_histo_fiche` WHERE ', @id_fiche_col, ' IS NULL');
PREPARE stmt_null FROM @count_null_query;
EXECUTE stmt_null;
DEALLOCATE PREPARE stmt_null;

SELECT 
    'Lignes avec id_fiche NULL (non migrées)' as raison,
    @count_null as nombre;

-- Compter les lignes qui ont le même id_fiche, id_etat et date_creation (doublons potentiels)
SET @doublons_query = CONCAT(
    'SELECT COUNT(*) INTO @count_doublons FROM (',
        'SELECT ',
        'hf.', @id_fiche_col, ' as id_f, ',
        @id_etat_select, ' as id_e, ',
        @date_creation_select, ' as date_c ',
        'FROM `yj_histo_fiche` hf ',
        'WHERE ',
        'hf.', @id_fiche_col, ' IS NOT NULL ',
        'GROUP BY ',
        'hf.', @id_fiche_col, ', ',
        @id_etat_select, ', ',
        @date_creation_select, ' ',
        'HAVING COUNT(*) > 1',
    ') as doublons'
);
PREPARE stmt_doublons FROM @doublons_query;
EXECUTE stmt_doublons;
DEALLOCATE PREPARE stmt_doublons;

SELECT 
    'Groupes de lignes avec mêmes valeurs (id_fiche, id_etat, date)' as raison,
    @count_doublons as nombre;

-- =====================================================
-- ÉTAPE 5 : Comparaison par fiche
-- =====================================================

SELECT 
    '=== COMPARAISON PAR FICHE (top 20 avec plus de différences) ===' as info;

SET @comparison_query = CONCAT(
    'SELECT ',
    '    yj.', CASE WHEN @has_id_col > 0 THEN '`id`' WHEN @has_id_fiche_col > 0 THEN '`id_fiche`' ELSE '`id`' END, ' as id_fiche, ',
    '    COUNT(*) as lignes_yj_histo_fiche, ',
    '    COALESCE(fh_count.total_histo, 0) as lignes_fiches_histo, ',
    '    COUNT(*) - COALESCE(fh_count.total_histo, 0) as difference ',
    'FROM `yj_histo_fiche` yj ',
    'LEFT JOIN (',
    '    SELECT `id_fiche`, COUNT(*) as total_histo ',
    '    FROM `fiches_histo` ',
    '    GROUP BY `id_fiche`',
    ') fh_count ON fh_count.`id_fiche` = yj.', CASE WHEN @has_id_col > 0 THEN '`id`' WHEN @has_id_fiche_col > 0 THEN '`id_fiche`' ELSE '`id`' END, ' ',
    'WHERE yj.', CASE WHEN @has_id_col > 0 THEN '`id`' WHEN @has_id_fiche_col > 0 THEN '`id_fiche`' ELSE '`id`' END, ' IS NOT NULL ',
    'GROUP BY yj.', CASE WHEN @has_id_col > 0 THEN '`id`' WHEN @has_id_fiche_col > 0 THEN '`id_fiche`' ELSE '`id`' END, ', fh_count.total_histo ',
    'HAVING COUNT(*) > COALESCE(fh_count.total_histo, 0) ',
    'ORDER BY difference DESC ',
    'LIMIT 20'
);
PREPARE stmt_comparison FROM @comparison_query;
EXECUTE stmt_comparison;
DEALLOCATE PREPARE stmt_comparison;

-- Nettoyer
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;

-- Réactiver les vérifications
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

