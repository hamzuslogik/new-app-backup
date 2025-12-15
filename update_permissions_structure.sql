-- =====================================================
-- Script pour mettre à jour les permissions selon la nouvelle structure
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Mise à jour de la description de suivi_agents_view pour indiquer qu'elle couvre les deux pages
UPDATE `permissions` 
SET 
  `nom` = 'Voir le suivi des agents',
  `description` = 'Accès aux pages Suivi des Agents et Suivi Agents Qualif pour visualiser la production des agents',
  `ordre` = 29
WHERE `code` = 'suivi_agents_view';

-- S'assurer que controle_qualite_view existe et est correctement configurée
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('controle_qualite_view', 'Voir le contrôle qualité', 'Accès à la page Contrôle Qualité pour auditer les fiches BRUT créées par les agents', 'page', 30, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- S'assurer que statistiques_rdv_view existe et est correctement configurée
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`, `etat`) VALUES
('statistiques_rdv_view', 'Voir les statistiques RDV', 'Accès à la page Statistiques RDV pour visualiser les statistiques des rendez-vous', 'page', 31, 1)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Supprimer la permission suivi_agents_qualif_view si elle existe (remplacée par suivi_agents_view)
-- Note: On ne supprime pas pour éviter de perdre les associations existantes, mais on peut la désactiver
UPDATE `permissions` 
SET `etat` = 0, `description` = 'DÉPRÉCIÉE - Utiliser suivi_agents_view à la place'
WHERE `code` = 'suivi_agents_qualif_view';

-- Vérification
SELECT 'Permissions mises à jour avec succès' AS message;
SELECT * FROM permissions 
WHERE code IN ('suivi_agents_view', 'controle_qualite_view', 'statistiques_rdv_view', 'suivi_agents_qualif_view') 
ORDER BY ordre;

