-- =====================================================
-- Mise a jour de fiches.id_qualite depuis yj_fiche.nom_qualite
-- =====================================================
--
-- Regle (alignee sur insert_fiches_from_yj.sql) :
--   yj_fiche.id_qualite n'est pas utilise — resolution via nom_qualite
--   -> utilisateurs.pseudo ou login UNIQUEMENT si fonction = 8 (qualite qualification)
--
-- En cas de doublons (plusieurs comptes fonction 8 pour le meme libelle) :
--   1) etat actif (etat > 0)
--   2) plus petit id
--
-- Ne cree PAS d'utilisateurs manquants.
-- Si nom_qualite ne correspond a aucun utilisateur existant -> id_qualite = @id_qualite_defaut (2814).
--
-- Parametres :
--   @id_qualite_defaut = 2814 : utilisateur qualite par defaut si nom_qualite inconnu
--   @mode_complet = 0 : ne met a jour que id_qualite NULL ou 0 (recommande)
--   @mode_complet = 1 : reecrit id_qualite pour toutes les fiches liees a yj_fiche
--
-- =====================================================

USE `crm`;

SET @fonction_qualite = 8;
SET @id_qualite_defaut = 2814;
SET @mode_complet = 0;

SET SQL_SAFE_UPDATES = 0;

-- -----------------------------------------------------
-- 0) Etat avant mise a jour
-- -----------------------------------------------------
SELECT
  COUNT(*) AS nb_fiches_total,
  SUM(CASE WHEN f.id_qualite IS NOT NULL AND f.id_qualite > 0 THEN 1 ELSE 0 END) AS nb_avec_id_qualite,
  SUM(CASE WHEN f.id_qualite IS NULL OR f.id_qualite = 0 THEN 1 ELSE 0 END) AS nb_sans_id_qualite
FROM fiches f
INNER JOIN yj_fiche y ON y.id = f.id;

SELECT
  COUNT(*) AS nb_yj_avec_nom_qualite
FROM yj_fiche y
WHERE NULLIF(TRIM(y.nom_qualite), '') IS NOT NULL;

-- -----------------------------------------------------
-- 1) Table de correspondance nom_qualite -> id utilisateur
-- -----------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_map_nom_qualite;
CREATE TEMPORARY TABLE tmp_map_nom_qualite (
  nom_key VARCHAR(600) NOT NULL,
  nom_qualite VARCHAR(600) NOT NULL,
  id_utilisateur INT NULL,
  PRIMARY KEY (nom_key)
) ENGINE=MEMORY;

INSERT INTO tmp_map_nom_qualite (nom_key, nom_qualite, id_utilisateur)
SELECT
  nom_key,
  nom_qualite,
  COALESCE(id_utilisateur_trouve, @id_qualite_defaut) AS id_utilisateur
FROM (
  SELECT
    UPPER(TRIM(y.nom_qualite)) AS nom_key,
    MIN(TRIM(y.nom_qualite)) AS nom_qualite,
    (
      SELECT u.id
      FROM utilisateurs u
      WHERE u.fonction = @fonction_qualite
        AND (
          TRIM(UPPER(u.pseudo)) = UPPER(TRIM(y.nom_qualite))
          OR TRIM(UPPER(u.login)) = UPPER(TRIM(y.nom_qualite))
        )
      ORDER BY
        CASE WHEN u.etat > 0 OR u.etat IS NULL THEN 0 ELSE 1 END,
        u.id ASC
      LIMIT 1
    ) AS id_utilisateur_trouve
  FROM yj_fiche y
  WHERE NULLIF(TRIM(y.nom_qualite), '') IS NOT NULL
  GROUP BY UPPER(TRIM(y.nom_qualite))
) src;

-- Libelles YJ sans utilisateur : seront affectes a @id_qualite_defaut
SELECT
  m.nom_qualite,
  COUNT(DISTINCT y.id) AS nb_fiches_yj,
  @id_qualite_defaut AS id_qualite_applique
FROM tmp_map_nom_qualite m
INNER JOIN yj_fiche y ON UPPER(TRIM(y.nom_qualite)) = m.nom_key
WHERE NOT EXISTS (
  SELECT 1
  FROM utilisateurs u
  WHERE u.fonction = @fonction_qualite
    AND (
      TRIM(UPPER(u.pseudo)) = m.nom_key
      OR TRIM(UPPER(u.login)) = m.nom_key
    )
)
GROUP BY m.nom_qualite, m.nom_key
ORDER BY nb_fiches_yj DESC, m.nom_qualite;

-- -----------------------------------------------------
-- 2) Mise a jour fiches.id_qualite
-- -----------------------------------------------------
UPDATE fiches f
INNER JOIN yj_fiche y ON y.id = f.id
INNER JOIN tmp_map_nom_qualite m ON m.nom_key = UPPER(TRIM(y.nom_qualite))
SET f.id_qualite = m.id_utilisateur
WHERE (
    @mode_complet = 1
    OR f.id_qualite IS NULL
    OR f.id_qualite = 0
  );

SELECT ROW_COUNT() AS lignes_fiches_mises_a_jour;

-- -----------------------------------------------------
-- 3) Etat apres mise a jour
-- -----------------------------------------------------
SELECT
  COUNT(*) AS nb_fiches_total,
  SUM(CASE WHEN f.id_qualite IS NOT NULL AND f.id_qualite > 0 THEN 1 ELSE 0 END) AS nb_avec_id_qualite,
  SUM(CASE WHEN f.id_qualite IS NULL OR f.id_qualite = 0 THEN 1 ELSE 0 END) AS nb_sans_id_qualite
FROM fiches f
INNER JOIN yj_fiche y ON y.id = f.id;

-- Fiches avec nom_qualite YJ renseigne mais toujours sans id_qualite
SELECT
  f.id,
  TRIM(y.nom_qualite) AS nom_qualite,
  f.id_qualite,
  m.id_utilisateur AS id_utilisateur_trouve
FROM fiches f
INNER JOIN yj_fiche y ON y.id = f.id
LEFT JOIN tmp_map_nom_qualite m ON m.nom_key = UPPER(TRIM(y.nom_qualite))
WHERE NULLIF(TRIM(y.nom_qualite), '') IS NOT NULL
  AND (f.id_qualite IS NULL OR f.id_qualite = 0)
ORDER BY y.nom_qualite, f.id
LIMIT 100;

-- Echantillon de controle
SELECT
  f.id,
  TRIM(y.nom_qualite) AS nom_qualite_yj,
  f.id_qualite,
  u.pseudo AS qualite_pseudo,
  u.fonction AS qualite_fonction
FROM fiches f
INNER JOIN yj_fiche y ON y.id = f.id
LEFT JOIN utilisateurs u ON u.id = f.id_qualite
WHERE NULLIF(TRIM(y.nom_qualite), '') IS NOT NULL
  AND f.id_qualite IS NOT NULL
  AND f.id_qualite > 0
ORDER BY f.id DESC
LIMIT 30;

DROP TEMPORARY TABLE IF EXISTS tmp_map_nom_qualite;
