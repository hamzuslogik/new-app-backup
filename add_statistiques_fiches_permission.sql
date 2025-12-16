-- =====================================================
-- Script pour ajouter la permission pour la page Statistiques Fiches
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Statistiques Fiches
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('statistiques_fiches_view', 'Voir les statistiques fiches', 'Accès à la page Statistiques Fiches pour visualiser les fiches par centre et date (modification/insertion)', 'page', 35, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission statistiques_fiches_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'statistiques_fiches_view';

