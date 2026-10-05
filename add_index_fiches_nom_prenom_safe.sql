-- Index pour accélérer la recherche par nom / prénom (préfixe `terme%`)
-- Version sécurisée : ne crée l'index que s'il n'existe pas.

SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fiches'
      AND INDEX_NAME = 'idx_fiches_nom'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_nom` ON `fiches` (`nom`)',
    'SELECT "Index idx_fiches_nom already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fiches'
      AND INDEX_NAME = 'idx_fiches_prenom'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_fiches_prenom` ON `fiches` (`prenom`)',
    'SELECT "Index idx_fiches_prenom already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fiches'
  AND INDEX_NAME IN ('idx_fiches_nom', 'idx_fiches_prenom')
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
