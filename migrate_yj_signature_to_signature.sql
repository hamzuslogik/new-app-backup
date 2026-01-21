-- =====================================================
-- Script de migration : yj_signature -> signature
-- =====================================================
-- 
-- Ce script migre les données de la table yj_signature
-- vers la table signature
--
-- Structure de la table signature :
-- - id (AUTO_INCREMENT)
-- - confirmateur (INT)
-- - ajoute (DECIMAL(10,2))
-- - date_heure (DATETIME)
-- - tel (VARCHAR(255))
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier l'existence des tables
-- =====================================================

SELECT 
    '=== VÉRIFICATION DES TABLES ===' as info;

-- Vérifier si yj_signature existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK - Table yj_signature existe'
        ELSE 'ERREUR - Table yj_signature n''existe pas'
    END as verification_yj_signature
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'yj_signature';

-- Vérifier si signature existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK - Table signature existe'
        ELSE 'ERREUR - Table signature n''existe pas'
    END as verification_signature
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'signature';

-- =====================================================
-- ÉTAPE 2 : Analyser la structure de yj_signature
-- =====================================================

SELECT 
    '=== ANALYSE DE LA STRUCTURE ===' as info;

-- Afficher toutes les colonnes de yj_signature
SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_signature'
ORDER BY ORDINAL_POSITION;

-- Compter les lignes dans yj_signature
SELECT 
    'Nombre de lignes dans yj_signature' as info,
    COUNT(*) as total_lignes
FROM `yj_signature`;

-- Afficher quelques exemples de données
SELECT 
    '=== EXEMPLES DE DONNÉES (5 PREMIÈRES LIGNES) ===' as info;

SELECT *
FROM `yj_signature`
LIMIT 5;

-- =====================================================
-- ÉTAPE 3 : Détecter les colonnes disponibles
-- =====================================================

SELECT 
    '=== DÉTECTION DES COLONNES ===' as info;

-- Créer une table temporaire pour stocker les noms de colonnes
DROP TEMPORARY TABLE IF EXISTS temp_yj_signature_columns;
CREATE TEMPORARY TABLE temp_yj_signature_columns (
    col_name VARCHAR(100)
);
INSERT INTO temp_yj_signature_columns
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_signature';

-- Détecter les colonnes correspondantes
SET @has_confirmateur = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'confirmateur');
SET @has_id_confirmateur = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'id_confirmateur');
SET @has_ajoute = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'ajoute');
SET @has_date_heure = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'date_heure');
SET @has_date = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'date');
SET @has_tel = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'tel');
SET @has_telephone = (SELECT COUNT(*) FROM temp_yj_signature_columns WHERE col_name = 'telephone');

-- Vérifier si confirmateur est numérique ou texte
SET @confirmateur_is_numeric = 0;
SET @test_numeric = (
    SELECT COUNT(*) 
    FROM `yj_signature` 
    WHERE `confirmateur` REGEXP '^[0-9]+$' 
    LIMIT 1
);
SET @confirmateur_is_numeric = IF(@has_confirmateur > 0 AND @test_numeric > 0, 1, 0);

SELECT 
    'Colonnes détectées' as info,
    @has_confirmateur as has_confirmateur,
    @has_id_confirmateur as has_id_confirmateur,
    @has_ajoute as has_ajoute,
    @has_date_heure as has_date_heure,
    @has_date as has_date,
    @has_tel as has_tel,
    @has_telephone as has_telephone;

-- =====================================================
-- ÉTAPE 4 : Construire la requête de migration
-- =====================================================

SELECT 
    '=== CONSTRUCTION DE LA REQUÊTE ===' as info;

-- Déterminer d'abord si on a besoin du JOIN avec utilisateurs
SET @need_join_utilisateurs = IF(@has_confirmateur > 0 AND @confirmateur_is_numeric = 0, 1, 0);

-- Construire le JOIN avec utilisateurs si nécessaire
SET @join_utilisateurs = IF(@need_join_utilisateurs > 0, 
    ' LEFT JOIN `utilisateurs` u ON yj.`confirmateur` = u.`pseudo`',
    ''
);

-- Déterminer les colonnes source pour chaque colonne cible
-- Si confirmateur est texte, on doit le convertir en ID via utilisateurs
SET @col_confirmateur = CASE
    WHEN @has_id_confirmateur > 0 THEN 'yj.`id_confirmateur`'
    WHEN @has_confirmateur > 0 AND @confirmateur_is_numeric > 0 THEN 'CAST(yj.`confirmateur` AS UNSIGNED)'
    WHEN @has_confirmateur > 0 AND @need_join_utilisateurs > 0 THEN 'u.`id`'  -- Texte, besoin de joindre avec utilisateurs
    WHEN @has_confirmateur > 0 THEN 'yj.`confirmateur`'  -- Texte mais pas de JOIN possible
    ELSE 'NULL'
