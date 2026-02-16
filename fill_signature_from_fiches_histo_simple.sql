-- =====================================================
-- Remplir la table signature depuis fiches_histo (MySQL 8)
-- =====================================================
--
-- Basé sur la DATE PLANNING (date_rdv_time de la fiche).
-- signature.date_heure est renseigné avec la date planning pour alignement
-- avec la page Signatures qui filtre par date de RDV.
--
-- Prérequis : fiches_histo avec id_fiche, id_etat, date_creation, id_confirmateur
-- et de préférence date_sign_time, id_confirmateur_2, id_confirmateur_3.
--
-- États signés : 13, 16, 44, 45. On exclut les fiches dont le dernier
-- état signé est 38 (SIGNER RETRACTER 2 FOIS).
-- Score : 1 confirmateur = 1.0 ; 2 = 0.5 chacun ; 3 = 0.33 chacun.
--
-- À exécuter sur la base crm. MySQL 8.
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Dernière entrée état signé par fiche + date planning (fiches.date_rdv_time)
WITH dernier_signe AS (
  SELECT
    fh.id_fiche,
    f.date_rdv_time AS date_planning,
    f.tel,
    fh.id_confirmateur,
    fh.id_confirmateur_2,
    fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45)
    AND fh.id_fiche IS NOT NULL
    AND fh.id = (
      SELECT MAX(fh2.id)
      FROM fiches_histo fh2
      WHERE fh2.id_fiche = fh.id_fiche
        AND fh2.id_etat IN (13, 16, 44, 45)
    )
    AND NOT EXISTS (
      SELECT 1 FROM fiches_histo fh38
      WHERE fh38.id_fiche = fh.id_fiche
        AND fh38.id_etat = 38
        AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation)
    )
)
-- 1 confirmateur : score 1.0 — date_heure = date planning
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur, 1.0, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur IS NOT NULL AND d.id_confirmateur > 0
  AND (d.id_confirmateur_2 IS NULL OR d.id_confirmateur_2 = 0)
  AND (d.id_confirmateur_3 IS NULL OR d.id_confirmateur_3 = 0)
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (
    SELECT 1 FROM signature s
    WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur
      AND s.date_heure = d.date_planning
  );

SELECT CONCAT('Cas 1 (1 confirmateur) : ', ROW_COUNT(), ' ligne(s) insérée(s)') AS resultat;

-- 2 confirmateurs : score 0.5 chacun
WITH dernier_signe AS (
  SELECT
    fh.id_fiche,
    f.date_rdv_time AS date_planning,
    f.tel,
    fh.id_confirmateur,
    fh.id_confirmateur_2,
    fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45)
    AND fh.id_fiche IS NOT NULL
    AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fh.id_fiche AND fh2.id_etat IN (13, 16, 44, 45))
    AND NOT EXISTS (SELECT 1 FROM fiches_histo fh38 WHERE fh38.id_fiche = fh.id_fiche AND fh38.id_etat = 38 AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation))
)
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur, 0.5, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur IS NOT NULL AND d.id_confirmateur > 0
  AND d.id_confirmateur_2 IS NOT NULL AND d.id_confirmateur_2 > 0
  AND (d.id_confirmateur_3 IS NULL OR d.id_confirmateur_3 = 0)
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (SELECT 1 FROM signature s WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur AND s.date_heure = d.date_planning);

WITH dernier_signe AS (
  SELECT fh.id_fiche, f.date_rdv_time AS date_planning, f.tel,
         fh.id_confirmateur, fh.id_confirmateur_2, fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45) AND fh.id_fiche IS NOT NULL
    AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fh.id_fiche AND fh2.id_etat IN (13, 16, 44, 45))
    AND NOT EXISTS (SELECT 1 FROM fiches_histo fh38 WHERE fh38.id_fiche = fh.id_fiche AND fh38.id_etat = 38 AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation))
)
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur_2, 0.5, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur_2 IS NOT NULL AND d.id_confirmateur_2 > 0
  AND d.id_confirmateur IS NOT NULL AND d.id_confirmateur > 0
  AND (d.id_confirmateur_3 IS NULL OR d.id_confirmateur_3 = 0)
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (SELECT 1 FROM signature s WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur_2 AND s.date_heure = d.date_planning);

