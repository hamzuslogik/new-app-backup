-- =====================================================
-- Script pour ajouter la permission spécifique pour Import en Masse
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission import_masse_view
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('import_masse_view', 'Voir l\'import en masse', 'Accès à la page Import en Masse pour importer des fiches en masse', 'page', 32, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission import_masse_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'import_masse_view';

