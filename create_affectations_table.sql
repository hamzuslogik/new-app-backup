-- =====================================================
-- Script pour créer la table affectations si elle n'existe pas
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: affectations
-- =====================================================
CREATE TABLE IF NOT EXISTS `affectations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `date_modif` bigint(20) DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_commercial` (`id_commercial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification
SELECT 'Table affectations créée avec succès' AS message;

