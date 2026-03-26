-- =====================================================
-- Mettre a jour id_sous_etat de fiches depuis yj_fiche
-- =====================================================
-- Prerequis:
-- - yj_fiche chargee
-- - sous_etat alimentee
-- - colonne fiches.id_sous_etat existante

USE `crm`;

UPDATE `fiches` f
INNER JOIN `yj_fiche` yf ON yf.`id` = f.`id`
LEFT JOIN `etats` e
  ON TRIM(UPPER(e.`titre`)) = TRIM(UPPER(yf.`etat_final`))
LEFT JOIN `sous_etat` se
  ON se.`id_etat` = e.`id`
 AND TRIM(UPPER(se.`titre`)) = TRIM(UPPER(yf.`sous_etat`))
SET f.`id_sous_etat` = se.`id`
WHERE yf.`sous_etat` IS NOT NULL
  AND TRIM(yf.`sous_etat`) <> '';

-- Optionnel: voir les fiches non mappees
-- SELECT f.id, yf.etat_final, yf.sous_etat
-- FROM fiches f
-- JOIN yj_fiche yf ON yf.id = f.id
-- LEFT JOIN etats e ON TRIM(UPPER(e.titre)) = TRIM(UPPER(yf.etat_final))
-- LEFT JOIN sous_etat se ON se.id_etat = e.id AND TRIM(UPPER(se.titre)) = TRIM(UPPER(yf.sous_etat))
-- WHERE yf.sous_etat IS NOT NULL AND TRIM(yf.sous_etat) <> '' AND se.id IS NULL;

