-- =====================================================
-- Script complet de migration de yj_histo_fiche vers fiches_histo
-- =====================================================
-- 
-- Ce script migre l'historique des états des fiches depuis yj_histo_fiche
-- vers fiches_histo (table utilisée pour afficher l'historique dans l'application)
--
-- IMPORTANT : 
-- - Exécutez d'abord ce script pour vérifier la structure
-- - Adaptez les colonnes si nécessaire selon les résultats
-- - Le script évite les doublons automatiquement
--
-- =====================================================

USE `crm`;

-- Désactiver temporairement les vérifications pour améliorer les performances
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier l'existence des tables
-- =====================================================

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Table yj_histo_fiche existe'
        ELSE '✗ Table yj_histo_fiche n''existe pas'
    END as verification_yj_histo_fiche
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'yj_histo_fiche';

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Table fiches_histo existe'
        ELSE '✗ Table fiches_histo n''existe pas'
    END as verification_fiches_histo
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'fiches_histo';

-- =====================================================
-- ÉTAPE 2 : Analyser la structure de yj_histo_fiche
-- =====================================================

-- Afficher toutes les colonnes de yj_histo_fiche
SELECT 
    '=== STRUCTURE DE yj_histo_fiche ===' as info;

SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    CHARACTER_MAXIMUM_LENGTH as longueur_max,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    ORDINAL_POSITION as position
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
ORDER BY ORDINAL_POSITION;

-- Afficher quelques exemples de données
SELECT 
    '=== EXEMPLES DE DONNÉES (5 premières lignes) ===' as info;

SELECT * FROM `yj_histo_fiche` LIMIT 5;

-- Compter le total
SELECT 
    '=== STATISTIQUES ===' as info,
    COUNT(*) as total_lignes_yj_histo_fiche
FROM `yj_histo_fiche`;

-- =====================================================
-- ÉTAPE 3 : Identifier les colonnes clés
-- =====================================================

-- Colonne pour l'ID de la fiche (probablement 'id' ou 'id_fiche')
SELECT 
    '=== COLONNES POUR ID_FICHE ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%fiche%' OR COLUMN_NAME = 'id')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'id' THEN 1
        WHEN COLUMN_NAME = 'id_fiche' THEN 2
        WHEN COLUMN_NAME LIKE '%fiche%' THEN 3
        ELSE 4
    END;

-- Colonnes pour l'état (probablement 'etat', 'id_etat', 'etat_final', etc.)
SELECT 
    '=== COLONNES POUR ÉTAT ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%etat%' OR COLUMN_NAME LIKE '%statut%')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'id_etat' THEN 1
        WHEN COLUMN_NAME = 'etat' THEN 2
        WHEN COLUMN_NAME = 'etat_final' THEN 3
        WHEN COLUMN_NAME LIKE '%etat%' THEN 4
        ELSE 5
    END;

-- Colonnes pour les dates
SELECT 
    '=== COLONNES POUR DATES ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%date%' OR COLUMN_NAME LIKE '%heure%' OR COLUMN_NAME LIKE '%time%')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'date_creation' THEN 1
        WHEN COLUMN_NAME = 'date' THEN 2
        WHEN COLUMN_NAME LIKE '%date%' THEN 3
        WHEN COLUMN_NAME LIKE '%time%' THEN 4
        ELSE 5
    END;

-- =====================================================
-- ÉTAPE 4 : Vérifier les correspondances avec fiches
-- =====================================================

-- Compter combien de fiches de yj_histo_fiche existent dans fiches
-- (en supposant que la colonne 'id' dans yj_histo_fiche correspond à fiches.id)
SELECT 
    '=== CORRESPONDANCES AVEC FICHES ===' as info,
    COUNT(DISTINCT hf.`id`) as total_fiches_avec_historique,
    COUNT(*) as total_lignes_historique
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
);

-- Compter les fiches qui n'existent pas encore dans fiches (seront migrées quand même)
SELECT 
    '=== FICHES NON MIGRÉES (historique sera migré quand même) ===' as info,
    COUNT(DISTINCT hf.`id`) as total_fiches_non_migrees,
    COUNT(*) as total_lignes_historique_non_migrees
FROM `yj_histo_fiche` hf
WHERE NOT EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
)
AND hf.`id` IS NOT NULL;

-- =====================================================
-- ÉTAPE 5 : Migration vers fiches_histo
-- =====================================================
-- 
-- IMPORTANT : Cette requête doit être adaptée selon les colonnes réelles détectées à l'étape 2
-- 
-- Structure de fiches_histo :
--   - id_fiche (int) : ID de la fiche
--   - id_etat (int) : ID de l'état
--   - date_rdv_time (datetime, nullable) : Date du rendez-vous
--   - date_creation (datetime) : Date de création de l'entrée historique
--
-- =====================================================

-- VERSION ADAPTATIVE : Essaie plusieurs combinaisons de colonnes
-- Cette version détecte automatiquement les colonnes disponibles

-- D'abord, créer une table temporaire pour stocker les résultats de détection
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;
CREATE TEMPORARY TABLE temp_yj_columns (
    col_name VARCHAR(100),
    col_type VARCHAR(50)
);

