-- Historique des fiches passées en KO (motif statique, indépendant de l'état final 54)
USE `crm`;

CREATE TABLE IF NOT EXISTS `fiches_ko` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `motif_ko` varchar(255) NOT NULL,
  `commentaire_qualite` text DEFAULT NULL,
  `commentaire_complement` text DEFAULT NULL,
  `id_qualite` int(11) DEFAULT NULL,
  `id_agent` int(11) DEFAULT NULL,
  `id_centre` int(11) DEFAULT NULL,
  `id_etat_final_avant` int(11) DEFAULT NULL,
  `id_etat_final_apres` int(11) DEFAULT NULL,
  `source` varchar(64) DEFAULT NULL,
  `date_ko` datetime NOT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fiches_ko_id_fiche` (`id_fiche`),
  KEY `idx_fiches_ko_motif` (`motif_ko`),
  KEY `idx_fiches_ko_date_ko` (`date_ko`),
  KEY `idx_fiches_ko_id_agent` (`id_agent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table fiches_ko créée' AS message;
