-- =====================================================
-- Diagnostic : fiches septembre présentes dans `crm.backup`
-- mais absentes de `crm`.`fiches`
-- =====================================================
-- Affiche uniquement :
--   1) la quantité
--   2) 10 exemples
--
-- Critère d'insertion septembre : DATE(date_insert_time) dans le mois
-- (année réglable via @annee_septembre).
-- Correspondance : même id.
-- =====================================================

-- Année du mois de septembre à analyser (ex. 2025 ou 2026)
SET @annee_septembre = 2025;

-- ---------------------------------------------------------------------------
-- 1) Quantité
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_fiches_backup_septembre_absentes_de_crm
FROM `crm.backup`.`fiches` b
WHERE b.`date_insert_time` IS NOT NULL
  AND YEAR(b.`date_insert_time`) = @annee_septembre
  AND MONTH(b.`date_insert_time`) = 9
  AND NOT EXISTS (
    SELECT 1
    FROM `crm`.`fiches` c
    WHERE c.`id` = b.`id`
  );

-- ---------------------------------------------------------------------------
-- 2) 10 exemples
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
WHERE b.`date_insert_time` IS NOT NULL
  AND YEAR(b.`date_insert_time`) = @annee_septembre
  AND MONTH(b.`date_insert_time`) = 9
  AND NOT EXISTS (
    SELECT 1
    FROM `crm`.`fiches` c
    WHERE c.`id` = b.`id`
  )
ORDER BY b.`date_insert_time` DESC, b.`id` DESC
LIMIT 10;
