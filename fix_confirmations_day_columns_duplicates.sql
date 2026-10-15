-- =====================================================
-- confirmations : sync confirmation_day / date_confirmation_date
-- et suppression des doublons croisés
-- =====================================================
-- Symptôme observé :
--   ligne A : confirmation_day = DATE, date_confirmation_date = 0000-00-00
--   ligne B : confirmation_day = 0000-00-00, date_confirmation_date = DATE
-- (même id_fiche, même jour logique de CONFIRMATION)
--
-- SÉCURITÉ anti-fausse suppression :
--   Le jour logique pour DELETE ne repose QUE sur :
--     confirmation_day | date_confirmation_date | DATE(date_confirmation)
--   JAMAIS sur date_rdv_time / date_creation seuls
--   (sinon 2 confirms uniques différents jours, même date RDV → 1 ligne effacée à tort).
--
-- IMPORTANT : dédoublonner AVANT de synchroniser les colonnes,
-- sinon UPDATE confirmation_day viole uk_fiche_confirmation_day.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Jour logique de CONFIRMATION uniquement (pas RDV / création)
-- COALESCE(
--   NULLIF(confirmation_day, '0000-00-00'),
--   NULLIF(date_confirmation_date, '0000-00-00'),
--   DATE(NULLIF(NULLIF(date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
-- )

-- -----------------------------------------------------
-- 0) APERÇU (ne supprime rien) : lignes qui seraient
--    considérées comme doublons (id plus ancien = à supprimer)
-- -----------------------------------------------------
SELECT
  c_old.id AS id_a_supprimer,
  c_keep.id AS id_conserve,
  c_old.id_fiche,
  COALESCE(
    NULLIF(c_old.confirmation_day, '0000-00-00'),
    NULLIF(c_old.date_confirmation_date, '0000-00-00'),
    DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
  ) AS jour_logique,
  c_old.confirmation_day AS old_confirmation_day,
  c_old.date_confirmation_date AS old_date_confirmation_date,
  c_old.date_confirmation AS old_date_confirmation,
  c_keep.confirmation_day AS keep_confirmation_day,
  c_keep.date_confirmation_date AS keep_date_confirmation_date,
  c_keep.date_confirmation AS keep_date_confirmation
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.id < c_keep.id
 AND COALESCE(
       NULLIF(c_old.confirmation_day, '0000-00-00'),
       NULLIF(c_old.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     ) = COALESCE(
       NULLIF(c_keep.confirmation_day, '0000-00-00'),
       NULLIF(c_keep.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_keep.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     )
WHERE COALESCE(
        NULLIF(c_old.confirmation_day, '0000-00-00'),
        NULLIF(c_old.date_confirmation_date, '0000-00-00'),
        DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
      ) IS NOT NULL
ORDER BY c_old.id_fiche, jour_logique, c_old.id;

SELECT COUNT(*) AS nb_lignes_qui_seraient_supprimees
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.id < c_keep.id
 AND COALESCE(
       NULLIF(c_old.confirmation_day, '0000-00-00'),
       NULLIF(c_old.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     ) = COALESCE(
       NULLIF(c_keep.confirmation_day, '0000-00-00'),
       NULLIF(c_keep.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_keep.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     )
WHERE COALESCE(
        NULLIF(c_old.confirmation_day, '0000-00-00'),
        NULLIF(c_old.date_confirmation_date, '0000-00-00'),
        DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
      ) IS NOT NULL;

-- -----------------------------------------------------
-- 1) Supprimer les doublons croisés (même id_fiche + même jour
--    de CONFIRMATION). Garde l'id le plus récent.
--    Ne touche PAS aux confirms uniques (jours différents).
-- -----------------------------------------------------
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.id < c_keep.id
 AND COALESCE(
       NULLIF(c_old.confirmation_day, '0000-00-00'),
       NULLIF(c_old.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     ) = COALESCE(
       NULLIF(c_keep.confirmation_day, '0000-00-00'),
       NULLIF(c_keep.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_keep.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
     )
WHERE COALESCE(
        NULLIF(c_old.confirmation_day, '0000-00-00'),
        NULLIF(c_old.date_confirmation_date, '0000-00-00'),
        DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00'))
      ) IS NOT NULL;

-- 2) Remplir confirmation_day depuis date_confirmation_date si manquant / zéro
UPDATE `confirmations`
SET `confirmation_day` = `date_confirmation_date`
WHERE (`confirmation_day` IS NULL OR `confirmation_day` = '0000-00-00')
  AND `date_confirmation_date` IS NOT NULL
  AND `date_confirmation_date` <> '0000-00-00';

-- 3) Remplir date_confirmation_date depuis confirmation_day si manquant / zéro
UPDATE `confirmations`
SET `date_confirmation_date` = `confirmation_day`
WHERE (`date_confirmation_date` IS NULL OR `date_confirmation_date` = '0000-00-00')
  AND `confirmation_day` IS NOT NULL
  AND `confirmation_day` <> '0000-00-00';

-- 4) Repli FILL uniquement (pas de DELETE ici) :
--    dériver le jour depuis date_confirmation, sinon date_creation.
--    date_rdv_time volontairement exclu (risque d'aligner 2 confirms uniques).
UPDATE `confirmations`
SET
  `confirmation_day` = DATE(COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00')
  )),
  `date_confirmation_date` = DATE(COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00')
  ))
WHERE (
    `confirmation_day` IS NULL OR `confirmation_day` = '0000-00-00'
    OR `date_confirmation_date` IS NULL OR `date_confirmation_date` = '0000-00-00'
  )
  AND COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00')
  ) IS NOT NULL;

-- 5) Filet : collisions exactes sur confirmation_day après sync
--    (uniquement si les deux lignes ont un confirmation_day réel)
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.confirmation_day <=> c_keep.confirmation_day
 AND c_old.confirmation_day IS NOT NULL
 AND c_old.confirmation_day <> '0000-00-00'
 AND c_old.id < c_keep.id;

SELECT 'confirmations : dédoublonnage (jour confirmation uniquement) + sync OK' AS message;

SET SQL_SAFE_UPDATES = 1;
