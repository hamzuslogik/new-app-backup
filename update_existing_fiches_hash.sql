-- =====================================================
-- Script SQL pour mettre à jour le champ hash des fiches existantes
-- =====================================================
--
-- IMPORTANT: Ce script utilise une approximation du hash car MySQL ne supporte pas
-- nativement HMAC SHA-256 avec une clé secrète. Pour un hash exact identique à celui
-- généré par l'application Node.js, utilisez le script update_existing_fiches_hash.js
--
-- Ce script SQL utilise SHA2 avec concaténation de l'ID et de la clé secrète,
-- ce qui donne un résultat similaire mais pas identique à HMAC.
--
-- Pour un hash exact, préférez le script Node.js qui utilise exactement la même
-- fonction encodeFicheId que l'application.
--
-- =====================================================

USE `crm`;

-- Définir la clé secrète (doit correspondre à FICHE_HASH_SECRET dans .env)
-- ATTENTION: Changez cette valeur si votre clé secrète est différente
-- 
-- Si FICHE_HASH_SECRET n'est pas défini dans .env, l'application utilise:
-- 'your-secret-key-change-in-production' (valeur par défaut)
--
-- Si vous avez ajouté FICHE_HASH_SECRET dans votre .env, remplacez la valeur ci-dessous
SET @hash_secret = 'your-secret-key-change-in-production';

-- =====================================================
-- FONCTION POUR CALCULER LE HASH (approximation)
-- =====================================================
-- Note: Cette fonction est une approximation car MySQL ne supporte pas HMAC nativement
-- Pour un hash exact, utilisez le script Node.js

DELIMITER $$

-- Fonction helper pour encoder en base64 (compatible MySQL < 8.0)
DROP FUNCTION IF EXISTS `base64_encode`$$

CREATE FUNCTION `base64_encode`(input_str VARCHAR(255))
RETURNS VARCHAR(255)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE base64_chars VARCHAR(64) DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  DECLARE result VARCHAR(255) DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE len INT;
  DECLARE char1, char2, char3 INT;
  DECLARE enc1, enc2, enc3, enc4 INT;
  
  SET len = LENGTH(input_str);
  
  WHILE i <= len DO
    SET char1 = ASCII(SUBSTRING(input_str, i, 1));
    SET char2 = IF(i + 1 <= len, ASCII(SUBSTRING(input_str, i + 1, 1)), 0);
    SET char3 = IF(i + 2 <= len, ASCII(SUBSTRING(input_str, i + 2, 1)), 0);
    
    SET enc1 = char1 >> 2;
    SET enc2 = ((char1 & 3) << 4) | (char2 >> 4);
    SET enc3 = IF(i + 1 <= len, ((char2 & 15) << 2) | (char3 >> 6), 64);
    SET enc4 = IF(i + 2 <= len, char3 & 63, 64);
    
    SET result = CONCAT(result,
      SUBSTRING(base64_chars, enc1 + 1, 1),
      SUBSTRING(base64_chars, enc2 + 1, 1),
      IF(enc3 = 64, '=', SUBSTRING(base64_chars, enc3 + 1, 1)),
      IF(enc4 = 64, '=', SUBSTRING(base64_chars, enc4 + 1, 1))
    );
    
    SET i = i + 3;
  END WHILE;
  
  RETURN result;
END$$

DROP FUNCTION IF EXISTS `calculate_fiche_hash`$$

CREATE FUNCTION `calculate_fiche_hash`(fiche_id INT, secret_key VARCHAR(255))
RETURNS VARCHAR(255)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE hash_part VARCHAR(16);
  DECLARE encoded_id VARCHAR(255);
  DECLARE id_str VARCHAR(20);
  DECLARE base64_encoded VARCHAR(255);
  
  -- Convertir l'ID en string
  SET id_str = CAST(fiche_id AS CHAR);
  
  -- Calculer le hash SHA-256 (approximation de HMAC)
  -- Note: Ce n'est pas exactement HMAC, mais proche
  -- HMAC utilise: H(K XOR opad, H(K XOR ipad, text))
  -- Ici on utilise: SHA2(CONCAT(secret, id, secret), 256) comme approximation
  SET hash_part = SUBSTRING(SHA2(CONCAT(secret_key, id_str, secret_key), 256), 1, 16);
  
  -- Encoder l'ID en base64 et convertir en URL-safe
  SET base64_encoded = `base64_encode`(id_str);
  SET encoded_id = REPLACE(REPLACE(REPLACE(base64_encoded, '+', '-'), '/', '_'), '=', '');
  
  -- Retourner la combinaison
  RETURN CONCAT(hash_part, encoded_id);
END$$

DELIMITER ;

-- =====================================================
-- MISE À JOUR DES FICHES SANS HASH
-- =====================================================

-- Vérifier combien de fiches n'ont pas de hash
SELECT 
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Mettre à jour TOUTES les fiches (y compris celles qui ont déjà un hash)
-- Note: Cette requête peut prendre du temps si vous avez beaucoup de fiches
-- ATTENTION: Cette requête va remplacer TOUS les hash existants par de nouveaux hash
-- basés sur le HASH_SECRET défini ci-dessus (@hash_secret)
UPDATE `fiches`
SET `hash` = `calculate_fiche_hash`(`id`, @hash_secret);

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Vérifier le résultat
SELECT 
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Afficher quelques exemples de hash générés
SELECT 
  id,
  hash,
  LENGTH(hash) as hash_length
FROM `fiches`
WHERE `hash` IS NOT NULL
ORDER BY `id` DESC
LIMIT 10;

-- =====================================================
-- NETTOYAGE: SUPPRIMER LES FONCTIONS
-- =====================================================
-- Décommentez ces lignes si vous voulez supprimer les fonctions après usage
-- DROP FUNCTION IF EXISTS `calculate_fiche_hash`;
-- DROP FUNCTION IF EXISTS `base64_encode`;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
-- 1. Ce script génère un hash APPROXIMATIF, pas identique à celui de l'application
-- 2. La différence vient de l'utilisation de SHA2 au lieu de HMAC SHA-256
-- 3. Pour un hash EXACT, utilisez le script Node.js: update_existing_fiches_hash.js
-- 4. Si vous utilisez ce script SQL, les nouveaux hash générés par l'application
--    seront différents de ceux générés par ce script
-- 5. Recommandation: Utilisez le script Node.js pour garantir la cohérence

-- =====================================================
-- ALTERNATIVE: MISE À JOUR PAR LOTS (pour grandes tables)
-- =====================================================
-- Si vous avez beaucoup de fiches, vous pouvez exécuter cette requête plusieurs fois
-- en limitant le nombre de lignes à chaque fois:

/*
SET @batch_size = 1000;
SET @last_id = 0;

UPDATE `fiches`
SET `hash` = `calculate_fiche_hash`(`id`, @hash_secret)
WHERE (`hash` IS NULL OR `hash` = '')
  AND `id` > @last_id
ORDER BY `id` ASC
LIMIT @batch_size;

-- Répétez cette requête jusqu'à ce que toutes les fiches soient mises à jour
-- Mettez à jour @last_id avec le dernier ID traité après chaque exécution
*/

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

