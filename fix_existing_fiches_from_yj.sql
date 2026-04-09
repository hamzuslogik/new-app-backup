-- =====================================================
-- Correction des fiches deja migrees depuis yj_fiche
-- Objectif: corriger mode_chauffage/conf_mode_chauffage en ID
-- Base de donnees: crm
-- =====================================================

USE `crm`;

-- 1) Alimenter mode_chauffage avec les libelles manquants de yj_fiche.conf_energie
--    (uniquement les valeurs texte non vides; les valeurs numeriques sont ignorees)
INSERT INTO `mode_chauffage` (`nom`)
SELECT DISTINCT TRIM(yj.`conf_energie`) AS nom
FROM `yj_fiche` yj
LEFT JOIN `mode_chauffage` mc
  ON REPLACE(REPLACE(TRIM(UPPER(mc.`nom`)), 'É', 'E'), 'È', 'E')
   = REPLACE(REPLACE(TRIM(UPPER(yj.`conf_energie`)), 'É', 'E'), 'È', 'E')
WHERE NULLIF(TRIM(yj.`conf_energie`), '') IS NOT NULL
  AND TRIM(yj.`conf_energie`) NOT REGEXP '^[0-9]+$'
  AND mc.`id` IS NULL;

-- 2) Corriger fiches.mode_chauffage depuis yj_fiche.conf_energie
--    - si conf_energie est numerique -> utiliser cette valeur comme ID
--    - sinon -> chercher l'ID dans mode_chauffage.nom
UPDATE `fiches` f
JOIN `yj_fiche` yj ON yj.`id` = f.`id`
LEFT JOIN `mode_chauffage` mc
  ON REPLACE(REPLACE(TRIM(UPPER(mc.`nom`)), 'É', 'E'), 'È', 'E')
   = REPLACE(REPLACE(TRIM(UPPER(yj.`conf_energie`)), 'É', 'E'), 'È', 'E')
SET f.`mode_chauffage` = CASE
  WHEN NULLIF(TRIM(yj.`conf_energie`), '') IS NULL THEN NULL
  WHEN TRIM(yj.`conf_energie`) REGEXP '^[0-9]+$' THEN CAST(TRIM(yj.`conf_energie`) AS UNSIGNED)
  WHEN mc.`id` IS NOT NULL THEN mc.`id`
  ELSE f.`mode_chauffage`
END
WHERE yj.`id` IS NOT NULL;

-- 3) Corriger fiches.conf_mode_chauffage (si la colonne existe)
SET @has_conf_mode_chauffage := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fiches'
    AND COLUMN_NAME = 'conf_mode_chauffage'
);

SET @sql_fix_conf_mode := IF(
  @has_conf_mode_chauffage > 0,
  'UPDATE `fiches` f
   JOIN `yj_fiche` yj ON yj.`id` = f.`id`
   LEFT JOIN `mode_chauffage` mc
     ON REPLACE(REPLACE(TRIM(UPPER(mc.`nom`)), ''É'', ''E''), ''È'', ''E'')
      = REPLACE(REPLACE(TRIM(UPPER(yj.`conf_energie`)), ''É'', ''E''), ''È'', ''E'')
   SET f.`conf_mode_chauffage` = CASE
     WHEN NULLIF(TRIM(yj.`conf_energie`), '''') IS NULL THEN NULL
     WHEN TRIM(yj.`conf_energie`) REGEXP ''^[0-9]+$'' THEN CAST(TRIM(yj.`conf_energie`) AS UNSIGNED)
     WHEN mc.`id` IS NOT NULL THEN mc.`id`
     ELSE f.`conf_mode_chauffage`
   END
   WHERE yj.`id` IS NOT NULL',
  'SELECT ''Colonne conf_mode_chauffage absente: etape ignoree'' AS info'
);

PREPARE stmt_fix_conf_mode FROM @sql_fix_conf_mode;
EXECUTE stmt_fix_conf_mode;
DEALLOCATE PREPARE stmt_fix_conf_mode;

-- 4) Controle rapide
SELECT
  'Fiches avec mode_chauffage non numerique (apres correction)' AS info,
  COUNT(*) AS total
FROM `fiches`
WHERE NULLIF(TRIM(`mode_chauffage`), '') IS NOT NULL
  AND TRIM(`mode_chauffage`) NOT REGEXP '^[0-9]+$';

