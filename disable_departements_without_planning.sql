-- =====================================================
-- Désactiver les départements sans planning disponible
-- =====================================================
--
-- Met à jour etat = 0 pour les départements qui n'ont aucune ligne
-- dans planning_availablity (aucune semaine/year renseignée).
-- Seuls les départements actuellement actifs (etat > 0) sont modifiés.
--
-- À exécuter sur la base crm.
-- =====================================================

USE `crm`;

-- 1) Aperçu : départements actifs qui n'ont aucun planning
SELECT
  d.id,
  d.departement_code,
  d.departement_nom,
  d.etat AS etat_actuel
FROM departements d
LEFT JOIN (SELECT DISTINCT dep FROM planning_availablity) pa ON d.departement_code = pa.dep
WHERE pa.dep IS NULL
  AND d.etat > 0
ORDER BY d.departement_code;

-- 2) Désactivation (etat = 0)
UPDATE departements d
LEFT JOIN (SELECT DISTINCT dep FROM planning_availablity) pa ON d.departement_code = pa.dep
SET d.etat = 0
WHERE pa.dep IS NULL
  AND d.etat > 0;

-- 3) Résumé
SELECT ROW_COUNT() AS departements_desactives;
