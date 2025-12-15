-- =====================================================
-- Ajouter le champ rdv_urgent à la table fiches
-- =====================================================

-- Vérifier si la colonne existe déjà avant de l'ajouter
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'rdv_urgent';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1', -- La colonne existe déjà
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TINYINT(1) DEFAULT 0 COMMENT "Indique si le rendez-vous est urgent (1=Oui, 0=Non)"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Mettre à jour les fiches existantes qui ont id_qualif = 'RDV_URGENT' ou qualification_code = 'RDV_URGENT'
-- Si la table qualif existe, utiliser un JOIN
UPDATE fiches f
LEFT JOIN qualif q ON f.id_qualif = q.id
SET f.rdv_urgent = 1
WHERE (q.code = 'RDV_URGENT' OR f.id_qualif = 'RDV_URGENT')
AND f.rdv_urgent = 0;

-- Si la table qualif n'existe pas, mettre à jour directement avec id_qualif
-- (Cette requête sera ignorée si la table qualif existe)
UPDATE fiches
SET rdv_urgent = 1
WHERE id_qualif = 'RDV_URGENT'
AND rdv_urgent = 0;

