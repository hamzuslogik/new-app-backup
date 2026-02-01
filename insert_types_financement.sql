-- =====================================================
-- Insertion des types de financement (ancienne liste)
-- Franfinance, Domo, Sofinco, Projexio, Cetelem
-- Base de données: crm
-- =====================================================

USE `crm`;

-- S'assurer que la table existe (exécuter create_types_financement_table.sql si besoin)

-- INSERT IGNORE évite les doublons si le script est relancé (contrainte UNIQUE sur nom)
INSERT IGNORE INTO `types_financement` (`nom`, `ordre`, `etat`) VALUES
('Franfinance', 1, 1),
('Domo', 2, 1),
('Sofinco', 3, 1),
('Projexio', 4, 1),
('Cetelem', 5, 1);

-- Vérification
SELECT
  id,
  nom,
  ordre,
  etat,
  CASE etat WHEN 1 THEN 'Actif' ELSE 'Inactif' END AS lib_etat
FROM `types_financement`
ORDER BY ordre ASC, nom ASC;
