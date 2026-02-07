-- =====================================================
-- Création de la table confirmations
-- =====================================================
-- Stocke les confirmations (RDV) par fiche et date de planning,
-- pour pouvoir interroger les RDV passés même après changement d'état de la fiche.
-- Alimentée par update_confirmations_table.sql (fiches_histo id_etat=7 + fiches id_etat_final=7).
-- =====================================================

USE `crm`;

CREATE TABLE IF NOT EXISTS `confirmations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `date_planning` datetime NOT NULL COMMENT 'Date/heure du RDV (date_rdv_time au moment de la confirmation)',
  `id_commercial` int(11) DEFAULT NULL,
  `id_commercial_2` int(11) DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL COMMENT 'Date de l''enregistrement historique ou de mise à jour',
  `source` varchar(20) DEFAULT NULL COMMENT 'fiches_histo ou fiches',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fiche_date` (`id_fiche`, `date_planning`),
  KEY `idx_date_planning` (`date_planning`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_id_fiche` (`id_fiche`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table confirmations créée (ou déjà existante).' AS message;
