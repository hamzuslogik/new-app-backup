-- =====================================================
-- Mise à jour de fiches_histo depuis compte_rendu_pending
-- =====================================================
-- Prerequisite: add_fiches_histo_from_compte_rendu.sql exécuté (colonnes from_compte_rendu, id_commercial_cr)
--
-- Règles (pas de duplication, lien exact) :
--   1. Un seul compte rendu par (fiche, état, jour) : on ne lie que si le CR est unique pour ce triplet.
--   2. Une seule ligne fiches_histo par CR : celle dont date_creation est la plus proche de la date du CR.
--   3. Reset préalable : toute ligne fiches_histo concernée par un CR est remise à 0 avant mise à jour,
--      puis seules les lignes explicitement associées à un CR unique sont marquées from_compte_rendu=1.
--
-- Correspondance:
--   fiches_histo.id_fiche = compte_rendu_pending.id_fiche
--   fiches_histo.id_etat = compte_rendu_pending.id_etat_final
--   Même jour, puis choix de la ligne dont date_creation est la plus proche de date_ref du CR
--
-- Statuts couverts: approved, rejected, pending (tous les CR)
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------------
-- Étape 1 : Reset des lignes fiches_histo qui matchent un CR (fiche, état, jour)
--            pour repartir sans ancienne liaison et éviter les doublons
-- ---------------------------------------------------------------------------
UPDATE `fiches_histo` fh
INNER JOIN (
  SELECT DISTINCT cr.id_fiche, cr.id_etat_final AS id_etat, DATE(COALESCE(cr.date_modif, cr.date_creation)) AS date_jour
  FROM `compte_rendu_pending` cr
  WHERE cr.id_commercial IS NOT NULL
    AND cr.id_etat_final IS NOT NULL
) cr_keys
  ON fh.id_fiche = cr_keys.id_fiche
  AND fh.id_etat = cr_keys.id_etat
  AND DATE(fh.date_creation) = cr_keys.date_jour
SET
  fh.from_compte_rendu = 0,
  fh.id_commercial_cr = NULL;

-- ---------------------------------------------------------------------------
-- Étape 2 : Un seul CR par (id_fiche, id_etat_final, date_jour) — HAVING COUNT(*) = 1
--           Puis pour ce CR unique, la SEULE ligne fiches_histo la plus proche en date.
--           GROUP BY fh_id garantit qu’une même ligne fiches_histo n’est mise à jour qu’une fois.
-- ---------------------------------------------------------------------------
UPDATE `fiches_histo` fh
INNER JOIN (
  SELECT link.fh_id, MAX(link.id_commercial) AS id_commercial
  FROM (
    SELECT fh_in.id AS fh_id, cr.id_commercial
    FROM `compte_rendu_pending` cr
    INNER JOIN (
      SELECT id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation)) AS date_jour,
             MIN(id) AS min_id,
             COUNT(*) AS cnt
      FROM `compte_rendu_pending`
      WHERE id_commercial IS NOT NULL
        AND id_etat_final IS NOT NULL
      GROUP BY id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation))
      HAVING cnt = 1
    ) uniq ON cr.id_fiche = uniq.id_fiche
          AND cr.id_etat_final = uniq.id_etat_final
          AND DATE(COALESCE(cr.date_modif, cr.date_creation)) = uniq.date_jour
          AND cr.id = uniq.min_id
    INNER JOIN `fiches_histo` fh_in
      ON fh_in.id_fiche = cr.id_fiche
      AND fh_in.id_etat = cr.id_etat_final
      AND DATE(fh_in.date_creation) = DATE(COALESCE(cr.date_modif, cr.date_creation))
    WHERE fh_in.id = (
      SELECT fh2.id
      FROM `fiches_histo` fh2
      WHERE fh2.id_fiche = cr.id_fiche
        AND fh2.id_etat = cr.id_etat_final
        AND DATE(fh2.date_creation) = DATE(COALESCE(cr.date_modif, cr.date_creation))
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, fh2.date_creation, COALESCE(cr.date_modif, cr.date_creation)))
      LIMIT 1
    )
  ) link
  GROUP BY link.fh_id
) sel ON fh.id = sel.fh_id
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = sel.id_commercial;

SET SQL_SAFE_UPDATES = 1;

-- ---------------------------------------------------------------------------
-- Statistiques et contrôles (pas de duplication)
-- ---------------------------------------------------------------------------
SELECT 'Lignes fiches_histo marquées from_compte_rendu=1 (lien exact 1 CR → 1 ligne histo)' AS info;
SELECT COUNT(*) AS nb_liees
FROM `fiches_histo`
WHERE from_compte_rendu = 1 AND id_commercial_cr IS NOT NULL;

SELECT 'Total fiches_histo avec from_compte_rendu=1' AS info;
SELECT COUNT(*) AS nb_from_cr FROM `fiches_histo` WHERE from_compte_rendu = 1;

-- (fiche, état, jour) avec plusieurs CR : exclus du lien, pas de compte rendu "successif" lié
SELECT 'Triplets (fiche, état, jour) avec plusieurs CR (exclus du lien, pas de duplication)' AS info;
SELECT id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation)) AS date_jour, COUNT(*) AS nb_cr
FROM `compte_rendu_pending`
WHERE id_commercial IS NOT NULL AND id_etat_final IS NOT NULL
GROUP BY id_fiche, id_etat_final, DATE(COALESCE(date_modif, date_creation))
HAVING COUNT(*) > 1;

-- Répartition par statut des CR dans compte_rendu_pending (pour info)
SELECT 'Compte_rendu_pending par statut (info seulement)' AS info;
SELECT statut, COUNT(*) AS nb FROM `compte_rendu_pending` GROUP BY statut;

SELECT 'Script terminé.' AS message;
