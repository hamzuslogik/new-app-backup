-- Table des demandes de complétude sur une fiche (Qualité Confirmation)
-- statut : en_attente | traitee | non_traitee

CREATE TABLE IF NOT EXISTS `fiche_completude` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_fiche` INT NOT NULL,
  `motif` VARCHAR(500) NOT NULL COMMENT 'Motif de la demande',
  `completes` TEXT NOT NULL COMMENT 'Détail des complétudes demandées',
  `statut` ENUM('en_attente', 'traitee', 'non_traitee') NOT NULL DEFAULT 'en_attente',
  `id_created_by` INT NOT NULL COMMENT 'Utilisateur créateur (Qualité Confirmation)',
  `id_traite_par` INT NULL COMMENT 'Utilisateur ayant traité la demande',
  `reponse_traitement` TEXT NULL COMMENT 'Commentaire optionnel lors du traitement',
  `date_creation` DATETIME NOT NULL,
  `date_traitement` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fiche_completude_fiche` (`id_fiche`),
  KEY `idx_fiche_completude_statut` (`statut`),
  KEY `idx_fiche_completude_created_by` (`id_created_by`),
  CONSTRAINT `fk_fiche_completude_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fiche_completude_created_by` FOREIGN KEY (`id_created_by`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fiche_completude_traite_par` FOREIGN KEY (`id_traite_par`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration fiche_completude terminee' AS message;
