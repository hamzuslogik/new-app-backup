-- =====================================================
-- Script pour ajouter la permission pour la page Production Qualif
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Production Qualif
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('production_qualif_view', 'Voir la production qualification', 'Accès à la page Production Qualif pour visualiser la production par superviseur (BRUT, OK, KO, etc.)', 'page', 32, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission production_qualif_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'production_qualif_view';

