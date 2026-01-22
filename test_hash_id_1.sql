-- =====================================================
-- Script SQL de test pour vérifier le hash généré pour l'ID = 1
-- Compare avec le résultat du script JavaScript
-- =====================================================

USE `crm`;

-- =====================================================
-- IMPORTANT: DÉFINIR LA CLÉ SECRÈTE
-- =====================================================
-- Cette valeur DOIT correspondre exactement à FICHE_HASH_SECRET dans votre fichier .env
-- 
-- Valeur par défaut si FICHE_HASH_SECRET n'est pas défini dans .env:
-- 'your-secret-key-change-in-production'
--
-- Si vous avez défini FICHE_HASH_SECRET dans votre .env, utilisez cette valeur ici:
-- Exemple: SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';
--
-- ⚠️ MODIFIEZ LA LIGNE SUIVANTE AVANT D'EXÉCUTER LE SCRIPT ⚠️
SET @hash_secret = 'your-secret-key-change-in-production';

SET @test_id = 1;

-- Afficher le secret utilisé (masqué)
SELECT 
  CONCAT(
    SUBSTRING(@hash_secret, 1, 6), 
    '...', 
    SUBSTRING(@hash_secret, LENGTH(@hash_secret) - 3)
  ) as hash_secret_utilise,
  LENGTH(@hash_secret) as longueur_secret,
  @test_id as id_test;

