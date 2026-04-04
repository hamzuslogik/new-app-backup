-- Journal des tentatives de connexion échouées (mot de passe, IP, compte inactif, etc.).
-- mysql -u <user> -p <base> < create_connexions_echouees.sql

CREATE TABLE IF NOT EXISTS `connexions_echouees` (
  `id` INT NOT NULL AUTO_INCREMENT,
  -- TIMESTAMP : compatible MySQL/MariaDB où DEFAULT CURRENT_TIMESTAMP sur DATETIME provoque l’erreur #1067
  `date_tentative` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `login` VARCHAR(128) DEFAULT NULL COMMENT 'Identifiant saisi',
  `id_utilisateur` INT DEFAULT NULL COMMENT 'Utilisateur concerné si connu',
  `adresse_ip` VARCHAR(64) DEFAULT NULL COMMENT 'IPv4 client (normalisée)',
  `raison_echec` VARCHAR(64) NOT NULL COMMENT 'Code : login_inconnu, mot_de_passe_incorrect, ip_non_autorisee, compte_ou_fonction_centre_desactive',
  PRIMARY KEY (`id`),
  KEY `idx_connex_date` (`date_tentative`),
  KEY `idx_connex_login` (`login`),
  KEY `idx_connex_user` (`id_utilisateur`),
  CONSTRAINT `fk_connexions_echouees_utilisateur` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