SELECT CONCAT('Cas 2 (2 confirmateurs) : ', ROW_COUNT(), ' ligne(s) insérée(s)') AS resultat;

-- 3 confirmateurs : score 0.33 chacun
WITH dernier_signe AS (
  SELECT fh.id_fiche, f.date_rdv_time AS date_planning, f.tel,
         fh.id_confirmateur, fh.id_confirmateur_2, fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45) AND fh.id_fiche IS NOT NULL
    AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fh.id_fiche AND fh2.id_etat IN (13, 16, 44, 45))
    AND NOT EXISTS (SELECT 1 FROM fiches_histo fh38 WHERE fh38.id_fiche = fh.id_fiche AND fh38.id_etat = 38 AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation))
)
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur, 0.33, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur IS NOT NULL AND d.id_confirmateur > 0
  AND d.id_confirmateur_2 IS NOT NULL AND d.id_confirmateur_2 > 0
  AND d.id_confirmateur_3 IS NOT NULL AND d.id_confirmateur_3 > 0
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (SELECT 1 FROM signature s WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur AND s.date_heure = d.date_planning);

WITH dernier_signe AS (
  SELECT fh.id_fiche, f.date_rdv_time AS date_planning, f.tel,
         fh.id_confirmateur, fh.id_confirmateur_2, fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45) AND fh.id_fiche IS NOT NULL
    AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fh.id_fiche AND fh2.id_etat IN (13, 16, 44, 45))
    AND NOT EXISTS (SELECT 1 FROM fiches_histo fh38 WHERE fh38.id_fiche = fh.id_fiche AND fh38.id_etat = 38 AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation))
)
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur_2, 0.33, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur_2 IS NOT NULL AND d.id_confirmateur_2 > 0
  AND d.id_confirmateur_3 IS NOT NULL AND d.id_confirmateur_3 > 0
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (SELECT 1 FROM signature s WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur_2 AND s.date_heure = d.date_planning);

WITH dernier_signe AS (
  SELECT fh.id_fiche, f.date_rdv_time AS date_planning, f.tel,
         fh.id_confirmateur, fh.id_confirmateur_2, fh.id_confirmateur_3
  FROM fiches_histo fh
  INNER JOIN fiches f ON f.id = fh.id_fiche
  WHERE fh.id_etat IN (13, 16, 44, 45) AND fh.id_fiche IS NOT NULL
    AND fh.id = (SELECT MAX(fh2.id) FROM fiches_histo fh2 WHERE fh2.id_fiche = fh.id_fiche AND fh2.id_etat IN (13, 16, 44, 45))
    AND NOT EXISTS (SELECT 1 FROM fiches_histo fh38 WHERE fh38.id_fiche = fh.id_fiche AND fh38.id_etat = 38 AND fh38.date_creation > COALESCE(fh.date_sign_time, fh.date_creation))
)
INSERT INTO signature (id_fiche, confirmateur, ajoute, date_heure, tel)
SELECT d.id_fiche, d.id_confirmateur_3, 0.33, d.date_planning, d.tel
FROM dernier_signe d
WHERE d.id_confirmateur_3 IS NOT NULL AND d.id_confirmateur_3 > 0
  AND d.id_confirmateur_2 IS NOT NULL AND d.id_confirmateur_2 > 0
  AND d.tel IS NOT NULL AND d.tel != ''
  AND NOT EXISTS (SELECT 1 FROM signature s WHERE s.id_fiche = d.id_fiche AND s.confirmateur = d.id_confirmateur_3 AND s.date_heure = d.date_planning);

SELECT CONCAT('Cas 3 (3 confirmateurs) : ', ROW_COUNT(), ' ligne(s) insérée(s)') AS resultat;

SET SQL_SAFE_UPDATES = 1;

SELECT COUNT(*) AS total_signatures FROM signature;
SELECT 'Script terminé (date planning = date_rdv_time).' AS message;
