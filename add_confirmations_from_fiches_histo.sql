-- =====================================================
-- Ajout des confirmations depuis fiches_histo
-- =====================================================
-- Insère dans la table confirmations la liste des confirmations
-- effectuées (id_etat = 7 = CONFIRMER) à partir de fiches_histo.
-- Une ligne par (id_fiche, date). Si date_rdv_time est NULL, on utilise date_creation.
-- Les doublons sont gérés par ON DUPLICATE KEY UPDATE.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- ========== DIAGNOSTIC (pourquoi 0 lignes ?) ==========
SELECT '=== DIAGNOSTIC fiches_histo (id_etat = 7) ===' AS info;
SELECT COUNT(*) AS nb_id_etat_7 FROM `fiches_histo` WHERE id_etat = 7;
SELECT COUNT(*) AS nb_id_etat_7_et_date_rdv_non_nulle FROM `fiches_histo` WHERE id_etat = 7 AND date_rdv_time IS NOT NULL AND id_fiche IS NOT NULL AND id_fiche > 0;
SELECT COUNT(*) AS nb_id_etat_7_et_id_fiche_valide FROM `fiches_histo` WHERE id_etat = 7 AND id_fiche IS NOT NULL AND id_fiche > 0;
-- Exemples de lignes état 7 (avec ou sans date_rdv_time)
SELECT id, id_fiche, id_etat, date_rdv_time, date_creation
FROM `fiches_histo`
WHERE id_etat = 7 AND id_fiche IS NOT NULL AND id_fiche > 0
ORDER BY id DESC
LIMIT 10;

-- ========== INSERTION ==========
-- On prend toutes les lignes id_etat = 7 avec id_fiche valide.
-- date_confirmation : date_creation de fiches_histo (date du passage à l'état CONFIRMER).
-- Date RDV : date_rdv_time si renseignée, sinon date_creation. id_confirmateur : fiches_histo ou fiches.
-- Une ligne par (id_fiche, date) en gardant la dernière entrée du groupe (MAX(id)).
INSERT INTO `confirmations` (`id_fiche`, `date_rdv_time`, `date_confirmation`, `id_confirmateur`, `id_commercial`, `date_creation`)
SELECT
  h.id_fiche,
  COALESCE(h.date_rdv_time, h.date_creation) AS date_rdv_time,
  h.date_creation AS date_confirmation,
  COALESCE(NULLIF(h.id_confirmateur, 0), (SELECT f.id_confirmateur FROM `fiches` f WHERE f.id = h.id_fiche LIMIT 1)) AS id_confirmateur,
  h.id_commercial,
  h.date_creation
FROM `fiches_histo` h
INNER JOIN (
  SELECT
    id_fiche,
    COALESCE(date_rdv_time, date_creation) AS dt,
    MAX(id) AS mid
  FROM `fiches_histo`
  WHERE id_etat = 7
    AND id_fiche IS NOT NULL
    AND id_fiche > 0
  GROUP BY id_fiche, COALESCE(date_rdv_time, date_creation)
) t ON h.id_fiche = t.id_fiche AND COALESCE(h.date_rdv_time, h.date_creation) = t.dt AND h.id = t.mid
WHERE h.id_etat = 7
  AND h.id_fiche IS NOT NULL
  AND h.id_fiche > 0
ON DUPLICATE KEY UPDATE
  date_confirmation = VALUES(date_confirmation),
  id_confirmateur = VALUES(id_confirmateur),
  id_commercial = VALUES(id_commercial),
  date_creation = VALUES(date_creation);

-- Résumé
SELECT COUNT(*) AS total_confirmations FROM `confirmations`;
SELECT CONCAT('Ajout terminé. Total confirmations : ', (SELECT COUNT(*) FROM `confirmations`)) AS resultat;

SET SQL_SAFE_UPDATES = 1;
