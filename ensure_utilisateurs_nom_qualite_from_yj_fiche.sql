-- =====================================================
-- Rapport : nom_qualite YJ sans agent qualite qualification (fonction 8)
-- =====================================================
--
-- NE CREE PLUS d'utilisateurs automatiquement.
-- Pour remplir fiches.id_qualite, utiliser :
--   update_fiches_id_qualite_from_yj_fiche.sql
-- (id_qualite = 2814 par defaut si nom_qualite inconnu)
--
-- =====================================================

USE `crm`;

SET @id_qualite_defaut = 2814;
SET @fonction_qualite = 8;

-- Libelles distincts sans compte qualite qualification (fonction 8)
SELECT
  MIN(TRIM(yj.nom_qualite)) AS nom_qualite,
  COUNT(*) AS nb_fiches_yj,
  @id_qualite_defaut AS id_qualite_utilise_par_migration
FROM yj_fiche yj
WHERE TRIM(IFNULL(yj.nom_qualite, '')) != ''
  AND NOT EXISTS (
    SELECT 1
    FROM utilisateurs u
    WHERE u.fonction = @fonction_qualite
      AND (
        TRIM(UPPER(u.pseudo)) = TRIM(UPPER(yj.nom_qualite))
        OR TRIM(UPPER(u.login)) = TRIM(UPPER(yj.nom_qualite))
      )
  )
GROUP BY UPPER(TRIM(yj.nom_qualite))
ORDER BY nb_fiches_yj DESC, nom_qualite;
