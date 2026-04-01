-- =====================================================
-- Mise a jour de fiches.id_qualite depuis yj_fiche
-- (apres migration initiale sans resolution nom_qualite -> utilisateurs)
-- =====================================================
--
-- Regle (identique a insert_fiches_from_yj.sql) :
--   yj_fiche.id_qualite non utilise — uniquement nom_qualite -> utilisateurs.pseudo
--
-- Prerequis : tables `fiches`, `yj_fiche`, `utilisateurs` dans la meme base.
-- Si seul nom_qualite est renseigne dans yj_fiche, executer d'abord :
--   ensure_utilisateurs_nom_qualite_from_yj_fiche.sql
-- Adapter USE ci-dessous si besoin.
--
-- Deux modes : executer UNE des sections (1) ou (2).
-- =====================================================

USE `crm`;

-- (1) MODE SECURISE : uniquement les fiches ou id_qualite est NULL ou 0
--     et nom_qualite permet de resoudre un utilisateur.
UPDATE `fiches` f
INNER JOIN `yj_fiche` y ON y.`id` = f.`id`
SET f.`id_qualite` = (
  SELECT u.`id`
  FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(y.`nom_qualite`))
  LIMIT 1
)
WHERE (f.`id_qualite` IS NULL OR f.`id_qualite` = 0)
  AND NULLIF(TRIM(y.`nom_qualite`), '') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `utilisateurs` u2
    WHERE TRIM(UPPER(u2.`pseudo`)) = TRIM(UPPER(y.`nom_qualite`))
  );

-- Decommenter pour voir le nombre de lignes affectees (apres execution) :
-- SELECT ROW_COUNT() AS lignes_mises_a_jour;

-- =====================================================
-- (2) MODE REALIGNEMENT COMPLET (optionnel, plus risque)
--     Reecrit fiches.id_qualite pour toutes les fiches dont l'id existe dans yj_fiche,
--     selon la meme regle COALESCE. A utiliser si des corrections manuelles dans fiches
--     doivent etre ecrasees par la source yj_fiche.
-- =====================================================
/*
UPDATE `fiches` f
INNER JOIN `yj_fiche` y ON y.`id` = f.`id`
SET f.`id_qualite` = (
  SELECT u.`id`
  FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(y.`nom_qualite`))
  LIMIT 1
)
WHERE NULLIF(TRIM(y.`nom_qualite`), '') IS NOT NULL;
*/

-- =====================================================
-- Verification rapide (exemples)
-- =====================================================
/*
SELECT f.`id`, f.`id_qualite` AS id_qualite_fiche, y.`nom_qualite`
FROM `fiches` f
INNER JOIN `yj_fiche` y ON y.`id` = f.`id`
WHERE y.`nom_qualite` IS NOT NULL AND TRIM(y.`nom_qualite`) != ''
LIMIT 20;
*/