-- =====================================================
-- CRÉER LES FONCTIONS (si elles n'existent pas déjà)
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

-- Fonction pour implémenter HMAC-SHA256
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
    SET key_binary = UNHEX(key_hash_hex);
    SET key_len = 32;
  ELSE
    SET key_binary = CONCAT(CAST(key_str AS BINARY), REPEAT(CHAR(0), 64 - key_len));
  END IF;
  
  -- Étape 2: Créer inner_key = key XOR ipad (0x36) et outer_key = key XOR opad (0x5C)
  SET inner_key = '';
  SET outer_key = '';
  SET i = 1;
  
  WHILE i <= 64 DO
    SET key_byte = ASCII(SUBSTRING(key_binary, i, 1));
    IF key_byte IS NULL THEN
      SET key_byte = 0;
    END IF;
    SET inner_key = CONCAT(inner_key, CHAR(key_byte ^ ipad_byte));
    SET outer_key = CONCAT(outer_key, CHAR(key_byte ^ opad_byte));
    SET i = i + 1;
  END WHILE;
  
  SET inner_key = CAST(inner_key AS BINARY);
  SET outer_key = CAST(outer_key AS BINARY);
  
  -- Étape 3: Calculer inner_hash = SHA256(inner_key || message)
  SET inner_hash_hex = SHA2(CONCAT(inner_key, message_str), 256);
  IF inner_hash_hex IS NULL THEN
    RETURN NULL;
  END IF;
  
  SET inner_hash_binary = UNHEX(inner_hash_hex);
  
  -- Étape 4: Calculer outer_hash = SHA256(outer_key || inner_hash)
  SET outer_hash_hex = SHA2(CONCAT(outer_key, inner_hash_binary), 256);
  IF outer_hash_hex IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN outer_hash_hex;
END$$

-- Fonction pour calculer le hash de fiche
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
  
  SET id_str = CAST(fiche_id AS CHAR);
  SET hmac_result = `hmac_sha256`(secret_key, id_str);
  
  IF hmac_result IS NULL OR hmac_result = '' THEN
    RETURN NULL;
  END IF;
  
  SET hash_part = SUBSTRING(hmac_result, 1, 16);
  IF hash_part IS NULL OR hash_part = '' THEN
    RETURN NULL;
  END IF;
  
  SET base64_encoded = `base64_encode`(id_str);
  IF base64_encoded IS NULL THEN
    SET base64_encoded = '';
  END IF;
  
  SET encoded_id = REPLACE(REPLACE(REPLACE(base64_encoded, '+', '-'), '/', '_'), '=', '');
  IF encoded_id IS NULL THEN
    SET encoded_id = '';
  END IF;
  
  RETURN CONCAT(COALESCE(hash_part, ''), COALESCE(encoded_id, ''));
END$$

DELIMITER ;

-- =====================================================
-- TEST: CALCULER LE HASH POUR ID = 1
-- =====================================================

SELECT 
  '📊 RÉSULTAT DU SCRIPT SQL' as titre,
  @test_id as id_test;

-- Calculer le hash avec la fonction SQL
SET @calculated_hash = `calculate_fiche_hash`(@test_id, @hash_secret);

SELECT 
  'Hash calculé (SQL)' as description,
  @calculated_hash as hash,
  LENGTH(@calculated_hash) as longueur;

-- Récupérer le hash actuel dans la base de données
SELECT 
  '📊 RÉSULTAT DANS LA BASE DE DONNÉES' as titre,
  id,
  hash as hash_actuel,
  LENGTH(hash) as longueur
FROM `fiches`
WHERE id = @test_id;

-- Comparer les résultats
SELECT 
  '🔍 COMPARAISON' as titre,
  @calculated_hash as hash_calcule_sql,
  (SELECT hash FROM `fiches` WHERE id = @test_id) as hash_en_db,
  CASE 
    WHEN @calculated_hash = (SELECT hash FROM `fiches` WHERE id = @test_id) 
    THEN '✅ IDENTIQUES'
    ELSE '❌ DIFFÉRENTS'
  END as resultat;

-- Détails du hash calculé (pour comparaison avec le script JS)
SELECT 
  '🔬 DÉTAILS DU HASH CALCULÉ (SQL)' as titre,
  `hmac_sha256`(@hash_secret, CAST(@test_id AS CHAR)) as hmac_complet_64_chars,
  SUBSTRING(`hmac_sha256`(@hash_secret, CAST(@test_id AS CHAR)), 1, 16) as hmac_tronque_16_chars,
  `base64_encode`(CAST(@test_id AS CHAR)) as id_encode_base64,
  REPLACE(REPLACE(REPLACE(`base64_encode`(CAST(@test_id AS CHAR)), '+', '-'), '/', '_'), '=', '') as id_encode_url_safe,
  @calculated_hash as hash_final;

-- Instructions pour comparer avec le script JS
SELECT 
  '📝 POUR COMPARER AVEC LE SCRIPT JS' as titre,
  'Exécutez: node test_hash_id_1.js' as instruction,
  'Assurez-vous que FICHE_HASH_SECRET dans .env correspond à @hash_secret ci-dessus' as note_importante;

-- =====================================================
-- MISE À JOUR: UPDATE DIRECT SUR ID = 1
-- =====================================================

-- Afficher l'état AVANT la mise à jour
SELECT 
  '📋 AVANT UPDATE' as etape,
  id,
  hash as hash_avant,
  LENGTH(hash) as longueur_avant
FROM `fiches`
WHERE id = @test_id;

-- Exécuter l'UPDATE
UPDATE `fiches`
SET `hash` = `calculate_fiche_hash`(@test_id, @hash_secret)
WHERE id = @test_id;

-- Afficher le nombre de lignes affectées
SELECT ROW_COUNT() as lignes_modifiees;

-- Afficher l'état APRÈS la mise à jour
SELECT 
  '📋 APRÈS UPDATE' as etape,
  id,
  hash as hash_apres,
  LENGTH(hash) as longueur_apres
FROM `fiches`
WHERE id = @test_id;

-- Vérification finale
SELECT 
  '✅ VÉRIFICATION FINALE' as titre,
  @calculated_hash as hash_calcule,
  (SELECT hash FROM `fiches` WHERE id = @test_id) as hash_en_db,
  CASE 
    WHEN @calculated_hash = (SELECT hash FROM `fiches` WHERE id = @test_id) 
    THEN '✅ MISE À JOUR RÉUSSIE - Les hash correspondent'
    ELSE '❌ ERREUR - Les hash ne correspondent pas'
  END as resultat;

-- =====================================================
-- NETTOYAGE (optionnel - décommentez si nécessaire)
-- =====================================================
-- DROP FUNCTION IF EXISTS `calculate_fiche_hash`;
-- DROP FUNCTION IF EXISTS `hmac_sha256`;
-- DROP FUNCTION IF EXISTS `base64_encode`;

