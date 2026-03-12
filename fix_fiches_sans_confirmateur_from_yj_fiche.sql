-- =====================================================
-- Script : vérifier les fiches sans id_confirmateur,
--          chercher leur confirmateur dans yj_fiche
--          et affecter aux utilisateurs (fiches + fiches_histo)
-- Base de données: crm
-- =====================================================
--
-- PARTIE 1 — FICHES
-- 1) Rapport des fiches sans confirmateur ayant une source dans yj_fiche
-- 2) Mise à jour des fiches (id_confirmateur, id_confirmateur_2, id_confirmateur_3)
--    à partir de yj_fiche (nom_confirmateur -> utilisateurs.pseudo, ou yj_fiche.id_confirmateur)
--
-- PARTIE 2 — FICHES_HISTO
-- 6) Rapport des lignes fiches_histo sans confirmateur avec source dans yj_fiche
-- 7) Mise à jour des lignes fiches_histo (même logique, yj_fiche.id = fiches_histo.id_fiche)
--
-- Prérequis : tables fiches, fiches_histo, yj_fiche, utilisateurs.
-- Lien fiches / yj_fiche : même id (f.id = yj.id).
-- Lien fiches_histo / yj_fiche : fiches_histo.id_fiche = yj_fiche.id.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1 — FICHES SANS CONFIRMATEUR (critère large)
-- =====================================================
-- Fiches où id_confirmateur est NULL ou 0 (aucun confirmateur affecté)

SELECT '--- Fiches sans id_confirmateur (total) ---' AS etape;
SELECT COUNT(*) AS nb_fiches_sans_confirmateur
FROM `fiches` f
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0);


-- =====================================================
-- ÉTAPE 2 — FICHES SANS CONFIRMATEUR MAIS AVEC SOURCE DANS yj_fiche
-- =====================================================
-- Ces fiches pourront être mises à jour si le nom dans yj_fiche existe dans utilisateurs

SELECT '--- Fiches sans confirmateur ayant au moins un confirmateur dans yj_fiche ---' AS etape;
SELECT
  f.`id`           AS fiche_id,
  f.`nom`,
  f.`prenom`,
  f.`tel`,
  yj.`nom_confirmateur`   AS yj_nom_confirmateur,
  yj.`nom_confirmateur_2` AS yj_nom_confirmateur_2,
  yj.`nom_confirmateur_3` AS yj_nom_confirmateur_3,
  yj.`id_confirmateur`   AS yj_id_confirmateur,
  (SELECT `id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur`)) LIMIT 1) AS id_utilisateur_c1,
  (SELECT `id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_2`)) LIMIT 1) AS id_utilisateur_c2,
  (SELECT `id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`)) LIMIT 1) AS id_utilisateur_c3
FROM `fiches` f
INNER JOIN `yj_fiche` yj ON yj.`id` = f.`id`
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND (
    NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
    OR (yj.`id_confirmateur` IS NOT NULL AND yj.`id_confirmateur` > 0)
  )
ORDER BY f.`id`
LIMIT 500;


-- =====================================================
-- ÉTAPE 3 — NOMS CONFIRMATEURS DANS yj_fiche SANS UTILISATEUR
-- =====================================================
-- Si des fiches à corriger référencent un pseudo inexistant dans utilisateurs,
-- la mise à jour laissera NULL pour ce confirmateur.

SELECT '--- Noms confirmateurs (yj_fiche) sans correspondance dans utilisateurs ---' AS etape;
SELECT DISTINCT TRIM(yj.`nom_confirmateur`) AS nom_confirmateur
FROM `fiches` f
INNER JOIN `yj_fiche` yj ON yj.`id` = f.`id`
LEFT JOIN `utilisateurs` u ON TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur`))
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
  AND u.`id` IS NULL
UNION
SELECT DISTINCT TRIM(yj.`nom_confirmateur_2`)
FROM `fiches` f
INNER JOIN `yj_fiche` yj ON yj.`id` = f.`id`
LEFT JOIN `utilisateurs` u ON TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_2`))
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
  AND u.`id` IS NULL
