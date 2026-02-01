-- =====================================================
-- Table types_financement : options de financement à saisir lors de la signature
-- Base de données: crm
-- =====================================================
-- Ces types sont proposés lors de la signature d'une fiche (ex: Prêt 10 ans, Crédit immobilier, Autofinancement).
-- =====================================================

USE `crm`;

CREATE TABLE IF NOT EXISTS `types_financement` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) NOT NULL COMMENT 'Libellé du type de financement',
  `ordre` int(11) DEFAULT 0 COMMENT 'Ordre d''affichage (0 = par défaut)',
  `etat` int(11) DEFAULT 1 COMMENT '1 = actif, 0 = inactif',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exemples (optionnel)
-- INSERT INTO `types_financement` (`nom`, `ordre`, `etat`) VALUES
-- ('Prêt 10 ans', 1, 1),
-- ('Crédit immobilier', 2, 1),
-- ('Autofinancement', 3, 1);
