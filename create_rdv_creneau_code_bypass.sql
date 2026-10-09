-- =====================================================
-- Table: rdv_creneau_code_bypass
-- Enregistre les utilisateurs (confirmateurs, RE, RP, BO…)
-- qui ont validé le code « à retaper » et placé un RDV
-- sur un créneau fermé / blindé / en surplus.
-- Compatible MariaDB 5.5+
-- =====================================================

CREATE TABLE IF NOT EXISTS `rdv_creneau_code_bypass` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL COMMENT 'Fiche sur laquelle le RDV a été placé',
  `id_utilisateur` int(11) NOT NULL COMMENT 'Utilisateur ayant retapé le code',
  `id_fonction` int(11) DEFAULT NULL COMMENT 'Fonction au moment du bypass (6=confirmateur)',
  `date_rdv` datetime NOT NULL COMMENT 'Date/heure du RDV placé',
  `dep` varchar(5) DEFAULT NULL COMMENT 'Département du créneau',
  `slot_hour` varchar(8) DEFAULT NULL COMMENT 'Créneau planning (ex: 09:00:00)',
  `week` int(11) DEFAULT NULL COMMENT 'Semaine ISO',
  `year` int(11) DEFAULT NULL COMMENT 'Année ISO',
  `is_ferme_politique` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Créneau fermé par politique département',
  `is_ferme_db` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Créneau fermé en planning_availablity',
  `is_surplus` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Créneau blindé / surplus de RDV',
  `is_zero_dispo` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Disponibilité à 0',
  `motif` varchar(100) DEFAULT NULL COMMENT 'Motifs concaténés (ferme_politique,surplus,...)',
  `date_creation` datetime NOT NULL COMMENT 'Date/heure d''enregistrement du bypass',
  PRIMARY KEY (`id`),
  KEY `idx_rdv_bypass_fiche` (`id_fiche`),
  KEY `idx_rdv_bypass_utilisateur` (`id_utilisateur`),
  KEY `idx_rdv_bypass_fonction` (`id_fonction`),
  KEY `idx_rdv_bypass_date_creation` (`date_creation`),
  KEY `idx_rdv_bypass_date_rdv` (`date_rdv`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table rdv_creneau_code_bypass créée (ou déjà existante)' AS message;
