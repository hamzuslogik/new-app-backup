-- Paramètres généraux : table global_settings + valeurs par défaut si absentes.
-- N’écrase pas une ligne déjà présente (même clé).
-- Le backend exécute la même logique via ensureGlobalSettingsTable() au premier accès.
-- mysql -u <user> -p <base> < insert_global_settings.sql

CREATE TABLE IF NOT EXISTS `global_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT(11) DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paramètre existant (recherche fiche par téléphone dans l’URL)
INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT 'phone_url_search_enabled', '1', NULL
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` WHERE `setting_key` = 'phone_url_search_enabled');

-- Sécurité : blocage après tentatives échouées (0 = désactivé)
INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT 'failed_login_max_before_ip_block', '0', NULL
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` WHERE `setting_key` = 'failed_login_max_before_ip_block');

INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT 'failed_login_window_minutes', '60', NULL
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` WHERE `setting_key` = 'failed_login_window_minutes');

-- Durée de session JWT (aligner sur JWT_EXPIRE si vous utilisez une autre valeur, ex. 7d)
INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT 'session_lifetime', '24h', NULL
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` WHERE `setting_key` = 'session_lifetime');
