-- =====================================================
-- Script pour ajouter les permissions manquantes pour les pages
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Permissions pour les nouvelles pages
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('suivi_agents_qualif_view', 'Voir le suivi agents qualification', 'Accès à la page Suivi Agents Qualif pour visualiser la production des agents qualification', 'page', 28, 1),
('suivi_agents_view', 'Voir le suivi des agents', 'Accès aux pages Suivi des Agents et Suivi Agents Qualif pour visualiser la production des agents', 'page', 29, 1),
('controle_qualite_view', 'Voir le contrôle qualité', 'Accès à la page Contrôle Qualité pour auditer les fiches BRUT créées par les agents', 'page', 30, 1),
('statistiques_rdv_view', 'Voir les statistiques RDV', 'Accès à la page Statistiques RDV pour visualiser les statistiques des rendez-vous', 'page', 31, 1),
('production_qualif_view', 'Voir la production qualification', 'Accès à la page Production Qualif pour visualiser la production par superviseur (BRUT, OK, KO, etc.)', 'page', 32, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Corriger la catégorie de fiches_detail pour qu'elle soit dans "page" au lieu de "action"
UPDATE `permissions` 
SET `categorie` = 'page', `ordre` = 3
WHERE `code` = 'fiches_detail' AND `categorie` != 'page';

-- Vérification
SELECT 'Permissions des pages ajoutées avec succès' AS message;
SELECT * FROM permissions WHERE code IN ('suivi_agents_qualif_view', 'suivi_agents_view', 'controle_qualite_view', 'statistiques_rdv_view', 'production_qualif_view', 'fiches_detail') ORDER BY ordre;

