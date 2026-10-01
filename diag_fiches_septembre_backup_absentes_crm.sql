-- =====================================================
-- Diagnostic : fiches septembre 2026 dans `crm.backup`
-- absentes de `crm`.`fiches` (test par téléphone)
-- =====================================================
-- Affiche uniquement :
--   1) la quantité
--   2) 10 exemples
--
-- Source (backup) :
--   - archive = 0
--   - date_insert_time = septembre 2026
--   - tel non vide
--
-- Présence dans crm :
--   - test UNIQUEMENT par numéro de téléphone (tel)
--   - archive = 0
--   - PAS d'obligation de même date d'insertion
-- =====================================================

SET @annee_septembre = 2026;

-- ---------------------------------------------------------------------------
-- 1) Quantité : backup sept. 2026 (archive=0) dont le tel n'existe PAS dans crm
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_fiches_backup_septembre_absentes_de_crm_par_tel
FROM `crm.backup`.`fiches` b
WHERE IFNULL(b.`archive`, 0) = 0
  AND b.`date_insert_time` IS NOT NULL
  AND YEAR(b.`date_insert_time`) = @annee_septembre
  AND MONTH(b.`date_insert_time`) = 9
  AND TRIM(IFNULL(b.`tel`, '')) != ''
  AND NOT EXISTS (
    SELECT 1
    FROM `crm`.`fiches` c
    WHERE IFNULL(c.`archive`, 0) = 0
      AND TRIM(IFNULL(c.`tel`, '')) != ''
      AND TRIM(c.`tel`) = TRIM(b.`tel`)
  );

-- ---------------------------------------------------------------------------
-- 2) 10 exemples (absentes)
-- ---------------------------------------------------------------------------
SELECT
  b.`id`,
  b.`nom`,
  b.`prenom`,
  b.`tel`,
  b.`date_insert_time`,
  b.`id_etat_final`,
  b.`id_agent`,
  b.`id_commercial`
FROM `crm.backup`.`fiches` b
WHERE IFNULL(b.`archive`, 0) = 0
  AND b.`date_insert_time` IS NOT NULL
  AND YEAR(b.`date_insert_time`) = @annee_septembre
  AND MONTH(b.`date_insert_time`) = 9
  AND TRIM(IFNULL(b.`tel`, '')) != ''
  AND NOT EXISTS (
    SELECT 1
    FROM `crm`.`fiches` c
    WHERE IFNULL(c.`archive`, 0) = 0
      AND TRIM(IFNULL(c.`tel`, '')) != ''
      AND TRIM(c.`tel`) = TRIM(b.`tel`)
  )
ORDER BY b.`date_insert_time` DESC, b.`id` DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- 3) Contrôle inverse (trouver OU PAS) : 10 exemples TROUVÉS dans crm par tel
--     (même date non exigée)
-- ---------------------------------------------------------------------------
SELECT
  b.`id` AS id_backup,
  b.`tel`,
  b.`date_insert_time` AS date_insert_backup,
  c.`id` AS id_crm,
  c.`date_insert_time` AS date_insert_crm,
  c.`archive` AS archive_crm
FROM `crm.backup`.`fiches` b
INNER JOIN `crm`.`fiches` c
  ON TRIM(c.`tel`) = TRIM(b.`tel`)
 AND IFNULL(c.`archive`, 0) = 0
 AND TRIM(IFNULL(c.`tel`, '')) != ''
WHERE IFNULL(b.`archive`, 0) = 0
  AND b.`date_insert_time` IS NOT NULL
  AND YEAR(b.`date_insert_time`) = @annee_septembre
  AND MONTH(b.`date_insert_time`) = 9
  AND TRIM(IFNULL(b.`tel`, '')) != ''
ORDER BY b.`date_insert_time` DESC, b.`id` DESC
LIMIT 10;
