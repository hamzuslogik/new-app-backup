-- =====================================================
-- Script de création de la table remarques
-- Date: 2026-02-12
-- Description: Liste des remarques envoyées par les agents qualité
--              aux agents qualification (nature, commentaire, expéditeur, destinataire, date).
-- =====================================================

-- Supprimer la table si elle existe (décommenter si nécessaire)
-- DROP TABLE IF EXISTS remarques;

-- Création de la table remarques
CREATE TABLE IF NOT EXISTS `remarques` (
  `id` int(11) NOT NULL AUTO_INCREMENT,

  -- Nature / type de la remarque (ex : qualité, processus, comportement, autre)
  `nature_remarque` varchar(100) NOT NULL COMMENT 'Nature ou type de la remarque',

  -- Commentaire détaillé
  `commentaire` text DEFAULT NULL COMMENT 'Contenu de la remarque',

  -- Qui envoie (agent qualité)
  `id_expediteur` int(11) NOT NULL COMMENT 'ID de l''utilisateur qualité qui envoie la remarque',

  -- À qui est envoyée (agent qualification)
  `id_destinataire` int(11) NOT NULL COMMENT 'ID de l''agent qualification destinataire',

  -- Date et heure d''envoi de la remarque
  `date_remarque` datetime NOT NULL COMMENT 'Date et heure d''envoi de la remarque',

  -- Fiche concernée (optionnel : si la remarque est liée à une fiche)
  `id_fiche` int(11) DEFAULT NULL COMMENT 'ID de la fiche concernée (optionnel)',

  -- Métadonnées
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création de l''enregistrement',

  PRIMARY KEY (`id`),

  -- Index pour les performances
  KEY `idx_id_expediteur` (`id_expediteur`),
  KEY `idx_id_destinataire` (`id_destinataire`),
  KEY `idx_date_remarque` (`date_remarque`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_nature_remarque` (`nature_remarque`),

  -- Index composites pour filtres courants
  KEY `idx_destinataire_date` (`id_destinataire`, `date_remarque`),
  KEY `idx_expediteur_date` (`id_expediteur`, `date_remarque`)

  -- Clés étrangères (décommenter si vous voulez les contraintes)
  -- ,CONSTRAINT `fk_remarques_expediteur` FOREIGN KEY (`id_expediteur`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_remarques_destinataire` FOREIGN KEY (`id_destinataire`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_remarques_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Remarques envoyées par les agents qualité aux agents qualification';


-- =====================================================
-- Vérification de la création
-- =====================================================

DESCRIBE remarques;
SHOW INDEX FROM remarques;


-- =====================================================
-- Exemples de requêtes utiles
-- =====================================================

-- Remarques reçues par un agent qualification (destinataire)
-- SELECT r.*, exp.pseudo AS expediteur_pseudo, dest.pseudo AS destinataire_pseudo
-- FROM remarques r
-- LEFT JOIN utilisateurs exp ON r.id_expediteur = exp.id
-- LEFT JOIN utilisateurs dest ON r.id_destinataire = dest.id
-- WHERE r.id_destinataire = ?
-- ORDER BY r.date_remarque DESC;

-- Remarques envoyées par un agent qualité (expéditeur)
-- SELECT r.*, exp.pseudo AS expediteur_pseudo, dest.pseudo AS destinataire_pseudo
-- FROM remarques r
-- LEFT JOIN utilisateurs exp ON r.id_expediteur = exp.id
-- LEFT JOIN utilisateurs dest ON r.id_destinataire = dest.id
-- WHERE r.id_expediteur = ?
-- ORDER BY r.date_remarque DESC;

-- Remarques sur une fiche donnée
-- SELECT r.*, exp.pseudo AS expediteur_pseudo, dest.pseudo AS destinataire_pseudo
-- FROM remarques r
-- LEFT JOIN utilisateurs exp ON r.id_expediteur = exp.id
-- LEFT JOIN utilisateurs dest ON r.id_destinataire = dest.id
-- WHERE r.id_fiche = ?
-- ORDER BY r.date_remarque DESC;
