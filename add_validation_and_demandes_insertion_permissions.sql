-- =====================================================
-- Script pour ajouter les permissions pour les pages Validation et Demandes d'Insertion
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

-- Ajouter la permission pour la page Demandes d'Insertion
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('demandes_insertion_view', 'Voir les demandes d\'insertion', 'Accès à la page Demandes d\'Insertion pour visualiser et traiter les demandes d\'insertion de fiches', 'page', 34, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permissions validation_view et demandes_insertion_view ajoutées avec succès' AS message;
SELECT * FROM permissions WHERE code IN ('validation_view', 'demandes_insertion_view') ORDER BY ordre;

