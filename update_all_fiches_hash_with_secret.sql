-- =====================================================
-- Script SQL pour VIDER et RÉGÉNÉRER tous les hash avec le HASH_SECRET actuel
-- =====================================================
--
-- ⚠️ ATTENTION IMPORTANTE ⚠️
-- Ce script SQL tente d'implémenter HMAC-SHA256, mais MySQL/MariaDB ne supporte pas
-- nativement HMAC. L'implémentation manuelle peut produire des résultats incorrects.
--
-- ⚠️ RECOMMANDATION FORTE ⚠️
-- Pour des hash EXACTS identiques à ceux générés par le backend Node.js, utilisez
-- le script Node.js qui utilise exactement la même fonction :
--
--   node update_all_fiches_hash_with_current_secret.js
--
-- Ce script Node.js :
-- - Utilise exactement la même fonction encodeFicheId que le backend
-- - Génère des hash 100% identiques à ceux vus dans l'URL
-- - Est garanti de fonctionner correctement
--
-- Ce script SQL :
-- 1. Vide tous les hash existants
-- 2. Tente de régénérer tous les hash avec le HASH_SECRET défini ci-dessous
--    (peut ne pas correspondre exactement au backend)
--
-- IMPORTANT: Modifiez la valeur de @hash_secret à la ligne 44 pour correspondre
-- à votre FICHE_HASH_SECRET dans le fichier .env
--
-- =====================================================

USE `crm`;

-- =====================================================
-- AVERTISSEMENT FINAL AVANT EXÉCUTION
-- =====================================================

SELECT 
  '⚠️ ATTENTION' as warning,
  'Ce script SQL peut ne pas générer des hash identiques au backend Node.js' as message1,
  'Pour des hash EXACTS, utilisez: node update_all_fiches_hash_with_current_secret.js' as message2,
  'Voulez-vous vraiment continuer avec ce script SQL?' as question;

-- Décommentez la ligne suivante pour continuer malgré l'avertissement
-- SET @continue_anyway = 1;

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

-- HASH_SECRET utilisé pour générer les hash (identique à FICHE_HASH_SECRET dans .env)
-- Ce secret est utilisé pour calculer HMAC-SHA256 des IDs de fiches
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
  -- Construire byte par byte car MySQL ne supporte pas XOR direct sur BINARY


  SET inner_key = '';
  SET outer_key = '';
  SET i = 1;
  
  WHILE i <= 64 DO
    -- Extraire le byte i de la clé (0-255)
    -- Utiliser ASCII() pour obtenir la valeur du byte (0-255)
    SET key_byte = ASCII(SUBSTRING(key_binary, i, 1));
    
    -- Si key_byte est NULL, utiliser 0
    IF key_byte IS NULL THEN
      SET key_byte = 0;
    END IF;
    
    -- Calculer XOR: key_byte XOR ipad_byte et key_byte XOR opad_byte
    -- En MySQL/MariaDB, l'opérateur ^ fait XOR bitwise sur les entiers
    -- Utiliser CHAR() pour convertir l'entier en caractère binaire
    -- Calculer XOR directement (^ est l'opérateur XOR bitwise)
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

-- Fonction pour calculer le hash de fiche (identique à encodeFicheId dans Node.js)
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
  -- S'assurer que hash_part et encoded_id sont bien des strings
  RETURN CONCAT(COALESCE(hash_part, ''), COALESCE(encoded_id, ''));
END$$

DELIMITER ;

-- =====================================================
-- ÉTAPE 3.5: TEST DU HASH POUR ID = 1
-- =====================================================

-- Test 1: Vérifier que les fonctions existent
SELECT 'TEST 1: Vérification des fonctions' as test;
SELECT 
  'Fonctions créées' as info,
  IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'hmac_sha256' AND ROUTINE_SCHEMA = DATABASE()), '✅ hmac_sha256 existe', '❌ hmac_sha256 manquante') as hmac_func,
  IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'base64_encode' AND ROUTINE_SCHEMA = DATABASE()), '✅ base64_encode existe', '❌ base64_encode manquante') as base64_func,
  IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'calculate_fiche_hash' AND ROUTINE_SCHEMA = DATABASE()), '✅ calculate_fiche_hash existe', '❌ calculate_fiche_hash manquante') as calc_func;

