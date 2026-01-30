-- =====================================================
-- Détection PAC / PV pour les fiches dont produit IS NULL
-- Base : champs remplis
--   PAC : ph3_pac, ph3_puissance, conf_produit, commentaire, mode_chauffage, surface_chauffee
--   PV  : ph3_puissance_pv, orientation_toiture, conf_orientation_toiture (orientation = PV)
-- PAC = produit 1, PV = produit 2 (référence table produits)
-- =====================================================
--
-- *** NE PAS COPIER-COLLER DANS LA CONSOLE (lignes tronquees = erreurs) ***
--
-- Executer avec :
--   1) Double-clic sur run_detect_produit_pac_pv.bat (modifier MYSQL_USER si besoin)
--   2) Ou en ligne de commande : mysql -u root -p crm < detect_produit_pac_pv_null.sql
--   3) Ou dans mysql : source C:/Users/dell/backup2026/new-app-backup/detect_produit_pac_pv_null.sql
--
-- =====================================================

USE `crm`;

-- ---------------------------------------------------------------------------
-- 0) DIAGNOSTIC : combien de fiches ont produit NULL ou 0 ?
--    Si le résultat est 0, il n'y a aucune fiche à traiter.
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS nb_fiches_produit_vide,
  SUM(CASE WHEN produit IS NULL THEN 1 ELSE 0 END) AS nb_produit_null,
  SUM(CASE WHEN produit = 0 OR produit = '' THEN 1 ELSE 0 END) AS nb_produit_zero
FROM fiches
WHERE (produit IS NULL OR produit = 0 OR produit = '');

-- Exemple de fiches concernées (colonnes utilisées pour la détection)
SELECT id, hash, nom, prenom, produit,
  ph3_pac, ph3_puissance, ph3_puissance_pv,
  mode_chauffage, surface_chauffee,
  orientation_toiture, conf_orientation_toiture,
  conf_produit,
  LEFT(conf_commentaire_produit, 80) AS conf_commentaire_produit_ex,
  LEFT(commentaire, 80) AS commentaire_ex
FROM fiches
WHERE (produit IS NULL OR produit = 0 OR produit = '')
LIMIT 20;

-- ---------------------------------------------------------------------------
-- 1) Vue de détection (SELECT) : fiches avec produit NULL ou 0
--    On ne filtre pas sur ko/active pour ne pas exclure de fiches.
--    Colonnes : id, hash, signes_pac, signes_pv, produit_detecte (1=PAC, 2=PV, NULL=indéterminé)
-- ---------------------------------------------------------------------------

SELECT
  f.id,
  f.hash,
  f.nom,
  f.prenom,
  -- Indicateurs PAC (au moins un champ "PAC" ou mode_chauffage ou surface_chauffee rempli)
  (
    (COALESCE(TRIM(f.ph3_pac), '') != '')
    OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
    OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
    OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
    OR (f.conf_produit = 1 OR f.conf_produit = '1')
    OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
    OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
    OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
  ) AS signes_pac,
  -- Indicateurs PV (au moins un champ "PV" ou orientation rempli ; orientation = PV)
  (
    (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
    OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
    OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
    OR (f.conf_produit = 2 OR f.conf_produit = '2')
    OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
    OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
    OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
  ) AS signes_pv,
  -- Produit détecté : 1 = PAC, 2 = PV, NULL = indéterminé
  CASE
    WHEN (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) AND NOT (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) THEN 1
    WHEN (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) AND NOT (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) THEN 2
    WHEN (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) AND (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) THEN 2
    ELSE NULL
  END AS produit_detecte
FROM fiches f
WHERE (f.produit IS NULL OR f.produit = 0 OR f.produit = '')
ORDER BY f.id;

-- ---------------------------------------------------------------------------
-- 2) Résumé : nombre de fiches (produit vide) par produit détecté
-- ---------------------------------------------------------------------------

