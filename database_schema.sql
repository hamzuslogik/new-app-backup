-- =====================================================
-- Script de création de la base de données CRM
-- Base de données: crm
-- Host: 151.80.58.72
-- =====================================================

-- Créer la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS `crm` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `crm`;

-- =====================================================
-- TABLE: utilisateurs
-- =====================================================
CREATE TABLE IF NOT EXISTS `utilisateurs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(600) CHARACTER SET utf8 DEFAULT NULL,
  `prenom` varchar(600) CHARACTER SET utf8 DEFAULT NULL,
  `pseudo` varchar(80) CHARACTER SET utf8 DEFAULT NULL,
  `tel` varchar(15) DEFAULT NULL,
  `mail` varchar(600) DEFAULT NULL,
  `login` varchar(600) CHARACTER SET utf8 DEFAULT NULL,
  `mdp` varchar(600) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  `color` varchar(50) DEFAULT NULL,
  `date` int(11) DEFAULT NULL,
  `fonction` int(11) DEFAULT NULL,
  `chef_equipe` int(11) DEFAULT NULL,
  `centre` int(11) DEFAULT NULL,
  `photo` varchar(600) CHARACTER SET utf8 DEFAULT NULL,
  `genre` int(11) DEFAULT NULL COMMENT '1=Femme, 2=Homme',
  PRIMARY KEY (`id`),
  KEY `idx_fonction` (`fonction`),
  KEY `idx_centre` (`centre`),
  KEY `idx_etat` (`etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: fonctions