END;

SET @col_ajoute = CASE
    WHEN @has_ajoute > 0 THEN 'yj.`ajoute`'
    ELSE '1.0'
END;

SET @col_date_heure = CASE
    WHEN @has_date_heure > 0 THEN 'yj.`date_heure`'
    WHEN @has_date > 0 THEN 'yj.`date`'
    ELSE 'NOW()'
END;

SET @col_tel = CASE
    WHEN @has_tel > 0 THEN 'yj.`tel`'
    WHEN @has_telephone > 0 THEN 'yj.`telephone`'
    ELSE 'NULL'
END;

-- Construire la condition WHERE pour confirmateur
SET @where_confirmateur = IF(@need_join_utilisateurs > 0,
    ' AND u.`id` IS NOT NULL AND u.`id` > 0',
    CONCAT(' AND ', COALESCE(@col_confirmateur, 'NULL'), ' IS NOT NULL AND ', COALESCE(@col_confirmateur, 'NULL'), ' > 0')
);

-- Construire la requête INSERT
-- S'assurer que @join_utilisateurs est défini (pas NULL)
SET @join_utilisateurs_safe = IF(@join_utilisateurs IS NULL OR @join_utilisateurs = '', '', @join_utilisateurs);
SET @where_confirmateur_safe = IF(@where_confirmateur IS NULL OR @where_confirmateur = '', '', @where_confirmateur);

SET @insert_query = CONCAT(
    'INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)',
    ' SELECT ',
    @col_confirmateur, ' as `confirmateur`,',
    @col_ajoute, ' as `ajoute`,',
    @col_date_heure, ' as `date_heure`,',
    @col_tel, ' as `tel`',
    ' FROM `yj_signature` yj',
    @join_utilisateurs_safe,
    ' WHERE ',
    @col_date_heure, ' IS NOT NULL',
    @where_confirmateur_safe,
    ' AND NOT EXISTS (',
    '     SELECT 1 FROM `signature` s',
    '     WHERE s.`confirmateur` = ', @col_confirmateur,
    '       AND s.`date_heure` = ', @col_date_heure,
    '       AND (s.`tel` = ', @col_tel, ' OR (s.`tel` IS NULL AND ', @col_tel, ' IS NULL))',
    ' )'
);

-- Afficher la requête générée (pour diagnostic)
SELECT @insert_query as requete_generee;

-- Afficher les colonnes détectées
SELECT 
    '=== COLONNES DÉTECTÉES ===' as info,
    @col_confirmateur as colonne_confirmateur,
    @col_ajoute as colonne_ajoute,
    @col_date_heure as colonne_date_heure,
    @col_tel as colonne_tel;

-- Afficher les informations de détection
SELECT 
    '=== INFORMATIONS DE DÉTECTION ===' as info,
    @confirmateur_is_numeric as confirmateur_est_numerique,
    @need_join_utilisateurs as besoin_join_utilisateurs,
    @join_utilisateurs as join_utilisateurs,
    @where_confirmateur as where_confirmateur;

-- Vérifier si les colonnes essentielles sont détectées
SELECT 
    CASE 
        WHEN @col_confirmateur = 'NULL' THEN '⚠️ ERREUR: Aucune colonne confirmateur trouvée!'
        WHEN @col_date_heure = 'NOW()' THEN '⚠️ ATTENTION: Aucune colonne date_heure trouvée, utilisation de NOW()'
        ELSE '✅ Colonnes essentielles détectées'
    END as verification_colonnes;

-- =====================================================
-- ÉTAPE 5 : Diagnostic des données disponibles
-- =====================================================

SELECT 
    '=== DIAGNOSTIC DES DONNÉES ===' as info;

-- Compter toutes les lignes dans yj_signature
SELECT 
    'Total lignes dans yj_signature' as info,
    COUNT(*) as total
FROM `yj_signature`;

-- Compter les lignes avec confirmateur valide (sans condition de date)
SET @count_confirmateur_query = CONCAT(
    'SELECT ',
    '    ''Lignes avec confirmateur valide'' as info,',
    '    COUNT(*) as total',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    IF(@has_confirmateur > 0 AND @confirmateur_is_numeric = 0,
        'u.`id` IS NOT NULL AND u.`id` > 0',
        CONCAT(COALESCE(@col_confirmateur, 'NULL'), ' IS NOT NULL AND ', COALESCE(@col_confirmateur, 'NULL'), ' > 0')
    )
);

PREPARE stmt_count_conf FROM @count_confirmateur_query;
EXECUTE stmt_count_conf;
DEALLOCATE PREPARE stmt_count_conf;

