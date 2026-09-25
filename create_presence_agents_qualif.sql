-- ============================================================
-- Présence agents qualification — structure + cron journalier
-- ============================================================

CREATE TABLE IF NOT EXISTS `presence_agents_qualif` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_agent` INT NOT NULL,
  `id_superviseur` INT NOT NULL,
  `date_jour` DATE NOT NULL,
  `type` ENUM('present', 'absence', 'depart') NOT NULL DEFAULT 'present',
  `heure_depart` TIME NULL,
  `coefficient_presence` DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
  `heures_travaillees` DECIMAL(6,2) NOT NULL DEFAULT 8.00,
  `heures_prevues` DECIMAL(6,2) NOT NULL DEFAULT 8.00,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  UNIQUE KEY `uniq_agent_jour` (`id_agent`, `date_jour`),
  KEY `idx_date_jour` (`date_jour`),
  KEY `idx_superviseur` (`id_superviseur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration si table déjà existante (à lancer une fois) :
-- ALTER TABLE presence_agents_qualif
--   MODIFY COLUMN `type` ENUM('present', 'absence', 'depart') NOT NULL DEFAULT 'present';

-- ============================================================
-- CRONTAB (tous les matins, ex. 06:00)
-- Ne crée QUE les lignes manquantes du jour.
-- Si absence/départ déjà saisi → la ligne n'est PAS écrasée.
--
-- Exemple crontab :
-- 0 6 * * 1-5 mysql -u USER -pPASS BDD < /chemin/cron_presence_agents_qualif_quotidien.sql
-- ou bien uniquement la requête INSERT ci-dessous via -e
-- ============================================================

INSERT INTO presence_agents_qualif (
  id_agent,
  id_superviseur,
  date_jour,
  type,
  heure_depart,
  coefficient_presence,
  heures_travaillees,
  heures_prevues,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(u.chef_equipe, 0),
  CURDATE(),
  'present',
  NULL,
  1.0000,
  8.00,
  8.00,
  NOW(),
  NOW()
FROM utilisateurs u
WHERE u.fonction = 3
  AND (u.etat > 0 OR u.etat IS NULL)
ON DUPLICATE KEY UPDATE
  /* no-op : conserve absence / départ déjà enregistrés */
  id = id;