UNION
SELECT DISTINCT TRIM(yj.`nom_confirmateur_3`)
FROM `fiches` f
INNER JOIN `yj_fiche` yj ON yj.`id` = f.`id`
LEFT JOIN `utilisateurs` u ON TRIM(UPPER(u.`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`))
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
  AND u.`id` IS NULL;


-- =====================================================
-- ÉTAPE 4 — MISE À JOUR : affecter confirmateurs depuis yj_fiche
-- =====================================================
-- Même règle que update_fiches_confirmateurs_from_yj_fiche.sql :
--   - 1 seul nom (ou 3 identiques) → id_confirmateur uniquement
--   - 2 noms distincts → id_confirmateur + id_confirmateur_2
--   - 3 noms distincts → id_confirmateur + id_confirmateur_2 + id_confirmateur_3
-- Ciblage : uniquement les fiches sans confirmateur (id_confirmateur IS NULL ou 0)
--           et ayant au moins une source dans yj_fiche.

UPDATE `fiches` f
INNER JOIN `yj_fiche` yj ON f.`id` = yj.`id`
SET
  f.`id_confirmateur` = COALESCE(
    CASE WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur`)) LIMIT 1)
    ELSE NULL END,
    CASE WHEN yj.`id_confirmateur` > 0 THEN yj.`id_confirmateur` ELSE NULL END
  ),
  f.`id_confirmateur_2` = CASE
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) = UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN NULL
    WHEN NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND UPPER(TRIM(yj.`nom_confirmateur_2`)) != UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, '')))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_2`)) LIMIT 1)
    WHEN NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL AND UPPER(TRIM(yj.`nom_confirmateur_3`)) != UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, '')))
     AND (NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NULL OR UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, ''))))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END,
  f.`id_confirmateur_3` = CASE
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) = UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN NULL
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) != UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) != UPPER(TRIM(yj.`nom_confirmateur_3`))
     AND UPPER(TRIM(yj.`nom_confirmateur`)) != UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND (
    NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
    OR (yj.`id_confirmateur` IS NOT NULL AND yj.`id_confirmateur` > 0)
  );


-- =====================================================
-- ÉTAPE 5 — VÉRIFICATION APRÈS MISE À JOUR
-- =====================================================

SELECT '--- Après mise à jour : fiches encore sans confirmateur ---' AS etape;
SELECT COUNT(*) AS nb_fiches_sans_confirmateur_restantes
FROM `fiches` f
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0);

SELECT '--- Fiches sans confirmateur restantes (avec yj_fiche) : pas de correspondance utilisateur ---' AS etape;
SELECT
  f.`id`,
  f.`nom`,
  f.`prenom`,
  f.`tel`,
  yj.`nom_confirmateur`,
  yj.`nom_confirmateur_2`,
  yj.`nom_confirmateur_3`
FROM `fiches` f
INNER JOIN `yj_fiche` yj ON yj.`id` = f.`id`
WHERE (f.`id_confirmateur` IS NULL OR f.`id_confirmateur` = 0)
  AND (
    NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
  )
ORDER BY f.`id`
LIMIT 200;


SELECT 'Script terminé : fiches sans confirmateur mises à jour depuis yj_fiche (affectation aux utilisateurs).' AS message;

-- =====================================================
-- PARTIE 2 — FIX FICHES_HISTO (lignes sans id_confirmateur)
-- =====================================================
-- Pour chaque ligne de fiches_histo sans confirmateur, on récupère le confirmateur
-- depuis yj_fiche (yj_fiche.id = fiches_histo.id_fiche) et on affecte aux utilisateurs.

-- =====================================================
-- ÉTAPE 6 — FICHES_HISTO SANS CONFIRMATEUR
-- =====================================================

SELECT '--- Lignes fiches_histo sans id_confirmateur (total) ---' AS etape;
SELECT COUNT(*) AS nb_histo_sans_confirmateur
FROM `fiches_histo` h
WHERE (h.`id_confirmateur` IS NULL OR h.`id_confirmateur` = 0);


