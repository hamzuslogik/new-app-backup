-- IPs / plages jamais soumises au blocage anti-brute-force sur POST /api/auth/login.
-- Le serveur crée aussi la table au premier usage (ensureGlobalLoginIpWhitelistTable).

CREATE TABLE IF NOT EXISTS global_login_ip_whitelist (
  id INT(11) NOT NULL AUTO_INCREMENT,
  ip_rule VARCHAR(64) NOT NULL,
  commentaire VARCHAR(255) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ip_rule (ip_rule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
