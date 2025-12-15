-- =====================================================
-- Script pour insérer les types de contrat
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Insérer les types de contrat
-- Utilisation de INSERT IGNORE pour éviter les doublons si le script est exécuté plusieurs fois

INSERT IGNORE INTO `type_contrat` (`nom`) VALUES
('CDI'),
('Titulaire'),
('CDD'),
('Chômage'),
('Femme au foyer'),
('Intérimaire'),
('Intermittent de spectacle'),
('Retraite'),
('Pré-retraite');

-- Vérification
SELECT 
    COUNT(*) AS nombre_types_contrat,
    GROUP_CONCAT(nom ORDER BY nom SEPARATOR ', ') AS liste_types
FROM `type_contrat`;

-- Afficher tous les types de contrat insérés
SELECT 
    id,
    nom,
    'Type de contrat' AS description
FROM `type_contrat`
WHERE nom IN ('CDI', 'Titulaire', 'CDD', 'Chômage', 'Femme au foyer', 'Intérimaire', 'Intermittent de spectacle', 'Retraite', 'Pré-retraite')
ORDER BY nom ASC;