-- =====================================================
-- ÉTAPE 7 — FICHES_HISTO SANS CONFIRMATEUR AVEC SOURCE DANS yj_fiche
-- =====================================================

SELECT '--- Lignes fiches_histo sans confirmateur ayant une source dans yj_fiche (échantillon) ---' AS etape;
SELECT
  h.`id`           AS histo_id,
  h.`id_fiche`,
  h.`id_etat`,
  h.`date_creation`,
  yj.`nom_confirmateur`   AS yj_nom_confirmateur,
  yj.`nom_confirmateur_2` AS yj_nom_confirmateur_2,
  yj.`nom_confirmateur_3` AS yj_nom_confirmateur_3
FROM `fiches_histo` h
INNER JOIN `yj_fiche` yj ON yj.`id` = h.`id_fiche`
WHERE (h.`id_confirmateur` IS NULL OR h.`id_confirmateur` = 0)
  AND (
    NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
    OR (yj.`id_confirmateur` IS NOT NULL AND yj.`id_confirmateur` > 0)
  )
ORDER BY h.`id`
LIMIT 500;


-- =====================================================
-- ÉTAPE 8 — MISE À JOUR FICHES_HISTO : affecter confirmateurs depuis yj_fiche
-- =====================================================
-- Même règle que pour fiches (1 nom → id_confirmateur ; 2 noms distincts → id_confirmateur + id_confirmateur_2 ; 3 distincts → les 3).
-- Lien : yj_fiche.id = fiches_histo.id_fiche.

UPDATE `fiches_histo` h
INNER JOIN `yj_fiche` yj ON yj.`id` = h.`id_fiche`
SET
  h.`id_confirmateur` = COALESCE(
    CASE WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur`)) LIMIT 1)
    ELSE NULL END,
    CASE WHEN yj.`id_confirmateur` > 0 THEN yj.`id_confirmateur` ELSE NULL END
  ),
  h.`id_confirmateur_2` = CASE
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) = UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN NULL
    WHEN NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND UPPER(TRIM(yj.`nom_confirmateur_2`)) != UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, '')))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_2`)) LIMIT 1)
    WHEN NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL AND UPPER(TRIM(yj.`nom_confirmateur_3`)) != UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, '')))
     AND (NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NULL OR UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(IFNULL(yj.`nom_confirmateur`, ''))))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END,
  h.`id_confirmateur_3` = CASE
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) = UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) = UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN NULL
    WHEN NULLIF(TRIM(yj.`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(yj.`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(yj.`nom_confirmateur`)) != UPPER(TRIM(yj.`nom_confirmateur_2`))
     AND UPPER(TRIM(yj.`nom_confirmateur_2`)) != UPPER(TRIM(yj.`nom_confirmateur_3`))
     AND UPPER(TRIM(yj.`nom_confirmateur`)) != UPPER(TRIM(yj.`nom_confirmateur_3`))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(yj.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END
WHERE (h.`id_confirmateur` IS NULL OR h.`id_confirmateur` = 0)
  AND (
    NULLIF(TRIM(COALESCE(yj.`nom_confirmateur`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_2`, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(yj.`nom_confirmateur_3`, '')), '') IS NOT NULL
    OR (yj.`id_confirmateur` IS NOT NULL AND yj.`id_confirmateur` > 0)
  );


-- =====================================================
-- ÉTAPE 9 — VÉRIFICATION APRÈS MISE À JOUR FICHES_HISTO
-- =====================================================

SELECT '--- Après mise à jour : lignes fiches_histo encore sans confirmateur ---' AS etape;
SELECT COUNT(*) AS nb_histo_sans_confirmateur_restantes
FROM `fiches_histo` h
WHERE (h.`id_confirmateur` IS NULL OR h.`id_confirmateur` = 0);


SELECT 'Script terminé : fiches et fiches_histo sans confirmateur mis à jour depuis yj_fiche.' AS message;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
