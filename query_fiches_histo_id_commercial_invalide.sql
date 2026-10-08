-- =====================================================
-- Diagnostic : fiches_histo.id_commercial sans commercial valide
-- =====================================================
-- Un commercial valide = ligne dans utilisateurs avec :
--   - u.id = fh.id_commercial
--   - u.fonction = 5
--
-- Cas détectés :
--   A) id_commercial renseigné mais aucun utilisateur
--   B) utilisateur existant mais fonction ≠ 5 (pas commercial)
-- =====================================================

USE `crm`;

SET @FONCTION_COMMERCIAL = 5;

-- -----------------------------------------------------
-- 1) Compteurs globaux
-- -----------------------------------------------------
SELECT '=== COMPTEURS ===' AS info;

SELECT
  COUNT(*) AS nb_lignes_histo_avec_id_commercial,
  SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) AS nb_utilisateur_inexistant,
  SUM(CASE WHEN u.id IS NOT NULL AND IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL THEN 1 ELSE 0 END) AS nb_pas_fonction_commercial,
  SUM(CASE WHEN u.id IS NOT NULL AND u.fonction = @FONCTION_COMMERCIAL THEN 1 ELSE 0 END) AS nb_ok_commercial
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial`
WHERE fh.`id_commercial` IS NOT NULL
  AND fh.`id_commercial` > 0;

SELECT COUNT(DISTINCT fh.`id_commercial`) AS nb_id_commercial_distincts_invalides
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial`
WHERE fh.`id_commercial` IS NOT NULL
  AND fh.`id_commercial` > 0
  AND (
    u.id IS NULL
    OR IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL
  );

-- -----------------------------------------------------
-- 2) Liste des id_commercial invalides (agrégé)
-- -----------------------------------------------------
SELECT '=== ID_COMMERCIAL INVALIDES (agrégé) ===' AS info;

SELECT
  fh.`id_commercial`,
  CASE
    WHEN u.id IS NULL THEN 'UTILISATEUR INEXISTANT'
    ELSE CONCAT('PAS COMMERCIAL (fonction=', IFNULL(u.fonction, 'NULL'), ')')
  END AS anomalie,
  u.`login`,
  u.`pseudo`,
  u.`nom`,
  u.`fonction` AS id_fonction,
  f.`titre` AS fonction_titre,
  u.`etat`,
  COUNT(*) AS nb_lignes_histo,
  COUNT(DISTINCT fh.`id_fiche`) AS nb_fiches,
  MIN(fh.`date_creation`) AS date_histo_min,
  MAX(fh.`date_creation`) AS date_histo_max
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial`
LEFT JOIN `fonctions` f ON f.`id` = u.`fonction`
WHERE fh.`id_commercial` IS NOT NULL
  AND fh.`id_commercial` > 0
  AND (
    u.id IS NULL
    OR IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL
  )
GROUP BY
  fh.`id_commercial`,
  u.id,
  u.`login`,
  u.`pseudo`,
  u.`nom`,
  u.`fonction`,
  f.`titre`,
  u.`etat`
ORDER BY nb_lignes_histo DESC, fh.`id_commercial`;

-- -----------------------------------------------------
-- 3) Détail des lignes fiches_histo concernées (échantillon)
-- -----------------------------------------------------
SELECT '=== DÉTAIL LIGNES (max 200) ===' AS info;

SELECT
  fh.`id` AS fh_id,
  fh.`id_fiche`,
  fh.`id_etat`,
  e.`titre` AS etat_titre,
  fh.`date_creation`,
  fh.`id_commercial`,
  CASE
    WHEN u.id IS NULL THEN 'UTILISATEUR INEXISTANT'
    ELSE CONCAT('PAS COMMERCIAL (fonction=', IFNULL(u.fonction, 'NULL'), ')')
  END AS anomalie,
  u.`login`,
  u.`pseudo`,
  u.`fonction` AS id_fonction
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial`
LEFT JOIN `etats` e ON e.`id` = fh.`id_etat`
WHERE fh.`id_commercial` IS NOT NULL
  AND fh.`id_commercial` > 0
  AND (
    u.id IS NULL
    OR IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL
  )
ORDER BY fh.`id` DESC
LIMIT 200;

-- -----------------------------------------------------
-- 4) Variante : aussi id_commercial_2 / id_commercial_cr (optionnel)
-- -----------------------------------------------------
SELECT '=== id_commercial_2 invalides (si colonne présente) ===' AS info;

SELECT
  fh.`id_commercial_2` AS id_commercial,
  CASE
    WHEN u.id IS NULL THEN 'UTILISATEUR INEXISTANT'
    ELSE CONCAT('PAS COMMERCIAL (fonction=', IFNULL(u.fonction, 'NULL'), ')')
  END AS anomalie,
  COUNT(*) AS nb_lignes_histo
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial_2`
WHERE fh.`id_commercial_2` IS NOT NULL
  AND fh.`id_commercial_2` > 0
  AND (
    u.id IS NULL
    OR IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL
  )
GROUP BY fh.`id_commercial_2`, u.id, u.`fonction`
ORDER BY nb_lignes_histo DESC;

SELECT '=== id_commercial_cr invalides (si colonne présente) ===' AS info;

SELECT
  fh.`id_commercial_cr` AS id_commercial,
  CASE
    WHEN u.id IS NULL THEN 'UTILISATEUR INEXISTANT'
    ELSE CONCAT('PAS COMMERCIAL (fonction=', IFNULL(u.fonction, 0), ')')
  END AS anomalie,
  COUNT(*) AS nb_lignes_histo
FROM `fiches_histo` fh
LEFT JOIN `utilisateurs` u ON u.`id` = fh.`id_commercial_cr`
WHERE fh.`id_commercial_cr` IS NOT NULL
  AND fh.`id_commercial_cr` > 0
  AND (
    u.id IS NULL
    OR IFNULL(u.fonction, 0) != @FONCTION_COMMERCIAL
  )
GROUP BY fh.`id_commercial_cr`, u.id, u.`fonction`
ORDER BY nb_lignes_histo DESC;
