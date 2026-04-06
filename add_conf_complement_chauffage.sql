-- Ajoute sur fiches : conf_complement_chauffage (confirmation), complement_chauffage (qualification)
-- Ajoute sur fiches_histo : conf_complement_chauffage (idempotent)

DELIMITER $$

DROP PROCEDURE IF EXISTS add_conf_complement_chauffage_if_missing$$

CREATE PROCEDURE add_conf_complement_chauffage_if_missing()
BEGIN
  DECLARE db_name VARCHAR(64);
  SELECT DATABASE() INTO db_name;

  -- Confirmation
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches' AND COLUMN_NAME = 'conf_complement_chauffage') = 0 THEN
    ALTER TABLE `fiches` ADD COLUMN `conf_complement_chauffage` VARCHAR(512) DEFAULT NULL COMMENT 'Complément de chauffage (confirmation)';
  END IF;

  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_complement_chauffage') = 0 THEN
    ALTER TABLE `fiches_histo` ADD COLUMN `conf_complement_chauffage` VARCHAR(512) DEFAULT NULL COMMENT 'Complément de chauffage (confirmation)';
  END IF;

  -- Qualification (agents qualification), distinct de conf_complement_chauffage
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = db_name AND TABLE_NAME = 'fiches' AND COLUMN_NAME = 'complement_chauffage') = 0 THEN
    ALTER TABLE `fiches` ADD COLUMN `complement_chauffage` VARCHAR(512) DEFAULT NULL COMMENT 'Complément de chauffage (qualification)';
  END IF;
END$$

DELIMITER ;

CALL add_conf_complement_chauffage_if_missing();
DROP PROCEDURE IF EXISTS add_conf_complement_chauffage_if_missing;

SELECT 'Migration complément de chauffage : conf_complement_chauffage (fiches + fiches_histo), complement_chauffage (fiches qualification) — terminée.' AS message;
