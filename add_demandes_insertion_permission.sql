-- =====================================================
-- Script pour ajouter la permission pour la page Demandes d'Insertion
-- Base de données: crm
-- =====================================================

USE `crm`;

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
SELECT 'Permission demandes_insertion_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'demandes_insertion_view';

