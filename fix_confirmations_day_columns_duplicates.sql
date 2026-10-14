-- =====================================================
-- confirmations : sync confirmation_day / date_confirmation_date
-- et suppression des doublons croisés
-- =====================================================
-- Symptôme observé :
--   ligne A : confirmation_day = DATE, date_confirmation_date = 0000-00-00
--   ligne B : confirmation_day = 0000-00-00, date_confirmation_date = DATE
-- (même id_fiche, même jour logique)
--
-- IMPORTANT : dédoublonner AVANT de synchroniser les colonnes,
-- sinon UPDATE confirmation_day viole uk_fiche_confirmation_day.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Jour logique d'une ligne (ignore 0000-00-00)
-- = COALESCE(confirmation_day, date_confirmation_date, DATE(date_confirmation|creation|rdv))

-- 1) Supprimer les doublons croisés AVANT tout UPDATE
--    Garder l'id le plus récent par (id_fiche, jour logique)
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.id < c_keep.id
 AND COALESCE(
       NULLIF(c_old.confirmation_day, '0000-00-00'),
       NULLIF(c_old.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00')),
       DATE(NULLIF(NULLIF(c_old.date_creation, '0000-00-00 00:00:00'), '0000-00-00')),
       DATE(NULLIF(NULLIF(c_old.date_rdv_time, '0000-00-00 00:00:00'), '0000-00-00'))
     ) = COALESCE(
       NULLIF(c_keep.confirmation_day, '0000-00-00'),
       NULLIF(c_keep.date_confirmation_date, '0000-00-00'),
       DATE(NULLIF(NULLIF(c_keep.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00')),
       DATE(NULLIF(NULLIF(c_keep.date_creation, '0000-00-00 00:00:00'), '0000-00-00')),
       DATE(NULLIF(NULLIF(c_keep.date_rdv_time, '0000-00-00 00:00:00'), '0000-00-00'))
     )
WHERE COALESCE(
        NULLIF(c_old.confirmation_day, '0000-00-00'),
        NULLIF(c_old.date_confirmation_date, '0000-00-00'),
        DATE(NULLIF(NULLIF(c_old.date_confirmation, '0000-00-00 00:00:00'), '0000-00-00')),
        DATE(NULLIF(NULLIF(c_old.date_creation, '0000-00-00 00:00:00'), '0000-00-00')),
        DATE(NULLIF(NULLIF(c_old.date_rdv_time, '0000-00-00 00:00:00'), '0000-00-00'))
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

-- 4) Repli : dériver le jour depuis date_confirmation / date_creation / date_rdv_time
UPDATE `confirmations`
SET
  `confirmation_day` = DATE(COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_rdv_time`, '0000-00-00 00:00:00'), '0000-00-00')
  )),
  `date_confirmation_date` = DATE(COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_rdv_time`, '0000-00-00 00:00:00'), '0000-00-00')
  ))
WHERE (
    `confirmation_day` IS NULL OR `confirmation_day` = '0000-00-00'
    OR `date_confirmation_date` IS NULL OR `date_confirmation_date` = '0000-00-00'
  )
  AND COALESCE(
    NULLIF(NULLIF(`date_confirmation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_creation`, '0000-00-00 00:00:00'), '0000-00-00'),
    NULLIF(NULLIF(`date_rdv_time`, '0000-00-00 00:00:00'), '0000-00-00')
  ) IS NOT NULL;

-- 5) Filet de sécurité : s'il reste des collisions exactes sur confirmation_day
DELETE c_old
FROM `confirmations` c_old
INNER JOIN `confirmations` c_keep
  ON c_old.id_fiche = c_keep.id_fiche
 AND c_old.confirmation_day <=> c_keep.confirmation_day
 AND c_old.confirmation_day IS NOT NULL
 AND c_old.confirmation_day <> '0000-00-00'
 AND c_old.id < c_keep.id;

SELECT 'confirmations : dédoublonnage puis sync day columns OK' AS message;

SET SQL_SAFE_UPDATES = 1;