SELECT
  CASE produit_detecte
    WHEN 1 THEN 'PAC'
    WHEN 2 THEN 'PV'
    ELSE 'Indéterminé'
  END AS produit_detecte_lib,
  produit_detecte,
  COUNT(*) AS nb_fiches
FROM (
  SELECT
    f.id,
    CASE
      WHEN (
        (COALESCE(TRIM(f.ph3_pac), '') != '')
        OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
        OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
        OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
        OR (f.conf_produit = 1 OR f.conf_produit = '1')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
      ) AND NOT (
        (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
        OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
        OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
        OR (f.conf_produit = 2 OR f.conf_produit = '2')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
      ) THEN 1
      WHEN (
        (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
        OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
        OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
        OR (f.conf_produit = 2 OR f.conf_produit = '2')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
      ) AND NOT (
        (COALESCE(TRIM(f.ph3_pac), '') != '')
        OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
        OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
        OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
        OR (f.conf_produit = 1 OR f.conf_produit = '1')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
      ) THEN 2
      WHEN (
        (COALESCE(TRIM(f.ph3_pac), '') != '')
        OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
        OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
        OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
        OR (f.conf_produit = 1 OR f.conf_produit = '1')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
      ) AND (
        (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
        OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
        OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
        OR (f.conf_produit = 2 OR f.conf_produit = '2')
        OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
        OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
        OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
      ) THEN 2
      ELSE NULL
    END AS produit_detecte
  FROM fiches f
  WHERE (f.produit IS NULL OR f.produit = 0 OR f.produit = '')
) t
GROUP BY produit_detecte
ORDER BY produit_detecte;

-- ---------------------------------------------------------------------------
-- 3) Mise à jour : affecter produit à partir du produit_detecte
--    Utilise une table temporaire pour éviter l'erreur MySQL
--    "You can't specify target table for update in FROM clause".
-- ---------------------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_detect_produit;

-- Colonne aliasée "pd" (court) pour éviter troncature en copier-coller console
CREATE TEMPORARY TABLE tmp_detect_produit AS
SELECT id, pd FROM (
SELECT
  f.id,
  CASE
    WHEN (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) AND NOT (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) THEN 1
    WHEN (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) AND NOT (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) THEN 2
    WHEN (
      (COALESCE(TRIM(f.ph3_pac), '') != '')
      OR (COALESCE(TRIM(f.ph3_puissance), '') != '')
      OR (COALESCE(TRIM(CAST(f.mode_chauffage AS CHAR)), '') NOT IN ('', '0'))
      OR (COALESCE(TRIM(f.surface_chauffee), '') != '')
      OR (f.conf_produit = 1 OR f.conf_produit = '1')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PAC%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PAC%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PAC%')
    ) AND (
      (COALESCE(TRIM(f.ph3_puissance_pv), '') != '')
      OR (COALESCE(TRIM(f.orientation_toiture), '') != '')
      OR (COALESCE(TRIM(f.conf_orientation_toiture), '') != '')
      OR (f.conf_produit = 2 OR f.conf_produit = '2')
      OR (COALESCE(f.conf_produit, '') != '' AND UPPER(CAST(f.conf_produit AS CHAR)) LIKE '%PV%')
      OR (COALESCE(f.conf_commentaire_produit, '') != '' AND UPPER(f.conf_commentaire_produit) LIKE '%PV%')
      OR (COALESCE(f.commentaire, '') != '' AND UPPER(f.commentaire) LIKE '%PV%')
    ) THEN 2
    ELSE NULL
  END AS pd
FROM fiches f
WHERE (f.produit IS NULL OR f.produit = 0 OR f.produit = '')
) x WHERE pd IS NOT NULL;

UPDATE fiches f
JOIN tmp_detect_produit t ON f.id = t.id
SET f.produit = t.pd;

SELECT ROW_COUNT() AS lignes_mises_a_jour;

DROP TEMPORARY TABLE IF EXISTS tmp_detect_produit;
