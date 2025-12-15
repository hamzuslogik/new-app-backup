-- =====================================================
-- Ajouter la clé étrangère entre decalages.id_etat et etat_decalage.id
-- =====================================================

USE `crm`;

-- Vérifier si la contrainte existe déjà
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'La contrainte existe déjà'
    ELSE 'La contrainte n''existe pas'
  END AS status
FROM information_schema.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA = SCHEMA()
  AND TABLE_NAME = 'decalages'
  AND CONSTRAINT_NAME = 'fk_decalages_etat'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- Supprimer la contrainte si elle existe déjà (pour éviter les erreurs lors de la récréation)
-- Note: Cette commande peut générer une erreur si la contrainte n'existe pas, c'est normal
-- On utilise une procédure stockée pour gérer cela proprement
DROP PROCEDURE IF EXISTS drop_fk_if_exists;

DELIMITER $$

CREATE PROCEDURE drop_fk_if_exists()
BEGIN
  DECLARE constraint_exists INT DEFAULT 0;
  
  SELECT COUNT(*) INTO constraint_exists
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = SCHEMA()
    AND TABLE_NAME = 'decalages'
    AND CONSTRAINT_NAME = 'fk_decalages_etat'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY';
  
  IF constraint_exists > 0 THEN
    SET @sql = 'ALTER TABLE `decalages` DROP FOREIGN KEY `fk_decalages_etat`';
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL drop_fk_if_exists();
DROP PROCEDURE drop_fk_if_exists;

-- Ajouter la contrainte de clé étrangère
-- ON DELETE SET NULL : si un état est supprimé, id_etat devient NULL
-- ON UPDATE CASCADE : si l'ID de l'état change, id_etat est mis à jour automatiquement
ALTER TABLE `decalages`
  ADD CONSTRAINT `fk_decalages_etat` 
  FOREIGN KEY (`id_etat`) 
  REFERENCES `etat_decalage` (`id`) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Vérification : Afficher les informations de la contrainte créée
SELECT 
  'Clé étrangère ajoutée avec succès' AS message,
  kcu.CONSTRAINT_NAME,
  kcu.TABLE_NAME,
  kcu.COLUMN_NAME,
  kcu.REFERENCED_TABLE_NAME,
  kcu.REFERENCED_COLUMN_NAME,
  rc.DELETE_RULE,
  rc.UPDATE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc 
  ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME 
  AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE kcu.CONSTRAINT_SCHEMA = SCHEMA()
  AND kcu.TABLE_NAME = 'decalages'
  AND kcu.CONSTRAINT_NAME = 'fk_decalages_etat';

