-- =====================================================
-- Script pour remplir la table signature depuis fiches_histo
-- =====================================================
-- 
-- Ce script extrait les signatures depuis fiches_histo
-- et les insère dans la table signature avec les scores appropriés
--
-- États signés pris en compte :
-- - 13 : SIGNER
-- - 16 : SIGNER RETRACTER
-- - 44 : SIGNER PM
-- - 45 : SIGNER COMPLET
-- - 38 : SIGNER RETRACTER 2 FOIS (EXCLU - ne doit pas être inclus)
--
-- Règles :
-- - Pour chaque fiche, on prend uniquement le DERNIER état signé
-- - Si le dernier état est "SIGNER RETRACTER 2 FOIS" (38), la fiche est exclue
--
-- Règles de score :
-- - 1 confirmateur : score = 1.0
-- - 2 confirmateurs : score = 0.5 pour chacun
-- - 3 confirmateurs : score = 0.33 pour chacun (1/3)
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier les données disponibles
-- =====================================================

SELECT 
    '=== VÉRIFICATION DES DONNÉES ===' as info;

-- Compter les entrées historiques avec états signés et date_sign_time
SELECT 
    'Entrées dans fiches_histo avec états signés (13, 16, 44, 45) et date_sign_time' as info,
    COUNT(*) as total_entrees
FROM `fiches_histo` fh
WHERE fh.`id_etat` IN (13, 16, 44, 45)
  AND fh.`date_sign_time` IS NOT NULL;

-- Compter les fiches avec dernier état = SIGNER RETRACTER 2 FOIS (38) - à exclure
SELECT 
    'Fiches avec dernier état = SIGNER RETRACTER 2 FOIS (38) - EXCLUES' as info,
    COUNT(DISTINCT fh.`id_fiche`) as total_fiches_exclues
FROM `fiches_histo` fh
WHERE fh.`id_fiche` IN (
    SELECT fh2.`id_fiche`
    FROM `fiches_histo` fh2
    WHERE fh2.`id_etat` IN (13, 16, 38, 44, 45)
      AND fh2.`date_creation` = (
          SELECT MAX(fh3.`date_creation`)
          FROM `fiches_histo` fh3
          WHERE fh3.`id_fiche` = fh2.`id_fiche`
            AND fh3.`id_etat` IN (13, 16, 38, 44, 45)
      )
      AND fh2.`id_etat` = 38
);

-- Vérifier la structure de fiches_histo
SELECT 
    '=== COLONNES DISPONIBLES DANS fiches_histo ===' as info,
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo'
  AND COLUMN_NAME IN ('id_confirmateur', 'id_confirmateur_2', 'id_confirmateur_3', 'date_sign_time', 'id_fiche')
ORDER BY COLUMN_NAME;

-- =====================================================
-- ÉTAPE 2 : Nettoyer les anciennes signatures (optionnel)
-- =====================================================
-- Décommentez cette section si vous voulez supprimer les anciennes signatures
-- avant d'insérer les nouvelles depuis fiches_histo

/*
DELETE FROM `signature`
WHERE `date_heure` IN (
    SELECT DISTINCT fh.`date_sign_time`
    FROM `fiches_histo` fh
    WHERE fh.`id_etat` = 13
      AND fh.`date_sign_time` IS NOT NULL
);
*/

-- =====================================================
-- ÉTAPE 3 : Détecter les colonnes disponibles dans fiches_histo
-- =====================================================

SELECT 
    '=== DÉTECTION DES COLONNES DISPONIBLES ===' as info;

-- Vérifier quelles colonnes existent dans fiches_histo
DROP TEMPORARY TABLE IF EXISTS temp_fiches_histo_columns;
CREATE TEMPORARY TABLE temp_fiches_histo_columns (
    col_name VARCHAR(100)
);
INSERT INTO temp_fiches_histo_columns
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo';

SET @has_id_confirmateur = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur');
SET @has_id_confirmateur_2 = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur_2');
SET @has_id_confirmateur_3 = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur_3');
SET @has_date_sign_time = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'date_sign_time');
SET @has_date_creation = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'date_creation');

