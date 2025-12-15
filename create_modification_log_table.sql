-- =====================================================
-- Script pour créer la table modification_log
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: modification_log
-- =====================================================
CREATE TABLE IF NOT EXISTS `modification_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `modifier_par` varchar(100) CHARACTER SET utf8 NOT NULL,
  `champs` varchar(100) CHARACTER SET utf8 NOT NULL,
  `valeur` text CHARACTER SET utf8 NOT NULL,
  `Date_Heure` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Old_valeur` text CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_modifier_par` (`modifier_par`),
  KEY `idx_date_heure` (`Date_Heure`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

