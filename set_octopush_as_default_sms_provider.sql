-- =====================================================
-- Script pour définir Octopush comme fournisseur SMS par défaut
-- Base de données: crm
-- IMPORTANT: Exécutez d'abord add_actif_column_to_fournisseurs_sms.sql si la colonne 'actif' n'existe pas
-- =====================================================

USE `crm`;

-- Ajouter la colonne 'actif' si elle n'existe pas (pour compatibilité MariaDB)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_schema = DATABASE() 
  AND table_name = 'fournisseurs_sms' 
  AND column_name = 'actif'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE `fournisseurs_sms` ADD COLUMN `actif` TINYINT(1) DEFAULT 1 COMMENT ''1 = actif, 0 = inactif''',
  'SELECT ''Colonne actif existe déjà'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier les fournisseurs existants
SELECT 'Fournisseurs SMS actuels:' AS info;
SELECT id, nom, actif, api_url, 
       COALESCE(login, auth_email, 'NON DÉFINI') AS login,
       CASE 
         WHEN api_key IS NOT NULL THEN CONCAT(LEFT(api_key, 5), '...', RIGHT(api_key, 5))
         ELSE 'NON DÉFINI'
       END AS api_key_preview
FROM fournisseurs_sms
ORDER BY actif DESC, id ASC;

-- Supprimer les anciens fournisseurs Octopush s'ils existent (pour éviter les doublons)
DELETE FROM fournisseurs_sms 
WHERE nom LIKE '%octopush%' OR nom LIKE '%Octopush%' OR api_url LIKE '%octopush%';

-- Créer Octopush comme premier fournisseur (sera sélectionné par défaut)
-- Note: date_creation est optionnel, on l'omet si la colonne n'existe pas
INSERT INTO fournisseurs_sms (nom, login, auth_email, api_key, api_url, actif)
VALUES (
  'Octopush',
  'pro_c52@sub-accounts.com',
  'pro_c52@sub-accounts.com',
  'GtXgcqrakYQJnvLZPs5upHR0CjNxeyOh',
  'https://api.octopush.com/v1/public/sms-campaign/send',
  1
);

-- Désactiver tous les autres fournisseurs
UPDATE fournisseurs_sms 
SET actif = 0 
WHERE (nom NOT LIKE '%octopush%' AND nom NOT LIKE '%Octopush%' AND api_url NOT LIKE '%octopush%')
AND actif = 1;

-- Activer Octopush
UPDATE fournisseurs_sms 
SET actif = 1 
WHERE nom LIKE '%octopush%' OR nom LIKE '%Octopush%' OR api_url LIKE '%octopush%'
LIMIT 1;

-- Vérification finale
SELECT '✅ Fournisseur SMS par défaut (Octopush):' AS info;
SELECT id, nom, actif, api_url, 
       COALESCE(login, auth_email, 'NON DÉFINI') AS login,
       CASE 
         WHEN api_key IS NOT NULL THEN CONCAT(LEFT(api_key, 5), '...', RIGHT(api_key, 5))
         ELSE 'NON DÉFINI'
       END AS api_key_preview
FROM fournisseurs_sms
WHERE actif = 1
ORDER BY id ASC
LIMIT 1;

-- Afficher le statut
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ ATTENTION: Aucun fournisseur SMS actif trouvé!'
    ELSE CONCAT('✅ Fournisseur SMS actif: ', GROUP_CONCAT(nom SEPARATOR ', '), ' (ID: ', GROUP_CONCAT(id SEPARATOR ', '), ')')
  END AS status
FROM fournisseurs_sms
WHERE actif = 1;

