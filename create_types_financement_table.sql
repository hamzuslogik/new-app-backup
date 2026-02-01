-- =====================================================
-- Table types_financement (types de financement à la signature)
-- Base de données: crm
-- =====================================================

USE `crm`;

CREATE TABLE IF NOT EXISTS `types_financement` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 NOT NULL,
  `ordre` int(11) DEFAULT 0,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_nom` (`nom`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
