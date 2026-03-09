-- =====================================================
-- Script : fixer fiches.id_centre à partir de yj_fiche.nom_centre
-- Base de données: crm
-- =====================================================
--
-- Met à jour fiches.id_centre en utilisant le nom du centre (yj_fiche.nom_centre)
-- et non pas id_centre de yj_fiche. Recherche l'id correspondant dans la table
-- centres via centres.titre = yj_fiche.nom_centre (comparaison insensible à la casse).
--
-- Prérequis : tables fiches, yj_fiche, centres.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- MISE À JOUR fiches.id_centre DEPUIS yj_fiche.nom_centre
-- =====================================================

UPDATE `fiches` f
INNER JOIN `yj_fiche` yj ON f.`id` = yj.`id`
INNER JOIN `centres` c ON TRIM(UPPER(c.`titre`)) = TRIM(UPPER(yj.`nom_centre`))
SET f.`id_centre` = c.`id`
WHERE NULLIF(TRIM(yj.`nom_centre`), '') IS NOT NULL;

-- =====================================================
-- VÉRIFICATION (optionnel)
-- =====================================================

SELECT
  (SELECT COUNT(*) FROM `yj_fiche` WHERE NULLIF(TRIM(`nom_centre`), '') IS NOT NULL) AS yj_fiche_avec_nom_centre,
  (SELECT COUNT(*) FROM `fiches` f
   INNER JOIN `yj_fiche` yj ON f.id = yj.id
   INNER JOIN `centres` c ON TRIM(UPPER(c.titre)) = TRIM(UPPER(yj.nom_centre))) AS fiches_liees_via_nom_centre;

SELECT 'fiches.id_centre mis à jour depuis yj_fiche.nom_centre.' AS message;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
