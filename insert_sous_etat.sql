-- =====================================================
-- INSERTION DES SOUS-ÉTATS
-- =====================================================
-- Ce script insère les sous-états pour différents états de fiches
-- Les titres sont en MAJUSCULE comme demandé
-- 
-- Note: Ce script supprime d'abord les sous-états existants pour chaque état
-- puis insère les nouveaux pour éviter les doublons

-- NRP (id_etat = 2)
DELETE FROM `sous_etat` WHERE `id_etat` = 2;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(2, 'APPEL RACCROCHÉ'),
(2, 'RÉPONDEUR');

-- RAPPEL POUR BUREAU (id_etat = 19)
DELETE FROM `sous_etat` WHERE `id_etat` = 19;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(19, 'ABSENT'),
(19, 'PAS DÉBALLÉ / PAS LE TEMPS'),
(19, 'DÉBALLÉ VEUT VOIR SON CONJOINT'),
(19, 'DÉBALLÉ DOIT RÉFLÉCHIR'),
(19, 'EN VACANCE'),
(19, 'PAS DÉBALLÉ/ ÉNERVÉ');

-- ANNULER À REPROGRAMMER (id_etat = 8)
DELETE FROM `sous_etat` WHERE `id_etat` = 8;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(8, 'PAS PRÉSENCE DE COUPLE'),
(8, 'INJOIGNABLE'),
(8, 'IMPRÉVU CLIENT'),
(8, 'PORTE'),
(8, 'TECHNICIEN BLESSÉ'),
(8, 'CONF NON HONORÉ PRÉVENU'),
(8, 'RETARD DU COMMERCIAL'),
(8, 'MESSAGE DU CLIENT'),
(8, 'NE SAIT PAS'),
(8, 'AUTRE');

-- SIGNER (id_etat = 13)
DELETE FROM `sous_etat` WHERE `id_etat` = 13;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(13, 'COMPLÉTÉ'),
(13, 'INCOMPLÉTÉ'),
(13, 'SIGNÉ SIMPLE'),
(13, 'SIGNÉ R2 CONFIRMATEUR'),
(13, 'SIGNÉ R2 COMMERCIAL'),
(13, 'SIGNÉ 50/50');

-- SIGNER RETRACTER (id_etat = 16)
DELETE FROM `sous_etat` WHERE `id_etat` = 16;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(16, 'COMPLÉTÉ'),
(16, 'INCOMPLÉTÉ'),
(16, 'SIGNÉ SIMPLE'),
(16, 'SIGNÉ R2 CONFIRMATEUR'),
(16, 'SIGNÉ R2 COMMERCIAL'),
(16, 'SIGNÉ 50/50');

-- SIGNER COMPLET (id_etat = 45)
DELETE FROM `sous_etat` WHERE `id_etat` = 45;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(45, 'COMPLÉTÉ'),
(45, 'INCOMPLÉTÉ'),
(45, 'SIGNÉ SIMPLE'),
(45, 'SIGNÉ R2 CONFIRMATEUR'),
(45, 'SIGNÉ R2 COMMERCIAL'),
(45, 'SIGNÉ 50/50');

-- SIGNER PM (id_etat = 44)
DELETE FROM `sous_etat` WHERE `id_etat` = 44;
INSERT INTO `sous_etat` (`id_etat`, `titre`) VALUES
(44, 'COMPLÉTÉ'),
(44, 'INCOMPLÉTÉ'),
(44, 'SIGNÉ SIMPLE'),
(44, 'SIGNÉ R2 CONFIRMATEUR'),
(44, 'SIGNÉ R2 COMMERCIAL'),
(44, 'SIGNÉ 50/50');

