-- =====================================================
-- Script de migration : yj_centre -> centres
-- =====================================================
--
-- Prérequis : la table yj_centre doit exister dans la BDD
--   (exécuter yj_centre.sql ou importer les données)
--
-- Structure :
--   yj_centre  : id, titre, etat, proprietaire
--   centres    : id, titre, etat
--
-- Les IDs sont préservés pour maintenir les références
-- (fiches.id_centre, utilisateurs.centre, etc.)
--
-- Utilisation : mysql -u user -p crm < migrate_yj_centre_to_centres.sql
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- Vérifier que yj_centre existe
-- =====================================================

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'yj_centre') > 0
    THEN 'Table yj_centre trouvée'
    ELSE 'ERREUR: Table yj_centre introuvable'
  END AS etape_1;

-- =====================================================
-- Créer la table centres si elle n'existe pas
-- =====================================================

CREATE TABLE IF NOT EXISTS `centres` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Migrer les centres (INSERT avec mise à jour si existe)
-- Tous les centres sont migrés, y compris etat = 0 (inactifs)
-- =====================================================

INSERT INTO `centres` (`id`, `titre`, `etat`)
SELECT 
  yj.`id`,
  TRIM(SUBSTRING(IFNULL(yj.`titre`, ''), 1, 255)),
  COALESCE(yj.`etat`, 1)
FROM `yj_centre` yj
WHERE yj.`id` IS NOT NULL
  AND TRIM(yj.`titre`) != ''
ON DUPLICATE KEY UPDATE
  `titre` = VALUES(`titre`),
  `etat` = VALUES(`etat`);

-- =====================================================
-- Statistiques
-- =====================================================

SELECT 
  (SELECT COUNT(*) FROM `yj_centre`) AS source_count,
  (SELECT COUNT(*) FROM `centres`) AS cible_count,
  (SELECT COUNT(*) FROM `yj_centre` yj 
   INNER JOIN `centres` c ON yj.id = c.id) AS migres_count;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- Fin de la migration
-- =====================================================
