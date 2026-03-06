-- =====================================================
-- Script : créer la table id_hash (id = fiches.id)
-- Base de données: crm
-- =====================================================
--
-- Crée la table id_hash avec id référençant fiches.id (même valeur).
-- Contrainte FK : id_hash.id doit exister dans fiches.
-- Elle sert à stocker des paires (id, hash) pour remplir fiches.hash par la suite, par exemple :
--   UPDATE fiches f INNER JOIN id_hash h ON f.id = h.id SET f.hash = h.hash;
--
-- =====================================================

USE `crm`;

-- =====================================================
-- CRÉATION DE LA TABLE id_hash (id = fiches.id)
-- =====================================================

CREATE TABLE IF NOT EXISTS `id_hash` (
  `id` int(11) NOT NULL COMMENT 'Même id que fiches.id (FK vers fiches)',
  `hash` varchar(255) DEFAULT NULL COMMENT 'Hash à appliquer à fiches.hash par la suite',
  PRIMARY KEY (`id`),
  KEY `idx_hash` (`hash`(191)),
  CONSTRAINT `fk_id_hash_fiches` FOREIGN KEY (`id`) REFERENCES `fiches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Table id_hash : id = fiches.id, pour remplir fiches.hash par la suite';

-- =====================================================
-- INSERTION INITIALE (optionnel) depuis fiches
-- =====================================================
-- Pour pré-remplir id_hash à partir des hash actuels de fiches.
-- Ensuite vous pouvez modifier id_hash et utiliser cette table pour mettre à jour fiches.hash.

INSERT INTO `id_hash` (`id`, `hash`)
SELECT `id`, NULLIF(TRIM(`hash`), '') as `hash`
FROM `fiches`
ON DUPLICATE KEY UPDATE `hash` = VALUES(`hash`);

-- =====================================================
-- VÉRIFICATION
-- =====================================================

SELECT
  (SELECT COUNT(*) FROM `fiches`) as total_fiches,
  (SELECT COUNT(*) FROM `id_hash`) as total_id_hash;

SELECT 'Table id_hash créée (id = fiches.id). Utilisez-la pour remplir fiches.hash par la suite.' AS message;

-- =====================================================
-- EXEMPLE : remplir fiches.hash à partir de id_hash
-- =====================================================
-- Décommentez et exécutez quand vous voulez appliquer les hash :
--
-- UPDATE fiches f
-- INNER JOIN id_hash h ON f.id = h.id
-- SET f.hash = h.hash
-- WHERE h.hash IS NOT NULL AND h.hash != '';

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
