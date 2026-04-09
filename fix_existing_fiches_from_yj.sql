-- =====================================================
-- Correction des fiches déjà migrées depuis yj_fiche
-- mode_chauffage / conf_mode_chauffage : libellés texte depuis yj_fiche.conf_energie
-- Exécuter après migrate_mode_chauffage_to_text.sql si les colonnes étaient en id
-- Base : crm
-- =====================================================

USE `crm`;

-- Référence : nouveaux libellés issus de yj_fiche
INSERT INTO `mode_chauffage` (`nom`)
SELECT DISTINCT TRIM(yj.`conf_energie`) AS `nom`
FROM `yj_fiche` yj
LEFT JOIN `mode_chauffage` mc
  ON REPLACE(REPLACE(TRIM(UPPER(mc.`nom`)), 'É', 'E'), 'È', 'E')
   = REPLACE(REPLACE(TRIM(UPPER(yj.`conf_energie`)), 'É', 'E'), 'È', 'E')
WHERE NULLIF(TRIM(yj.`conf_energie`), '') IS NOT NULL
  AND TRIM(yj.`conf_energie`) NOT REGEXP '^[0-9]+$'
  AND mc.`id` IS NULL;

-- Libellé cible depuis conf_energie (texte ou id -> nom)
UPDATE `fiches` f
JOIN `yj_fiche` yj ON yj.`id` = f.`id`
LEFT JOIN `mode_chauffage` mc
  ON TRIM(yj.`conf_energie`) REGEXP '^[0-9]+$'
  AND mc.`id` = CAST(TRIM(yj.`conf_energie`) AS UNSIGNED)
SET f.`mode_chauffage` = CASE
    WHEN NULLIF(TRIM(yj.`conf_energie`), '') IS NULL THEN f.`mode_chauffage`
    WHEN TRIM(yj.`conf_energie`) REGEXP '^[0-9]+$' THEN COALESCE(mc.`nom`, f.`mode_chauffage`)
    ELSE NULLIF(TRIM(yj.`conf_energie`), '')
  END,
  f.`conf_mode_chauffage` = CASE
    WHEN NULLIF(TRIM(yj.`conf_energie`), '') IS NULL THEN f.`conf_mode_chauffage`
    WHEN TRIM(yj.`conf_energie`) REGEXP '^[0-9]+$' THEN COALESCE(mc.`nom`, f.`conf_mode_chauffage`)
    ELSE NULLIF(TRIM(yj.`conf_energie`), '')
  END
WHERE yj.`id` IS NOT NULL;
