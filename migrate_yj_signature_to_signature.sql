-- =====================================================
-- Script de migration : yj_signature -> signature
-- =====================================================
-- 
-- Ce script migre les données de la table yj_signature
-- vers la table signature
--
-- Structure de la table signature :
-- - id (AUTO_INCREMENT)
-- - id_fiche (INT) - IGNORÉ dans cette migration (sera rempli par update_signature_id_fiche_from_tel.sql)
-- - confirmateur (INT)
-- - ajoute (DECIMAL(10,2))
-- - date_heure (DATETIME)
-- - tel (VARCHAR(255))
--
-- NOTE: Ce script ignore id_fiche pour optimiser les performances.
-- Exécutez update_signature_id_fiche_from_tel.sql après pour remplir id_fiche.
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Détecter les colonnes disponibles
-- =====================================================


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

-- Vérifier si confirmateur est numérique ou texte (optimisé avec LIMIT 1)
SET @confirmateur_is_numeric = 0;
SET @test_numeric = IF(@has_confirmateur > 0,
    (SELECT COUNT(*) 
     FROM `yj_signature` 
     WHERE `confirmateur` REGEXP '^[0-9]+$' 
     LIMIT 1),
    0
);
SET @confirmateur_is_numeric = IF(@has_confirmateur > 0 AND @test_numeric > 0, 1, 0);

-- =====================================================
-- ÉTAPE 2 : Construire la requête de migration
-- =====================================================

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
    IF(@col_confirmateur IS NOT NULL AND @col_confirmateur != 'NULL',
        CONCAT(' AND ', @col_confirmateur, ' IS NOT NULL AND ', @col_confirmateur, ' > 0'),
        ''
    )
);

-- S'assurer que @join_utilisateurs et @where_confirmateur sont définis (pas NULL)
SET @join_utilisateurs_safe = IF(@join_utilisateurs IS NULL OR @join_utilisateurs = '', '', @join_utilisateurs);
SET @where_confirmateur_safe = IF(@where_confirmateur IS NULL OR @where_confirmateur = '', '', @where_confirmateur);

-- Construire la requête INSERT sans id_fiche (sera rempli plus tard par un autre script)
-- Version optimisée sans sous-requête pour id_fiche
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
    ' AND ', @col_tel, ' IS NOT NULL',
    ' AND ', @col_tel, ' != ''''',
    @where_confirmateur_safe,
    ' AND NOT EXISTS (',
    '     SELECT 1 FROM `signature` s',
    '     WHERE s.`tel` = ', @col_tel,
    '       AND s.`confirmateur` = ', @col_confirmateur,
    '       AND s.`date_heure` = ', @col_date_heure,
    '     LIMIT 1',
    ' )'
);

-- =====================================================
-- ÉTAPE 3 : Exécuter la migration
-- =====================================================

PREPARE stmt FROM @insert_query;
EXECUTE stmt;
SET @rows_affected = ROW_COUNT();
DEALLOCATE PREPARE stmt;

-- Afficher le résultat
SELECT 
    CONCAT('✅ Migration terminée: ', @rows_affected, ' ligne(s) insérée(s)') as resultat;

-- Statistiques
SELECT 
    '=== STATISTIQUES ===' as info;

SELECT 
    COUNT(*) as total_signatures_migrees
FROM `signature`;

SELECT 
    COUNT(*) as signatures_sans_id_fiche
FROM `signature`
WHERE `id_fiche` IS NULL OR `id_fiche` = 0;

SELECT 
    'NOTE: Pour remplir id_fiche, exécutez le script update_signature_id_fiche_from_tel.sql' as info;

-- Nettoyer
DROP TEMPORARY TABLE IF EXISTS temp_yj_signature_columns;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

