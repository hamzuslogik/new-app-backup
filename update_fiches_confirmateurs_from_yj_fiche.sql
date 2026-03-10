-- =====================================================
-- Script : corriger id_confirmateur, id_confirmateur_2, id_confirmateur_3 dans fiches
-- Base de données: crm
-- =====================================================
--
-- Met à jour les lignes existantes de fiches en appliquant la même règle
-- que insert_fiches_from_yj.sql, à partir de yj_fiche :
--   - Si nom_confirmateur = nom_confirmateur_2 = nom_confirmateur_3 → uniquement id_confirmateur
--   - Si 2 valeurs distinctes → id_confirmateur + id_confirmateur_2
--   - Si 3 valeurs distinctes → id_confirmateur + id_confirmateur_2 + id_confirmateur_3
--
-- Prérequis : tables fiches, yj_fiche, utilisateurs.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- MISE À JOUR DES CONFIRMATEURS DANS FICHES
-- =====================================================

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
  END;

-- =====================================================
-- VÉRIFICATION (optionnel)
-- =====================================================

SELECT
  (SELECT COUNT(*) FROM `fiches` f INNER JOIN `yj_fiche` yj ON f.id = yj.id) AS lignes_jointes,
  (SELECT COUNT(*) FROM `fiches`) AS total_fiches;

SELECT 'Correction id_confirmateur / id_confirmateur_2 / id_confirmateur_3 appliquée depuis yj_fiche.' AS message;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
