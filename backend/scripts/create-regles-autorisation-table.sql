-- Règles d'autorisation automatique lors d'une demande d'insertion (doublon téléphone)
USE `crm`;

CREATE TABLE IF NOT EXISTS `regles_autorisation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `libelle` varchar(255) NOT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `id_etat_final` int(11) DEFAULT NULL COMMENT 'NULL = tous les états',
  `date_insert_debut` date DEFAULT NULL,
  `date_insert_fin` date DEFAULT NULL,
  `date_appel_debut` date DEFAULT NULL,
  `date_appel_fin` date DEFAULT NULL,
  `priorite` int(11) NOT NULL DEFAULT 0,
  `date_creation` datetime NOT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_regles_autorisation_actif` (`actif`),
  KEY `idx_regles_autorisation_etat` (`id_etat_final`),
  KEY `idx_regles_autorisation_priorite` (`priorite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `regles_autorisation_centres` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_regle` int(11) NOT NULL,
  `id_centre` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_regle_centre` (`id_regle`, `id_centre`),
  KEY `idx_rac_id_regle` (`id_regle`),
  KEY `idx_rac_id_centre` (`id_centre`),
  CONSTRAINT `fk_rac_regle` FOREIGN KEY (`id_regle`) REFERENCES `regles_autorisation` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Tables regles_autorisation créées' AS message;