SELECT 
    'Colonnes détectées' as info,
    @has_id_confirmateur as has_id_confirmateur,
    @has_id_confirmateur_2 as has_id_confirmateur_2,
    @has_id_confirmateur_3 as has_id_confirmateur_3,
    @has_date_sign_time as has_date_sign_time,
    @has_date_creation as has_date_creation;

-- =====================================================
-- ÉTAPE 4 : Créer une vue temporaire avec le dernier état signé par fiche
-- =====================================================

SELECT 
    '=== CRÉATION DE LA VUE TEMPORAIRE ===' as info;

-- Créer une table temporaire avec le dernier état signé de chaque fiche
DROP TEMPORARY TABLE IF EXISTS `temp_dernier_etat_signe`;

-- Créer d'abord la structure de la table
CREATE TEMPORARY TABLE `temp_dernier_etat_signe` (
    `id_fiche` INT NOT NULL,
    `id_etat` INT NOT NULL,
    `id_confirmateur` INT,
    `id_confirmateur_2` INT,
    `id_confirmateur_3` INT,
    `date_sign_time` DATETIME,
    `date_creation` DATETIME,
    `id` INT NOT NULL,
    PRIMARY KEY (`id_fiche`)
);

-- Construire la requête SELECT dynamiquement selon les colonnes disponibles
SET @select_cols = CONCAT(
    'fh.`id_fiche`,',
    'fh.`id_etat`,',
    IF(@has_id_confirmateur > 0, 'fh.`id_confirmateur`,', 'NULL as `id_confirmateur`,'),
    IF(@has_id_confirmateur_2 > 0, 'fh.`id_confirmateur_2`,', 'NULL as `id_confirmateur_2`,'),
    IF(@has_id_confirmateur_3 > 0, 'fh.`id_confirmateur_3`,', 'NULL as `id_confirmateur_3`,'),
    IF(@has_date_sign_time > 0, 'fh.`date_sign_time`,', 'NULL as `date_sign_time`,'),
    IF(@has_date_creation > 0, 'fh.`date_creation`,', 'NOW() as `date_creation`,'),
    'fh.`id`'
);

SET @where_date_sign = IF(@has_date_sign_time > 0, ' AND fh.`date_sign_time` IS NOT NULL', '');

SET @where_date_creation = IF(@has_date_creation > 0, 
    ' AND fh.`date_creation` = (
        SELECT MAX(fh2.`date_creation`)
        FROM `fiches_histo` fh2
        WHERE fh2.`id_fiche` = fh.`id_fiche`
          AND fh2.`id_etat` IN (13, 16, 44, 45)
    )',
    ''
);

SET @insert_query = CONCAT(
    'INSERT INTO `temp_dernier_etat_signe` (',
    '`id_fiche`, `id_etat`, `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3`, `date_sign_time`, `date_creation`, `id`',
    ') ',
    'SELECT ',
    COALESCE(@select_cols, ''),
    ' FROM `fiches_histo` fh',
    ' WHERE fh.`id_etat` IN (13, 16, 44, 45)',
    COALESCE(@where_date_sign, ''),
    COALESCE(@where_date_creation, ''),
    ' AND fh.`id` = (',
    '        SELECT MAX(fh3.`id`)',
    '        FROM `fiches_histo` fh3',
    '        WHERE fh3.`id_fiche` = fh.`id_fiche`',
    '          AND fh3.`id_etat` IN (13, 16, 44, 45)',
    COALESCE(IF(@has_date_creation > 0, ' AND fh3.`date_creation` = fh.`date_creation`', ''), ''),
    '    )',
    '  AND NOT EXISTS (',
    '        SELECT 1',
    '        FROM `fiches_histo` fh4',
    '        WHERE fh4.`id_fiche` = fh.`id_fiche`',
    '          AND fh4.`id_etat` = 38',
    COALESCE(IF(@has_date_creation > 0,
        CONCAT(
            ' AND fh4.`date_creation` > (',
            '            SELECT COALESCE(MAX(fh5.`date_creation`), ''1970-01-01'')',
            '            FROM `fiches_histo` fh5',
            '            WHERE fh5.`id_fiche` = fh.`id_fiche`',
            '              AND fh5.`id_etat` IN (13, 16, 44, 45)',
            '        )'
        ),
        ''
    ), ''),
    '  )'
);