-- =====================================================
CREATE TABLE IF NOT EXISTS `fonctions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: centres
-- =====================================================
CREATE TABLE IF NOT EXISTS `centres` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: departements
-- =====================================================
CREATE TABLE IF NOT EXISTS `departements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `departement_code` varchar(3) DEFAULT NULL,
  `departement_nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `departement_nom_uppercase` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_code` (`departement_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: etats
-- =====================================================
CREATE TABLE IF NOT EXISTS `etats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `groupe` varchar(50) DEFAULT NULL,
  `ordre` int(11) DEFAULT 0,
  `taux` varchar(50) DEFAULT NULL COMMENT 'NEUTRE, POSITIVE, NEGATIVE',
  `abbreviation` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ordre` (`ordre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: produits
-- =====================================================
CREATE TABLE IF NOT EXISTS `produits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: fiches
-- =====================================================
CREATE TABLE IF NOT EXISTS `fiches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `civ` varchar(100) CHARACTER SET utf8 DEFAULT NULL,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `prenom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `gsm1` varchar(100) DEFAULT NULL,
  `gsm2` varchar(100) DEFAULT NULL,
  `adresse` text CHARACTER SET utf8 DEFAULT NULL,
  `cp` varchar(20) DEFAULT NULL,
  `ville` varchar(150) CHARACTER SET utf8 DEFAULT NULL,
  `etude` varchar(10) DEFAULT NULL,
  `consommation_chauffage` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `surface_habitable` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `annee_systeme_chauffage` int(11) DEFAULT NULL,
  `surface_chauffee` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `proprietaire_maison` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `nb_pieces` int(11) DEFAULT NULL,
  `nb_pans` int(11) DEFAULT NULL,
  `age_maison` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `orientation_toiture` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `produit` int(11) DEFAULT NULL,
  `nb_chemines` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `mode_chauffage` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `consommation_electricite` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `age_mr` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `age_madame` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `revenu_foyer` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `credit_foyer` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `situation_conjugale` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `nb_enfants` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `profession_mr` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `profession_madame` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `commentaire` text CHARACTER SET utf8 DEFAULT NULL,
  `id_agent` int(11) DEFAULT NULL,
  `id_centre` int(11) DEFAULT NULL,
  `id_insert` int(11) DEFAULT NULL,
  `id_confirmateur` int(11) DEFAULT NULL,
  `id_confirmateur_2` int(11) DEFAULT NULL,
  `id_confirmateur_3` int(11) DEFAULT NULL,
  `id_qualite` int(11) DEFAULT NULL,
  `id_qualif` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `id_commercial_2` int(11) DEFAULT NULL,
  `id_etat_final` int(11) DEFAULT NULL,
  `date_appel` bigint(20) DEFAULT NULL,
  `date_insert` bigint(20) DEFAULT NULL,
  `date_insert_time` datetime DEFAULT NULL,
  `date_audit` bigint(20) DEFAULT NULL,
  `date_confirmation` bigint(20) DEFAULT NULL,
  `date_qualif` bigint(20) DEFAULT NULL,
  `date_rdv` bigint(20) DEFAULT NULL,
  `date_rdv_time` datetime DEFAULT NULL,
  `date_affect` bigint(20) DEFAULT NULL,
  `date_sign` bigint(20) DEFAULT NULL,
  `date_sign_time` datetime DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  `archive` int(11) DEFAULT 0,
  `ko` int(11) DEFAULT 0,
  `hc` int(11) DEFAULT 0,
  `active` int(11) DEFAULT 1,
  `valider` int(11) DEFAULT 0,
  `conf_commentaire_produit` text CHARACTER SET utf8 DEFAULT NULL,
  `conf_consommations` int(11) DEFAULT NULL,
  `conf_profession_monsieur` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_profession_madame` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_presence_couple` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_produit` int(11) DEFAULT NULL,
  `conf_orientation_toiture` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_zones_ombres` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_site_classe` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_consommation_electricite` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `cq_etat` int(11) DEFAULT NULL,
  `cq_dossier` int(11) DEFAULT NULL,
  `ph3_installateur` int(11) DEFAULT NULL,
  `ph3_pac` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_puissance` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_puissance_pv` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_rr_model` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_ballon` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_marque_ballon` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_alimentation` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_type` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_prix` decimal(10,2) DEFAULT NULL,
  `ph3_bonus_30` decimal(10,2) DEFAULT NULL,
  `ph3_mensualite` decimal(10,2) DEFAULT NULL,
  `ph3_attente` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `nbr_annee_finance` int(11) DEFAULT NULL,
  `credit_immobilier` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `credit_autre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_centre` (`id_centre`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_id_confirmateur` (`id_confirmateur`),
  KEY `idx_id_etat_final` (`id_etat_final`),
  KEY `idx_produit` (`produit`),
  KEY `idx_date_rdv_time` (`date_rdv_time`),
  KEY `idx_date_modif_time` (`date_modif_time`),
  KEY `idx_archive` (`archive`),
  KEY `idx_active` (`active`),
  KEY `idx_cp` (`cp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: fiches_histo
-- =====================================================
CREATE TABLE IF NOT EXISTS `fiches_histo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_etat` int(11) DEFAULT NULL,
  `date_rdv_time` datetime DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_etat` (`id_etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: decalages
-- =====================================================
CREATE TABLE IF NOT EXISTS `decalages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `expediteur` int(11) DEFAULT NULL,
  `destination` int(11) DEFAULT NULL,
  `message` text CHARACTER SET utf8 DEFAULT NULL,
  `id_etat` int(11) DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  `modifie_le` datetime DEFAULT NULL,
  `date_prevu` datetime DEFAULT NULL,
  `date_nouvelle` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_expediteur` (`expediteur`),
  KEY `idx_destination` (`destination`),
  KEY `idx_id_etat` (`id_etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: etat_decalage
-- =====================================================
CREATE TABLE IF NOT EXISTS `etat_decalage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: affectations
-- =====================================================
CREATE TABLE IF NOT EXISTS `affectations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `date_modif` bigint(20) DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_commercial` (`id_commercial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: transferts
-- =====================================================
CREATE TABLE IF NOT EXISTS `transferts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_dec` int(11) DEFAULT NULL,
  `id_fiche` int(11) DEFAULT NULL,
  `expediteur` int(11) DEFAULT NULL,
  `transfert` int(11) DEFAULT NULL,
  `date_exec` date DEFAULT NULL,
  `modifie_le` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_dec` (`id_dec`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_transfert` (`transfert`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: chats
-- =====================================================
CREATE TABLE IF NOT EXISTS `chats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `expediteur` int(11) DEFAULT NULL,
  `destination` int(11) DEFAULT NULL,
  `message` text CHARACTER SET utf8 DEFAULT NULL,
  `lu` int(11) DEFAULT 0,
  `date_modif` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expediteur` (`expediteur`),
  KEY `idx_destination` (`destination`),
  KEY `idx_lu` (`lu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: installateurs
-- =====================================================
CREATE TABLE IF NOT EXISTS `installateurs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `etat` int(11) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: cq_etat
-- =====================================================
CREATE TABLE IF NOT EXISTS `cq_etat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: cq_dossier
-- =====================================================
CREATE TABLE IF NOT EXISTS `cq_dossier` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: compte_rendu
-- =====================================================
CREATE TABLE IF NOT EXISTS `compte_rendu` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `contenu` text CHARACTER SET utf8 DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_commercial` (`id_commercial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: professions
-- =====================================================
CREATE TABLE IF NOT EXISTS `professions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: mode_chauffage
-- =====================================================
CREATE TABLE IF NOT EXISTS `mode_chauffage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: etude_raison
-- =====================================================
CREATE TABLE IF NOT EXISTS `etude_raison` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: type_contrat
-- =====================================================
CREATE TABLE IF NOT EXISTS `type_contrat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sous_etat
-- =====================================================
CREATE TABLE IF NOT EXISTS `sous_etat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_etat` int(11) DEFAULT NULL,
  `titre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_etat` (`id_etat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: groupe_etat
-- =====================================================
CREATE TABLE IF NOT EXISTS `groupe_etat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_etat` int(11) DEFAULT NULL,
  `id_func` int(11) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_etat` (`id_etat`),
  KEY `idx_id_func` (`id_func`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: planning_hbd
-- =====================================================
CREATE TABLE IF NOT EXISTS `planning_hbd` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `week` int(11) DEFAULT NULL,
  `year` int(11) DEFAULT NULL,
  `nbr_com` int(11) DEFAULT NULL,
  `dep` varchar(10) DEFAULT NULL,
  `timestamp` bigint(20) DEFAULT NULL,
  `date_day` date DEFAULT NULL,
  `date_modif` bigint(20) DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_week_year_dep` (`week`, `year`, `dep`),
  KEY `idx_date_day` (`date_day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: planning_availablity
-- =====================================================
CREATE TABLE IF NOT EXISTS `planning_availablity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `week` int(11) DEFAULT NULL,
  `year` int(11) DEFAULT NULL,
  `dep` varchar(10) DEFAULT NULL,
  `date_day` date DEFAULT NULL,
  `hour` time DEFAULT NULL,
  `force_crenaux` tinyint(1) DEFAULT 0,
  `nbr_com` int(11) DEFAULT NULL,
  `date_modif` bigint(20) DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_week_year_dep` (`week`, `year`, `dep`),
  KEY `idx_date_day_hour` (`date_day`, `hour`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INSERTION DES DONNÉES DE BASE
-- =====================================================

-- Insérer quelques fonctions de base
INSERT INTO `fonctions` (`id`, `titre`, `etat`) VALUES
(1, 'Administrateur', 1),
(2, 'Superviseur', 1),
(3, 'Agent', 1),
(4, 'Rôle Spécial', 1),
(5, 'Commercial', 1),
(6, 'Confirmateur', 1),
(7, 'Manager', 1),
(8, 'Rôle Spécial 2', 1),
(9, 'Rôle Spécial 3', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`);

-- Insérer quelques états de base
INSERT INTO `etats` (`id`, `titre`, `color`, `groupe`, `ordre`, `taux`, `abbreviation`) VALUES
(1, 'Nouveau', '#cccccc', 'nouveau', 1, 'NEUTRE', 'NV'),
(7, 'Rendez-vous', '#4CAF50', 'rdv', 7, 'POSITIVE', 'RDV'),
(9, 'Rappel', '#ff9800', 'rappel', 9, 'NEUTRE', 'R2'),
(11, 'Annulé', '#f44336', 'annule', 11, 'NEGATIVE', 'AN'),
(12, 'Refusé', '#f44336', 'refus', 12, 'NEGATIVE', 'RF'),
(13, 'Signé', '#4CAF50', 'signe', 13, 'POSITIVE', 'SGN'),
(16, 'Terminé', '#2196F3', 'termine', 16, 'POSITIVE', 'TER'),
(38, 'Terminé 2', '#2196F3', 'termine', 38, 'POSITIVE', 'TER2'),
(44, 'Signé 2', '#4CAF50', 'signe', 44, 'POSITIVE', 'SGN2'),
(45, 'Signé 3', '#4CAF50', 'signe', 45, 'POSITIVE', 'SGN3')
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`);

-- Insérer quelques produits
INSERT INTO `produits` (`id`, `nom`) VALUES
(1, 'PAC'),
(2, 'PV')
ON DUPLICATE KEY UPDATE `nom`=VALUES(`nom`);

-- Insérer quelques états de décalage
INSERT INTO `etat_decalage` (`id`, `titre`) VALUES
(1, 'En attente'),
(2, 'Accepté'),
(3, 'Refusé')
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`);

-- =====================================================
-- CONTRAINTES DE CLÉS ÉTRANGÈRES (optionnel)
-- =====================================================
-- Note: Les clés étrangères sont commentées car elles peuvent causer des problèmes
-- si les données existantes ne respectent pas les contraintes
-- Décommentez-les après avoir vérifié l'intégrité des données

/*
ALTER TABLE `utilisateurs`
  ADD CONSTRAINT `fk_utilisateurs_fonction` FOREIGN KEY (`fonction`) REFERENCES `fonctions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_utilisateurs_centre` FOREIGN KEY (`centre`) REFERENCES `centres` (`id`) ON DELETE SET NULL;

ALTER TABLE `fiches`
  ADD CONSTRAINT `fk_fiches_centre` FOREIGN KEY (`id_centre`) REFERENCES `centres` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_fiches_commercial` FOREIGN KEY (`id_commercial`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_fiches_confirmateur` FOREIGN KEY (`id_confirmateur`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_fiches_etat` FOREIGN KEY (`id_etat_final`) REFERENCES `etats` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_fiches_produit` FOREIGN KEY (`produit`) REFERENCES `produits` (`id`) ON DELETE SET NULL;

ALTER TABLE `fiches_histo`
  ADD CONSTRAINT `fk_fiches_histo_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_fiches_histo_etat` FOREIGN KEY (`id_etat`) REFERENCES `etats` (`id`) ON DELETE SET NULL;

ALTER TABLE `decalages`
  ADD CONSTRAINT `fk_decalages_fiche` FOREIGN KEY (`id_fiche`) REFERENCES `fiches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_decalages_expediteur` FOREIGN KEY (`expediteur`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_decalages_destination` FOREIGN KEY (`destination`) REFERENCES `utilisateurs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_decalages_etat` FOREIGN KEY (`id_etat`) REFERENCES `etat_decalage` (`id`) ON DELETE SET NULL;

ALTER TABLE `chats`
  ADD CONSTRAINT `fk_chats_expediteur` FOREIGN KEY (`expediteur`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chats_destination` FOREIGN KEY (`destination`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE;
*/

-- =====================================================
-- TABLE: sms
-- =====================================================
CREATE TABLE IF NOT EXISTS `sms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_confirmateur` int(11) DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `message` text CHARACTER SET utf8 DEFAULT NULL,
  `statut` varchar(50) DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_confirmateur` (`id_confirmateur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: modifica
-- =====================================================
CREATE TABLE IF NOT EXISTS `modifica` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_user` int(11) DEFAULT NULL,
  `type` varchar(100) CHARACTER SET utf8 DEFAULT NULL,
  `ancien_valeur` text CHARACTER SET utf8 DEFAULT NULL,
  `nouvelle_valeur` text CHARACTER SET utf8 DEFAULT NULL,
  `date_modif_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_user` (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: modification_log
-- =====================================================
CREATE TABLE IF NOT EXISTS `modification_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) NOT NULL,
  `modifier_par` varchar(100) CHARACTER SET utf8 NOT NULL,
  `champs` varchar(100) CHARACTER SET utf8 NOT NULL,
  `valeur` text CHARACTER SET utf8 NOT NULL,
  `Date_Heure` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Old_valeur` text CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_modifier_par` (`modifier_par`),
  KEY `idx_date_heure` (`Date_Heure`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

