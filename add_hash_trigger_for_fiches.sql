-- Trigger pour calculer automatiquement le hash lors de l'insertion d'une fiche
-- Ce trigger garantit que le hash est toujours calculé, même pour les insertions SQL directes
-- 
-- IMPORTANT: 
-- 1. Ce trigger calcule le hash uniquement si le hash n'a pas été fourni (NULL)
-- 2. Le code Node.js calcule toujours le hash après insertion, donc ce trigger sert de secours
-- 3. La clé secrète doit correspondre à FICHE_HASH_SECRET dans le .env du backend
-- 4. Le format du hash est: 16 premiers caractères du SHA256 + ID encodé en base64 URL-safe

USE `crm`;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS `trg_fiches_after_insert_hash`;

DELIMITER //

CREATE TRIGGER `trg_fiches_after_insert_hash`
AFTER INSERT ON `fiches`
FOR EACH ROW
BEGIN
  -- Calculer le hash uniquement si le hash n'a pas été fourni (NULL)
  -- Cela permet au code Node.js de définir le hash lui-même s'il le souhaite
  IF NEW.hash IS NULL AND NEW.id IS NOT NULL THEN
    -- Utiliser la même clé secrète que dans le code Node.js
    -- IMPORTANT: Cette clé doit correspondre à FICHE_HASH_SECRET dans le .env
    -- Pour la production, modifiez cette valeur pour correspondre à votre .env
    SET @hash_secret = 'your-secret-key-change-in-production';
    
    -- Calculer le hash SHA256 (approximation de HMAC-SHA256)
    -- Note: MySQL n'a pas de fonction HMAC native, donc on utilise SHA2 avec concaténation
    -- Format: 16 premiers caractères du hash SHA256 + ID encodé en base64 URL-safe
    SET @hmac_hash = SUBSTRING(SHA2(CONCAT(NEW.id, @hash_secret), 256), 1, 16);
    
    -- Encoder l'ID en base64 URL-safe
    -- MySQL n'a pas de fonction native pour base64 URL-safe, donc on utilise TO_BASE64 et on remplace les caractères
    SET @encoded_id = REPLACE(REPLACE(REPLACE(TO_BASE64(CAST(NEW.id AS CHAR)), '+', '-'), '/', '_'), '=', '');
    
    -- Combiner le hash et l'ID encodé (format identique à encodeFicheId dans Node.js)
    SET @final_hash = CONCAT(@hmac_hash, @encoded_id);
    
    -- Mettre à jour le hash
    UPDATE `fiches` SET `hash` = @final_hash WHERE `id` = NEW.id;
  END IF;
END //

DELIMITER ;

-- Vérification
SELECT 'Trigger trg_fiches_after_insert_hash créé avec succès' AS message;
SELECT 'IMPORTANT: Assurez-vous que la clé secrète dans le trigger correspond à FICHE_HASH_SECRET dans votre .env' AS warning;

-- Afficher le trigger créé
SHOW TRIGGERS WHERE `Table` = 'fiches';

