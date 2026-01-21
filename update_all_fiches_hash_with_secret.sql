-- =====================================================
-- Script SQL pour VIDER et RÉGÉNÉRER tous les hash avec le HASH_SECRET actuel
-- =====================================================
--
-- ⚠️ ATTENTION IMPORTANTE ⚠️
-- Ce script SQL utilise une APPROXIMATION du hash car MySQL/MariaDB ne supporte pas
-- nativement HMAC SHA-256. Le hash généré NE SERA PAS IDENTIQUE à celui généré
-- par le backend Node.js.
--
-- POUR UN HASH EXACT, UTILISEZ LE SCRIPT NODE.JS :
--   node update_all_fiches_hash_with_current_secret.js
--
-- Ce script Node.js utilise exactement la même fonction encodeFicheId que le backend
-- et générera des hash identiques à ceux vus dans l'URL.
--
-- Ce script SQL :
-- 1. Vide tous les hash existants
-- 2. Régénère tous les hash avec le HASH_SECRET défini ci-dessous (approximation)
--
-- IMPORTANT: Modifiez la valeur de @hash_secret à la ligne 45 pour correspondre
-- à votre FICHE_HASH_SECRET dans le fichier .env
--
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1: VIDER TOUS LES HASH
-- =====================================================

-- Afficher le nombre de fiches avant
SELECT 
  'AVANT' as etape,
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Vider tous les hash
UPDATE `fiches`
SET `hash` = NULL
WHERE `hash` IS NOT NULL;

SELECT '✅ Tous les hash ont été vidés' as message;

-- =====================================================
-- ÉTAPE 2: DÉFINIR LE HASH_SECRET
-- =====================================================

-- ⚠️ ATTENTION: MODIFIEZ CETTE LIGNE avec votre HASH_SECRET actuel
-- Pour trouver votre HASH_SECRET, vérifiez le fichier .env à la racine du projet
-- ou la variable d'environnement FICHE_HASH_SECRET
SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';

-- Afficher le HASH_SECRET utilisé (masqué pour sécurité)
SELECT 
  CONCAT(
    SUBSTRING(@hash_secret, 1, 6), 
    '...', 
    SUBSTRING(@hash_secret, LENGTH(@hash_secret) - 3)
  ) as hash_secret_utilise,
  LENGTH(@hash_secret) as longueur_secret;

-- =====================================================
-- ÉTAPE 3: CRÉER LES FONCTIONS NÉCESSAIRES
-- =====================================================

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
  
  -- ⚠️ ATTENTION: Cette approximation n'est PAS identique à HMAC-SHA256
  -- Le backend Node.js utilise: crypto.createHmac('sha256', secret).update(id).digest('hex')
  -- Ce qui est DIFFÉRENT de: SHA2(CONCAT(secret, id, secret), 256)
  -- 
  -- HMAC utilise: H(K XOR opad, H(K XOR ipad, text))
  -- Cette approximation utilise: SHA2(CONCAT(secret, id, secret), 256)
  -- 
  -- Pour un hash exact, utilisez le script Node.js: update_all_fiches_hash_with_current_secret.js
  SET hash_part = SUBSTRING(SHA2(CONCAT(secret_key, id_str, secret_key), 256), 1, 16);
  
  -- Encoder l'ID en base64 et convertir en URL-safe
  SET base64_encoded = `base64_encode`(id_str);
  SET encoded_id = REPLACE(REPLACE(REPLACE(base64_encoded, '+', '-'), '/', '_'), '=', '');
  
  -- Retourner la combinaison
  RETURN CONCAT(hash_part, encoded_id);
END$$

DELIMITER ;

-- =====================================================
-- ÉTAPE 4: RÉGÉNÉRER TOUS LES HASH
-- =====================================================

-- ⚠️ AVERTISSEMENT FINAL ⚠️
SELECT 
  '⚠️ ATTENTION: Les hash générés par ce script SQL NE SERONT PAS IDENTIQUES' as warning,
  'aux hash générés par le backend Node.js.' as warning2,
  'Pour des hash exacts, utilisez: node update_all_fiches_hash_with_current_secret.js' as recommendation;

SELECT '🔄 Régénération des hash en cours (approximation)...' as message;

-- Mettre à jour TOUTES les fiches
UPDATE `fiches`
SET `hash` = `calculate_fiche_hash`(`id`, @hash_secret);

-- =====================================================
-- ÉTAPE 5: VÉRIFICATION
-- =====================================================

-- Vérifier le résultat
SELECT 
  'APRÈS' as etape,
  COUNT(*) as total_fiches,
  COUNT(hash) as fiches_avec_hash,
  COUNT(*) - COUNT(hash) as fiches_sans_hash
FROM `fiches`;

-- Afficher quelques exemples de hash générés
SELECT 
  'EXEMPLES' as type,
  id,
  hash,
  LENGTH(hash) as hash_length
FROM `fiches`
WHERE `hash` IS NOT NULL
ORDER BY `id` DESC
LIMIT 10;

-- =====================================================
-- NETTOYAGE: SUPPRIMER LES FONCTIONS (optionnel)
-- =====================================================
-- Décommentez ces lignes si vous voulez supprimer les fonctions après usage
-- DROP FUNCTION IF EXISTS `calculate_fiche_hash`;
-- DROP FUNCTION IF EXISTS `base64_encode`;

SELECT '✅ Mise à jour terminée!' as message;

