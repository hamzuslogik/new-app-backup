-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Type de notification (rdv_approval, etc.)',
  `id_fiche` int(11) DEFAULT NULL COMMENT 'ID de la fiche concernée (optionnel)',
  `message` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Message de la notification',
  `destination` int(11) DEFAULT NULL COMMENT 'ID de l''utilisateur destinataire',
  `date_creation` datetime DEFAULT NULL COMMENT 'Date de création',
  `lu` int(11) DEFAULT 0 COMMENT '0 = non lu, 1 = lu',
  `metadata` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Métadonnées JSON (date_rdv_time, etc.)',
  `action` varchar(20) DEFAULT NULL COMMENT 'Action effectuée (accepted, refused, pending)',
  PRIMARY KEY (`id`),
  KEY `idx_destination` (`destination`),
  KEY `idx_lu` (`lu`),
  KEY `idx_type` (`type`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_date_creation` (`date_creation`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

