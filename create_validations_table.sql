-- =====================================================
-- Script pour créer la table validations si elle n'existe pas
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: validations
-- =====================================================
CREATE TABLE IF NOT EXISTS `validations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `date_valider` bigint(20) DEFAULT NULL,
  `date_valider_time` datetime DEFAULT NULL,
  `valider` int(11) DEFAULT NULL,
  `id_user` int(11) DEFAULT NULL,
  `conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_user` (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification
SELECT 'Table validations créée avec succès' AS message;

