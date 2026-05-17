-- Codes de secours (4 chiffres, stockés hashés)
-- Générés depuis la page /code-secours (utilisateur login = backoffice uniquement)

CREATE TABLE IF NOT EXISTS `codes_secours` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code_hash` VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt du code à 4 chiffres',
  `lot_id` VARCHAR(36) NOT NULL COMMENT 'Identifiant du lot de génération (10 codes par lot)',
  `utilise` TINYINT(1) NOT NULL DEFAULT 0,
  `date_utilisation` DATETIME NULL,
  `id_genere_par` INT NOT NULL COMMENT 'Utilisateur ayant généré le lot',
  `date_creation` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_codes_secours_lot` (`lot_id`),
  KEY `idx_codes_secours_utilise` (`utilise`),
  CONSTRAINT `fk_codes_secours_genere_par` FOREIGN KEY (`id_genere_par`) REFERENCES `utilisateurs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration codes_secours terminee' AS message;
