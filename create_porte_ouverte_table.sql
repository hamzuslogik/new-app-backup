-- =====================================================
-- Création de la table porte_ouverte
-- =====================================================
-- Enregistre les fiches dont le compte rendu a été approuvé
-- avec l'un des états : HHC TECHNIQUE, REFUSER, CLIENT HONORE A SUIVRE, SIGNER
-- (et variantes Signer : SIGNER RETRACTER, SIGNER RETRACTER 2 FOIS, SIGNER PM, SIGNER COMPLET).
-- Une ligne est ajoutée à chaque approbation d'un compte rendu contenant un de ces états.
-- =====================================================

USE `crm`;

CREATE TABLE IF NOT EXISTS `porte_ouverte` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL COMMENT 'Fiche concernée',
  `id_compte_rendu_pending` int(11) NOT NULL COMMENT 'Compte rendu approuvé à l''origine',
  `id_etat_final` int(11) NOT NULL COMMENT 'État appliqué (qualification porte ouverte)',
  `id_commercial` int(11) DEFAULT NULL COMMENT 'Commercial ayant rédigé le compte rendu',
  `id_approbateur` int(11) DEFAULT NULL COMMENT 'Utilisateur ayant approuvé le compte rendu',
  `date_approbation` datetime DEFAULT NULL COMMENT 'Date d''approbation du compte rendu',
  `date_creation` datetime DEFAULT NULL COMMENT 'Date d''insertion dans porte_ouverte',
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_compte_rendu_pending` (`id_compte_rendu_pending`),
  KEY `idx_id_etat_final` (`id_etat_final`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_id_approbateur` (`id_approbateur`),
  KEY `idx_date_approbation` (`date_approbation`),
  KEY `idx_date_creation` (`date_creation`),
  CONSTRAINT `fk_porte_ouverte_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_porte_ouverte_cr` FOREIGN KEY (`id_compte_rendu_pending`) REFERENCES `compte_rendu_pending` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_porte_ouverte_etat` FOREIGN KEY (`id_etat_final`) REFERENCES `etats` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_porte_ouverte_commercial` FOREIGN KEY (`id_commercial`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_porte_ouverte_approbateur` FOREIGN KEY (`id_approbateur`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Fiches avec CR approuvé ayant une qualification porte ouverte (HHC TECHNIQUE, REFUSER, HONORE A SUIVRE, SIGNER)';

SELECT 'Table porte_ouverte créée.' AS message;
