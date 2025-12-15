-- =====================================================
-- Script pour créer la table de comptes rendus en attente
-- Les commerciaux peuvent créer des comptes rendus qui seront
-- approuvés/rejetés par un administrateur avant d'être appliqués
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: compte_rendu_pending
-- =====================================================
CREATE TABLE IF NOT EXISTS `compte_rendu_pending` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `id_commercial` int(11) NOT NULL COMMENT 'Commercial qui a créé le compte rendu',
  `id_approbateur` int(11) DEFAULT NULL COMMENT 'Admin qui a approuvé/rejeté',
  `statut` enum('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'pending = en attente, approved = approuvé, rejected = rejeté',
  `id_etat_final` int(11) DEFAULT NULL COMMENT 'État de la fiche',
  `id_sous_etat` int(11) DEFAULT NULL COMMENT 'Sous-état de la fiche',
  `modifications` text DEFAULT NULL COMMENT 'JSON contenant les modifications proposées',
  `commentaire` text DEFAULT NULL COMMENT 'Commentaire du commercial',
  `commentaire_admin` text DEFAULT NULL COMMENT 'Commentaire de l admin lors de l approbation/rejet',
  -- Informations de vente (Phase 3)
  `ph3_installateur` int(11) DEFAULT NULL COMMENT 'Installateur',
  `ph3_pac` varchar(255) DEFAULT NULL COMMENT 'Type de PAC',
  `ph3_puissance` varchar(255) DEFAULT NULL COMMENT 'Puissance',
  `ph3_puissance_pv` varchar(255) DEFAULT NULL COMMENT 'Puissance PV',
  `ph3_rr_model` varchar(255) DEFAULT NULL COMMENT 'Modèle RR',
  `ph3_ballon` varchar(255) DEFAULT NULL COMMENT 'Ballon',
  `ph3_marque_ballon` varchar(255) DEFAULT NULL COMMENT 'Marque du ballon',
  `ph3_alimentation` varchar(255) DEFAULT NULL COMMENT 'Alimentation',
  `ph3_type` varchar(255) DEFAULT NULL COMMENT 'Type',
  `ph3_prix` decimal(10,2) DEFAULT NULL COMMENT 'Prix',
  `ph3_bonus_30` decimal(10,2) DEFAULT NULL COMMENT 'Bonus 30%',
  `ph3_mensualite` decimal(10,2) DEFAULT NULL COMMENT 'Mensualité',
  `ph3_attente` varchar(255) DEFAULT NULL COMMENT 'Attente',
  `nbr_annee_finance` int(11) DEFAULT NULL COMMENT 'Nombre d années de financement',
  `credit_immobilier` varchar(255) DEFAULT NULL COMMENT 'Crédit immobilier',
  `credit_autre` varchar(255) DEFAULT NULL COMMENT 'Autre crédit',
  `date_creation` datetime DEFAULT NULL COMMENT 'Date de création du compte rendu',
  `date_modif` datetime DEFAULT NULL COMMENT 'Date de modification',
  `date_approbation` datetime DEFAULT NULL COMMENT 'Date d approbation/rejet',
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_id_approbateur` (`id_approbateur`),
  KEY `idx_statut` (`statut`),
  KEY `idx_date_creation` (`date_creation`),
  KEY `idx_id_etat_final` (`id_etat_final`),
  KEY `idx_id_sous_etat` (`id_sous_etat`),
  CONSTRAINT `fk_compte_rendu_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compte_rendu_commercial` FOREIGN KEY (`id_commercial`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compte_rendu_approbateur` FOREIGN KEY (`id_approbateur`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index pour améliorer les performances
CREATE INDEX `idx_compte_rendu_statut_creation` ON `compte_rendu_pending` (`statut`, `date_creation`);
CREATE INDEX `idx_compte_rendu_commercial_statut` ON `compte_rendu_pending` (`id_commercial`, `statut`);

-- Vérification
SELECT 'Table compte_rendu_pending créée avec succès' AS message;