-- Test 2: Tester base64_encode
SELECT 'TEST 2: Test base64_encode' as test;
SELECT 
  '1' as input,
  `base64_encode`('1') as base64_result,
  IF(`base64_encode`('1') IS NULL, '❌ NULL', '✅ OK') as status;

-- Test 3: Tester hmac_sha256 avec un secret court
SELECT 'TEST 3: Test hmac_sha256' as test;
SELECT 
  'test' as secret,
  '1' as message,
  `hmac_sha256`('test', '1') as hmac_result,
  IF(`hmac_sha256`('test', '1') IS NULL, '❌ NULL', IF(LENGTH(`hmac_sha256`('test', '1')) = 64, '✅ OK (64 chars)', CONCAT('⚠️ Longueur: ', LENGTH(`hmac_sha256`('test', '1'))))) as status;

-- Test 4: Tester hmac_sha256 avec le secret réel
SELECT 'TEST 4: Test hmac_sha256 avec secret réel' as test;
SELECT 
  @hash_secret as secret_utilise,
  '1' as message,
  `hmac_sha256`(@hash_secret, '1') as hmac_result,
  IF(`hmac_sha256`(@hash_secret, '1') IS NULL, '❌ NULL', IF(LENGTH(`hmac_sha256`(@hash_secret, '1')) = 64, '✅ OK (64 chars)', CONCAT('⚠️ Longueur: ', LENGTH(`hmac_sha256`(@hash_secret, '1'))))) as status;

-- Test 5: Tester calculate_fiche_hash
SELECT 'TEST 5: Test calculate_fiche_hash' as test;
SELECT 
  1 as fiche_id,
  `calculate_fiche_hash`(1, @hash_secret) as hash_genere,
  IF(`calculate_fiche_hash`(1, @hash_secret) IS NULL, '❌ NULL', '✅ OK') as status;

-- Test 6: Tester le hash complet pour l'ID = 1
SELECT 'TEST 6: Test hash complet ID=1' as test;
SELECT 
  'TEST HASH ID=1' as test,
  1 as fiche_id,
  `calculate_fiche_hash`(1, @hash_secret) as hash_genere,
  '9b8edfe529207aa2MQ' as hash_attendu,
  CASE 
    WHEN `calculate_fiche_hash`(1, @hash_secret) IS NULL THEN '❌ NULL'
    WHEN `calculate_fiche_hash`(1, @hash_secret) = '9b8edfe529207aa2MQ' THEN '✅ CORRECT'
    ELSE '❌ DIFFÉRENT'
  END as resultat;

-- Afficher les composants du hash pour debug
SELECT 
  'DÉTAILS HASH ID=1' as info,
  1 as fiche_id,
  `hmac_sha256`(@hash_secret, '1') as hmac_complet,
  LENGTH(`hmac_sha256`(@hash_secret, '1')) as hmac_length,
  SUBSTRING(`hmac_sha256`(@hash_secret, '1'), 1, 16) as hash_part_16_chars,
  `base64_encode`('1') as base64_original,
  REPLACE(REPLACE(REPLACE(`base64_encode`('1'), '+', '-'), '/', '_'), '=', '') as base64_url_safe,
  `calculate_fiche_hash`(1, @hash_secret) as hash_final,
  LENGTH(`calculate_fiche_hash`(1, @hash_secret)) as hash_final_length;

-- Test avec le secret pour voir si le problème vient de l'HMAC
SELECT 
  'TEST SECRET' as info,
  @hash_secret as secret_utilise,
  LENGTH(@hash_secret) as secret_length,
  SHA2(@hash_secret, 256) as sha2_secret;

-- =====================================================
-- ÉTAPE 4: RÉGÉNÉRER TOUS LES HASH
-- =====================================================

SELECT '🔄 Régénération des hash en cours (HMAC-SHA256 exact)...' as message;

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

