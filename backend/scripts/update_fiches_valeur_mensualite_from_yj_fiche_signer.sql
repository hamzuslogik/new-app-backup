-- =====================================================
-- Source : yj_fiche  →  Cible : fiches
-- Copier yj_fiche.valeur_mensualite → fiches.valeur_mensualite (SIGNER)
-- Liaison : yj_fiche.id = fiches.id
--
-- États SIGNER (yj_fiche.etat_final ou fiches.id_etat_final) :
--   SIGNER (13), SIGNER RETRACTER (16), SIGNER RETRACTER 2 FOIS (38),
--   SIGNER PM (44), SIGNER COMPLET (45)
--
-- Par défaut : ne met à jour que fiches.valeur_mensualite NULL ou 0.
-- Pour forcer l'écrasement : SET @force_overwrite = 1;
-- =====================================================

USE `crm`;

SET @force_overwrite = 0;

-- Aperçu avant mise à jour
SELECT '--- Aperçu fiches SIGNER éligibles (source yj_fiche) ---' AS info;

SELECT
  f.id,
  f.nom,
  f.prenom,
  f.id_etat_final,
  yj_fiche.etat_final AS yj_etat_final,
  yj_fiche.valeur_mensualite AS yj_valeur_mensualite,
  f.valeur_mensualite AS fiche_valeur_mensualite_actuelle,
  CASE
    WHEN NULLIF(TRIM(yj_fiche.valeur_mensualite), '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
      THEN CAST(TRIM(yj_fiche.valeur_mensualite) AS DECIMAL(10, 2))
    ELSE NULL
  END AS valeur_mensualite_cible
FROM fiches f
INNER JOIN yj_fiche ON yj_fiche.id = f.id
WHERE (
    UPPER(TRIM(yj_fiche.etat_final)) IN (
      'SIGNER',
      'SIGNER RETRACTER',
      'SIGNER RETRACTER 2 FOIS',
      'SIGNER PM',
      'SIGNER COMPLET'
    )
    OR f.id_etat_final IN (13, 16, 38, 44, 45)
  )
  AND NULLIF(TRIM(yj_fiche.valeur_mensualite), '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
  AND (
    @force_overwrite = 1
    OR f.valeur_mensualite IS NULL
    OR f.valeur_mensualite = 0
  )
ORDER BY f.id
LIMIT 200;

SELECT '--- Nombre de fiches SIGNER à mettre à jour ---' AS info;

SELECT COUNT(*) AS nb_fiches_a_mettre_a_jour
FROM fiches f
INNER JOIN yj_fiche ON yj_fiche.id = f.id
WHERE (
    UPPER(TRIM(yj_fiche.etat_final)) IN (
      'SIGNER',
      'SIGNER RETRACTER',
      'SIGNER RETRACTER 2 FOIS',
      'SIGNER PM',
      'SIGNER COMPLET'
    )
    OR f.id_etat_final IN (13, 16, 38, 44, 45)
  )
  AND NULLIF(TRIM(yj_fiche.valeur_mensualite), '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
  AND (
    @force_overwrite = 1
    OR f.valeur_mensualite IS NULL
    OR f.valeur_mensualite = 0
  );

-- Mise à jour depuis yj_fiche
UPDATE fiches f
INNER JOIN yj_fiche ON yj_fiche.id = f.id
SET f.valeur_mensualite = CAST(TRIM(yj_fiche.valeur_mensualite) AS DECIMAL(10, 2))
WHERE (
    UPPER(TRIM(yj_fiche.etat_final)) IN (
      'SIGNER',
      'SIGNER RETRACTER',
      'SIGNER RETRACTER 2 FOIS',
      'SIGNER PM',
      'SIGNER COMPLET'
    )
    OR f.id_etat_final IN (13, 16, 38, 44, 45)
  )
  AND NULLIF(TRIM(yj_fiche.valeur_mensualite), '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
  AND (
    @force_overwrite = 1
    OR f.valeur_mensualite IS NULL
    OR f.valeur_mensualite = 0
  );

SELECT ROW_COUNT() AS nb_lignes_mises_a_jour;

-- Contrôle après mise à jour
SELECT '--- Échantillon après mise à jour ---' AS info;

SELECT
  f.id,
  f.id_etat_final,
  yj_fiche.etat_final AS yj_etat_final,
  yj_fiche.valeur_mensualite AS yj_valeur_mensualite,
  f.valeur_mensualite AS fiche_valeur_mensualite
FROM fiches f
INNER JOIN yj_fiche ON yj_fiche.id = f.id
WHERE (
    UPPER(TRIM(yj_fiche.etat_final)) IN (
      'SIGNER',
      'SIGNER RETRACTER',
      'SIGNER RETRACTER 2 FOIS',
      'SIGNER PM',
      'SIGNER COMPLET'
    )
    OR f.id_etat_final IN (13, 16, 38, 44, 45)
  )
  AND f.valeur_mensualite IS NOT NULL
  AND f.valeur_mensualite > 0
ORDER BY f.id DESC
LIMIT 50;

SELECT 'Terminé : yj_fiche.valeur_mensualite → fiches.valeur_mensualite (SIGNER).' AS message;
