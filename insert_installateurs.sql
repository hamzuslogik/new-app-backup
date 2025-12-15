-- =====================================================
-- Script pour insérer les installateurs
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Insérer les installateurs avec leurs IDs et états spécifiques
-- Utilisation de INSERT ... ON DUPLICATE KEY UPDATE pour mettre à jour si l'ID existe déjà

INSERT INTO `installateurs` (`id`, `nom`, `etat`) VALUES
(5, 'LTE', 0),
(11, 'ANDD', 0),
(29, 'GE', 0),
(9, 'LEH', 1),
(12, 'AIS', 0),
(13, 'LME', 1),
(14, 'GLOBAL BISMUTH', 0),
(15, 'ENGIE GREEN', 0),
(16, 'AEG', 0),
(17, 'EAG', 0),
(18, 'EAEG', 0),
(30, 'CMI', 1),
(20, 'CEL', 0),
(21, 'GROUPE RENOVATION', 0),
(22, 'TFE', 0),
(23, 'ANT', 0),
(24, 'ACBAT', 1),
(25, 'PE', 0),
(31, 'MS RENOVES', 1),
(27, 'BATI', 1),
(28, 'CERTI', 1),
(32, 'MHG', 1)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `etat` = VALUES(`etat`);

-- Vérification
SELECT 
    COUNT(*) AS nombre_installateurs,
    SUM(CASE WHEN etat = 1 THEN 1 ELSE 0 END) AS installateurs_actifs,
    SUM(CASE WHEN etat = 0 THEN 1 ELSE 0 END) AS installateurs_inactifs
FROM `installateurs`;

-- Afficher tous les installateurs insérés
SELECT 
    id,
    nom,
    etat,
    CASE WHEN etat = 1 THEN 'Actif' ELSE 'Inactif' END AS statut
FROM `installateurs`
WHERE id IN (5, 11, 29, 9, 12, 13, 14, 15, 16, 17, 18, 30, 20, 21, 22, 23, 24, 25, 31, 27, 28, 32)
ORDER BY id ASC;

