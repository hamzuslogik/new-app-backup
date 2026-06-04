-- =====================================================
-- Table audit_qualite_rdv
-- Historique des audits RDV par agents qualité confirmation (fonction 4)
-- La table f iches reste la source de vérité pour l''affichage fiche et les stats agents qualité :
--   fiches.id_qualite_confirmation, fiches.observation_qualite
-- Cette table conserve l''historique de chaque saisie (audit_qualite_rdv).
-- =====================================================
-- phpMyAdmin : exécuter ce script en entier (CREATE IF NOT EXISTS, pas d'erreur si déjà là)

USE `crm`;

CREATE TABLE IF NOT EXISTS `audit_qualite_rdv` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL COMMENT 'Fiche / RDV audité',
  `id_qualite_confirmation` int(11) NOT NULL COMMENT 'Agent qualité confirmation (fonction 4)',
  `observation` text DEFAULT NULL COMMENT 'Observation saisie lors de l''audit',
  `date_rdv_time` datetime DEFAULT NULL COMMENT 'Date RDV au moment de l''audit (filtre stats)',
  `id_etat_final` int(11) DEFAULT NULL COMMENT 'État fiche au moment de l''audit',
  `id_confirmateur` int(11) DEFAULT NULL,
  `id_centre` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `id_agent` int(11) DEFAULT NULL COMMENT 'Agent qualification créateur de la fiche',
  `date_audit` datetime NOT NULL COMMENT 'Date/heure de l''audit',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_aqr_fiche` (`id_fiche`),
  KEY `idx_aqr_qualite_date_audit` (`id_qualite_confirmation`, `date_audit`),
  KEY `idx_aqr_date_rdv` (`date_rdv_time`),
  KEY `idx_aqr_fiche_date_audit` (`id_fiche`, `date_audit`),
  KEY `idx_aqr_qualite_date_rdv` (`id_qualite_confirmation`, `date_rdv_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historique audits RDV (complément de fiches.id_qualite_confirmation / observation_qualite)';

-- ---------------------------------------------------------------------
-- Rétro-remplissage (optionnel, une fois) : fiches déjà auditées via id_qualite_confirmation
-- Décommenter si vous voulez alimenter l''historique depuis les fiches existantes
-- ---------------------------------------------------------------------
/*
INSERT INTO audit_qualite_rdv (
  id_fiche, id_qualite_confirmation, observation, date_rdv_time,
  id_etat_final, id_confirmateur, id_centre, id_commercial, id_agent, date_audit, updated_at
)
SELECT
  f.id,
  f.id_qualite_confirmation,
  f.observation_qualite,
  f.date_rdv_time,
  f.id_etat_final,
  f.id_confirmateur,
  f.id_centre,
  f.id_commercial,
  f.id_agent,
  COALESCE(f.date_modif_time, f.date_rdv_time, NOW()),
  NOW()
FROM fiches f
INNER JOIN utilisateurs u ON u.id = f.id_qualite_confirmation AND u.fonction = 4
WHERE f.id_qualite_confirmation IS NOT NULL
  AND f.date_rdv_time IS NOT NULL
  AND f.date_rdv_time != ''
  AND (f.archive = 0 OR f.archive IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM audit_qualite_rdv a
    WHERE a.id_fiche = f.id AND a.id_qualite_confirmation = f.id_qualite_confirmation
  );
*/

SELECT 'Table audit_qualite_rdv prête.' AS message;
SHOW INDEX FROM audit_qualite_rdv;
