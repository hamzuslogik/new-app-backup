-- =====================================================
-- Insérer les sous-états distincts depuis yj_fiche / yj_fiches
-- =====================================================
-- Objectif:
-- 1) Lire les sous_etat distincts de la source legacy
-- 2) Retrouver l'id_etat cible via etat_final
-- 3) Insérer dans sous_etat sans doublons
--
-- Notes:
-- - Le script fonctionne avec la table yj_fiche (présente dans ce repo).
-- - Si vous avez une table/vue yj_fiches, adaptez simplement la source.
-- - Comparaison insensible à la casse (et généralement aux accents via collation).

USE `crm`;

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT DISTINCT
  e.id AS id_etat,
  TRIM(yf.sous_etat) AS titre
FROM `yj_fiche` yf
INNER JOIN `etats` e
  ON TRIM(yf.etat_final) COLLATE utf8mb4_unicode_ci = TRIM(e.titre) COLLATE utf8mb4_unicode_ci
LEFT JOIN `sous_etat` se
  ON se.id_etat = e.id
 AND TRIM(se.titre) COLLATE utf8mb4_unicode_ci = TRIM(yf.sous_etat) COLLATE utf8mb4_unicode_ci
WHERE yf.sous_etat IS NOT NULL
  AND TRIM(yf.sous_etat) <> ''
  AND yf.etat_final IS NOT NULL
  AND TRIM(yf.etat_final) <> ''
  AND se.id IS NULL;

-- Diagnostic optionnel: lignes non mappées (etat_final introuvable dans etats)
-- SELECT DISTINCT TRIM(yf.etat_final) AS etat_final_non_mappe
-- FROM yj_fiche yf
-- LEFT JOIN etats e
--   ON TRIM(yf.etat_final) COLLATE utf8mb4_unicode_ci = TRIM(e.titre) COLLATE utf8mb4_unicode_ci
-- WHERE yf.etat_final IS NOT NULL
--   AND TRIM(yf.etat_final) <> ''
--   AND e.id IS NULL
-- ORDER BY etat_final_non_mappe;

