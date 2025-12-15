-- =====================================================
-- Script pour créer les tables de suivi télépro
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: signature
-- =====================================================
CREATE TABLE IF NOT EXISTS `signature` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `confirmateur` int(11) DEFAULT NULL,
  `ajoute` decimal(10,2) DEFAULT NULL,
  `date_heure` datetime DEFAULT NULL,
  `tel` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_confirmateur` (`confirmateur`),
  KEY `idx_date_heure` (`date_heure`),
  KEY `idx_tel` (`tel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: new_repro
-- =====================================================
CREATE TABLE IF NOT EXISTS `new_repro` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_confirmateur` int(11) DEFAULT NULL,
  `new` int(11) DEFAULT 0,
  `repro` int(11) DEFAULT 0,
  `date_modif` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_confirmateur` (`id_confirmateur`),
  KEY `idx_date_modif` (`date_modif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification
SELECT 'Tables signature et new_repro créées avec succès' AS message;

