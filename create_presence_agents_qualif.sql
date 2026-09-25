-- Présence des agents qualification (absence journée / départ avec heure)
CREATE TABLE IF NOT EXISTS `presence_agents_qualif` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_agent` INT NOT NULL,
  `id_superviseur` INT NOT NULL,
  `date_jour` DATE NOT NULL,
  `type` ENUM('absence', 'depart') NOT NULL,
  `heure_depart` TIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  UNIQUE KEY `uniq_agent_jour` (`id_agent`, `date_jour`),
  KEY `idx_date_jour` (`date_jour`),
  KEY `idx_superviseur` (`id_superviseur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
