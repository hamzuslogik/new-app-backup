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
SELECT t.k, t.v, NULL
FROM (SELECT 'phone_url_search_enabled' AS k, '1' AS v) AS t
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` AS g WHERE g.`setting_key` = t.k);

-- Sécurité : blocage après tentatives échouées (0 = désactivé)
INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT t.k, t.v, NULL
FROM (SELECT 'failed_login_max_before_ip_block' AS k, '5' AS v) AS t
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` AS g WHERE g.`setting_key` = t.k);

INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT t.k, t.v, NULL
FROM (SELECT 'failed_login_window_minutes' AS k, '60' AS v) AS t
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` AS g WHERE g.`setting_key` = t.k);

-- Durée de session JWT (aligner sur JWT_EXPIRE si vous utilisez une autre valeur, ex. 7d)
INSERT INTO `global_settings` (`setting_key`, `setting_value`, `updated_by`)
SELECT t.k, t.v, NULL
FROM (SELECT 'session_lifetime' AS k, '24h' AS v) AS t
WHERE NOT EXISTS (SELECT 1 FROM `global_settings` AS g WHERE g.`setting_key` = t.k);
