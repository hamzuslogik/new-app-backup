-- =====================================================
-- Script pour ajouter la colonne 'actif' à la table fournisseurs_sms
-- Base de données: crm
-- Compatible avec MariaDB (sans IF NOT EXISTS)
-- =====================================================

USE `crm`;

-- Vérifier si la colonne 'actif' existe déjà
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_schema = DATABASE() 
  AND table_name = 'fournisseurs_sms' 
  AND column_name = 'actif'
);

-- Afficher le statut
SELECT 
  CASE 
    WHEN @column_exists > 0 THEN 'La colonne actif existe déjà'
    ELSE 'La colonne actif n''existe pas, elle sera créée'
  END AS status;

-- Ajouter la colonne 'actif' seulement si elle n'existe pas
SET @sql = IF(@column_exists = 0,
  'ALTER TABLE `fournisseurs_sms` ADD COLUMN `actif` TINYINT(1) DEFAULT 1 COMMENT ''1 = actif, 0 = inactif''',
  'SELECT ''Colonne actif existe déjà, pas besoin de l''ajouter'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mettre tous les fournisseurs existants comme actifs par défaut (si la colonne vient d'être créée)
UPDATE `fournisseurs_sms` 
SET `actif` = 1 
WHERE `actif` IS NULL;

-- Vérification
SELECT 'Colonne actif ajoutée avec succès' AS message;
SELECT id, nom, actif, api_url 
FROM fournisseurs_sms 
ORDER BY id ASC;

