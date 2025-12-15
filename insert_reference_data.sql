-- =====================================================
-- Script pour alimenter les nouvelles tables avec les données existantes
-- Base de données: crm
-- =====================================================
--
-- Ce script insère directement les données dans les nouvelles tables
-- sans dépendre des anciennes tables.
-- Il utilise ON DUPLICATE KEY UPDATE pour éviter les erreurs si les données existent déjà.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- DÉPARTEMENTS
-- =====================================================
-- Insertion des départements français avec leurs codes et noms

INSERT INTO `departements` (`departement_code`, `departement_nom`, `departement_nom_uppercase`, `etat`) VALUES
('01', 'Ain', 'AIN', 1),
('02', 'Aisne', 'AISNE', 1),
('03', 'Allier', 'ALLIER', 1),
('04', 'Alpes-de-Haute-Provence', 'ALPES-DE-HAUTE-PROVENCE', 1),
('05', 'Hautes-Alpes', 'HAUTES-ALPES', 1),
('06', 'Alpes-Maritimes', 'ALPES-MARITIMES', 1),
('07', 'Ardèche', 'ARDECHE', 1),
('08', 'Ardennes', 'ARDENNES', 1),
('10', 'Aube', 'AUBE', 1),
('14', 'Calvados', 'CALVADOS', 1),
('15', 'Cantal', 'CANTAL', 1),
('16', 'Charente', 'CHARENTE', 1),
('17', 'Charente-Maritime', 'CHARENTE-MARITIME', 1),
('19', 'Corrèze', 'CORREZE', 1),
('22', 'Côtes-d''Armor', 'COTES-D''ARMOR', 1),
('23', 'Creuse', 'CREUSE', 1),
('24', 'Dordogne', 'DORDOGNE', 1),
('25', 'Doubs', 'DOUBS', 1),
('26', 'Drôme', 'DROME', 1),
('27', 'Eure', 'EURE', 1),
('28', 'Eure-et-Loir', 'EURE-ET-LOIR', 1),
('29', 'Finistère', 'FINISTERE', 1),
('30', 'Gard', 'GARD', 1),
('31', 'Haute-Garonne', 'HAUTE-GARONNE', 1),
('32', 'Gers', 'GERS', 1),
('33', 'Gironde', 'GIRONDE', 1),
('34', 'Hérault', 'HERAULT', 1),
('35', 'Ille-et-Vilaine', 'ILLE-ET-VILAINE', 1),
('38', 'Isère', 'ISERE', 1),
('39', 'Jura', 'JURA', 1),
('40', 'Landes', 'LANDES', 1),
('42', 'Loire', 'LOIRE', 1),
('43', 'Haute-Loire', 'HAUTE-LOIRE', 1),
('44', 'Loire-Atlantique', 'LOIRE-ATLANTIQUE', 1),
('46', 'Lot', 'LOT', 1),
('47', 'Lot-et-Garonne', 'LOT-ET-GARONNE', 1),
('49', 'Maine-et-Loire', 'MAINE-ET-LOIRE', 1),
('50', 'Manche', 'MANCHE', 1),
('51', 'Marne', 'MARNE', 1),
('52', 'Haute-Marne', 'HAUTE-MARNE', 1),
('53', 'Mayenne', 'MAYENNE', 1),
('54', 'Meurthe-et-Moselle', 'MEURTHE-ET-MOSELLE', 1),
('55', 'Meuse', 'MEUSE', 1),
('56', 'Morbihan', 'MORBIHAN', 1),
('57', 'Moselle', 'MOSELLE', 1),
('59', 'Nord', 'NORD', 1),
('60', 'Oise', 'OISE', 1),
('61', 'Orne', 'ORNE', 1),
('62', 'Pas-de-Calais', 'PAS-DE-CALAIS', 1),
('63', 'Puy-de-Dôme', 'PUY-DE-DOME', 1),
('64', 'Pyrénées-Atlantiques', 'PYRENEES-ATLANTIQUES', 1),
('65', 'Hautes-Pyrénées', 'HAUTES-PYRENEES', 1),
('67', 'Bas-Rhin', 'BAS-RHIN', 1),
('68', 'Haut-Rhin', 'HAUT-RHIN', 1),
('69', 'Rhône', 'RHONE', 1),
('70', 'Haute-Saône', 'HAUTE-SAONE', 1),
('71', 'Saône-et-Loire', 'SAONE-ET-LOIRE', 1),
('73', 'Savoie', 'SAVOIE', 1),
('74', 'Haute-Savoie', 'HAUTE-SAVOIE', 1),
('76', 'Seine-Maritime', 'SEINE-MARITIME', 1),
('77', 'Seine-et-Marne', 'SEINE-ET-MARNE', 1),
('78', 'Yvelines', 'YVELINES', 1),
('79', 'Deux-Sèvres', 'DEUX-SEVRES', 1),
('80', 'Somme', 'SOMME', 1),
('81', 'Tarn', 'TARN', 1),
('82', 'Tarn-et-Garonne', 'TARN-ET-GARONNE', 1),
('83', 'Var', 'VAR', 1),
('85', 'Vendée', 'VENDEE', 1),
('86', 'Vienne', 'VIENNE', 1),
('87', 'Haute-Vienne', 'HAUTE-VIENNE', 1),
('88', 'Vosges', 'VOSGES', 1),
('90', 'Territoire de Belfort', 'TERRITOIRE DE BELFORT', 1),
('91', 'Essonne', 'ESSONNE', 1),
('92', 'Hauts-de-Seine', 'HAUTS-DE-SEINE', 1),
('93', 'Seine-Saint-Denis', 'SEINE-SAINT-DENIS', 1),
('94', 'Val-de-Marne', 'VAL-DE-MARNE', 1),
('95', 'Val-d''Oise', 'VAL-D''OISE', 1)
ON DUPLICATE KEY UPDATE 
  `departement_nom` = VALUES(`departement_nom`),
  `departement_nom_uppercase` = VALUES(`departement_nom_uppercase`),
  `etat` = VALUES(`etat`);

