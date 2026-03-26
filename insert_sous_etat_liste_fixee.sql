-- =====================================================
-- Insertion des sous-etats (liste fixee)
-- =====================================================
-- Mapping etats:
-- NRP -> id_etat = 2
-- RAPPEL BUREAU -> id_etat = 19
-- ANNULER A REPROGRAMMER -> id_etat = 8
-- SIGNER -> id_etat = 13

USE `crm`;

-- NRP (id_etat = 2)
INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 2, 'APPEL RACCROCHE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 2 AND `titre` = 'APPEL RACCROCHE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 2, 'REPONDEUR' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 2 AND `titre` = 'REPONDEUR');

-- RAPPEL BUREAU (id_etat = 19)
INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'ABSENT' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'ABSENT');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'PAS DEBALLER PAS LE TEMPS' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'PAS DEBALLER PAS LE TEMPS');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'DEBALLER VEUT VOIR CONJOINT' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'DEBALLER VEUT VOIR CONJOINT');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'DEBALLER IL DOIT REFLECHIR' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'DEBALLER IL DOIT REFLECHIR');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'EN VACANCE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'EN VACANCE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 19, 'PAS DEBALLER ENERVE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 19 AND `titre` = 'PAS DEBALLER ENERVE');

-- ANNULER A REPROGRAMMER (id_etat = 8)
INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'PAS DE PRESENCE DU COUPLE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'PAS DE PRESENCE DU COUPLE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'INJOIGNABLE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'INJOIGNABLE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'IMPREVU CLIENT' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'IMPREVU CLIENT');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'PORTE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'PORTE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'TECHNICIEN BLESSE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'TECHNICIEN BLESSE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'CONF NON HONORE NON PREVENU' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'CONF NON HONORE NON PREVENU');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'RETARD DU COMMERCIAL' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'RETARD DU COMMERCIAL');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'MESSAGE DU CLIENT' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'MESSAGE DU CLIENT');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'NE SAIT PAS' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'NE SAIT PAS');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 8, 'AUTRE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 8 AND `titre` = 'AUTRE');

-- SIGNER (id_etat = 13)
INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'COMPLETE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'COMPLETE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'IMCOMPLETE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'IMCOMPLETE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'SIGNER SIMPLE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'SIGNER SIMPLE');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'SIGNER R2 CONFIRMATEUR' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'SIGNER R2 CONFIRMATEUR');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'SIGNER R2 COMMERCIAL' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'SIGNER R2 COMMERCIAL');

INSERT INTO `sous_etat` (`id_etat`, `titre`)
SELECT 13, 'SIGNER 50/50' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `sous_etat` WHERE `id_etat` = 13 AND `titre` = 'SIGNER 50/50');

