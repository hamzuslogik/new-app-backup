USE `crm`;

-- Table pour stocker les demandes d'insertion de fiches en double
CREATE TABLE IF NOT EXISTS `demandes_insertion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_agent` int(11) NOT NULL COMMENT 'ID de l''agent qui a fait la demande',
  `id_fiche_existante` int(11) NOT NULL COMMENT 'ID de la fiche existante dans la base',
  `donnees_fiche` text COMMENT 'Données JSON de la fiche à insérer (pour référence)',
  `date_demande` datetime DEFAULT NULL COMMENT 'Date de la demande',
  `statut` enum('EN_ATTENTE','APPROUVEE','REJETEE') DEFAULT 'EN_ATTENTE' COMMENT 'Statut de la demande',
  `date_traitement` datetime DEFAULT NULL COMMENT 'Date de traitement (approbation ou rejet)',
  `id_traitant` int(11) DEFAULT NULL COMMENT 'ID de l''utilisateur qui a traité la demande',
  `commentaire` text COMMENT 'Commentaire du traitement',
  PRIMARY KEY (`id`),
  KEY `idx_agent` (`id_agent`),
  KEY `idx_fiche_existante` (`id_fiche_existante`),
  KEY `idx_statut` (`statut`),
  KEY `idx_date_demande` (`date_demande`),
  CONSTRAINT `fk_di_agent` FOREIGN KEY (`id_agent`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_di_fiche` FOREIGN KEY (`id_fiche_existante`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_di_traitant` FOREIGN KEY (`id_traitant`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Table pour gérer les demandes d''insertion de fiches en double';

