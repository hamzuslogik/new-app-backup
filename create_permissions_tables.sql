-- =====================================================
-- Script pour créer les tables de gestion des permissions
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- TABLE: permissions
-- Définit toutes les permissions disponibles dans l'application
-- =====================================================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8 NOT NULL COMMENT 'Code unique de la permission (ex: dashboard_view, fiche_create)',
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Nom affiché de la permission',
  `description` text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Description de la permission',
  `categorie` varchar(100) CHARACTER SET utf8 DEFAULT NULL COMMENT 'Catégorie (page, action, fonctionnalite)',
  `ordre` int(11) DEFAULT 0 COMMENT 'Ordre d''affichage',
  `etat` int(11) DEFAULT 1 COMMENT '1: actif, 0: inactif',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_categorie` (`categorie`),
  KEY `idx_etat` (`etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: fonction_permissions
-- Associe les permissions aux fonctions
-- =====================================================
CREATE TABLE IF NOT EXISTS `fonction_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fonction` int(11) NOT NULL COMMENT 'ID de la fonction',
  `id_permission` int(11) NOT NULL COMMENT 'ID de la permission',
  `autorise` tinyint(1) DEFAULT 1 COMMENT '1: autorisé, 0: refusé',
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `date_modif` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fonction_permission` (`id_fonction`, `id_permission`),
  KEY `idx_id_fonction` (`id_fonction`),
  KEY `idx_id_permission` (`id_permission`),
  CONSTRAINT `fk_fp_fonction` FOREIGN KEY (`id_fonction`) REFERENCES `fonctions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fp_permission` FOREIGN KEY (`id_permission`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Insertion des permissions de base
-- =====================================================

-- Permissions pour les pages
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`) VALUES
('dashboard_view', 'Voir le tableau de bord', 'Accès à la page Dashboard', 'page', 1),
('fiches_view', 'Voir les fiches', 'Accès à la page Fiches', 'page', 2),
('fiches_create', 'Créer une fiche', 'Créer une nouvelle fiche', 'action', 3),
('fiches_edit', 'Modifier une fiche', 'Modifier une fiche existante', 'action', 4),
('fiches_delete', 'Supprimer une fiche', 'Supprimer une fiche', 'action', 5),
('fiches_archive', 'Archiver une fiche', 'Archiver une fiche', 'action', 6),
('fiches_detail', 'Voir le détail d''une fiche', 'Accès à la page de détail d''une fiche', 'action', 7),
('planning_view', 'Voir le planning', 'Accès à la page Planning', 'page', 8),
('planning_create', 'Créer un planning', 'Créer un nouveau planning', 'action', 9),
('planning_edit', 'Modifier un planning', 'Modifier un planning existant', 'action', 10),
('planning_delete', 'Supprimer un planning', 'Supprimer un planning', 'action', 11),
('statistiques_view', 'Voir les statistiques', 'Accès à la page Statistiques', 'page', 12),
('affectation_view', 'Voir l''affectation', 'Accès à la page Affectation', 'page', 13),
('affectation_edit', 'Modifier l''affectation', 'Affecter/désaffecter des fiches', 'action', 14),
('suivi_telepro_view', 'Voir le suivi télépro', 'Accès à la page Suivi Télépro', 'page', 15),
('compte_rendu_view', 'Voir les comptes rendus', 'Accès à la page Compte Rendu', 'page', 16),
('compte_rendu_create', 'Créer un compte rendu', 'Créer un nouveau compte rendu', 'action', 17),
('compte_rendu_edit', 'Modifier un compte rendu', 'Modifier un compte rendu existant', 'action', 18),
('compte_rendu_delete', 'Supprimer un compte rendu', 'Supprimer un compte rendu', 'action', 19),
('phase3_view', 'Voir Phase 3', 'Accès à la page Phase 3', 'page', 20),
('messages_view', 'Voir les messages', 'Accès à la page Messages', 'page', 21),
('messages_send', 'Envoyer un message', 'Envoyer un message', 'action', 22),
('users_view', 'Voir les utilisateurs', 'Accès à la page Utilisateurs', 'page', 23),
('users_create', 'Créer un utilisateur', 'Créer un nouvel utilisateur', 'action', 24),
('users_edit', 'Modifier un utilisateur', 'Modifier un utilisateur existant', 'action', 25),
('users_delete', 'Supprimer un utilisateur', 'Supprimer un utilisateur', 'action', 26),
('management_view', 'Voir la gestion', 'Accès à la page Gestion', 'page', 27),
('management_edit', 'Modifier la configuration', 'Modifier les paramètres de configuration', 'action', 28);

-- Permissions pour les fonctionnalités spécifiques
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`) VALUES
('fiche_validate', 'Valider une fiche', 'Valider/invalider une fiche confirmée', 'fonctionnalite', 29),
('fiche_quick_edit', 'Modification rapide', 'Modifier rapidement un champ de fiche', 'fonctionnalite', 30),
('fiche_sms_send', 'Envoyer un SMS', 'Envoyer un SMS depuis la fiche', 'fonctionnalite', 31),
('planning_duplicate', 'Dupliquer un planning', 'Dupliquer un planning existant', 'fonctionnalite', 32),
('planning_availability', 'Gérer les disponibilités', 'Créer/modifier les disponibilités', 'fonctionnalite', 33),
('statistiques_export', 'Exporter les statistiques', 'Exporter les statistiques en CSV/PDF', 'fonctionnalite', 34),
('fiche_export', 'Exporter les fiches', 'Exporter les fiches en CSV/PDF', 'fonctionnalite', 35);

-- Permissions pour les filtres et recherches
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`) VALUES
('search_advanced', 'Recherche avancée', 'Utiliser la recherche avancée', 'fonctionnalite', 36),
('filter_by_centre', 'Filtrer par centre', 'Filtrer les résultats par centre', 'fonctionnalite', 37),
('filter_by_confirmateur', 'Filtrer par confirmateur', 'Filtrer les résultats par confirmateur', 'fonctionnalite', 38),
('filter_by_commercial', 'Filtrer par commercial', 'Filtrer les résultats par commercial', 'fonctionnalite', 39),
('filter_by_etat', 'Filtrer par état', 'Filtrer les résultats par état', 'fonctionnalite', 40);

-- Permissions pour les actions administratives
INSERT INTO `permissions` (`code`, `nom`, `description`, `categorie`, `ordre`) VALUES
('config_centres', 'Gérer les centres', 'Créer/modifier/supprimer les centres', 'admin', 41),
('config_departements', 'Gérer les départements', 'Créer/modifier/supprimer les départements', 'admin', 42),
('config_produits', 'Gérer les produits', 'Créer/modifier/supprimer les produits', 'admin', 43),
('config_etats', 'Gérer les états', 'Créer/modifier/supprimer les états', 'admin', 44),
('config_fonctions', 'Gérer les fonctions', 'Créer/modifier/supprimer les fonctions', 'admin', 45),
('config_permissions', 'Gérer les permissions', 'Gérer les permissions des fonctions', 'admin', 46);

-- Vérification
SELECT 'Tables de permissions créées avec succès' AS message;

