-- =====================================================
-- Script pour ajouter la permission pour la page Assistance IA
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Ajouter la permission pour la page Assistance IA
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('assistance_ia_view', 'Voir l\'assistance IA', 'Accès à la page Assistance IA pour analyser les rendez-vous, détecter les problèmes et générer des rapports intelligents', 'page', 36, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Vérification
SELECT 'Permission assistance_ia_view ajoutée avec succès' AS message;
SELECT * FROM permissions WHERE code = 'assistance_ia_view';

