-- Ajouter un index composite pour améliorer les performances de la vérification des doublons
-- Cet index permet de vérifier rapidement si une demande existe déjà pour un agent, une fiche et une date

USE `crm`;

-- Vérifier si l'index existe déjà
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'L''index existe déjà'
    ELSE 'L''index n''existe pas'
  END AS status
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = SCHEMA()
  AND TABLE_NAME = 'demandes_insertion'
  AND INDEX_NAME = 'idx_agent_fiche_date';

-- Ajouter l'index composite si il n'existe pas
-- Cet index optimise la requête de vérification des doublons
ALTER TABLE `demandes_insertion`
  ADD INDEX `idx_agent_fiche_date` (`id_agent`, `id_fiche_existante`, `date_demande`);

