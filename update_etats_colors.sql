-- Script SQL pour mettre à jour les couleurs des états selon les codes RGB fournis
-- Les couleurs sont stockées en format hexadécimal (#RRGGBB)

USE `crm`;

-- Phase 1
UPDATE `etats` SET `color` = '#FFFF15' WHERE `titre` = 'NRP';
UPDATE `etats` SET `color` = '#FEB770' WHERE `titre` = 'RAPPEL POUR BUREAU';
UPDATE `etats` SET `color` = '#FF0000' WHERE `titre` = 'ANNULER';
UPDATE `etats` SET `color` = '#6D8049' WHERE `titre` = 'HORS CIBLE AIR AIR';
UPDATE `etats` SET `color` = '#000000' WHERE `titre` = 'HORS CIBLE AGE / DOUBLON / LOCATAIRE';
UPDATE `etats` SET `color` = '#AF0030' WHERE `titre` = 'ANNULER 2 FOIS';
UPDATE `etats` SET `color` = '#B4C6D6' WHERE `titre` = 'HORS CIBLE FINANCEMENT';
UPDATE `etats` SET `color` = '#555555' WHERE `titre` = 'HORS CIBLE CONFIRMATEUR';

-- Phase 2
UPDATE `etats` SET `color` = '#00CC00' WHERE `titre` = 'CONFIRMER';
UPDATE `etats` SET `color` = '#158701' WHERE `titre` = 'ANNULER ET A REPROGRAMMER';
UPDATE `etats` SET `color` = '#FE83FE' WHERE `titre` = 'CLIENT HONORE A SUIVRE';
UPDATE `etats` SET `color` = '#AB1111' WHERE `titre` = 'RDV ANNULER';
UPDATE `etats` SET `color` = '#FF0000' WHERE `titre` = 'RDV ANNULER 2 FOIS';
UPDATE `etats` SET `color` = '#FF0000' WHERE `titre` = 'REFUSER';
UPDATE `etats` SET `color` = '#475D27' WHERE `titre` = 'HHC FINANCEMENT A VERIFIER';
UPDATE `etats` SET `color` = '#FF0000' WHERE `titre` = 'REFUSER 2 FOIS';
UPDATE `etats` SET `color` = '#899A70' WHERE `titre` = 'HHC TECHNIQUE';
UPDATE `etats` SET `color` = '#2C420C' WHERE `titre` = 'HHC ERREUR CONFIRMATEUR';
UPDATE `etats` SET `color` = '#5A6A42' WHERE `titre` = 'HHC MENSONGE CLIENT';

-- Phase 3
UPDATE `etats` SET `color` = '#FF3380' WHERE `titre` = 'SIGNER';
UPDATE `etats` SET `color` = '#FF0000' WHERE `titre` = 'SIGNER RETRACTER';
UPDATE `etats` SET `color` = '#800510' WHERE `titre` = 'SIGNER RETRACTER 2 FOIS';
UPDATE `etats` SET `color` = '#9262DA' WHERE `titre` = 'SIGNER COMPLET';
UPDATE `etats` SET `color` = '#CC00FF' WHERE `titre` = 'SIGNER PM';

-- Vérification des mises à jour
SELECT 
  `id`,
  `titre`,
  `color`,
  `groupe`,
  `abbreviation`
FROM `etats`
WHERE `color` IS NOT NULL
ORDER BY `groupe`, `ordre`;

