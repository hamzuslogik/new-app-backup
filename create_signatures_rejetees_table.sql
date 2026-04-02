-- Table de stockage des signatures rejetées (non comptabilisées)
USE `crm`;

CREATE TABLE IF NOT EXISTS `signatures_rejetees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `signature_id` int(11) NOT NULL,
  `id_fiche` int(11) DEFAULT NULL,
  `confirmateur` int(11) DEFAULT NULL,
  `ajoute` decimal(10,2) DEFAULT NULL,
  `date_heure` datetime DEFAULT NULL,
  `tel` varchar(255) DEFAULT NULL,
  `motif` text NOT NULL,
  `id_rejete_par` int(11) NOT NULL,
  `date_rejet` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_signature_id` (`signature_id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_confirmateur` (`confirmateur`),
  KEY `idx_date_rejet` (`date_rejet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