-- Compter les lignes avec date_heure valide
SET @count_date_query = CONCAT(
    'SELECT ',
    '    ''Lignes avec date_heure valide'' as info,',
    '    COUNT(*) as total',
    ' FROM `yj_signature` yj',
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL'
);

PREPARE stmt_count_date FROM @count_date_query;
EXECUTE stmt_count_date;
DEALLOCATE PREPARE stmt_count_date;

-- Compter les lignes qui répondent à toutes les conditions (sans NOT EXISTS)
SET @count_all_query = CONCAT(
    'SELECT ',
    '    ''Lignes répondant à toutes les conditions (sans doublons)'' as info,',
    '    COUNT(*) as total',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL',
    COALESCE(@where_confirmateur, '')
);

PREPARE stmt_count_all FROM @count_all_query;
EXECUTE stmt_count_all;
DEALLOCATE PREPARE stmt_count_all;

-- =====================================================
-- ÉTAPE 6 : Prévisualiser les données à migrer
-- =====================================================

SELECT 
    '=== PRÉVISUALISATION DES DONNÉES ===' as info;

-- Compter combien de lignes seront migrées
SET @preview_query = CONCAT(
    'SELECT ',
    '    COUNT(*) as lignes_a_migrer',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL',
    COALESCE(@where_confirmateur, ''),
    ' AND NOT EXISTS (',
    '     SELECT 1 FROM `signature` s',
    '     WHERE s.`confirmateur` = ', COALESCE(@col_confirmateur, 'NULL'),
    '       AND s.`date_heure` = ', COALESCE(@col_date_heure, 'NOW()'),
    '       AND (s.`tel` = ', COALESCE(@col_tel, 'NULL'), ' OR (s.`tel` IS NULL AND ', COALESCE(@col_tel, 'NULL'), ' IS NULL))',
    ' )'
);

PREPARE stmt_preview FROM @preview_query;
EXECUTE stmt_preview;
DEALLOCATE PREPARE stmt_preview;

-- Afficher quelques exemples de données qui seront migrées
SET @sample_query = CONCAT(
    'SELECT ',
    COALESCE(@col_confirmateur, 'NULL'), ' as confirmateur,',
    COALESCE(@col_ajoute, '1.0'), ' as ajoute,',
    COALESCE(@col_date_heure, 'NOW()'), ' as date_heure,',
    COALESCE(@col_tel, 'NULL'), ' as tel',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL',
    COALESCE(@where_confirmateur, ''),
    ' LIMIT 10'
);

SELECT 
    '=== EXEMPLES DE DONNÉES À MIGRER ===' as info;

PREPARE stmt_sample FROM @sample_query;
EXECUTE stmt_sample;
DEALLOCATE PREPARE stmt_sample;

-- Test simple : essayer de sélectionner toutes les colonnes détectées
SELECT 
    '=== TEST DE SÉLECTION SIMPLE ===' as info;

SET @test_simple_query = CONCAT(
    'SELECT ',
    COALESCE(@col_confirmateur, 'NULL'), ' as confirmateur,',
    COALESCE(@col_ajoute, '1.0'), ' as ajoute,',
    COALESCE(@col_date_heure, 'NOW()'), ' as date_heure,',
    COALESCE(@col_tel, 'NULL'), ' as tel',
    ' FROM `yj_signature` yj',
    ' LIMIT 5'
);

PREPARE stmt_test FROM @test_simple_query;
EXECUTE stmt_test;
DEALLOCATE PREPARE stmt_test;

-- =====================================================
-- ÉTAPE 7 : Exécuter la migration
-- =====================================================

SELECT 
    '=== EXÉCUTION DE LA MIGRATION ===' as info;

-- Compter les lignes avant migration
SELECT 
    'Lignes dans signature avant migration' as info,
    COUNT(*) as total_avant
FROM `signature`;

-- Afficher la requête avant exécution pour diagnostic
SELECT 
    '=== REQUÊTE INSERT GÉNÉRÉE ===' as info;

SELECT @insert_query as requete_complete;

-- Test : Compter combien de lignes répondent aux conditions SANS le NOT EXISTS
SET @test_without_exists = CONCAT(
    'SELECT ',
    '    ''Lignes répondant aux conditions (SANS vérification doublons)'' as info,',
    '    COUNT(*) as total',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL',
    COALESCE(@where_confirmateur, '')
);

SELECT 
    '=== TEST SANS NOT EXISTS ===' as info;

PREPARE stmt_test_no_exists FROM @test_without_exists;
EXECUTE stmt_test_no_exists;
DEALLOCATE PREPARE stmt_test_no_exists;

