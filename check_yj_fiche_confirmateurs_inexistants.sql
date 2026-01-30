-- =============================================================================
-- Liste SANS DUPLICATION des noms de confirmateurs (yj_fiche) qui n'existent
-- pas dans la table utilisateurs (comparaison sur pseudo).
-- Une seule ligne par nom distinct.
-- =============================================================================

USE `crm`;

SELECT
  t.nom_confirmateur,
  SUM(t.nb_fiches) AS nb_fiches_total
FROM (
  SELECT TRIM(y.nom_confirmateur) AS nom_confirmateur, COUNT(*) AS nb_fiches
  FROM yj_fiche y
  LEFT JOIN utilisateurs u ON TRIM(UPPER(u.pseudo)) = TRIM(UPPER(y.nom_confirmateur))
  WHERE TRIM(COALESCE(y.nom_confirmateur, '')) <> '' AND u.id IS NULL
  GROUP BY TRIM(y.nom_confirmateur)
  UNION
  SELECT TRIM(y.nom_confirmateur_2), COUNT(*)
  FROM yj_fiche y
  LEFT JOIN utilisateurs u ON TRIM(UPPER(u.pseudo)) = TRIM(UPPER(y.nom_confirmateur_2))
  WHERE TRIM(COALESCE(y.nom_confirmateur_2, '')) <> '' AND u.id IS NULL
  GROUP BY TRIM(y.nom_confirmateur_2)
  UNION
  SELECT TRIM(y.nom_confirmateur_3), COUNT(*)
  FROM yj_fiche y
  LEFT JOIN utilisateurs u ON TRIM(UPPER(u.pseudo)) = TRIM(UPPER(y.nom_confirmateur_3))
  WHERE TRIM(COALESCE(y.nom_confirmateur_3, '')) <> '' AND u.id IS NULL
  GROUP BY TRIM(y.nom_confirmateur_3)
) t
GROUP BY t.nom_confirmateur
ORDER BY t.nom_confirmateur;
