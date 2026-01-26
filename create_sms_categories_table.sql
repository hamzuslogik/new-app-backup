-- =====================================================
-- Script pour créer la table des catégories de messages SMS
-- Base de données: crm
-- =====================================================

USE `crm`;

-- Créer la table des catégories de messages SMS
CREATE TABLE IF NOT EXISTS `sms_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) CHARACTER SET utf8 NOT NULL COMMENT 'Code unique de la catégorie (ex: rappel_rdv, pieces_manquantes)',
  `titre` varchar(255) CHARACTER SET utf8 NOT NULL COMMENT 'Titre affiché dans l\'interface (ex: RAPPEL RDV)',
  `message` text CHARACTER SET utf8 NOT NULL COMMENT 'Template du message avec variables {{nom}}, {{prenom}}, {{date_rdv_time}}, etc.',
  `ordre` int(11) DEFAULT 0 COMMENT 'Ordre d\'affichage',
  `actif` tinyint(1) DEFAULT 1 COMMENT '1 = actif, 0 = inactif',
  `date_creation` datetime DEFAULT NULL,
  `date_modif` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `actif` (`actif`),
  KEY `ordre` (`ordre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catégories de messages SMS prédéfinis';

-- Insérer les catégories par défaut
INSERT INTO `sms_categories` (`code`, `titre`, `message`, `ordre`, `actif`, `date_creation`) VALUES
('rappel_rdv', 'RAPPEL RDV', 'Cher(e) Mr/Mme {{prenom}} {{nom}},

Suite à notre appel téléphonique, Bureau central Environnement confirme votre rendez-vous prévu le {{date_rdv}} à {{heure_rdv}} avec l''un de nos techniciens, en présence de votre conjoint(e).

Restant à votre disposition pour tous renseignements complémentaires, nous vous prions d''agréer, Madame, Monsieur, nos salutations distinguées.', 1, 1, NOW()),
('pieces_manquantes', 'PIÉCES MANQUANTES', 'Cher(e) Mr/Mme {{prenom}} {{nom}},

Nous vous informons que des pièces manquantes sont nécessaires pour finaliser votre dossier.

Veuillez nous contacter au plus vite pour compléter votre dossier.

Cordialement.', 2, 1, NOW()),
('signer_nrp', 'SIGNER NRP', 'Cher(e) Mr/Mme {{prenom}} {{nom}},

Nous vous rappelons qu''il est important de signer votre contrat NRP.

Veuillez nous contacter pour finaliser votre dossier.

Cordialement.', 3, 1, NOW())
ON DUPLICATE KEY UPDATE
  titre = VALUES(titre),
  message = VALUES(message),
  ordre = VALUES(ordre),
  actif = VALUES(actif);

-- Vérification
SELECT 'Table sms_categories créée avec succès' AS message;
SELECT * FROM sms_categories ORDER BY ordre ASC;

