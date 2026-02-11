-- =====================================================
-- Script de création de la table controle_qualite
-- Date: 2026-02-11
-- Description: Table pour stocker les audits de contrôle qualité des fiches
-- =====================================================

-- Supprimer la table si elle existe (décommenter si nécessaire)
-- DROP TABLE IF EXISTS controle_qualite;

-- Création de la table controle_qualite
CREATE TABLE IF NOT EXISTS `controle_qualite` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  
  -- Référence à la fiche auditée
  `id_fiche` int(11) NOT NULL COMMENT 'ID de la fiche auditée',
  
  -- Agent qualité qui a effectué l''audit
  `id_qualite` int(11) NOT NULL COMMENT 'ID de l''agent qualité',
  
  -- État et sous-état assignés lors de l''audit
  `id_etat` int(11) DEFAULT NULL COMMENT 'ID de l''état assigné',
  `id_sous_etat` int(11) DEFAULT NULL COMMENT 'ID du sous-état assigné',
  
  -- Commentaire de l'audit
  `commentaire` text DEFAULT NULL COMMENT 'Commentaire de l''audit qualité',
  
  -- Indicateurs KO/HC
  `ko` tinyint(1) DEFAULT 0 COMMENT 'Fiche marquée KO (1=oui, 0=non)',
  `hc` tinyint(1) DEFAULT 0 COMMENT 'Fiche marquée HC (1=oui, 0=non)',
  
  -- État précédent (avant l'audit)
  `id_etat_precedent` int(11) DEFAULT NULL COMMENT 'ID de l''état avant l''audit',
  `id_sous_etat_precedent` int(11) DEFAULT NULL COMMENT 'ID du sous-état avant l''audit',
  
  -- Agent créateur de la fiche (pour référence)
  `id_agent_fiche` int(11) DEFAULT NULL COMMENT 'ID de l''agent qui a créé la fiche',
  
  -- Centre de la fiche
  `id_centre` int(11) DEFAULT NULL COMMENT 'ID du centre de la fiche',
  
  -- Dates
  `date_audit` datetime NOT NULL COMMENT 'Date et heure de l''audit',
  `date_fiche` datetime DEFAULT NULL COMMENT 'Date d''insertion de la fiche auditée',
  
  -- Métadonnées
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de creation de l''enregistrement',
  `updated_at` datetime DEFAULT NULL COMMENT 'Date de derniere modification',
  
  PRIMARY KEY (`id`),
  
  -- Index pour les performances
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_qualite` (`id_qualite`),
  KEY `idx_id_etat` (`id_etat`),
  KEY `idx_id_sous_etat` (`id_sous_etat`),
  KEY `idx_date_audit` (`date_audit`),
  KEY `idx_id_agent_fiche` (`id_agent_fiche`),
  KEY `idx_id_centre` (`id_centre`),
  KEY `idx_ko` (`ko`),
  KEY `idx_hc` (`hc`),
  
  -- Index composite pour les requêtes fréquentes
  KEY `idx_qualite_date` (`id_qualite`, `date_audit`),
  KEY `idx_fiche_date` (`id_fiche`, `date_audit`)
  
  -- Clés étrangères (décommenter si vous voulez les contraintes)
  -- ,CONSTRAINT `fk_cq_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE
  -- ,CONSTRAINT `fk_cq_qualite` FOREIGN KEY (`id_qualite`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_cq_etat` FOREIGN KEY (`id_etat`) REFERENCES `etats` (`id`)
  -- ,CONSTRAINT `fk_cq_sous_etat` FOREIGN KEY (`id_sous_etat`) REFERENCES `sous_etat` (`id`)
  -- ,CONSTRAINT `fk_cq_agent` FOREIGN KEY (`id_agent_fiche`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_cq_centre` FOREIGN KEY (`id_centre`) REFERENCES `centres` (`id`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des audits de controle qualite';

-- =====================================================
-- Vérification de la création
-- =====================================================

-- Afficher la structure de la table
DESCRIBE controle_qualite;

-- Afficher les index
SHOW INDEX FROM controle_qualite;

-- =====================================================
-- Exemples de requêtes utiles
-- =====================================================

-- Nombre d'audits par agent qualité
-- SELECT 
--   u.pseudo, 
--   u.nom, 
--   u.prenom, 
--   COUNT(*) as nb_audits 
-- FROM controle_qualite cq 
-- INNER JOIN utilisateurs u ON cq.id_qualite = u.id 
-- GROUP BY cq.id_qualite 
-- ORDER BY nb_audits DESC;

-- Audits du jour
-- SELECT * FROM controle_qualite WHERE DATE(date_audit) = CURDATE();

-- Audits KO par agent
-- SELECT 
--   u.pseudo, 
--   COUNT(*) as nb_ko 
-- FROM controle_qualite cq 
-- INNER JOIN utilisateurs u ON cq.id_qualite = u.id 
-- WHERE cq.ko = 1 
-- GROUP BY cq.id_qualite;

-- Répartition par état
-- SELECT 
--   e.titre as etat, 
--   COUNT(*) as nb 
-- FROM controle_qualite cq 
-- INNER JOIN etats e ON cq.id_etat = e.id 
-- GROUP BY cq.id_etat 
-- ORDER BY nb DESC;
