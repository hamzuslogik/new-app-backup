-- Ajoute fiches_histo.pseudo pour conserver le pseudo saisi au compte rendu
-- (aujourd'hui uniquement dans compte_rendu_pending).
-- Idempotent : n'ajoute la colonne que si elle est absente.

USE `crm`;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_fiches_histo_pseudo_if_missing$$

CREATE PROCEDURE add_fiches_histo_pseudo_if_missing()
BEGIN
  DECLARE db_name VARCHAR(64) DEFAULT DATABASE();

  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = db_name
        AND TABLE_NAME = 'fiches_histo'
        AND COLUMN_NAME = 'pseudo') = 0 THEN
    ALTER TABLE `fiches_histo`
      ADD COLUMN `pseudo` VARCHAR(255) NULL DEFAULT NULL;
  END IF;
END$$

DELIMITER ;

CALL add_fiches_histo_pseudo_if_missing();
DROP PROCEDURE IF EXISTS add_fiches_histo_pseudo_if_missing;
