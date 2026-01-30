-- =============================================================================
-- Vérifier dans yj_fiche les fiches où un confirmateur (1, 2 ou 3) est "BUREAU".
-- Uniquement nom_confirmateur, nom_confirmateur_2, nom_confirmateur_3.
-- =============================================================================

USE `crm`;

-- Nombre de fiches concernées (au moins un confirmateur = BUREAU)
SELECT
  COUNT(*) AS nb_fiches_avec_bureau
FROM yj_fiche
WHERE TRIM(UPPER(nom_confirmateur))   = 'BUREAU'
   OR TRIM(UPPER(nom_confirmateur_2)) = 'BUREAU'
   OR TRIM(UPPER(nom_confirmateur_3)) = 'BUREAU';

-- Détail par colonne confirmateur
SELECT
  'nom_confirmateur'   AS colonne,
  COUNT(*) AS nb_fiches
FROM yj_fiche
WHERE TRIM(UPPER(nom_confirmateur)) = 'BUREAU'
UNION ALL
SELECT 'nom_confirmateur_2', COUNT(*)
FROM yj_fiche
WHERE TRIM(UPPER(nom_confirmateur_2)) = 'BUREAU'
UNION ALL
SELECT 'nom_confirmateur_3', COUNT(*)
FROM yj_fiche
WHERE TRIM(UPPER(nom_confirmateur_3)) = 'BUREAU'
ORDER BY colonne;

-- Liste (échantillon) des fiches avec BUREAU en confirmateur 1, 2 ou 3
SELECT
  y.id,
  y.nom,
  y.prenom,
  y.tel,
  y.nom_confirmateur,
  y.nom_confirmateur_2,
  y.nom_confirmateur_3,
  y.etat_final
FROM yj_fiche y
WHERE TRIM(UPPER(y.nom_confirmateur))   = 'BUREAU'
   OR TRIM(UPPER(y.nom_confirmateur_2)) = 'BUREAU'
   OR TRIM(UPPER(y.nom_confirmateur_3)) = 'BUREAU'
ORDER BY y.id
LIMIT 500;
