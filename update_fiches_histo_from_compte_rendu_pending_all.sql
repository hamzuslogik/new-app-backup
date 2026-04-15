-- =====================================================
-- V2 - Synchroniser fiches_histo depuis compte_rendu_pending
-- Objectif: prendre TOUS les comptes rendus (approved/rejected/pending)
-- =====================================================
-- Différences vs script précédent:
-- 1) Utilise date_ref = COALESCE(date_approbation, date_modif, date_creation)
-- 2) N'exclut pas les doublons CR par (fiche, etat, jour)
-- 3) Lie d'abord les lignes histo existantes (même fiche/etat/jour)
-- 4) Insère une ligne fiches_histo manquante pour chaque CR non représenté
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------------
-- A) Source CR normalisée (TOUS les statuts)
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
WHERE cr.id_fiche IS NOT NULL
  AND cr.id_etat_final IS NOT NULL
  AND COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) IS NOT NULL;

ALTER TABLE tmp_cr_src ADD INDEX idx_cr_src_fiche_etat_date (id_fiche, id_etat_final, date_ref);

-- ---------------------------------------------------------------------------
-- B) Reset ciblé des flags from_compte_rendu pour les (fiche, état, jour) présents dans CR
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
-- C) Lier les lignes histo existantes (même fiche/etat/jour)
--    On marque toute ligne ayant au moins un CR correspondant le même jour.
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
   AND DATE(src.date_ref) = DATE(fh2.date_creation)
  GROUP BY fh2.id
) m ON m.fh_id = fh.id
SET
  fh.from_compte_rendu = 1,
  fh.id_commercial_cr = m.id_commercial;

-- ---------------------------------------------------------------------------
-- D) Insérer les CR non représentés dans fiches_histo
--    Critère "non représenté": aucun historique (fiche/etat/jour) marqué from_compte_rendu=1
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
    AND DATE(fh.date_creation) = DATE(src.date_ref)
    AND fh.from_compte_rendu = 1
);

-- ---------------------------------------------------------------------------
-- E) Contrôles
-- ---------------------------------------------------------------------------
SELECT 'CR source total (pris en compte)' AS info;
SELECT COUNT(*) AS nb_cr_source FROM tmp_cr_src;

SELECT 'Lignes fiches_histo marquées from_compte_rendu=1' AS info;
SELECT COUNT(*) AS nb_histo_from_cr
FROM fiches_histo
WHERE from_compte_rendu = 1;

SELECT 'Lignes insérées (CR non représentés)' AS info;
SELECT ROW_COUNT() AS nb_histo_inserees;

SELECT 'CR encore non représentés (doit être 0 ou cas de données incohérentes)' AS info;
SELECT COUNT(*) AS nb_cr_non_representes
FROM tmp_cr_src src
WHERE NOT EXISTS (
  SELECT 1
  FROM fiches_histo fh
  WHERE fh.id_fiche = src.id_fiche
    AND fh.id_etat = src.id_etat_final
    AND DATE(fh.date_creation) = DATE(src.date_ref)
    AND fh.from_compte_rendu = 1
);

SET SQL_SAFE_UPDATES = 1;

SELECT 'Script V2 terminé.' AS message;