-- Test : Essayer d'insérer une seule ligne pour voir si ça fonctionne
SELECT 
    '=== TEST INSERTION D''UNE LIGNE ===' as info;

SET @test_insert_one = CONCAT(
    'INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)',
    ' SELECT ',
    COALESCE(@col_confirmateur, 'NULL'), ' as `confirmateur`,',
    COALESCE(@col_ajoute, '1.0'), ' as `ajoute`,',
    COALESCE(@col_date_heure, 'NOW()'), ' as `date_heure`,',
    COALESCE(@col_tel, 'NULL'), ' as `tel`',
    ' FROM `yj_signature` yj',
    COALESCE(@join_utilisateurs, ''),
    ' WHERE ',
    COALESCE(@col_date_heure, 'NOW()'), ' IS NOT NULL',
    COALESCE(@where_confirmateur, ''),
    ' LIMIT 1'
);

PREPARE stmt_test_one FROM @test_insert_one;
EXECUTE stmt_test_one;
SET @test_rows = ROW_COUNT();
DEALLOCATE PREPARE stmt_test_one;

SELECT 
    CONCAT('Test insertion 1 ligne: ', @test_rows, ' ligne(s) insérée(s)') as resultat_test;

-- Supprimer la ligne de test si elle existe
DELETE FROM `signature` 
WHERE `id` = (SELECT MAX(`id`) FROM (SELECT `id` FROM `signature`) as temp);

SELECT 
    CASE 
        WHEN @test_rows > 0 THEN 'Ligne de test supprimée'
        ELSE 'Aucune ligne de test à supprimer'
    END as nettoyage;

-- Exécuter l'insertion complète
SELECT 
    '=== EXÉCUTION DE L''INSERTION COMPLÈTE ===' as info;

PREPARE stmt FROM @insert_query;
EXECUTE stmt;
SET @rows_affected = ROW_COUNT();
DEALLOCATE PREPARE stmt;

-- Afficher le résultat
SELECT 
    CONCAT('Lignes insérées: ', @rows_affected) as resultat_insertion;

-- Compter les lignes après migration
SELECT 
    'Lignes dans signature après migration' as info,
    COUNT(*) as total_apres
FROM `signature`;

-- Afficher le nombre de lignes affectées par l'INSERT
SELECT 
    CONCAT('Lignes insérées (ROW_COUNT): ', @rows_affected) as resultat_insertion_detail;

-- =====================================================
-- ÉTAPE 8 : Vérification des résultats
-- =====================================================

SELECT 
    '=== VÉRIFICATION DES RÉSULTATS ===' as info;

-- Statistiques générales
SELECT 
    'Total signatures dans la table signature' as info,
    COUNT(*) as total_signatures
FROM `signature`;

-- Répartition par score
SELECT 
    'Répartition par score' as info,
    `ajoute` as score,
    COUNT(*) as nombre_signatures
FROM `signature`
GROUP BY `ajoute`
ORDER BY `ajoute` DESC;

-- Top 10 confirmateurs par nombre de signatures
SELECT 
    'Top 10 confirmateurs' as info,
    s.`confirmateur`,
    u.`pseudo` as nom_confirmateur,
    COUNT(*) as nombre_signatures,
    SUM(s.`ajoute`) as score_total
FROM `signature` s
LEFT JOIN `utilisateurs` u ON s.`confirmateur` = u.`id`
GROUP BY s.`confirmateur`, u.`pseudo`
ORDER BY nombre_signatures DESC
LIMIT 10;

-- Vérifier les signatures sans téléphone
SELECT 
    'Signatures sans téléphone' as info,
    COUNT(*) as nombre
FROM `signature`
WHERE `tel` IS NULL OR `tel` = '';

-- Vérifier les signatures sans confirmateur
SELECT 
    'Signatures sans confirmateur (erreur possible)' as info,
    COUNT(*) as nombre
FROM `signature`
WHERE `confirmateur` IS NULL OR `confirmateur` = 0;

-- Vérifier les signatures sans date_heure
SELECT 
    'Signatures sans date_heure (erreur possible)' as info,
    COUNT(*) as nombre
FROM `signature`
WHERE `date_heure` IS NULL;

-- Comparaison yj_signature vs signature
SELECT 
    'Comparaison yj_signature vs signature' as info,
    (SELECT COUNT(*) FROM `yj_signature`) as total_yj_signature,
    (SELECT COUNT(*) FROM `signature`) as total_signature,
    (SELECT COUNT(*) FROM `yj_signature`) - (SELECT COUNT(*) FROM `signature`) as difference;

-- Nettoyer
DROP TEMPORARY TABLE IF EXISTS temp_yj_signature_columns;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

SELECT '✅ Migration terminée avec succès!' as message;