-- =====================================================
-- CENTRES
-- =====================================================
-- Insertion des centres actifs (etat = 1) depuis yj_centre.sql

INSERT INTO `centres` (`id`, `titre`, `etat`) VALUES
(1, 'Call_Provoice_PAC', 1),
(3, 'Call_Perfectline_PAC', 1),
(63, 'Call_CASA_PAC', 1),
(57, 'LEAD_LAURENT_PAC', 1),
(91, 'Call_JWS_PAC', 1),
(97, 'LEAD_SKYNET_PAC', 1),
(110, 'LEAD_Gary_PAC', 1),
(113, 'LEAD_JEREMY_PAC', 1),
(114, 'LEAD_FY_PAC', 1),
(115, 'LEAD_SKYNET_DATA_PV', 1),
(120, 'Call_Phoceen_PAC', 1),
(123, 'Call_VOICE_PRO_PAC', 1),
(126, 'Call_GOLDEN_CONSULTING_PAC', 1),
(127, 'LEAD_Gary_PV', 1),
(128, 'LEAD_FY_PV', 1),
(129, 'LEAD_LAURENT_PV', 1),
(130, 'Call_Perfectline_PV', 1),
(131, 'Call_CASA_PV', 1),
(132, 'LEAD_JEREMY_PV', 1),
(133, 'Call_Phoceen_PV', 1),
(134, 'LEAD_SKYNET_PV', 1),
(135, 'Call_Revoice_PAC ', 1),
(136, 'Call_Revoice_PV', 1),
(138, 'LEAD_SCALE_UP_PAC', 1),
(139, 'LEAD_SCALE_UP_PV', 1),
(140, 'Call_Annarz_PAC', 1),
(141, 'Call_Annarz_PV', 1),
(142, 'Call_GMA_PAC', 1),
(143, 'Call_GMA_PV', 1),
(144, 'Call_G2S_PAC', 1),
(145, 'Call_G2S_PV', 1),
(146, 'Call_GOLDEN_CONSULTING_PV', 1),
(147, 'Call_JWS_PV', 1),
(148, 'Call_Provoice_PV', 1),
(149, 'Call_VOICE_PRO_PV', 1),
(150, 'LEAD_2R_PAC', 1),
(151, 'LEAD_2R_PV', 1),
(152, 'Call_France_Eco_Energy_PAC', 1),
(153, 'Call_France_Eco_Energy_PV', 1),
(156, 'Call_JWS_SKYNET_PAC', 1),
(157, 'Call_JWS_SKYNET_PV', 1),
(158, 'TH_JWS', 1),
(159, 'LEAD_LAURENT_DATA_PAC', 1),
(160, 'LEAD_LAURENT_DATA_PV', 1),
(161, 'CALL_JWS_LAURENT_PAC', 1),
(162, 'CALL_JWS_LAURENT_PV', 1),
(163, 'LEAD_YOHAI_PV', 1),
(164, 'LEAD_SPIN8_PAC', 1),
(165, 'LEAD_SPIN8_PV', 1),
(166, 'Call_Optimum_PAC', 1),
(167, 'Call_Optimum_PV', 1),
(168, 'LEAD_NECTOM_PAC', 1),
(169, 'LEAD_NECTOM_PV', 1),
(170, 'LEAD_YOHAI_PAC', 1),
(172, 'Call_SOS JOB_PAC', 1),
(173, 'Call_SOS JOB_PV', 1),
(174, 'LEAD_HARDOR09_PV', 1),
(175, 'LEAD_HARDOR09_PAC', 1),
(176, 'TH_CMI', 1),
(177, 'TH_LEH', 1),
(178, 'TH_CERTI', 1),
(179, 'TH_BATI', 1),
(180, 'Call_JWS_signé_PAC', 1),
(181, 'Call_JWS_signé_PV', 1),
(184, 'TH_MS_RENOVES', 1),
(186, 'TH_MHG', 1),
(187, 'LEAD_ANCIEN_HAROLD_AD_PAC', 1),
(188, 'LEAD_ANCIEN_HAROLD_AD_PV', 1),
(189, 'CALL_WISSAL_PV', 1),
(190, 'CALL_WISSAL_PAC', 1),
(191, 'Call_VOICE_PRO_PEPINIERE_PAC', 1),
(192, 'Call_VOICE_PRO_PEPINIERE_PV', 1),
(193, 'CALL_HY770_PAC', 1),
(194, 'CALL_HY770_PV', 1),
(195, 'CALL_T2F_PV', 1),
(196, 'LEAD_MDL_PV', 1),
(197, 'CALL_DPM_SERVICES_PAC', 1),
(198, 'CALL_DPM_SERVICES_PV', 1),
(199, 'CALL_AGENCE26_PAC', 1),
(200, 'CALL_AGENCE26_PV', 1),
(201, 'LEAD_MDL_PAC', 1),
(202, 'LEAD_SKYNET_ROBOT_PV', 1),
(203, 'LEAD_LIMITLESS_PAC', 1),
(204, 'LEAD_LIMITLESS_PV', 1),
(205, 'LIMITLESS_DATA_PAC', 1),
(206, 'LIMITLESS_DATA_PV', 1),
(207, 'MY_LOOP_CALL_PAC', 1),
(208, 'MY_LOOP_CALL_PV', 1),
(209, 'LEAD_ADM_BLUE_PAC', 1),
(210, 'LEAD_ADM_BLUE_PV', 1),
(211, 'LEAD_LOGICALL_STP_DATA_PAC', 1),
(212, 'LEAD_LOGICALL_STP_DATA_Pv', 1),
(213, 'LEAD_2D_PAC', 1),
(214, 'LEAD_2D_PV', 1),
(215, 'LEAD_GROUPE_SOLARITE_PV', 1),
(216, 'CALL_JWS_INSTALL_PAC', 1),
(217, 'LEADS_DATA_CEDRIC_PV_PAC', 1),
(218, 'LEAD_KOMTEL_PV', 1),
(219, 'LEAD_KOMTEL_PAC', 1),
(220, 'CALL_REDALA_SOLUTION_PAC', 1),
(221, 'CALL_REDALA_SOLUTION_PV', 1),
(222, 'LEADS_IA_DATACENTER_PRO_PAC', 1),
(223, 'LEADS_IA_DATACENTER_PRO_PV', 1),
(224, 'CALL_GMA_FICHES_PV', 1),
(225, 'CALL_REYNES_PAC', 1),
(226, 'CALL_GMA_FICHES_HC', 1),
(227, 'LEAD_ASTON_PV', 1),
(228, 'LEAD_ASTON_PAC', 1),
(229, 'LEAD_FY_DATA_PV', 1),
(231, 'LEAD_MEDIA_LTD_PV', 1),
(232, 'CALL_JWS_ISO', 1),
(233, 'LEAD_BASSEL_ENERGIE_PV', 1),
(234, 'LEAD_BASSEL_ENERGIE_PAC', 1)
ON DUPLICATE KEY UPDATE 
  `titre` = VALUES(`titre`),
  `etat` = VALUES(`etat`);

