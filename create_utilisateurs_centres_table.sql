-- =====================================================
-- Table de liaison pour permettre plusieurs centres par utilisateur
-- Spécifiquement pour les utilisateurs de fonction 9
-- =====================================================

USE `crm`;

-- Créer la table de liaison utilisateurs_centres
CREATE TABLE IF NOT EXISTS `utilisateurs_centres` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_utilisateur` int(11) NOT NULL,
  `id_centre` int(11) NOT NULL,
  `date_creation` datetime DEFAULT NULL COMMENT 'Date de création de la relation',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_centre` (`id_utilisateur`, `id_centre`),
  KEY `idx_utilisateur` (`id_utilisateur`),
  KEY `idx_centre` (`id_centre`),
  CONSTRAINT `fk_uc_utilisateur` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uc_centre` FOREIGN KEY (`id_centre`) REFERENCES `centres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commentaire pour documenter l'utilisation
ALTER TABLE `utilisateurs_centres` 
  COMMENT = 'Table de liaison pour permettre plusieurs centres par utilisateur (principalement pour fonction 9)';

