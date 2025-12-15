-- =====================================================
-- Tables pour les templates de permissions et l'historique
-- =====================================================

USE `crm`;

-- Table pour les templates de permissions
CREATE TABLE IF NOT EXISTS `permission_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 NOT NULL,
  `description` text CHARACTER SET utf8,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_created_by` (`created_by`),
  FOREIGN KEY (`created_by`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les permissions d'un template
CREATE TABLE IF NOT EXISTS `permission_template_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_template` int(11) NOT NULL,
  `id_permission` int(11) NOT NULL,
  `autorise` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_template_permission` (`id_template`, `id_permission`),
  KEY `idx_id_template` (`id_template`),
  KEY `idx_id_permission` (`id_permission`),
  FOREIGN KEY (`id_template`) REFERENCES `permission_templates`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_permission`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour l'historique des modifications de permissions
CREATE TABLE IF NOT EXISTS `permission_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fonction` int(11) NOT NULL,
  `id_permission` int(11) NOT NULL,
  `ancien_etat` tinyint(1) DEFAULT NULL COMMENT '0=refusé, 1=autorisé, NULL=non défini',
  `nouveau_etat` tinyint(1) NOT NULL COMMENT '0=refusé, 1=autorisé',
  `modified_by` int(11) DEFAULT NULL,
  `modified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fonction` (`id_fonction`),
  KEY `idx_id_permission` (`id_permission`),
  KEY `idx_modified_by` (`modified_by`),
  KEY `idx_modified_at` (`modified_at`),
  FOREIGN KEY (`id_fonction`) REFERENCES `fonctions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_permission`) REFERENCES `permissions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`modified_by`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

