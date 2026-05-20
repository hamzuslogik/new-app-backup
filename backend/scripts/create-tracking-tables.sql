-- Tables tracking RDV (session backoffice) + historique des modifications
USE `crm`;

CREATE TABLE IF NOT EXISTS `tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `id_compte_rendu` int(11) DEFAULT NULL COMMENT 'Compte rendu lié (création depuis page CR)',
  `date_rdv` datetime DEFAULT NULL COMMENT 'Date RDV de la fiche au moment du tracking',
  `date_creation` datetime NOT NULL,
  `date_modif` datetime DEFAULT NULL,
  `id_user` int(11) NOT NULL COMMENT 'Utilisateur ayant créé / dernière modification',
  `rappel_client` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=non, 1=oui',
  `commentaire_client` text DEFAULT NULL,
  `constat` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tracking_compte_rendu` (`id_compte_rendu`),
  KEY `idx_tracking_fiche` (`id_fiche`),
  KEY `idx_tracking_date_rdv` (`date_rdv`),
  KEY `idx_tracking_date_creation` (`date_creation`),
  KEY `idx_tracking_user` (`id_user`),
  CONSTRAINT `fk_tracking_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tracking_compte_rendu` FOREIGN KEY (`id_compte_rendu`) REFERENCES `compte_rendu_pending` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tracking_user` FOREIGN KEY (`id_user`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Suivi backoffice des RDV (depuis compte rendu)';

CREATE TABLE IF NOT EXISTS `tracking_histo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_tracking` int(11) NOT NULL,
  `action` enum('create','update') NOT NULL,
  `date_histo` datetime NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_fiche` int(11) NOT NULL,
  `id_compte_rendu` int(11) DEFAULT NULL,
  `date_rdv` datetime DEFAULT NULL,
  `rappel_client` tinyint(1) NOT NULL DEFAULT 0,
  `commentaire_client` text DEFAULT NULL,
  `constat` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tracking_histo_tracking` (`id_tracking`),
  KEY `idx_tracking_histo_date` (`date_histo`),
  CONSTRAINT `fk_tracking_histo_tracking` FOREIGN KEY (`id_tracking`) REFERENCES `tracking` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tracking_histo_user` FOREIGN KEY (`id_user`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historique des créations / modifications tracking';

SELECT 'Tables tracking et tracking_histo créées' AS message;
