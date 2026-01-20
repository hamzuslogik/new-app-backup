-- =====================================================
-- Script pour créer la table fournisseurs_sms
-- Base de données: crm
-- =====================================================
--
-- Ce script crée la table fournisseurs_sms si elle n'existe pas
-- Structure basée sur les routes backend (management.routes.js)
--
-- =====================================================

USE `crm`;

-- Créer la table fournisseurs_sms si elle n'existe pas
CREATE TABLE IF NOT EXISTS `fournisseurs_sms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 NOT NULL,
  `login` varchar(255) CHARACTER SET utf8 NOT NULL,
  `api_key` varchar(500) CHARACTER SET utf8 NOT NULL,
  `api_url` varchar(500) CHARACTER SET utf8 NOT NULL,
  `actif` tinyint(1) DEFAULT 1 COMMENT '1=Actif, 0=Inactif',
  `date_creation` datetime DEFAULT NULL,
  `date_modification` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_nom` (`nom`),
  KEY `idx_actif` (`actif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérifier la structure créée
SELECT 
    '=== STRUCTURE DE LA TABLE fournisseurs_sms ===' as info,
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    COLUMN_KEY as cle
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fournisseurs_sms'
ORDER BY ORDINAL_POSITION;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

