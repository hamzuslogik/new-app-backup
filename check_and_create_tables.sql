-- =====================================================
-- Script de vérification et création des tables requises
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- VÉRIFICATION ET CRÉATION DE LA TABLE user_activity
-- (Pour le suivi des utilisateurs en ligne)
-- =====================================================
CREATE TABLE IF NOT EXISTS `user_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `last_activity` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user` (`user_id`),
  KEY `idx_last_activity` (`last_activity`),
  CONSTRAINT `fk_user_activity_user` FOREIGN KEY (`user_id`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VÉRIFICATION ET CRÉATION DE LA TABLE chats
-- (Pour les messages instantanés)
-- =====================================================
CREATE TABLE IF NOT EXISTS `chats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `expediteur` int(11) DEFAULT NULL,
  `destination` int(11) DEFAULT NULL,
  `message` text CHARACTER SET utf8 DEFAULT NULL,
  `lu` int(11) DEFAULT 0,
  `date_modif` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expediteur` (`expediteur`),
  KEY `idx_destination` (`destination`),
  KEY `idx_lu` (`lu`),
  KEY `idx_date_modif` (`date_modif`),
  CONSTRAINT `fk_chats_expediteur` FOREIGN KEY (`expediteur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chats_destination` FOREIGN KEY (`destination`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VÉRIFICATION DES TABLES PRINCIPALES
-- =====================================================

-- Vérifier l'existence des tables principales
SELECT 
  'utilisateurs' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'utilisateurs'

UNION ALL

SELECT 
  'fonctions' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'fonctions'

UNION ALL

SELECT 
  'centres' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'centres'

UNION ALL

SELECT 
  'fiches' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'fiches'

UNION ALL

SELECT 
  'etats' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'etats'

UNION ALL

SELECT 
  'chats' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'chats'

UNION ALL

SELECT 
  'user_activity' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'user_activity'

UNION ALL

SELECT 
  'permissions' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'permissions'

UNION ALL

SELECT 
  'fonction_permissions' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'fonction_permissions'

UNION ALL

SELECT 
  'compte_rendu' as table_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = SCHEMA() AND table_name = 'compte_rendu';

-- =====================================================
-- VÉRIFICATION DES COLONNES IMPORTANTES
-- =====================================================

-- Vérifier les colonnes de la table chats
SELECT 
  'chats' as table_name,
  column_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns
WHERE table_schema = SCHEMA() 
  AND table_name = 'chats'
  AND column_name IN ('id', 'expediteur', 'destination', 'message', 'lu', 'date_modif')
GROUP BY column_name

UNION ALL

-- Vérifier les colonnes de la table user_activity
SELECT 
  'user_activity' as table_name,
  column_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns
WHERE table_schema = SCHEMA() 
  AND table_name = 'user_activity'
  AND column_name IN ('id', 'user_id', 'last_activity')
GROUP BY column_name;

-- =====================================================
-- CRÉATION DES TABLES MANQUANTES (si nécessaire)
-- =====================================================

-- Table user_activity (déjà créée en haut, mais on vérifie)
CREATE TABLE IF NOT EXISTS `user_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `last_activity` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user` (`user_id`),
  KEY `idx_last_activity` (`last_activity`),
  CONSTRAINT `fk_user_activity_user` FOREIGN KEY (`user_id`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table permissions (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8 NOT NULL COMMENT 'Code unique de la permission',
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Nom affiché de la permission',
  `description` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Description de la permission',
  `categorie` varchar(100) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Catégorie (page, action, fonctionnalite)',
  `ordre` int(11) DEFAULT 0 COMMENT 'Ordre d''affichage',
  `etat` int(11) DEFAULT 1 COMMENT '1: actif, 0: inactif',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_categorie` (`categorie`),
  KEY `idx_etat` (`etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table fonction_permissions (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS `fonction_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fonction` int(11) NOT NULL COMMENT 'ID de la fonction',
  `id_permission` int(11) NOT NULL COMMENT 'ID de la permission',
  `autorise` tinyint(1) DEFAULT 1 COMMENT '1: autorisé, 0: refusé',
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `date_modif` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fonction_permission` (`id_fonction`, `id_permission`),
  KEY `idx_id_fonction` (`id_fonction`),
  KEY `idx_id_permission` (`id_permission`),
  CONSTRAINT `fk_fp_fonction` FOREIGN KEY (`id_fonction`) REFERENCES `fonctions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fp_permission` FOREIGN KEY (`id_permission`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table compte_rendu (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS `compte_rendu` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `date_visite` datetime DEFAULT NULL,
  `date_modif` datetime DEFAULT NULL,
  `etat` int(11) DEFAULT 0,
  `compte_rendu` text CHARACTER SET utf8 DEFAULT NULL,
  `etat_fiche` int(11) DEFAULT NULL,
  `sous_etat` int(11) DEFAULT 0,
  `rappel` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_etat_fiche` (`etat_fiche`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- MESSAGE DE FIN
-- =====================================================
SELECT 'Vérification et création des tables terminée' as message;

