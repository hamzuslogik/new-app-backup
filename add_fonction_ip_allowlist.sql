-- Restrictions d'accès par IP par fonction (toutes les IP ou liste IPv4 / CIDR).
-- mysql -u <user> -p <base> < add_fonction_ip_allowlist.sql

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fonctions'
    AND COLUMN_NAME = 'ip_acces_tous'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `fonctions` ADD COLUMN `ip_acces_tous` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=toutes IP, 0=liste''',
  'SELECT ''ip_acces_tous already exists'' AS message'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `fonction_ips_autorisees` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_fonction` INT NOT NULL,
  `ip_rule` VARCHAR(64) NOT NULL COMMENT 'IPv4 ou CIDR ex. 192.168.1.0/24',
  PRIMARY KEY (`id`),
  KEY `idx_fonction_ip` (`id_fonction`),
  CONSTRAINT `fk_fonction_ips_fonction` FOREIGN KEY (`id_fonction`) REFERENCES `fonctions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
