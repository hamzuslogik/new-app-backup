-- =====================================================
-- Script pour ajouter la colonne id_fiche à la table signature
-- =====================================================
-- 
-- Ce script ajoute la colonne id_fiche pour relier directement
-- la table signature à la table fiches par ID au lieu de seulement par tel
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier si la colonne existe déjà
-- =====================================================

SELECT 
    '=== VÉRIFICATION DE LA COLONNE ===' as info;

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK - Colonne id_fiche existe déjà'
        ELSE 'INFO - Colonne id_fiche n''existe pas, elle sera créée'
    END as verification_id_fiche
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'signature'
  AND COLUMN_NAME = 'id_fiche';

-- =====================================================
-- ÉTAPE 2 : Ajouter la colonne id_fiche si elle n'existe pas
-- =====================================================

SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'signature'
      AND COLUMN_NAME = 'id_fiche'
);

SET @sql_add_col = IF(@col_exists = 0,
    'ALTER TABLE `signature` ADD COLUMN `id_fiche` INT(11) DEFAULT NULL AFTER `id`',
    'SELECT ''Colonne id_fiche existe déjà, pas besoin de la créer'' as message'
);

PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- ÉTAPE 3 : Ajouter un index sur id_fiche pour améliorer les performances
-- =====================================================

SELECT 
    '=== AJOUT DE L''INDEX ===' as info;

SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'signature'
      AND INDEX_NAME = 'idx_id_fiche'
);

SET @sql_add_index = IF(@index_exists = 0,
    'ALTER TABLE `signature` ADD INDEX `idx_id_fiche` (`id_fiche`)',
    'SELECT ''Index idx_id_fiche existe déjà'' as message'
);

PREPARE stmt_index FROM @sql_add_index;
EXECUTE stmt_index;
DEALLOCATE PREPARE stmt_index;

-- =====================================================
-- ÉTAPE 4 : Remplir id_fiche pour les enregistrements existants
-- =====================================================

SELECT 
    '=== REMPLISSAGE DE id_fiche POUR LES ENREGISTREMENTS EXISTANTS ===' as info;

-- Mettre à jour id_fiche en joignant avec fiches par tel
UPDATE `signature` s
INNER JOIN `fiches` f ON s.`tel` = f.`tel` 
  AND s.`date_heure` = f.`date_sign_time`
SET s.`id_fiche` = f.`id`
WHERE s.`id_fiche` IS NULL;

-- Afficher le nombre de lignes mises à jour
SELECT 
    'Lignes mises à jour avec id_fiche' as info,
    ROW_COUNT() as lignes_mises_a_jour;

-- Afficher les statistiques
SELECT 
    '=== STATISTIQUES ===' as info;

SELECT 
    'Total signatures' as info,
    COUNT(*) as total
FROM `signature`;

SELECT 
    'Signatures avec id_fiche' as info,
    COUNT(*) as total
FROM `signature`
WHERE `id_fiche` IS NOT NULL;

SELECT 
    'Signatures sans id_fiche' as info,
    COUNT(*) as total
FROM `signature`
WHERE `id_fiche` IS NULL;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

SELECT '✅ Colonne id_fiche ajoutée avec succès!' as message;

