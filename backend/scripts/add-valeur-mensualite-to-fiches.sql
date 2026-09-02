-- « Partie à financer du client » (compte_rendu_pending.valeur_mensualite) → fiches.valeur_mensualite
-- ph3_mensualite reste « Mensualité du crédit » sur les deux tables.

SET @db = DATABASE();

SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'fiches'
    AND COLUMN_NAME = 'valeur_mensualite'
);

SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `fiches` ADD COLUMN `valeur_mensualite` decimal(10,2) DEFAULT NULL COMMENT ''Partie à financer du client'' AFTER `credit_autre`',
  'SELECT ''Colonne fiches.valeur_mensualite déjà présente'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