-- Afficher la requête générée pour diagnostic (commenté pour éviter l'affichage)
-- SELECT @insert_query as requete_generee;

PREPARE stmt FROM @insert_query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier si des données ont été insérées dans la table temporaire
SELECT 
    'Vérification après insertion dans temp_dernier_etat_signe' as info,
    COUNT(*) as total_lignes,
    COUNT(CASE WHEN `id_confirmateur` IS NOT NULL AND `id_confirmateur` > 0 THEN 1 END) as avec_confirmateur,
    COUNT(CASE WHEN `date_sign_time` IS NOT NULL THEN 1 END) as avec_date_sign_time
FROM `temp_dernier_etat_signe`;

-- Index pour améliorer les performances
CREATE INDEX idx_temp_fiche ON `temp_dernier_etat_signe`(`id_fiche`);

SELECT 
    '✅ Vue temporaire créée' as message,
    COUNT(*) as total_derniers_etats
FROM `temp_dernier_etat_signe`;

-- =====================================================
-- DIAGNOSTIC : Vérifier les données dans la table temporaire
-- =====================================================

SELECT 
    '=== DIAGNOSTIC TABLE TEMPORAIRE ===' as info;

-- Vérifier combien de lignes ont des confirmateurs
SELECT 
    'Lignes avec id_confirmateur' as info,
    COUNT(*) as total,
    COUNT(CASE WHEN `id_confirmateur` IS NOT NULL AND `id_confirmateur` > 0 THEN 1 END) as avec_confirmateur,
    COUNT(CASE WHEN `id_confirmateur_2` IS NOT NULL AND `id_confirmateur_2` > 0 THEN 1 END) as avec_confirmateur_2,
    COUNT(CASE WHEN `id_confirmateur_3` IS NOT NULL AND `id_confirmateur_3` > 0 THEN 1 END) as avec_confirmateur_3,
    COUNT(CASE WHEN `date_sign_time` IS NOT NULL THEN 1 END) as avec_date_sign_time
FROM `temp_dernier_etat_signe`;

-- Vérifier combien de lignes peuvent être jointes avec fiches
SELECT 
    'Lignes joignables avec fiches' as info,
    COUNT(*) as total_temp,
    COUNT(f.id) as joignables,
    COUNT(CASE WHEN f.`tel` IS NOT NULL AND f.`tel` != '' THEN 1 END) as avec_tel
FROM `temp_dernier_etat_signe` fh
LEFT JOIN `fiches` f ON fh.`id_fiche` = f.`id`;

-- Vérifier un exemple de données
SELECT 
    'Exemple de données (5 premières lignes)' as info,
    fh.`id_fiche`,
    fh.`id_etat`,
    fh.`id_confirmateur`,
    fh.`id_confirmateur_2`,
    fh.`id_confirmateur_3`,
    fh.`date_sign_time`,
    f.`tel`,
    CASE 
        WHEN f.`tel` IS NULL OR f.`tel` = '' THEN 'PAS DE TEL'
        WHEN fh.`id_confirmateur` IS NULL OR fh.`id_confirmateur` = 0 THEN 'PAS DE CONFIRMATEUR'
        WHEN fh.`date_sign_time` IS NULL THEN 'PAS DE DATE_SIGN_TIME'
        ELSE 'OK'
    END as statut
FROM `temp_dernier_etat_signe` fh
LEFT JOIN `fiches` f ON fh.`id_fiche` = f.`id`
LIMIT 5;

-- =====================================================
-- ÉTAPE 4 : Insérer les signatures depuis fiches_histo
-- =====================================================

SELECT 
    '=== INSERTION DES SIGNATURES ===' as info;

-- Diagnostic : Compter combien de lignes correspondent aux critères
SELECT 
    'Diagnostic Cas 1 (1 confirmateur)' as info,
    COUNT(*) as lignes_correspondantes
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND (fh.`id_confirmateur_2` IS NULL OR fh.`id_confirmateur_2` = 0)
  AND (fh.`id_confirmateur_3` IS NULL OR fh.`id_confirmateur_3` = 0)
  AND f.`tel` IS NOT NULL
  AND f.`tel` != '';

-- Cas 1 : Un seul confirmateur (id_confirmateur uniquement)
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur` as `confirmateur`,
    1.0 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND (fh.`id_confirmateur_2` IS NULL OR fh.`id_confirmateur_2` = 0)
  AND (fh.`id_confirmateur_3` IS NULL OR fh.`id_confirmateur_3` = 0)
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

SELECT 
    '✅ Cas 1 terminé : 1 confirmateur (score 1.0)' as message,
    ROW_COUNT() as lignes_inserees;

-- Cas 2 : Deux confirmateurs (id_confirmateur + id_confirmateur_2)
-- Confirmateur 1
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur` as `confirmateur`,
    0.5 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND fh.`id_confirmateur_2` IS NOT NULL
  AND fh.`id_confirmateur_2` > 0
  AND (fh.`id_confirmateur_3` IS NULL OR fh.`id_confirmateur_3` = 0)
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

-- Confirmateur 2
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur_2` as `confirmateur`,
    0.5 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur_2` IS NOT NULL
  AND fh.`id_confirmateur_2` > 0
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND (fh.`id_confirmateur_3` IS NULL OR fh.`id_confirmateur_3` = 0)
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur_2`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

SELECT 
    '✅ Cas 2 terminé : 2 confirmateurs (score 0.5 chacun)' as message,
    ROW_COUNT() as lignes_inserees;

-- Cas 3 : Trois confirmateurs (id_confirmateur + id_confirmateur_2 + id_confirmateur_3)
-- Confirmateur 1
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur` as `confirmateur`,
    0.33 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND fh.`id_confirmateur_2` IS NOT NULL
  AND fh.`id_confirmateur_2` > 0
  AND fh.`id_confirmateur_3` IS NOT NULL
  AND fh.`id_confirmateur_3` > 0
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

-- Confirmateur 2
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur_2` as `confirmateur`,
    0.33 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur_2` IS NOT NULL
  AND fh.`id_confirmateur_2` > 0
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND fh.`id_confirmateur_3` IS NOT NULL
  AND fh.`id_confirmateur_3` > 0
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur_2`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

-- Confirmateur 3
INSERT INTO `signature` (`confirmateur`, `ajoute`, `date_heure`, `tel`)
SELECT 
    fh.`id_confirmateur_3` as `confirmateur`,
    0.33 as `ajoute`,
    fh.`date_sign_time` as `date_heure`,
    f.`tel`
FROM `temp_dernier_etat_signe` fh
INNER JOIN `fiches` f ON fh.`id_fiche` = f.`id`
WHERE fh.`date_sign_time` IS NOT NULL
  AND fh.`id_confirmateur_3` IS NOT NULL
  AND fh.`id_confirmateur_3` > 0
  AND fh.`id_confirmateur` IS NOT NULL
  AND fh.`id_confirmateur` > 0
  AND fh.`id_confirmateur_2` IS NOT NULL
  AND fh.`id_confirmateur_2` > 0
  AND f.`tel` IS NOT NULL
  AND f.`tel` != ''
  -- Éviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM `signature` s
    WHERE s.`confirmateur` = fh.`id_confirmateur_3`
      AND s.`date_heure` = fh.`date_sign_time`
      AND s.`tel` = f.`tel`
  );

SELECT 
    '✅ Cas 3 terminé : 3 confirmateurs (score 0.33 chacun)' as message,
    ROW_COUNT() as lignes_inserees;

-- Nettoyer la table temporaire
DROP TEMPORARY TABLE IF EXISTS `temp_dernier_etat_signe`;

-- =====================================================
-- ÉTAPE 5 : Vérification des résultats
-- =====================================================

SELECT 
    '=== RÉSULTATS ===' as info;

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

-- Vérifier les signatures sans téléphone (devrait être 0)
SELECT 
    'Signatures sans téléphone (erreur possible)' as info,
    COUNT(*) as nombre
FROM `signature`
WHERE `tel` IS NULL OR `tel` = '';

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

SELECT '✅ Script terminé avec succès!' as message;

