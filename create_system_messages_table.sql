-- =====================================================
-- Script pour créer la table des messages système
-- Base de données: crm
-- =====================================================
-- 
-- Cette table permet de stocker les messages système qui seront
-- affichés aux utilisateurs lors de leur connexion
--
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: system_messages
-- =====================================================
CREATE TABLE IF NOT EXISTS `system_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Titre du message',
  `message` text CHARACTER SET utf8 NOT NULL COMMENT 'Contenu du message',
  `type` varchar(50) CHARACTER SET utf8 DEFAULT 'info' COMMENT 'Type: info, warning, success, error',
  `priorite` int(11) DEFAULT 1 COMMENT 'Priorité: 1=normal, 2=important, 3=urgent',
  `date_debut` datetime DEFAULT NULL COMMENT 'Date de début d''affichage',
  `date_fin` datetime DEFAULT NULL COMMENT 'Date de fin d''affichage',
  `actif` tinyint(1) DEFAULT 1 COMMENT '1=actif, 0=inactif',
  `afficher_une_seule_fois` tinyint(1) DEFAULT 0 COMMENT '1=afficher une seule fois par utilisateur, 0=toujours afficher',
  `cibles_fonctions` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'IDs des fonctions ciblées (JSON array ou NULL pour tous)',
  `cibles_centres` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'IDs des centres ciblés (JSON array ou NULL pour tous)',
  `cibles_utilisateurs` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'IDs des utilisateurs ciblés (JSON array ou NULL pour tous)',
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `date_modification` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `id_createur` int(11) DEFAULT NULL COMMENT 'ID de l''utilisateur qui a créé le message',
  PRIMARY KEY (`id`),
  KEY `idx_actif` (`actif`),
  KEY `idx_date_debut` (`date_debut`),
  KEY `idx_date_fin` (`date_fin`),
  KEY `idx_type` (`type`),
  KEY `idx_priorite` (`priorite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: system_messages_lus
-- Table pour suivre quels utilisateurs ont déjà vu quels messages
-- (si afficher_une_seule_fois = 1)
-- =====================================================
CREATE TABLE IF NOT EXISTS `system_messages_lus` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_message` int(11) NOT NULL COMMENT 'ID du message',
  `id_utilisateur` int(11) NOT NULL COMMENT 'ID de l''utilisateur',
  `date_lecture` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_utilisateur` (`id_message`, `id_utilisateur`),
  KEY `idx_id_message` (`id_message`),
  KEY `idx_id_utilisateur` (`id_utilisateur`),
  CONSTRAINT `fk_sml_message` FOREIGN KEY (`id_message`) REFERENCES `system_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sml_utilisateur` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Insertion d'un message exemple (optionnel)
-- =====================================================
-- INSERT INTO `system_messages` (`titre`, `message`, `type`, `priorite`, `actif`, `afficher_une_seule_fois`) VALUES
-- ('Bienvenue', 'Bienvenue sur la plateforme CRM. N''hésitez pas à consulter l''aide si vous avez des questions.', 'info', 1, 1, 0);

-- =====================================================
-- Vérification
-- =====================================================
SELECT 'Tables des messages système créées avec succès' AS message;
SELECT * FROM system_messages LIMIT 1;
