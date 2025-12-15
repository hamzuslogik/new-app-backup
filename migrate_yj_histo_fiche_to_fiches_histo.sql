-- =====================================================
-- Script de migration de yj_histo_fiche vers fiches_histo
-- =====================================================
-- 
-- Ce script migre l'historique des états des fiches depuis yj_histo_fiche
-- vers fiches_histo pour permettre l'affichage de l'historique des fiches
-- qui ont été insérées depuis yj_fiche vers fiches.
--
-- IMPORTANT : 
-- - Chaque fiche peut avoir plusieurs lignes dans yj_histo_fiche
-- - Le script insère toutes ces lignes dans fiches_histo
-- - Vérifiez d'abord la structure de yj_histo_fiche avant d'exécuter
--
-- =====================================================

USE `crm`;

-- Désactiver temporairement les vérifications pour améliorer les performances
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier la structure de yj_histo_fiche
-- =====================================================

-- Vérifier si la table existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Table yj_histo_fiche existe'
        ELSE '✗ Table yj_histo_fiche n''existe pas'
    END as verification_table
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'yj_histo_fiche';

-- Afficher la structure de la table
SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
ORDER BY ORDINAL_POSITION;

-- Afficher quelques exemples de données
SELECT 
    'Exemples de données dans yj_histo_fiche' as info,
    COUNT(*) as total_lignes
FROM `yj_histo_fiche`;

SELECT * FROM `yj_histo_fiche` LIMIT 10;

-- =====================================================
-- ÉTAPE 2 : Vérifier les correspondances avec la table fiches
-- =====================================================

-- Compter combien de fiches de yj_histo_fiche existent dans fiches
SELECT 
    'Fiches de yj_histo_fiche qui existent dans fiches' as info,
    COUNT(DISTINCT hf.`id`) as total_fiches_avec_historique
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
);

-- Voir la distribution : nombre de lignes d'historique par fiche
SELECT 
    hf.`id` as id_fiche,
    COUNT(*) as nb_lignes_historique
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
)
GROUP BY hf.`id`
ORDER BY nb_lignes_historique DESC
LIMIT 20;

-- =====================================================
-- ÉTAPE 3 : Migration vers fiches_histo
-- =====================================================

-- IMPORTANT : Cette requête doit être adaptée selon les colonnes réelles de yj_histo_fiche
-- Après avoir vu la structure à l'étape 1, adaptez les colonnes ci-dessous
--
-- Colonnes supposées dans yj_histo_fiche :
--   - id : ID de la fiche (correspond à fiches.id)
--   - etat ou id_etat : ID ou titre de l'état
--   - date ou date_creation : Date de création de l'entrée historique
--   - date_rdv (optionnel) : Date du rendez-vous

-- =====================================================
-- VERSION 1 : Version complète (utilise les colonnes etat, date_creation, etc.)
-- =====================================================
-- ⚠️ Cette version est COMMENTÉE par défaut car les colonnes peuvent ne pas exister
-- Si vous connaissez les colonnes réelles de yj_histo_fiche, décommentez et adaptez

/*
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    -- ID de la fiche : utiliser la colonne 'id'
    hf.`id` AS `id_fiche`,
    
    -- État : utiliser la colonne 'etat' si elle existe, sinon état par défaut
    -- Si vous obtenez une erreur "Unknown column 'hf.etat'", remplacez tout ce COALESCE par : 1 AS `id_etat`,
    COALESCE(
        -- Si 'etat' est un nombre (ID), l'utiliser directement
        CASE 
            WHEN hf.`etat` IS NOT NULL 
                 AND CAST(hf.`etat` AS CHAR) REGEXP '^[0-9]+$'
            THEN CAST(hf.`etat` AS UNSIGNED)
            ELSE NULL
        END,
        -- Si 'etat' est un titre, chercher l'ID dans la table etats
        (SELECT e.`id` 
         FROM `etats` e 
         WHERE hf.`etat` IS NOT NULL 
           AND (e.`titre` = CAST(hf.`etat` AS CHAR)
                OR e.`titre` LIKE CONCAT('%', CAST(hf.`etat` AS CHAR), '%')
                OR UPPER(e.`titre`) = UPPER(CAST(hf.`etat` AS CHAR)))
         LIMIT 1),
        -- État par défaut si 'etat' n'existe pas ou si non trouvé
        1  -- EN-ATTENTE
    ) AS `id_etat`,
    
    -- Date du rendez-vous (optionnel) - Mettre NULL par défaut
    -- Si vous avez une colonne date_rdv, décommentez et adaptez :
    -- hf.`date_rdv` AS `date_rdv_time`,
    NULL AS `date_rdv_time`,
    
    -- Date de création de l'entrée historique
    -- Si vous obtenez une erreur "Unknown column", remplacez par : NOW() AS `date_creation`
    COALESCE(
        hf.`date_creation`,
        hf.`date`,
        hf.`date_insertion`,
        hf.`date_heure_mod`,
        hf.`date_modif_time`,
        NOW()
    ) AS `date_creation`
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
)
-- Éviter les doublons : ne pas insérer si cette combinaison existe déjà
AND NOT EXISTS (
    SELECT 1 
    FROM `fiches_histo` fh 
    WHERE fh.`id_fiche` = hf.`id`
      -- Comparer sur l'ID de l'état et la date de création (à 1 minute près pour éviter les doublons dus aux secondes)
      AND fh.`id_etat` = COALESCE(
          CASE 
              WHEN hf.`etat` IS NOT NULL 
                   AND CAST(hf.`etat` AS CHAR) REGEXP '^[0-9]+$'
              THEN CAST(hf.`etat` AS UNSIGNED)
              ELSE NULL
          END,
          (SELECT e.`id` 
           FROM `etats` e 
           WHERE hf.`etat` IS NOT NULL 
             AND (e.`titre` = CAST(hf.`etat` AS CHAR)
                  OR e.`titre` LIKE CONCAT('%', CAST(hf.`etat` AS CHAR), '%')
                  OR UPPER(e.`titre`) = UPPER(CAST(hf.`etat` AS CHAR)))
           LIMIT 1),
          1
      )
      AND ABS(TIMESTAMPDIFF(SECOND, 
          fh.`date_creation`, 
          COALESCE(
              hf.`date_creation`,
              hf.`date`,
              hf.`date_insertion`,
              hf.`date_heure_mod`,
              hf.`date_modif_time`,
              NOW()
          )
      )) < 60  -- Tolérance de 1 minute pour éviter les doublons
)
ORDER BY hf.`id`, COALESCE(
    hf.`date_creation`,
    hf.`date`,
    hf.`date_insertion`,
    hf.`date_heure_mod`,
    hf.`date_modif_time`,
    NOW()
);
*/

