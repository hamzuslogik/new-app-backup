-- Ajouter des index pour optimiser les recherches par téléphone (version sécurisée)
-- Ce script vérifie l'existence des index avant de les créer pour éviter les erreurs
-- 
-- Ces index amélioreront considérablement les performances des recherches par téléphone
-- La recherche actuelle utilise : WHERE (fiche.tel = ? OR fiche.gsm1 = ? OR fiche.gsm2 = ?)

-- Vérifier et créer l'index sur tel
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'fiches' 
    AND INDEX_NAME = 'idx_fiches_tel'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_tel` ON `fiches` (`tel`)',
    'SELECT "Index idx_fiches_tel already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier et créer l'index sur gsm1
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'fiches' 
    AND INDEX_NAME = 'idx_fiches_gsm1'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_gsm1` ON `fiches` (`gsm1`)',
    'SELECT "Index idx_fiches_gsm1 already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier et créer l'index sur gsm2
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'fiches' 
    AND INDEX_NAME = 'idx_fiches_gsm2'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_gsm2` ON `fiches` (`gsm2`)',
    'SELECT "Index idx_fiches_gsm2 already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier et créer l'index composite (optionnel, peut aider pour certaines requêtes)
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'fiches' 
    AND INDEX_NAME = 'idx_fiches_tel_gsm1_gsm2'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_tel_gsm1_gsm2` ON `fiches` (`tel`, `gsm1`, `gsm2`)',
    'SELECT "Index idx_fiches_tel_gsm1_gsm2 already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Afficher les index créés pour vérification
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'fiches' 
AND (INDEX_NAME LIKE 'idx_fiches_%tel%' OR INDEX_NAME LIKE 'idx_fiches_%gsm%')
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
