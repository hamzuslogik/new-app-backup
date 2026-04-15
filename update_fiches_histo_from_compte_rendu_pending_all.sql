-- =====================================================
-- V2 - Synchroniser fiches_histo depuis compte_rendu_pending
-- Objectif: lier tous les comptes rendus APPROUVÉS sans fausser les passages
--           « Annuler à reprogrammer » (8) et « Honoré à suivre » (9) faits
--           directement par un confirmateur (même jour ≠ compte rendu).
-- =====================================================
-- Règles:
-- 1) Uniquement compte_rendu_pending.statut = 'approved' (vrai passage par validation CR).
-- 2) date_ref = COALESCE(date_approbation, date_modif, date_creation).
-- 3) États autres que 8 et 9: liaison par même jour (fiche, état, DATE(date_creation fh) = DATE(date_ref CR)).
-- 4) États 8 et 9: NE PAS utiliser seulement le même jour — risque de marquer une ligne
--    créée par le confirmateur. On ne marque que si la ligne fiches_histo est dans une
--    fenêtre temporelle autour de date_ref du CR (défaut 3 minutes), en prenant la meilleure
--    correspondance (écart minimal) par ligne d’historique.
-- 5) Insertion d’une ligne fiches_histo manquante si aucune ligne ne peut représenter le CR.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Fenêtre (secondes) pour rapprocher CR et ligne histo sur états 8 et 9
SET @fenetre_sec_8_9 = 180;

-- ---------------------------------------------------------------------------
-- A) Source CR : uniquement APPROUVÉS
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_cr_src;
CREATE TEMPORARY TABLE tmp_cr_src AS
SELECT
  cr.id AS cr_id,
  cr.id_fiche,
  cr.id_etat_final,
  cr.id_commercial,
  cr.id_approbateur,
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_fiche IS NOT NULL
  AND cr.id_etat_final IS NOT NULL
  AND COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) IS NOT NULL;

ALTER TABLE tmp_cr_src ADD INDEX idx_cr_src_fiche_etat_date (id_fiche, id_etat_final, date_ref);

-- ---------------------------------------------------------------------------
-- B) Reset des flags sur le périmètre (fiche, état, jour) des CR approuvés
-- ---------------------------------------------------------------------------
UPDATE fiches_histo fh
INNER JOIN (
  SELECT DISTINCT id_fiche, id_etat_final, DATE(date_ref) AS date_jour
  FROM tmp_cr_src
) k
  ON fh.id_fiche = k.id_fiche
 AND fh.id_etat = k.id_etat_final
 AND DATE(fh.date_creation) = k.date_jour
SET
  fh.from_compte_rendu = 0,
  fh.id_commercial_cr = NULL;

-- ---------------------------------------------------------------------------
-- C1) États hors 8 et 9 : même jour (comportement large)
-- ---------------------------------------------------------------------------
UPDATE fiches_histo fh
INNER JOIN (
  SELECT
    fh2.id AS fh_id,
    MAX(src.id_commercial) AS id_commercial
  FROM fiches_histo fh2
  INNER JOIN tmp_cr_src src
    ON src.id_fiche = fh2.id_fiche
   AND src.id_etat_final = fh2.id_etat
   AND src.id_etat_final NOT IN (8, 9)
   AND DATE(src.date_ref) = DATE(fh2.date_creation)
  GROUP BY fh2.id
) m ON m.fh_id = fh.id
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = m.id_commercial;

-- ---------------------------------------------------------------------------
-- C2) États 8 et 9 : fenêtre temporelle serrée (évite <CR> sur action confirmateur le même jour)
--     MySQL : une TEMP TABLE ne peut pas être ouverte 2× dans la même requête → étapes séparées.
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_89_min_delta;
CREATE TEMPORARY TABLE tmp_89_min_delta AS
SELECT
  fh3.id AS fh_id,
  MIN(ABS(TIMESTAMPDIFF(SECOND, fh3.date_creation, cr.date_ref))) AS min_delta
FROM fiches_histo fh3
INNER JOIN tmp_cr_src cr
  ON cr.id_fiche = fh3.id_fiche
 AND cr.id_etat_final = fh3.id_etat
 AND fh3.id_etat IN (8, 9)
 AND ABS(TIMESTAMPDIFF(SECOND, fh3.date_creation, cr.date_ref)) <= @fenetre_sec_8_9
GROUP BY fh3.id;

DROP TEMPORARY TABLE IF EXISTS tmp_89_pick_cr;
CREATE TEMPORARY TABLE tmp_89_pick_cr AS
SELECT
  fh2.id AS fh_id,
  MAX(cr.cr_id) AS pick_cr_id
FROM fiches_histo fh2
INNER JOIN tmp_89_min_delta m ON m.fh_id = fh2.id
INNER JOIN tmp_cr_src cr
  ON cr.id_fiche = fh2.id_fiche
 AND cr.id_etat_final = fh2.id_etat
 AND fh2.id_etat IN (8, 9)
 AND ABS(TIMESTAMPDIFF(SECOND, fh2.date_creation, cr.date_ref)) = m.min_delta
GROUP BY fh2.id;

DROP TEMPORARY TABLE IF EXISTS tmp_cr_match_8_9;
CREATE TEMPORARY TABLE tmp_cr_match_8_9 AS
SELECT
  fh2.id AS fh_id,
  cr.id_commercial
FROM fiches_histo fh2
INNER JOIN tmp_89_pick_cr p ON p.fh_id = fh2.id
INNER JOIN tmp_cr_src cr ON cr.cr_id = p.pick_cr_id;

UPDATE fiches_histo fh
INNER JOIN tmp_cr_match_8_9 m ON m.fh_id = fh.id
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = m.id_commercial;

-- ---------------------------------------------------------------------------
-- D) Insérer une ligne fiches_histo pour chaque CR encore sans représentation
--    (hors 8/9: déjà couvert par C1 si même jour ; 8/9: seulement si aucune ligne dans la fenêtre)
-- ---------------------------------------------------------------------------
INSERT INTO fiches_histo (
  id_fiche,
  id_etat,
  id_confirmateur,
  id_sous_etat,
  date_rdv_time,
  date_creation,
  from_compte_rendu,
  id_commercial_cr
)
SELECT
  src.id_fiche,
  src.id_etat_final,
  src.id_approbateur,
  NULL,
  NULL,
  src.date_ref,
  1,
  src.id_commercial
FROM tmp_cr_src src
WHERE NOT EXISTS (
  SELECT 1
  FROM fiches_histo fh
  WHERE fh.id_fiche = src.id_fiche
    AND fh.id_etat = src.id_etat_final
    AND fh.from_compte_rendu = 1
    AND (
      (src.id_etat_final NOT IN (8, 9) AND DATE(fh.date_creation) = DATE(src.date_ref))
      OR
      (src.id_etat_final IN (8, 9)
        AND ABS(TIMESTAMPDIFF(SECOND, fh.date_creation, src.date_ref)) <= @fenetre_sec_8_9)
    )
);

SET SQL_SAFE_UPDATES = 1;

-- ---------------------------------------------------------------------------
-- Contrôles
-- ---------------------------------------------------------------------------
SELECT 'CR approuvés pris en compte' AS info;
SELECT COUNT(*) AS nb_cr_source FROM tmp_cr_src;

SELECT 'Lignes fiches_histo from_compte_rendu=1' AS info;
SELECT COUNT(*) AS nb_histo_from_cr FROM fiches_histo WHERE from_compte_rendu = 1;

SELECT 'Script V2 (affiné 8/9) terminé.' AS message;
