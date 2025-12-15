-- =====================================================
-- Script de migration de yj_histo_fiche vers l'historique des états
-- =====================================================
-- 
-- Ce script lit les données de yj_histo_fiche et les insère dans :
-- 1. fiches_histo : pour l'historique des états
-- 2. modifica : pour l'historique des modifications si nécessaire
--
-- IMPORTANT : 
-- - Vérifier que la table yj_histo_fiche existe avant d'exécuter ce script
-- - Adapter les noms de colonnes selon la structure réelle de yj_histo_fiche
-- - Exécuter d'abord sur une base de test
--
-- =====================================================

-- Désactiver les vérifications de clés étrangères temporairement pour améliorer les performances
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier l'existence et la structure de yj_histo_fiche
-- =====================================================

-- IMPORTANT : Avant d'exécuter ce script, vérifier la structure de yj_histo_fiche :
-- Exécuter : DESCRIBE yj_histo_fiche;
-- ou : SHOW CREATE TABLE yj_histo_fiche;

-- Afficher la structure de la table (à exécuter manuellement si nécessaire)
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'yj_histo_fiche';

-- Vérifier si la table existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK - Table yj_histo_fiche existe'
        ELSE 'ERREUR - Table yj_histo_fiche n''existe pas'
    END as verification_table
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'yj_histo_fiche';

-- =====================================================
-- ÉTAPE 2 : Détecter les colonnes disponibles dans yj_histo_fiche
-- =====================================================

-- Afficher toutes les colonnes disponibles dans yj_histo_fiche
SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
ORDER BY ORDINAL_POSITION;

-- =====================================================
-- ÉTAPE 3 : Migration vers fiches_histo (historique des états)
-- =====================================================

-- IMPORTANT : Adapter cette requête selon les colonnes réellement disponibles
-- Les colonnes possibles pour l'ID de la fiche : id, id_fiche, fiche_id
-- Les colonnes possibles pour l'état : etat, etat_id, etat_final, id_etat, statut
-- Les colonnes possibles pour la date : date_creation, date_insertion, date, date_heure_mod, date_modif_time

-- Version générique qui essaie plusieurs noms de colonnes possibles
-- À adapter selon les résultats de l'étape 2 ci-dessus

-- Option 1 : Si yj_histo_fiche a une structure simple avec id et etat (ou équivalent)
-- DÉCOMMENTER ET ADAPTER selon la structure réelle détectée à l'étape 2

/*
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    -- ID de la fiche : adapter selon la colonne réelle
    hf.`id` AS `id_fiche`,  -- ou hf.`id_fiche` ou hf.`fiche_id`
    
    -- Conversion de l'état : adapter selon la colonne réelle
    -- Si la colonne contient un ID numérique
    COALESCE(
        CASE 
            WHEN hf.`etat` REGEXP '^[0-9]+$' 
            THEN CAST(hf.`etat` AS UNSIGNED)
            ELSE NULL
        END,
        -- Si la colonne contient un titre, chercher l'ID dans etats
        (SELECT e.`id` 
         FROM `etats` e 
         WHERE e.`titre` = hf.`etat`
            OR e.`titre` LIKE CONCAT('%', hf.`etat`, '%')
         LIMIT 1),
        1  -- État par défaut
    ) AS `id_etat`,
    
    -- Date RDV (optionnel)
    NULL AS `date_rdv_time`,  -- ou hf.`date_rdv` ou hf.`date_rdv_time`
    
    -- Date de création
    COALESCE(
        hf.`date_creation`,  -- adapter selon la colonne réelle
        hf.`date_insertion`,
        hf.`date`,
        hf.`date_heure_mod`,
        NOW()
    ) AS `date_creation`
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = hf.`id`  -- adapter selon la colonne réelle
)
AND NOT EXISTS (
    SELECT 1 
    FROM `fiches_histo` fh 
    WHERE fh.`id_fiche` = hf.`id`
      AND fh.`date_creation` = COALESCE(hf.`date_creation`, NOW())
)
ORDER BY hf.`id`, COALESCE(hf.`date_creation`, NOW());
*/

-- =====================================================
-- INSTRUCTIONS IMPORTANTES
-- =====================================================
--
-- 1. Exécutez d'abord l'ÉTAPE 2 ci-dessus pour voir les colonnes disponibles
-- 2. Adaptez le template ci-dessous en remplaçant les noms de colonnes
-- 3. Décommentez et exécutez l'INSERT
--
-- =====================================================
-- DIAGNOSTIC : Vérifier les données avant migration
-- =====================================================

-- 1. Voir quelques exemples de données
SELECT 
    'Exemples de données dans yj_histo_fiche' as info,
    COUNT(*) as total_lignes
FROM `yj_histo_fiche`;

-- 2. Voir les premières lignes pour identifier les colonnes
SELECT * FROM `yj_histo_fiche` LIMIT 5;

-- 3. Vérifier combien de fiches de yj_histo_fiche existent dans fiches
SELECT 
    'Fiches de yj_histo_fiche qui existent dans fiches' as info,
    COUNT(DISTINCT COALESCE(hf.`id_fiche`, hf.`id`)) as fiches_existantes
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = COALESCE(hf.`id_fiche`, hf.`id`)
);

-- =====================================================
-- VERSION SIMPLE : Utilise uniquement la colonne 'id' (sûre)
-- =====================================================
-- Cette version utilise uniquement la colonne 'id' qui devrait exister
-- et met un état par défaut (1 = EN-ATTENTE)
--
-- IMPORTANT : Si vous avez d'autres colonnes (etat, date_creation, etc.),
-- adaptez cette requête après avoir vu les colonnes réelles avec la requête ci-dessus