-- Insérer les colonnes disponibles
INSERT INTO temp_yj_columns
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche';

-- Vérifier quelles colonnes existent
SET @has_id_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id');
SET @has_id_fiche_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id_fiche');
SET @has_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'etat');
SET @has_id_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'id_etat');
SET @has_etat_final_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'etat_final');
SET @has_date_creation_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_creation');
SET @has_date_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date');
SET @has_date_rdv_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_rdv');
SET @has_date_rdv_time_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE col_name = 'date_rdv_time');

-- Afficher les colonnes détectées
SELECT 
    '=== COLONNES DÉTECTÉES ===' as info,
    @has_id_col as has_id,
    @has_id_fiche_col as has_id_fiche,
    @has_etat_col as has_etat,
    @has_id_etat_col as has_id_etat,
    @has_etat_final_col as has_etat_final,
    @has_date_creation_col as has_date_creation,
    @has_date_col as has_date,
    @has_date_rdv_col as has_date_rdv,
    @has_date_rdv_time_col as has_date_rdv_time;

-- =====================================================
-- MIGRATION PRINCIPALE
-- =====================================================
-- 
-- Cette requête utilise les colonnes détectées automatiquement
-- Si une colonne n'existe pas, elle utilise une valeur par défaut
-- 
-- IMPORTANT : Cette version utilise une approche plus sûre qui évite
-- les erreurs si les colonnes n'existent pas
--

-- Construire la requête dynamiquement selon les colonnes disponibles
SET @sql_query = '';

-- Construire la partie SELECT pour id_fiche
SET @id_fiche_select = CASE 
    WHEN @has_id_col > 0 THEN 'hf.`id`'
    WHEN @has_id_fiche_col > 0 THEN 'hf.`id_fiche`'
    ELSE 'NULL'
END;

-- Construire la partie SELECT pour id_etat (en utilisant seulement les colonnes qui existent)
-- Construire une chaîne COALESCE avec seulement les colonnes disponibles
SET @id_etat_parts = '';

-- Ajouter id_etat si la colonne existe
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_id_etat_col > 0 THEN 'CAST(hf.`id_etat` AS UNSIGNED), ' ELSE '' END
);

-- Ajouter etat si la colonne existe (simplifié pour éviter les problèmes d'échappement)
SET @etat_part1 = CASE WHEN @has_etat_col > 0 THEN 
    'CASE WHEN CAST(hf.`etat` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`etat` AS UNSIGNED) ELSE NULL END, '
ELSE '' END;

SET @etat_part2 = CASE WHEN @has_etat_col > 0 THEN 
    '(SELECT e.`id` FROM `etats` e WHERE e.`titre` = CAST(hf.`etat` AS CHAR) OR e.`titre` LIKE CONCAT(''%'', CAST(hf.`etat` AS CHAR), ''%'') LIMIT 1), '
ELSE '' END;

SET @id_etat_parts = CONCAT(@id_etat_parts, @etat_part1, @etat_part2);

-- Ajouter etat_final si la colonne existe
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_etat_final_col > 0 THEN 
        'CASE WHEN CAST(hf.`etat_final` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`etat_final` AS UNSIGNED) ELSE NULL END, '
    ELSE '' END
);

-- Ajouter la valeur par défaut
SET @id_etat_parts = CONCAT(@id_etat_parts, '1');

-- Construire le COALESCE final (seulement si on a plus que juste "1")
SET @id_etat_select = CASE 
    WHEN LENGTH(@id_etat_parts) > 1 AND @id_etat_parts != '1' THEN 
        CONCAT('COALESCE(', @id_etat_parts, ')')
    ELSE 
        '1'
END;

-- Construire la partie SELECT pour date_rdv_time
SET @date_rdv_select = CASE
    WHEN @has_date_rdv_time_col > 0 THEN 'hf.`date_rdv_time`'
    WHEN @has_date_rdv_col > 0 THEN 'hf.`date_rdv`'
    ELSE 'NULL'
END;

-- Construire la partie SELECT pour date_creation
SET @date_creation_select = CASE
    WHEN @has_date_creation_col > 0 THEN 'hf.`date_creation`'
    WHEN @has_date_col > 0 THEN 'hf.`date`'
    ELSE 'NOW()'
END;

-- Construire la requête complète
-- IMPORTANT : On retire DISTINCT pour migrer TOUTES les entrées historiques
-- La détection de doublons se fait via NOT EXISTS avec une tolérance de temps
SET @sql_query = CONCAT(
    'INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`) ',
    'SELECT ',
    @id_fiche_select, ' AS `id_fiche`, ',
    @id_etat_select, ' AS `id_etat`, ',
    @date_rdv_select, ' AS `date_rdv_time`, ',
    @date_creation_select, ' AS `date_creation` ',
    'FROM `yj_histo_fiche` hf ',
    'WHERE ',
    @id_fiche_select, ' IS NOT NULL ',
    'AND NOT EXISTS (',
        'SELECT 1 FROM `fiches_histo` fh ',
        'WHERE fh.`id_fiche` = ', @id_fiche_select, ' ',
        'AND fh.`id_etat` = ', @id_etat_select, ' ',
        'AND ABS(TIMESTAMPDIFF(SECOND, fh.`date_creation`, ', @date_creation_select, ')) < 5',
    ') ',
    'ORDER BY ', @id_fiche_select, ', ', @date_creation_select
);