-- =====================================================
-- ÉTATS
-- =====================================================
-- Insertion des états depuis yj_etat.sql
-- Note: Le groupe est converti de int vers varchar, color est NULL

INSERT INTO `etats` (`id`, `titre`, `color`, `groupe`, `ordre`, `taux`, `abbreviation`) VALUES
(1, 'EN-ATTENTE', NULL, '1', 1, 'NEUTRE', 'EN ATT'),
(2, 'NRP', NULL, '1', 2, 'NEUTRE', 'NRP'),
(5, 'ANNULER', NULL, '1', 5, 'NEGATIVE', 'ANN'),
(6, 'HORS CIBLE AGE / DOUBLON / LOCATAIRE', NULL, '1', 5, 'NEGATIVE', 'HC AGE DBL LOC'),
(7, 'CONFIRMER', NULL, '2', 1, 'POSITIVE', 'CONFIRMER'),
(8, 'ANNULER ET A REPROGRAMMER', NULL, '2', 2, 'POSITIVE', 'ANN REPRO'),
(9, 'CLIENT HONORE A SUIVRE', NULL, '2', 3, 'POSITIVE', 'CL HS'),
(11, 'RDV ANNULER', NULL, '2', 5, 'POSITIVE', 'RDV ANN'),
(12, 'REFUSER', NULL, '2', 6, 'POSITIVE', 'REFU'),
(13, 'SIGNER', NULL, '3', 1, 'POSITIVE', 'SIGNER'),
(16, 'SIGNER RETRACTER', NULL, '3', 2, 'POSITIVE', 'RETRAC'),
(19, 'RAPPEL POUR BUREAU', NULL, '1', 2, 'NEUTRE', 'RAP BUREAU'),
(22, 'ANNULER 2 FOIS', NULL, '1', 5, 'NEGATIVE', 'ANN 2F'),
(23, 'HORS CIBLE CONFIRMATEUR', NULL, '1', 6, 'NEGATIVE', 'HC CONFI'),
(24, 'HORS CIBLE FINANCEMENT', NULL, '1', 6, 'NEGATIVE', 'HC FIN'),
(25, 'REFUSER 2 FOIS', NULL, '2', 7, 'POSITIVE', 'REFU2'),
(26, 'RDV ANNULER 2 FOIS', NULL, '2', 5, 'POSITIVE', 'RDV ANN 2'),
(29, 'HORS CIBLE AIR AIR', NULL, '1', 5, 'NEGATIVE', 'HC RR'),
(34, 'HHC FINANCEMENT A VERIFIER', NULL, '2', 7, 'NEGATIVE', 'HHC FIN'),
(35, 'HHC TECHNIQUE', NULL, '2', 7, 'NEGATIVE', 'HHC TEC'),
(36, 'HHC ERREUR CONFIRMATEUR', NULL, '2', 8, 'NEGATIVE', 'HHC EC'),
(37, 'HHC MENSONGE CLIENT', NULL, '2', 9, 'NEGATIVE', 'HHC MC'),
(38, 'SIGNER RETRACTER 2 FOIS', NULL, '3', 3, 'POSITIVE', 'RETRAC_2'),
(44, 'SIGNER PM', NULL, '3', 5, 'POSITIVE', 'SIGNER_PM'),
(45, 'SIGNER COMPLET', NULL, '3', 4, 'POSITIVE', 'SIGNER_COMPLET'),
(47, 'VT OK', NULL, '3', 9, 'POSITIVE', 'VT_OK'),
(48, 'VT EN COURS', NULL, '3', 10, 'POSITIVE', 'VT_ENCOURS'),
(49, 'TH POSE OK', NULL, '3', 11, 'POSITIVE', 'TH_POSE_OK'),
(50, 'TH PAIEMENT OK', NULL, '3', 12, 'POSITIVE', 'TH_PAIEMENT_OK')
ON DUPLICATE KEY UPDATE 
  `titre` = VALUES(`titre`),
  `groupe` = VALUES(`groupe`),
  `ordre` = VALUES(`ordre`),
  `taux` = VALUES(`taux`),
  `abbreviation` = VALUES(`abbreviation`);

-- =====================================================
-- NOTE: UTILISATEURS ET FICHES
-- =====================================================
-- Les utilisateurs et fiches sont trop nombreux pour être insérés directement ici.
-- 
-- Pour migrer les UTILISATEURS:
-- 1. Exécutez d'abord yj_utilisateur.sql pour créer la table yj_utilisateur (si elle n'existe pas)
-- 2. Puis exécutez le fichier: insert_utilisateurs.sql
--
-- Pour migrer les FICHES:
-- 1. Identifiez le nom de votre table source de fiches (yj_fiche, fiches, etc.)
-- 2. Exécutez le fichier: insert_fiches.sql
-- 3. Adaptez le nom de la table source dans insert_fiches.sql selon votre cas
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