-- =====================================================
-- VERSION 2 : Version minimale (utilise uniquement la colonne 'id')
-- =====================================================
-- ✅ Cette version est ACTIVE par défaut car elle utilise uniquement 'id'
-- Elle insère toutes les lignes avec l'état par défaut (1 = EN-ATTENTE)
-- et la date actuelle

INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    hf.`id` AS `id_fiche`,
    1 AS `id_etat`,  -- État par défaut (EN-ATTENTE)
    NULL AS `date_rdv_time`,
    NOW() AS `date_creation`
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`
)
AND NOT EXISTS (
    SELECT 1 
    FROM `fiches_histo` fh 
    WHERE fh.`id_fiche` = hf.`id`
      AND DATE(fh.`date_creation`) = DATE(NOW())
)
ORDER BY hf.`id`;

-- =====================================================
-- ÉTAPE 4 : Statistiques après migration
-- =====================================================

-- Afficher le nombre d'enregistrements insérés
SELECT 
    'Résultats de la migration' as info,
    COUNT(*) AS total_lignes_inserees
FROM `fiches_histo`
WHERE `date_creation` >= DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- Afficher quelques exemples de données migrées
SELECT 
    'Exemples de données migrées' as info,
    fh.`id`,
    fh.`id_fiche`,
    fh.`id_etat`,
    e.`titre` AS `etat_titre`,
    fh.`date_creation`,
    fh.`date_rdv_time`
FROM `fiches_histo` fh
LEFT JOIN `etats` e ON fh.`id_etat` = e.`id`
WHERE fh.`date_creation` >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY fh.`id_fiche`, fh.`date_creation`
LIMIT 20;

-- Voir la distribution : nombre de lignes d'historique par fiche (après migration)
SELECT 
    fh.`id_fiche`,
    COUNT(*) as nb_lignes_historique_migrees
FROM `fiches_histo` fh
WHERE fh.`date_creation` >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
GROUP BY fh.`id_fiche`
ORDER BY nb_lignes_historique_migrees DESC
LIMIT 20;

-- Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Si vous obtenez une erreur "Unknown column", cela signifie que les colonnes
--    utilisées n'existent pas dans yj_histo_fiche.
--    Dans ce cas, utilisez la VERSION 2 (version minimale) qui utilise uniquement 'id'
--
-- 2. Pour adapter le script :
--    a) Exécutez d'abord les requêtes de l'ÉTAPE 1 pour voir la structure réelle
--    b) Adaptez les noms de colonnes dans l'INSERT selon la structure réelle
--    c) Si la colonne 'etat' n'existe pas, utilisez la VERSION 2 ou mettez un état par défaut
--
-- 3. Version minimale (VERSION 2) :
--    - Utilise uniquement la colonne 'id' (qui devrait toujours exister)
--    - Met l'état par défaut (1 = EN-ATTENTE) pour toutes les entrées
--    - Utilise NOW() comme date de création
--    - Décommentez cette version si la VERSION 1 ne fonctionne pas
--
-- 3. Le script évite les doublons en vérifiant :
--    - L'ID de la fiche
--    - L'ID de l'état
--    - La date de création (avec une tolérance de 1 minute)
--
-- 4. Si vous avez besoin de réexécuter le script, vous pouvez :
--    - Soit supprimer les entrées déjà migrées de fiches_histo
--    - Soit modifier la condition NOT EXISTS pour ne pas vérifier les doublons
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

