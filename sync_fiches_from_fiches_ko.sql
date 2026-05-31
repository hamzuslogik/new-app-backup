-- =====================================================
-- Synchroniser la table fiches depuis fiches_ko
-- Pour chaque fiche présente dans fiches_ko :
--   - ko = 1
--   - id_agent = agent de la dernière ligne fiches_ko
--   - date_appel_time = date_ko de la dernière ligne (si renseignée)
--   - id_etat_final = id_etat_final_apres de la dernière ligne (si renseigné)
-- Base : crm
-- =====================================================

USE `crm`;

-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Diagnostic avant mise à jour
-- ---------------------------------------------------------------------
SELECT '--- Fiches avec ligne fiches_ko ---' AS etape;
SELECT COUNT(DISTINCT fk.`id_fiche`) AS nb_fiches_ko_distinctes
FROM `fiches_ko` fk;

SELECT '--- Fiches à corriger (ko ≠ 1 ou agent / date incohérents) ---' AS etape;
SELECT COUNT(*) AS nb_fiches_a_mettre_a_jour
FROM `fiches` f
INNER JOIN (
  SELECT
    fk.`id_fiche`,
    fk.`id_agent`,
    fk.`date_ko`,
    fk.`id_etat_final_apres`
  FROM `fiches_ko` fk
  INNER JOIN (
    SELECT `id_fiche`, MAX(`id`) AS max_id
    FROM `fiches_ko`
    GROUP BY `id_fiche`
  ) latest ON latest.max_id = fk.`id`
) src ON src.`id_fiche` = f.`id`
WHERE COALESCE(f.`ko`, 0) <> 1
   OR (src.`id_agent` IS NOT NULL AND src.`id_agent` <> COALESCE(f.`id_agent`, 0))
   OR (src.`date_ko` IS NOT NULL AND (
        f.`date_appel_time` IS NULL
        OR DATE(f.`date_appel_time`) <> DATE(src.`date_ko`)
      ))
   OR (src.`id_etat_final_apres` IS NOT NULL AND src.`id_etat_final_apres` <> COALESCE(f.`id_etat_final`, 0));

SELECT '--- Aperçu (20 premières lignes) ---' AS etape;
SELECT
  f.`id` AS fiche_id,
  f.`ko` AS ko_actuel,
  1 AS ko_cible,
  f.`id_agent` AS id_agent_actuel,
  src.`id_agent` AS id_agent_cible,
  f.`date_appel_time` AS date_appel_actuelle,
  src.`date_ko` AS date_ko_cible,
  f.`id_etat_final` AS etat_actuel,
  src.`id_etat_final_apres` AS etat_cible,
  src.`source` AS source_ko
FROM `fiches` f
INNER JOIN (
  SELECT
    fk.`id_fiche`,
    fk.`id_agent`,
    fk.`date_ko`,
    fk.`id_etat_final_apres`,
    fk.`source`
  FROM `fiches_ko` fk
  INNER JOIN (
    SELECT `id_fiche`, MAX(`id`) AS max_id
    FROM `fiches_ko`
    GROUP BY `id_fiche`
  ) latest ON latest.max_id = fk.`id`
) src ON src.`id_fiche` = f.`id`
ORDER BY f.`id` ASC
LIMIT 20;

-- ---------------------------------------------------------------------
-- ÉTAPE 2 — Mise à jour fiches (dernière ligne fiches_ko par id_fiche)
-- ---------------------------------------------------------------------
UPDATE `fiches` f
INNER JOIN (
  SELECT
    fk.`id_fiche`,
    fk.`id_agent`,
    fk.`date_ko`,
    fk.`id_etat_final_apres`
  FROM `fiches_ko` fk
  INNER JOIN (
    SELECT `id_fiche`, MAX(`id`) AS max_id
    FROM `fiches_ko`
    GROUP BY `id_fiche`
  ) latest ON latest.max_id = fk.`id`
) src ON src.`id_fiche` = f.`id`
SET
  f.`ko` = 1,
  f.`id_agent` = COALESCE(src.`id_agent`, f.`id_agent`),
  f.`date_appel_time` = COALESCE(src.`date_ko`, f.`date_appel_time`),
  f.`id_etat_final` = COALESCE(src.`id_etat_final_apres`, f.`id_etat_final`),
  f.`date_modif_time` = NOW()
WHERE COALESCE(f.`ko`, 0) <> 1
   OR (src.`id_agent` IS NOT NULL AND src.`id_agent` <> COALESCE(f.`id_agent`, 0))
   OR (src.`date_ko` IS NOT NULL AND (
        f.`date_appel_time` IS NULL
        OR DATE(f.`date_appel_time`) <> DATE(src.`date_ko`)
      ))
   OR (src.`id_etat_final_apres` IS NOT NULL AND src.`id_etat_final_apres` <> COALESCE(f.`id_etat_final`, 0));

SELECT CONCAT('Fiches mises à jour : ', ROW_COUNT()) AS message;

-- ---------------------------------------------------------------------
-- ÉTAPE 3 — Contrôle après mise à jour
-- ---------------------------------------------------------------------
SELECT '--- Fiches KO sans ligne fiches_ko (anomalie inverse) ---' AS etape;
SELECT COUNT(*) AS nb_fiches_ko_sans_historique
FROM `fiches` f
WHERE COALESCE(f.`ko`, 0) = 1
  AND NOT EXISTS (
    SELECT 1 FROM `fiches_ko` fk WHERE fk.`id_fiche` = f.`id`
  );

SELECT '--- Fiches fiches_ko avec ko ≠ 1 (anomalie restante) ---' AS etape;
SELECT COUNT(*) AS nb_fiches_ko_non_synchronisees
FROM `fiches` f
INNER JOIN `fiches_ko` fk ON fk.`id_fiche` = f.`id`
WHERE COALESCE(f.`ko`, 0) <> 1;

SELECT 'Synchronisation fiches ← fiches_ko terminée.' AS message;
