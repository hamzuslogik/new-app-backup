-- =====================================================
-- Script : mettre à jour fiches.hash à partir de id_hash
-- Base de données: crm
-- =====================================================
--
-- Met à jour la colonne fiches.hash avec les valeurs de id_hash
-- pour toutes les fiches dont l'id existe dans id_hash.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- MISE À JOUR fiches.hash DEPUIS id_hash
-- =====================================================

UPDATE `fiches` f
INNER JOIN `id_hash` h ON f.`id` = h.`id`
SET f.`hash` = h.`hash`;

-- =====================================================
-- VÉRIFICATION (optionnel)
-- =====================================================
-- Nombre de lignes dans id_hash et fiches dont hash est en sync

SELECT
  (SELECT COUNT(*) FROM `id_hash`) AS lignes_id_hash,
  (SELECT COUNT(*) FROM `fiches` f INNER JOIN `id_hash` h ON f.id = h.id WHERE (f.hash <=> h.hash) OR (f.hash IS NULL AND h.hash IS NULL)) AS fiches_en_sync;

SELECT 'fiches.hash mis à jour depuis id_hash.' AS message;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
