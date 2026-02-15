-- =====================================================
-- Mise à jour de la table confirmations
-- =====================================================
-- Remplit la table confirmations uniquement depuis fiches_histo :
--   lignes avec id_etat = 7 (CONFIRMER) et date_rdv_time renseignée,
--   une ligne par (id_fiche, date_rdv_time).
-- date_confirmation et date_creation reçoivent la même valeur (date_creation de fiches_histo).
--
-- Prérequis : la table confirmations doit avoir la colonne date_confirmation.
-- Si absent : ALTER TABLE confirmations ADD COLUMN date_confirmation datetime DEFAULT NULL AFTER date_rdv_time;
--
-- Peut être exécuté régulièrement (cron ou manuel) pour maintenir la table à jour.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Optionnel : vider la table avant re-remplissage (rafraîchissement complet)
-- TRUNCATE TABLE `confirmations`;

-- Insérer les confirmations depuis fiches_histo (une ligne par id_fiche + date_rdv_time)
-- On garde la dernière ligne de chaque groupe (MAX(id)) pour récupérer id_commercial, id_confirmateur
-- date_confirmation = date_creation de l'historique ; date_creation prend la même valeur que date_confirmation
-- id_confirmateur : fiches_histo.id_confirmateur, ou fiches.id_confirmateur si 0/NULL
INSERT INTO `confirmations` (`id_fiche`, `date_rdv_time`, `date_confirmation`, `id_confirmateur`, `id_commercial`, `date_creation`)
SELECT
  h.id_fiche,
  h.date_rdv_time,
  h.date_creation AS date_confirmation,
  COALESCE(NULLIF(h.id_confirmateur, 0), (SELECT f.id_confirmateur FROM `fiches` f WHERE f.id = h.id_fiche LIMIT 1)) AS id_confirmateur,
  h.id_commercial,
  h.date_creation
FROM `fiches_histo` h
INNER JOIN (
  SELECT id_fiche, date_rdv_time, MAX(id) AS mid
  FROM `fiches_histo`
  WHERE id_etat = 7
    AND date_rdv_time IS NOT NULL
    AND id_fiche IS NOT NULL
  GROUP BY id_fiche, date_rdv_time
) t ON h.id_fiche = t.id_fiche AND h.date_rdv_time = t.date_rdv_time AND h.id = t.mid
WHERE h.id_etat = 7
  AND h.date_rdv_time IS NOT NULL
ON DUPLICATE KEY UPDATE
  id_confirmateur = VALUES(id_confirmateur),
  id_commercial = VALUES(id_commercial),
  date_confirmation = VALUES(date_confirmation),
  date_creation = VALUES(date_confirmation);

-- Résumé
SELECT COUNT(*) AS total_confirmations FROM `confirmations`;
SELECT CONCAT('Mise à jour terminée. Total lignes dans confirmations : ', (SELECT COUNT(*) FROM `confirmations`)) AS resultat;

SET SQL_SAFE_UPDATES = 1;