-- Afficher la requête générée (pour debug)
SELECT 
    '=== REQUÊTE GÉNÉRÉE ===' as info,
    @sql_query as requete_sql;

-- Afficher les valeurs des variables pour debug
SELECT 
    '=== VARIABLES DE DÉTECTION ===' as info,
    @has_id_col as has_id,
    @has_id_fiche_col as has_id_fiche,
    @has_etat_col as has_etat,
    @has_id_etat_col as has_id_etat,
    @has_etat_final_col as has_etat_final,
    @has_date_creation_col as has_date_creation,
    @has_date_col as has_date,
    @has_date_rdv_col as has_date_rdv,
    @has_date_rdv_time_col as has_date_rdv_time;

-- Vérifier que la requête est valide avant de l'exécuter
-- Si aucune colonne pour id_fiche n'est trouvée, arrêter
SELECT 
    CASE 
        WHEN @has_id_col = 0 AND @has_id_fiche_col = 0 THEN 
            'ERREUR : Aucune colonne pour id_fiche trouvée dans yj_histo_fiche'
        ELSE 
            'OK : Colonnes détectées, migration possible'
    END as verification_migration;

-- Exécuter la requête dynamique seulement si les colonnes nécessaires existent
-- Note : Cette vérification doit être faite manuellement avant d'exécuter
-- Si vous voyez l'erreur ci-dessus, adaptez le script selon la structure réelle

-- Exécuter la requête dynamique
PREPARE stmt FROM @sql_query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Nettoyer la table temporaire
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;

-- =====================================================
-- ÉTAPE 6 : Statistiques après migration
-- =====================================================

SELECT 
    '=== RÉSULTATS DE LA MIGRATION ===' as info;

-- Nombre total d'enregistrements dans fiches_histo
SELECT 
    'Total enregistrements dans fiches_histo' as info,
    COUNT(*) as total
FROM `fiches_histo`;

-- Vérifier que toutes les lignes ont été migrées
SELECT 
    '=== VÉRIFICATION COMPLÉTUDE DE LA MIGRATION ===' as info,
    (SELECT COUNT(*) FROM `yj_histo_fiche` WHERE `id` IS NOT NULL) as total_lignes_yj_histo_fiche,
    (SELECT COUNT(*) FROM `fiches_histo`) as total_lignes_fiches_histo,
    CASE 
        WHEN (SELECT COUNT(*) FROM `yj_histo_fiche` WHERE `id` IS NOT NULL) <= (SELECT COUNT(*) FROM `fiches_histo`)
        THEN '✓ Migration complète ou supérieure (doublons possibles dans yj_histo_fiche)'
        ELSE CONCAT('⚠ Attention : ', 
            (SELECT COUNT(*) FROM `yj_histo_fiche` WHERE `id` IS NOT NULL) - (SELECT COUNT(*) FROM `fiches_histo`),
            ' lignes non migrées (peut être normal si doublons détectés)')
    END as statut_migration;

-- Nombre d'enregistrements par fiche
SELECT 
    'Distribution : nombre de lignes par fiche' as info,
    id_fiche,
    COUNT(*) as nb_lignes_historique
FROM `fiches_histo`
GROUP BY id_fiche
ORDER BY nb_lignes_historique DESC
LIMIT 20;

-- Exemples de données migrées
SELECT 
    '=== EXEMPLES DE DONNÉES MIGRÉES ===' as info;

SELECT 
    fh.`id`,
    fh.`id_fiche`,
    f.`nom`,
    f.`prenom`,
    fh.`id_etat`,
    e.`titre` AS `etat_titre`,
    fh.`date_creation`,
    fh.`date_rdv_time`
FROM `fiches_histo` fh
LEFT JOIN `fiches` f ON fh.`id_fiche` = f.`id`
LEFT JOIN `etats` e ON fh.`id_etat` = e.`id`
ORDER BY fh.`id_fiche`, fh.`date_creation`
LIMIT 20;

-- Réactiver les vérifications
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Ce script détecte automatiquement les colonnes disponibles dans yj_histo_fiche
-- 2. Il évite les doublons en vérifiant l'ID de la fiche, l'ID de l'état et la date (tolérance de 5 secondes)
-- 3. Si une colonne n'existe pas, le script utilise une valeur par défaut
-- 4. Le script migre TOUTES les entrées historiques, même si la fiche n'existe pas encore dans 'fiches'
--    (l'historique sera disponible dès que la fiche sera créée)
-- 5. Si l'état n'est pas trouvé, l'état par défaut (1 = EN-ATTENTE) est utilisé
-- 6. DISTINCT a été retiré pour garantir que toutes les entrées historiques sont migrées
-- 7. La tolérance de doublons est de 5 secondes (au lieu de 60) pour être plus précise
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

