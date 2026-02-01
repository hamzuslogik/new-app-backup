-- =====================================================
-- Types de financement : création table + insertion liste
-- Franfinance, Domo, Sofinco, Projexio, Cetelem
-- Base de données: crm
-- Exécuter ce script une fois pour créer la table et insérer les données.
-- =====================================================

USE `crm`;

-- 1. Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS `types_financement` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 NOT NULL,
  `ordre` int(11) DEFAULT 0,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_nom` (`nom`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Insérer la liste (sans doublon si relancé)
INSERT IGNORE INTO `types_financement` (`nom`, `ordre`, `etat`) VALUES
('Franfinance', 1, 1),
('Domo', 2, 1),
('Sofinco', 3, 1),
('Projexio', 4, 1),
('Cetelem', 5, 1);

-- 3. Vérification
SELECT
  id,
  nom,
  ordre,
  CASE etat WHEN 1 THEN 'Actif' ELSE 'Inactif' END AS etat
FROM `types_financement`
ORDER BY ordre ASC, nom ASC;
