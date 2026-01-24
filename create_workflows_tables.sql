-- =====================================================
-- Script pour créer les tables de workflows
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: workflows
-- =====================================================
CREATE TABLE IF NOT EXISTS `workflows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 NOT NULL,
  `description` text CHARACTER SET utf8,
  `actif` tinyint(1) DEFAULT 1,
  `priorite` int(11) DEFAULT 0 COMMENT 'Ordre d''exécution (plus petit = prioritaire)',
  `date_creation` datetime DEFAULT NULL,
  `date_modif` datetime DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_actif` (`actif`),
  KEY `idx_priorite` (`priorite`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: workflow_triggers
-- =====================================================
CREATE TABLE IF NOT EXISTS `workflow_triggers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `type` varchar(50) CHARACTER SET utf8 NOT NULL COMMENT 'fiche_created, fiche_updated, etat_changed, rdv_created, rdv_validated, compte_rendu_created, compte_rendu_approved, scheduled',
  `config` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Configuration specifique (champ pour fiche_updated, etat pour etat_changed, cron pour scheduled, etc.)',
  `conditions` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Conditions a verifier avant declenchement',
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`),
  KEY `idx_type` (`type`),
  CONSTRAINT `fk_trigger_workflow` FOREIGN KEY (`id_workflow`) REFERENCES `workflows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: workflow_actions
-- =====================================================
CREATE TABLE IF NOT EXISTS `workflow_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `ordre` int(11) NOT NULL DEFAULT 0 COMMENT 'Ordre d''exécution',
  `type` varchar(50) CHARACTER SET utf8 NOT NULL COMMENT 'notification, sms, email, update_field, change_etat, webhook, delay',
  `config` text CHARACTER SET utf8 NOT NULL COMMENT 'Configuration de l''action',
  `conditions` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Conditions pour executer cette action',
  `delay_seconds` int(11) DEFAULT 0 COMMENT 'Délai en secondes avant exécution',
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`),
  KEY `idx_ordre` (`ordre`),
  CONSTRAINT `fk_action_workflow` FOREIGN KEY (`id_workflow`) REFERENCES `workflows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: workflow_executions
-- =====================================================
CREATE TABLE IF NOT EXISTS `workflow_executions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `id_fiche` int(11) DEFAULT NULL,
  `id_user` int(11) DEFAULT NULL,
  `trigger_type` varchar(50) CHARACTER SET utf8 DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8 DEFAULT 'pending' COMMENT 'pending, running, completed, failed, cancelled',
  `trigger_data` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Donnees du declencheur',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `error_message` text CHARACTER SET utf8,
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`),
  KEY `idx_fiche` (`id_fiche`),
  KEY `idx_status` (`status`),
  KEY `idx_started_at` (`started_at`),
  CONSTRAINT `fk_execution_workflow` FOREIGN KEY (`id_workflow`) REFERENCES `workflows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: workflow_action_results
-- =====================================================
CREATE TABLE IF NOT EXISTS `workflow_action_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_execution` int(11) NOT NULL,
  `id_action` int(11) NOT NULL,
  `status` varchar(20) CHARACTER SET utf8 DEFAULT 'pending' COMMENT 'pending, running, completed, failed, skipped',
  `result_data` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Resultat de l''action',
  `error_message` text CHARACTER SET utf8,
  `executed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_execution` (`id_execution`),
  KEY `idx_action` (`id_action`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_result_execution` FOREIGN KEY (`id_execution`) REFERENCES `workflow_executions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_result_action` FOREIGN KEY (`id_action`) REFERENCES `workflow_actions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

