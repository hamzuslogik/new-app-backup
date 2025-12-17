-- =====================================================
-- Script pour ajouter la permission pour la page KPI Qualification
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page KPI Qualification
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('kpi_qualification_view', 'Voir les KPI qualification', 'Accès à la page KPI Qualification pour visualiser les meilleurs agents et équipes en termes de production (fiches validées)', 'page', 36, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission kpi_qualification_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'kpi_qualification_view';

