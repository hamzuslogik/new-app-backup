-- =====================================================
-- Mise à jour de la table confirmations
-- =====================================================
-- Remplit la table confirmations uniquement depuis fiches_histo :
--   lignes avec id_etat = 7 (CONFIRMER) et date_rdv_time renseignée,
--   une ligne par (id_fiche, date_rdv_time).
-- date_creation = date de la confirmation (même valeur que date_confirmation).
--   Source : fiches_histo.date_creation = moment de création de la ligne histo = passage à l'état CONFIRMER (7).
-- id_etat_avant = NULL.
-- commentaire = champ conf_commentaire_produit de fiches_histo.
--
-- Prérequis : table confirmations avec colonnes date_confirmation, id_etat_avant, commentaire.
-- Si absentes :
--   ALTER TABLE confirmations ADD COLUMN date_confirmation datetime DEFAULT NULL;
--   ALTER TABLE confirmations ADD COLUMN id_etat_avant int(11) DEFAULT NULL;
--   ALTER TABLE confirmations ADD COLUMN commentaire text DEFAULT NULL;
--
-- Peut être exécuté régulièrement (cron ou manuel) pour maintenir la table à jour.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Optionnel : vider la table avant re-remplissage (rafraîchissement complet)
-- TRUNCATE TABLE `confirmations`;

-- Insérer les confirmations depuis fiches_histo (une ligne par id_fiche + date_rdv_time)
-- date_creation et date_confirmation = date de la confirmation (fiches_histo.date_creation = passage à l'état 7)
INSERT INTO `confirmations` (`id_fiche`, `date_rdv_time`, `date_confirmation`, `id_confirmateur`, `id_commercial`, `date_creation`, `id_etat_avant`, `commentaire`)
SELECT
  h.id_fiche,
  h.date_rdv_time,
  h.date_creation AS date_confirmation,
  COALESCE(NULLIF(h.id_confirmateur, 0), (SELECT f.id_confirmateur FROM `fiches` f WHERE f.id = h.id_fiche LIMIT 1)) AS id_confirmateur,
  h.id_commercial,
  h.date_creation AS date_creation,
  NULL AS id_etat_avant,
  h.`conf_commentaire_produit` AS commentaire
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
  date_creation = VALUES(date_confirmation),
  id_etat_avant = NULL,
  commentaire = VALUES(commentaire);

-- Résumé
SELECT COUNT(*) AS total_confirmations FROM `confirmations`;
SELECT CONCAT('Mise à jour terminée. Total lignes dans confirmations : ', (SELECT COUNT(*) FROM `confirmations`)) AS resultat;

SET SQL_SAFE_UPDATES = 1;
