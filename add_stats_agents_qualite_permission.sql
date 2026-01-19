-- =====================================================
-- Script pour ajouter la permission pour la page Stats Agents Qualité
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Stats Agents Qualité
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('stats_agents_qualite_view', 'Voir les statistiques agents qualité', 'Accès à la page Stats Agents Qualité pour visualiser les statistiques par agent qualité : nombre d\'audits, fiches avec commentaires, répartition par état', 'page', 38, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission stats_agents_qualite_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'stats_agents_qualite_view';

