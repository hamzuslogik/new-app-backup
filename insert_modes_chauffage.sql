-- =====================================================
-- Script pour insérer les modes de chauffage
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Insérer les modes de chauffage
-- Utilisation de INSERT IGNORE pour éviter les doublons si le script est exécuté plusieurs fois

INSERT IGNORE INTO `mode_chauffage` (`nom`) VALUES
('Gaz'),
('Fuel'),
('PAC'),
('Granulé'),
('Bois'),
('Électricité'),
('Mazout'),
('Pellet');

-- Vérification
SELECT 
    COUNT(*) AS nombre_modes_chauffage,
    GROUP_CONCAT(nom ORDER BY nom SEPARATOR ', ') AS liste_modes
FROM `mode_chauffage`;

-- Afficher tous les modes de chauffage insérés
SELECT 
    id,
    nom,
    'Mode de chauffage' AS description
FROM `mode_chauffage`
WHERE nom IN ('Gaz', 'Fuel', 'PAC', 'Granulé', 'Bois', 'Électricité', 'Mazout', 'Pellet')
ORDER BY nom ASC;

