-- =====================================================
-- Script pour ajouter la permission pour la page KPIs
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page KPIs
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('kpis_view', 'Voir les KPIs', 'Accès à la page KPIs pour visualiser les indicateurs de performance : Top 3 agents, Top 3 équipes, Taux de conversion et Évolution', 'page', 37, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission kpis_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'kpis_view';

