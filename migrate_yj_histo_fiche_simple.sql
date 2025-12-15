-- =====================================================
-- Script SIMPLIFIÉ de migration de yj_histo_fiche vers l'historique des états
-- =====================================================
-- 
-- VERSION SIMPLE - À adapter selon la structure réelle de yj_histo_fiche
--
-- Ce script suppose une structure typique de yj_histo_fiche :
--   - id : ID de l'enregistrement historique
--   - id_fiche : ID de la fiche (ou peut être "id" si c'est le même que fiches.id)
--   - etat_final : ID de l'état OU titre de l'état (varchar)
--   - date_creation : Date de création de l'entrée historique
--   - date_rdv_time : Date du rendez-vous (optionnel)
--
-- IMPORTANT : 
-- 1. Exécuter d'abord : DESCRIBE yj_histo_fiche; pour voir la structure réelle
-- 2. Adapter les noms de colonnes dans ce script selon la structure réelle
-- 3. Tester d'abord avec SELECT au lieu de INSERT pour voir les données
--
-- =====================================================

-- Désactiver temporairement les vérifications pour améliorer les performances
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Voir la structure de yj_histo_fiche (à exécuter manuellement d'abord)
-- =====================================================
-- DESCRIBE `yj_histo_fiche`;
-- ou
-- SHOW CREATE TABLE `yj_histo_fiche`;

-- =====================================================
-- ÉTAPE 2 : Migration vers fiches_histo (historique des états)
-- =====================================================

-- VERSION 1 : Si yj_histo_fiche.etat_final contient un ID d'état (int)
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    hf.`id_fiche` AS `id_fiche`,  -- Adapter : peut être hf.`id` si c'est le même que fiches.id
    hf.`etat_final` AS `id_etat`,  -- Adapter : peut être hf.`id_etat`, hf.`etat_id`, etc.
    hf.`date_rdv_time` AS `date_rdv_time`,  -- Adapter : peut être hf.`date_rdv`, hf.`date_heure_playning`, etc.
    COALESCE(
        hf.`date_creation`,
        hf.`date_insertion`,
        hf.`date_heure_mod`,
        hf.`date_modif_time`,
        NOW()
    ) AS `date_creation`
FROM `yj_histo_fiche` hf
INNER JOIN `fiches` f ON f.`id` = hf.`id_fiche`  -- Vérifier que la fiche existe
WHERE hf.`etat_final` IS NOT NULL
  AND NOT EXISTS (
      -- Éviter les doublons
      SELECT 1 
      FROM `fiches_histo` fh 
      WHERE fh.`id_fiche` = hf.`id_fiche`
        AND fh.`id_etat` = hf.`etat_final`
        AND ABS(TIMESTAMPDIFF(SECOND, fh.`date_creation`, COALESCE(hf.`date_creation`, hf.`date_insertion`, NOW()))) < 60
  );

-- VERSION 2 : Si yj_histo_fiche.etat_final contient un TITRE d'état (varchar) - À utiliser à la place de la VERSION 1
/*
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
SELECT DISTINCT
    hf.`id_fiche` AS `id_fiche`,
    COALESCE(
        e.`id`,
        (SELECT `id` FROM `etats` WHERE `titre` = hf.`etat_final` LIMIT 1),
        1  -- État par défaut si non trouvé
    ) AS `id_etat`,
    hf.`date_rdv_time` AS `date_rdv_time`,
    COALESCE(
        hf.`date_creation`,
        hf.`date_insertion`,
        hf.`date_heure_mod`,
        NOW()
    ) AS `date_creation`
FROM `yj_histo_fiche` hf
INNER JOIN `fiches` f ON f.`id` = hf.`id_fiche`
LEFT JOIN `etats` e ON e.`titre` = hf.`etat_final` OR e.`abbreviation` = hf.`etat_final`
WHERE hf.`etat_final` IS NOT NULL
  AND hf.`etat_final` != ''
  AND NOT EXISTS (
      SELECT 1 
      FROM `fiches_histo` fh 
      INNER JOIN `etats` e2 ON fh.`id_etat` = e2.`id`
      WHERE fh.`id_fiche` = hf.`id_fiche`
        AND (e2.`titre` = hf.`etat_final` OR e2.`abbreviation` = hf.`etat_final`)
        AND ABS(TIMESTAMPDIFF(SECOND, fh.`date_creation`, COALESCE(hf.`date_creation`, NOW()))) < 60
  );
*/

-- =====================================================
-- ÉTAPE 3 : Migration vers modifica (historique des modifications) - OPTIONNEL
-- =====================================================

-- Si yj_histo_fiche contient des informations sur les modifications utilisateur
INSERT INTO `modifica` (`id_fiche`, `id_user`, `type`, `ancien_valeur`, `nouvelle_valeur`, `date_modif_time`)
SELECT DISTINCT
    hf.`id_fiche` AS `id_fiche`,
    COALESCE(
        hf.`id_user`,
        hf.`id_agent`,
        hf.`modifier_par`,
        NULL
    ) AS `id_user`,
    'etat' AS `type`,
    NULL AS `ancien_valeur`,  -- L'ancienne valeur n'est pas disponible dans yj_histo_fiche
    CAST(COALESCE(
        hf.`etat_final`,
        hf.`id_etat`,
        (SELECT `id` FROM `etats` WHERE `titre` = hf.`etat_final` LIMIT 1)
    ) AS CHAR) AS `nouvelle_valeur`,
    COALESCE(
        hf.`date_modif_time`,
        hf.`date_heure_mod`,
        hf.`date_creation`,
        hf.`date_insertion`,
        NOW()
    ) AS `date_modif_time`
FROM `yj_histo_fiche` hf
INNER JOIN `fiches` f ON f.`id` = hf.`id_fiche`
WHERE hf.`etat_final` IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM `modifica` m 
      WHERE m.`id_fiche` = hf.`id_fiche`
        AND m.`type` = 'etat'
        AND ABS(TIMESTAMPDIFF(SECOND, m.`date_modif_time`, COALESCE(hf.`date_modif_time`, hf.`date_creation`, NOW()))) < 60
  );

-- =====================================================
-- ÉTAPE 4 : Vérification et statistiques
-- =====================================================

-- Compter les enregistrements dans yj_histo_fiche
SELECT 
    'yj_histo_fiche' AS `source`,
    COUNT(*) AS `total`
FROM `yj_histo_fiche`;

-- Compter les enregistrements migrés dans fiches_histo
SELECT 
    'fiches_histo' AS `destination`,
    COUNT(*) AS `total`,
    COUNT(DISTINCT `id_fiche`) AS `fiches_uniques`
FROM `fiches_histo`;

-- Vérifier quelques exemples de données migrées
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
INNER JOIN `fiches` f ON f.`id` = fh.`id_fiche`
LEFT JOIN `etats` e ON e.`id` = fh.`id_etat`
ORDER BY fh.`date_creation` DESC
LIMIT 20;

-- Vérifier les doublons potentiels
SELECT 
    `id_fiche`,
    `id_etat`,
    COUNT(*) AS `nombre_occurrences`,
    GROUP_CONCAT(`date_creation` ORDER BY `date_creation` SEPARATOR ', ') AS `dates`
FROM `fiches_histo`
GROUP BY `id_fiche`, `id_etat`
HAVING COUNT(*) > 1
LIMIT 20;

-- Réactiver les vérifications
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- GUIDE D'UTILISATION
-- =====================================================
--
-- 1. D'abord, voir la structure de yj_histo_fiche :
--    DESCRIBE `yj_histo_fiche`;
--
-- 2. Adapter les noms de colonnes dans les requêtes ci-dessus :
--    - Remplacer hf.`id_fiche` par le vrai nom de colonne (peut être hf.`id`)
--    - Remplacer hf.`etat_final` par le vrai nom de colonne
--    - Remplacer les noms de colonnes de dates
--
-- 3. Tester d'abord avec SELECT pour voir ce qui sera inséré :
--    Remplacer "INSERT INTO" par "SELECT" et voir les résultats
--
-- 4. Décommenter la VERSION 1 ou VERSION 2 selon le type de données dans etat_final
--
-- 5. Exécuter le script
--
-- 6. Vérifier les résultats avec les requêtes de l'ÉTAPE 4
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

