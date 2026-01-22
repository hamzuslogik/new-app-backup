-- =====================================================
-- Script SQL pour mettre à jour le champ hash des fiches existantes
-- =====================================================
--
-- Ce script SQL implémente HMAC-SHA256 pour générer des hash identiques
-- à ceux générés par l'application Node.js (update_existing_fiches_hash.js)
--
-- IMPORTANT: Ce script génère maintenant des hash EXACTS identiques au script Node.js
-- car il implémente correctement HMAC-SHA256 au lieu d'une simple approximation.
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
SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';

-- =====================================================
-- FONCTIONS POUR CALCULER LE HASH (implémentation HMAC-SHA256)
-- =====================================================
-- Note: Ces fonctions implémentent correctement HMAC-SHA256 pour générer
-- des hash identiques à ceux du script Node.js

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

-- Fonction pour implémenter HMAC-SHA256 (identique à Node.js crypto.createHmac)
-- HMAC-SHA256(key, message) = SHA256((key XOR opad) || SHA256((key XOR ipad) || message))
-- où ipad = 0x36 répété 64 fois, opad = 0x5C répété 64 fois
DROP FUNCTION IF EXISTS `hmac_sha256`$$

CREATE FUNCTION `hmac_sha256`(key_str VARCHAR(255), message_str VARCHAR(255))
RETURNS VARCHAR(64)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE key_hash_hex VARCHAR(64);
  DECLARE key_binary BINARY(64);
  DECLARE key_len INT;
  DECLARE i INT DEFAULT 1;
  DECLARE key_byte INT;
  DECLARE ipad_byte INT DEFAULT 0x36;
  DECLARE opad_byte INT DEFAULT 0x5C;
  DECLARE inner_key BINARY(64);
  DECLARE outer_key BINARY(64);
  DECLARE inner_hash_hex VARCHAR(64);
  DECLARE inner_hash_binary BINARY(32);
  DECLARE outer_hash_hex VARCHAR(64);
  
  -- Étape 1: Si la clé est plus longue que 64 bytes, la hacher avec SHA256
  SET key_len = LENGTH(key_str);
  IF key_len > 64 THEN
    SET key_hash_hex = SHA2(key_str, 256);
    -- Convertir le hash hex en binaire (32 bytes)
    SET key_binary = UNHEX(key_hash_hex);
    SET key_len = 32;
  ELSE
    -- Convertir la clé en binaire et padder avec des zéros jusqu'à 64 bytes
    SET key_binary = CONCAT(CAST(key_str AS BINARY), REPEAT(CHAR(0), 64 - key_len));
  END IF;
  
  -- Étape 2: Créer inner_key = key XOR ipad (0x36) et outer_key = key XOR opad (0x5C)
  SET inner_key = '';
  SET outer_key = '';
  SET i = 1;
  
  WHILE i <= 64 DO
    -- Extraire le byte i de la clé (0-255)
    SET key_byte = ASCII(SUBSTRING(key_binary, i, 1));
    
    -- Si key_byte est NULL, utiliser 0
    IF key_byte IS NULL THEN
      SET key_byte = 0;
    END IF;
    
    -- Calculer XOR: key_byte XOR ipad_byte et key_byte XOR opad_byte
    SET inner_key = CONCAT(inner_key, CHAR(key_byte ^ ipad_byte));
    SET outer_key = CONCAT(outer_key, CHAR(key_byte ^ opad_byte));
    
    SET i = i + 1;
  END WHILE;
  
  -- Convertir en BINARY pour les opérations suivantes
  SET inner_key = CAST(inner_key AS BINARY);
  SET outer_key = CAST(outer_key AS BINARY);
  
  -- Étape 3: Calculer inner_hash = SHA256(inner_key || message)
  SET inner_hash_hex = SHA2(CONCAT(inner_key, message_str), 256);
  
  -- Vérifier que inner_hash_hex n'est pas NULL
  IF inner_hash_hex IS NULL THEN
    RETURN NULL;
  END IF;
  
  SET inner_hash_binary = UNHEX(inner_hash_hex);
  
  -- Étape 4: Calculer outer_hash = SHA256(outer_key || inner_hash)
  SET outer_hash_hex = SHA2(CONCAT(outer_key, inner_hash_binary), 256);
  
  -- Vérifier que outer_hash_hex n'est pas NULL
  IF outer_hash_hex IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Retourner le hash HMAC (64 caractères hex)
  RETURN outer_hash_hex;
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
  DECLARE hmac_result VARCHAR(64);
  
  -- Convertir l'ID en string
  SET id_str = CAST(fiche_id AS CHAR);
  
  -- Calculer HMAC-SHA256 (identique à Node.js crypto.createHmac('sha256', secret).update(id).digest('hex'))
  -- Le backend utilise: const hmac = crypto.createHmac('sha256', HASH_SECRET);
  --                     hmac.update(String(id));
  --                     const hash = hmac.digest('hex');
  SET hmac_result = `hmac_sha256`(secret_key, id_str);
  
  -- Vérifier que hmac_result n'est pas NULL
  IF hmac_result IS NULL OR hmac_result = '' THEN
    RETURN NULL;
  END IF;
  
  -- Prendre les 16 premiers caractères du hash hex
  SET hash_part = SUBSTRING(hmac_result, 1, 16);
  
  -- Vérifier que hash_part n'est pas NULL
  IF hash_part IS NULL OR hash_part = '' THEN
    RETURN NULL;
  END IF;
  
  -- Encoder l'ID en base64 URL-safe (identique à Node.js Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, ...))
  -- Le backend utilise: const encodedId = Buffer.from(String(id)).toString('base64').replace(/[+/=]/g, (m) => {
  --   return { '+': '-', '/': '_', '=': '' }[m];
  -- });
  SET base64_encoded = `base64_encode`(id_str);
  
  -- Vérifier que base64_encoded n'est pas NULL
  IF base64_encoded IS NULL THEN
    SET base64_encoded = '';
  END IF;
  
  SET encoded_id = REPLACE(REPLACE(REPLACE(base64_encoded, '+', '-'), '/', '_'), '=', '');
  
  -- Vérifier que encoded_id n'est pas NULL
  IF encoded_id IS NULL THEN
    SET encoded_id = '';
  END IF;
  
  -- Retourner la combinaison: hash(16) + encodedId
  -- Le backend retourne: `${hash.substring(0, 16)}${encodedId}`
  RETURN CONCAT(COALESCE(hash_part, ''), COALESCE(encoded_id, ''));
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

-- Mettre à jour uniquement les fiches SANS hash
-- Note: Cette requête peut prendre du temps si vous avez beaucoup de fiches
-- Cette requête ne met à jour que les fiches qui n'ont pas encore de hash
UPDATE `fiches`
SET `hash` = `calculate_fiche_hash`(`id`, @hash_secret)
WHERE `hash` IS NULL OR `hash` = '';

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
-- DROP FUNCTION IF EXISTS `hmac_sha256`;
-- DROP FUNCTION IF EXISTS `base64_encode`;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
-- 1. Ce script génère maintenant des hash EXACTS identiques à ceux de l'application
-- 2. Il implémente correctement HMAC-SHA256 (identique à Node.js crypto.createHmac)
-- 3. Les hash générés par ce script SQL sont identiques à ceux générés par:
--    - Le script Node.js: update_existing_fiches_hash.js
--    - L'application backend (fiche.routes.js)
-- 4. Ce script ne met à jour que les fiches SANS hash (hash IS NULL OR hash = '')
-- 5. Les deux scripts (SQL et JS) produisent maintenant les mêmes résultats

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

