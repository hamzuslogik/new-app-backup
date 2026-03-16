-- =====================================================
-- Mise à jour de fiches_histo depuis compte_rendu_pending
-- =====================================================
-- Prerequisite: add_fiches_histo_from_compte_rendu.sql exécuté (colonnes from_compte_rendu, id_commercial_cr)
--
-- Met à jour:
--   fiches_histo.from_compte_rendu = 1
--   fiches_histo.id_commercial_cr = compte_rendu_pending.id_commercial
--
-- Correspondance:
--   fiches_histo.id_fiche = compte_rendu_pending.id_fiche
--   fiches_histo.id_etat = compte_rendu_pending.id_etat_final
--   Même jour: DATE(fiches_histo.date_creation) = DATE(compte_rendu_pending.date_modif)
--              ou DATE(compte_rendu_pending.date_creation)
--
-- Statuts couverts: approved, rejected, pending (tous les CR, pas seulement approuvés)
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Sous-requête : un CR par (id_fiche, id_etat_final, date_jour, statut) pour éviter les doublons
-- On prend le CR avec l'id minimal quand plusieurs correspondent au même jour
-- Tous les statuts sont pris en compte (approved, rejected, pending)
UPDATE `fiches_histo` fh
INNER JOIN (
  SELECT cr.id_fiche, cr.id_etat_final, cr.id_commercial,
         COALESCE(cr.date_modif, cr.date_creation) AS date_ref
  FROM `compte_rendu_pending` cr
  INNER JOIN (
    SELECT id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation)) AS date_jour,
           MIN(id) AS min_id
    FROM `compte_rendu_pending`
    WHERE id_commercial IS NOT NULL
      AND id_etat_final IS NOT NULL
    GROUP BY id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation))
  ) uniq ON cr.id_fiche = uniq.id_fiche
        AND cr.id_etat_final = uniq.id_etat_final
        AND DATE(COALESCE(cr.date_modif, cr.date_creation)) = uniq.date_jour
        AND cr.id = uniq.min_id
) cr
  ON fh.id_fiche = cr.id_fiche
  AND fh.id_etat = cr.id_etat_final
  AND DATE(fh.date_creation) = DATE(cr.date_ref)
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = cr.id_commercial;

SET SQL_SAFE_UPDATES = 1;

-- Statistiques
SELECT 'Lignes fiches_histo mises à jour (from_compte_rendu=1, id_commercial_cr renseigné)' AS info;
SELECT COUNT(*) AS nb_mises_a_jour
FROM `fiches_histo`
WHERE from_compte_rendu = 1 AND id_commercial_cr IS NOT NULL;

SELECT 'Total fiches_histo avec from_compte_rendu=1' AS info;
SELECT COUNT(*) AS nb_from_cr FROM `fiches_histo` WHERE from_compte_rendu = 1;

-- Répartition par statut des CR dans compte_rendu_pending (pour info)
SELECT 'Compte_rendu_pending par statut (non utilisé dans l''UPDATE, info seulement)' AS info;
SELECT statut, COUNT(*) AS nb FROM `compte_rendu_pending` GROUP BY statut;

SELECT 'Script terminé.' AS message;
