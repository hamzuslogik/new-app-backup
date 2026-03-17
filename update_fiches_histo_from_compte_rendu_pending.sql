-- =====================================================
-- Mise à jour de fiches_histo depuis compte_rendu_pending
-- =====================================================
-- Prerequisite: add_fiches_histo_from_compte_rendu.sql exécuté (colonnes from_compte_rendu, id_commercial_cr)
--
-- Met à jour UNE SEULE ligne fiches_histo par compte rendu :
--   celle dont date_creation est la plus proche de la date du CR (date_modif/date_creation).
--   Les autres lignes (même fiche, même état, même jour) viennent des confirmateurs et ne sont pas modifiées.
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

-- Une ligne CR par (id_fiche, id_etat_final, date_jour)
-- Puis pour chaque CR, la SEULE ligne fiches_histo dont date_creation est la plus proche de date_ref
UPDATE `fiches_histo` fh
INNER JOIN (
  SELECT fh_in.id AS fh_id, cr.id_commercial
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
) sel ON fh.id = sel.fh_id
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = sel.id_commercial;

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
