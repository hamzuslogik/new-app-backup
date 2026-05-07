-- Cree la table planning_alerts (MySQL)
-- Utilisee par la page "Alerte Planning" et l'affichage dans l'onglet Planning du detail fiche

CREATE TABLE IF NOT EXISTS `planning_alerts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `dep` VARCHAR(10) NOT NULL,
  `slot_hour` VARCHAR(8) NOT NULL,
  `message` TEXT NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_dep_slot` (`dep`, `slot_hour`),
  KEY `idx_planning_alerts_dep` (`dep`),
  KEY `idx_planning_alerts_slot_hour` (`slot_hour`),
  KEY `idx_planning_alerts_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration planning_alerts terminee' AS message;
