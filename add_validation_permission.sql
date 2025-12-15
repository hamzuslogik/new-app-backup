-- =====================================================
-- Script pour ajouter la permission pour la page Validation
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Validation
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('validation_view', 'Voir la validation', 'Accès à la page Validation pour visualiser les RDV validés et non validés', 'page', 33, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission validation_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'validation_view';

