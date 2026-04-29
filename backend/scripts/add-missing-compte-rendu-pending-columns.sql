-- Ajoute les colonnes manquantes dans compte_rendu_pending (MySQL)
-- Colonnes cible: pseudo, valeur_mensualite, conf_consommations, produit

SET @table_name = 'compte_rendu_pending';

-- pseudo
SET @col_name = 'pseudo';
SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = @table_name
        AND COLUMN_NAME = @col_name
    ),
    'SELECT ''pseudo already exists''',
    CONCAT('ALTER TABLE `', @table_name, '` ADD COLUMN `pseudo` VARCHAR(255) NULL')
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- valeur_mensualite
SET @col_name = 'valeur_mensualite';
SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = @table_name
        AND COLUMN_NAME = @col_name
    ),
    'SELECT ''valeur_mensualite already exists''',
    CONCAT('ALTER TABLE `', @table_name, '` ADD COLUMN `valeur_mensualite` DECIMAL(10,2) NULL')
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- conf_consommations
SET @col_name = 'conf_consommations';
SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = @table_name
        AND COLUMN_NAME = @col_name
    ),
    'SELECT ''conf_consommations already exists''',
    CONCAT('ALTER TABLE `', @table_name, '` ADD COLUMN `conf_consommations` DECIMAL(10,2) NULL')
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- produit
SET @col_name = 'produit';
SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = @table_name
        AND COLUMN_NAME = @col_name
    ),
    'SELECT ''produit already exists''',
    CONCAT('ALTER TABLE `', @table_name, '` ADD COLUMN `produit` INT NULL')
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration compte_rendu_pending terminee' AS message;
