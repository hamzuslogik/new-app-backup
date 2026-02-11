-- =====================================================
-- Script de création de la table alert_ko
-- Date: 2026-02-11
-- Description: Table des alertes envoyées aux agents qualification (fonction 3)
--              avant passage en KO. 3 alertes doivent être envoyées avant de
--              pouvoir passer une fiche en KO.
-- =====================================================

-- Supprimer la table si elle existe (décommenter si nécessaire)
-- DROP TABLE IF EXISTS alert_ko;

-- Création de la table alert_ko
CREATE TABLE IF NOT EXISTS `alert_ko` (
  `id` int(11) NOT NULL AUTO_INCREMENT,

  -- Fiche concernée
  `id_fiche` int(11) NOT NULL COMMENT 'ID de la fiche concernée par l''alerte',

  -- Agent qualification (fonction 3) destinataire de l''alerte
  `id_agent` int(11) NOT NULL COMMENT 'ID de l''agent qualification (fonction 3) à qui l''alerte est envoyée',

  -- Qualité qui envoie l''alerte
  `id_qualite` int(11) NOT NULL COMMENT 'ID de l''utilisateur qualité qui envoie l''alerte',

  -- État et sous-état sélectionnés au moment de l''alerte
  `id_etat` int(11) DEFAULT NULL COMMENT 'ID de l''état sélectionné',
  `id_sous_etat` int(11) DEFAULT NULL COMMENT 'ID du sous-état sélectionné',

  -- Numéro de l''alerte (1, 2 ou 3) : 3 alertes avant passage au KO
  `num_alerte` tinyint(1) NOT NULL COMMENT 'Numéro de l''alerte (1=1ère, 2=2e, 3=3e)',

  -- Date et heure d''envoi de l''alerte
  `date_alerte` datetime NOT NULL COMMENT 'Date et heure d''envoi de l''alerte',

  -- Informations client (snapshot pour affichage liste / historique)
  `nom` varchar(255) DEFAULT NULL COMMENT 'Nom du client (fiche)',
  `prenom` varchar(255) DEFAULT NULL COMMENT 'Prénom du client (fiche)',
  `tel` varchar(50) DEFAULT NULL COMMENT 'Téléphone du client (fiche)',

  -- Message ou commentaire associé à l''alerte
  `commentaire` text DEFAULT NULL COMMENT 'Commentaire ou message de l''alerte',

  -- Métadonnées
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création de l''enregistrement',

  PRIMARY KEY (`id`),

  -- Index pour les performances
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_agent` (`id_agent`),
  KEY `idx_id_qualite` (`id_qualite`),
  KEY `idx_date_alerte` (`date_alerte`),
  KEY `idx_id_etat` (`id_etat`),
  KEY `idx_id_sous_etat` (`id_sous_etat`),
  KEY `idx_num_alerte` (`num_alerte`),

  -- Index composite : compter les alertes par fiche (doit atteindre 3 avant KO)
  KEY `idx_fiche_num` (`id_fiche`, `num_alerte`),
  KEY `idx_agent_date` (`id_agent`, `date_alerte`)

  -- Clés étrangères (décommenter si vous voulez les contraintes)
  -- ,CONSTRAINT `fk_alert_ko_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE
  -- ,CONSTRAINT `fk_alert_ko_agent` FOREIGN KEY (`id_agent`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_alert_ko_qualite` FOREIGN KEY (`id_qualite`) REFERENCES `utilisateurs` (`id`)
  -- ,CONSTRAINT `fk_alert_ko_etat` FOREIGN KEY (`id_etat`) REFERENCES `etats` (`id`)
  -- ,CONSTRAINT `fk_alert_ko_sous_etat` FOREIGN KEY (`id_sous_etat`) REFERENCES `sous_etat` (`id`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Alertes KO envoyées aux agents qualification (3 alertes avant KO)';

-- =====================================================
-- Vérification de la création
-- =====================================================

DESCRIBE alert_ko;
SHOW INDEX FROM alert_ko;

-- =====================================================
-- Exemples de requêtes utiles
-- =====================================================

-- Nombre d'alertes envoyées par fiche (doit être >= 3 pour autoriser le KO)
-- SELECT id_fiche, COUNT(*) AS nb_alertes
-- FROM alert_ko
-- GROUP BY id_fiche;

-- Vérifier si une fiche a déjà reçu 3 alertes (autorisation passage KO)
-- SELECT id_fiche, COUNT(*) AS nb_alertes
-- FROM alert_ko
-- WHERE id_fiche = ?
-- GROUP BY id_fiche;
-- -- Si nb_alertes >= 3 alors passage KO autorisé

-- Historique des alertes pour un agent (fonction 3)
-- SELECT a.*, f.nom, f.prenom, f.tel
-- FROM alert_ko a
-- LEFT JOIN fiches f ON f.id = a.id_fiche
-- WHERE a.id_agent = ?
-- ORDER BY a.date_alerte DESC;