-- VERSION MINIMALE : Utilise uniquement la colonne 'id' (qui devrait exister)
-- Cette version crée des entrées avec l'état par défaut (1 = EN-ATTENTE) et la date actuelle
-- Si vous avez d'autres colonnes, vous pouvez adapter après

INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    -- ID de la fiche : utiliser la colonne 'id' (supposée exister)
    hf.`id` AS `id_fiche`,
    
    -- État par défaut (EN-ATTENTE = 1)
    -- Si vous avez une colonne 'etat', adaptez ceci pour l'utiliser
    1 AS `id_etat`,
    
    -- Date RDV (optionnel - NULL)
    NULL AS `date_rdv_time`,
    
    -- Date de création : utiliser NOW() par défaut
    -- Si vous avez une colonne date, remplacez NOW() par hf.`date` ou hf.`date_creation`
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
-- ÉTAPE 4 : Migration vers modifica (OPTIONNEL - si nécessaire)
-- =====================================================

-- Cette section est optionnelle et dépend de la structure de yj_histo_fiche
-- Si yj_histo_fiche contient des informations sur qui a modifié et quoi, on peut les migrer

-- Exemple de migration vers modifica pour les changements d'état
-- (Adapter selon la structure réelle de yj_histo_fiche)
-- COMMENTÉ PAR DÉFAUT - décommenter si nécessaire

/*
INSERT INTO `modifica` (`id_fiche`, `id_user`, `type`, `ancien_valeur`, `nouvelle_valeur`, `date_modif_time`)
SELECT DISTINCT
    COALESCE(hf.`id_fiche`, hf.`id`) AS `id_fiche`,
    -- ID de l'utilisateur qui a fait la modification (si disponible)
    COALESCE(
        hf.`id_user`,
        hf.`id_agent`,
        hf.`modifier_par`,
        NULL
    ) AS `id_user`,
    'etat' AS `type`,
    -- Ancien état (essayer de trouver l'état précédent ou NULL)
    NULL AS `ancien_valeur`,
    -- Nouvel état (convertir en string)
    -- REMPLACER : adapter selon le nom réel de la colonne état
    COALESCE(
        CASE 
            WHEN hf.`NOM_COLONNE_ETAT` REGEXP '^[0-9]+$' 
            THEN CAST(hf.`NOM_COLONNE_ETAT` AS CHAR)
            ELSE NULL
        END,
        (SELECT CAST(e.`id` AS CHAR)
         FROM `etats` e 
         WHERE e.`titre` = hf.`NOM_COLONNE_ETAT`
            OR e.`titre` LIKE CONCAT('%', hf.`NOM_COLONNE_ETAT`, '%')
         LIMIT 1),
        CAST(hf.`NOM_COLONNE_ETAT` AS CHAR)
    ) AS `nouvelle_valeur`,
    -- Date de modification
    COALESCE(
        hf.`date_modif_time`,
        hf.`date_heure_mod`,
        hf.`date_creation`,
        hf.`date_insertion`,
        NOW()
    ) AS `date_modif_time`
FROM `yj_histo_fiche` hf
WHERE EXISTS (
    SELECT 1 
    FROM `fiches` f 
    WHERE f.`id` = COALESCE(hf.`id_fiche`, hf.`id`)
)
-- Éviter les doublons
AND NOT EXISTS (
    SELECT 1 
    FROM `modifica` m 
    WHERE m.`id_fiche` = COALESCE(hf.`id_fiche`, hf.`id`)
      AND m.`type` = 'etat'
      AND m.`date_modif_time` = COALESCE(
          hf.`date_modif_time`,
          hf.`date_heure_mod`,
          hf.`date_creation`,
          hf.`date_insertion`,
          NOW()
      )
)
-- Filtrer uniquement si on a un état valide
-- REMPLACER : adapter selon le nom réel de la colonne état
-- AND hf.`NOM_COLONNE_ETAT` IS NOT NULL;
*/

-- =====================================================
-- ÉTAPE 5 : Statistiques et vérification
-- =====================================================

-- Afficher le nombre d'enregistrements migrés
SELECT 
    'fiches_histo' AS `table`,
    COUNT(*) AS `nombre_enregistrements_migres`
FROM `fiches_histo`
WHERE `date_creation` >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
UNION ALL
SELECT 
    'modifica' AS `table`,
    COUNT(*) AS `nombre_enregistrements_migres`
FROM `modifica`
WHERE `date_modif_time` >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Afficher quelques exemples de données migrées
SELECT 
    'Exemples fiches_histo' AS `type`,
    fh.`id`,
    fh.`id_fiche`,
    fh.`id_etat`,
    e.`titre` AS `etat_titre`,
    fh.`date_creation`
FROM `fiches_histo` fh
LEFT JOIN `etats` e ON fh.`id_etat` = e.`id`
WHERE fh.`date_creation` >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY fh.`date_creation` DESC
LIMIT 10;

-- Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Ce script nécessite de connaître la structure réelle de yj_histo_fiche
--    Exécutez d'abord l'ÉTAPE 2 pour voir les colonnes disponibles
--    Les colonnes typiques pourraient être :
--    - id ou id_fiche : ID de la fiche
--    - etat, id_etat, ou autre : ID ou titre de l'état
--    - date, date_creation, date_insertion, ou autre : Date
--    - date_rdv_time ou autre : Date RDV (optionnel)
--
-- 2. Pour voir la structure réelle de yj_histo_fiche, exécuter :
--    DESCRIBE `yj_histo_fiche`;
--    ou
--    SHOW CREATE TABLE `yj_histo_fiche`;
--
-- 3. Si les noms de colonnes sont différents, modifier les requêtes ci-dessus
--
-- 4. Ce script évite les doublons mais vérifier manuellement après exécution
--
-- 5. Pour tester, remplacer les INSERT par SELECT pour voir ce qui serait inséré
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

