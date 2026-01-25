-- =====================================================
-- Script pour ajouter la permission pour la page Statistiques V2
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Statistiques V2
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('statistiques_v2_view', 'Voir les Statistiques V2', 'Accès à la page Statistiques V2 pour visualiser les statistiques avancées : Top 10 agents, temps de traitement, taux de rejet, performance temporelle, heatmap, comparaisons et export de données', 'page', 38, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission statistiques_v2_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'statistiques_v2_view';

