-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : mar. 18 nov. 2025 à 15:14
-- Version du serveur : 10.6.4-MariaDB-1:10.6.4+maria~buster-log
-- Version de PHP : 7.4.23

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `admin_extranet`
--

-- --------------------------------------------------------

--
-- Structure de la table `yj_centre`
--

CREATE TABLE `yj_centre` (
  `id` int(11) NOT NULL,
  `titre` varchar(600) NOT NULL,
  `etat` int(11) NOT NULL,
  `proprietaire` varchar(60) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Déchargement des données de la table `yj_centre`
--

INSERT INTO `yj_centre` (`id`, `titre`, `etat`, `proprietaire`) VALUES
(1, 'Call_Provoice_PAC', 1, ''),
(3, 'Call_Perfectline_PAC', 1, ''),
(55, 'INTEGRATION', 0, ''),
(7, 'CALL_LEAD', 0, ''),
(64, 'LEAD_PAC_2', 0, ''),
(45, 'PERFECTVOICE', 0, ''),
(47, 'MONTPLAISIR', 0, ''),
(43, 'CALL_HORIZONE', 0, ''),
(42, 'KALIPHONE', 0, ''),
(41, 'PARTENAIRE_ALAIN', 0, ''),
(37, 'PRODEV', 0, ''),
(63, 'Call_CASA_PAC', 1, ''),
(62, 'CALL_ISO_LAURENT', 0, ''),
(56, 'CALL DEBRIF', 0, ''),
(35, 'PARTENAIRE', 0, ''),
(2, 'CAMCALL', 0, ''),
(61, 'LEAD_MAISON', 0, ''),
(60, 'CALL_ISO', 0, ''),
(32, 'PARTENAIRE_PERFECT', 0, ''),
(49, 'SAFSAF_CALL', 0, ''),
(59, 'LEAD_ZAKI', 0, ''),
(58, 'EBI_CALL_CENTRE', 0, ''),
(57, 'LEAD_LAURENT_PAC', 1, ''),
(52, 'OZVOICE', 0, ''),
(53, 'JWSCALL', 0, ''),
(54, 'LEAD_PAC', 0, ''),
(65, 'BUSINESS_WINGS', 0, ''),
(66, 'HA CALL', 0, ''),
(67, 'TSMARKETING', 0, ''),
(68, 'JH_CALL', 0, ''),
(69, 'FATMA_CALL', 0, ''),
(70, 'LEAD_SUD', 0, ''),
(71, 'SANDALI_PHONE', 0, ''),
(72, 'LEAD_SS2A', 0, ''),
(73, 'LEAD_TEST', 0, ''),
(74, 'PROVOICE_RECYCLAGE', 0, ''),
(75, 'LEAD_SKYNET2020', 0, ''),
(78, 'LEAD_MA_MARKETING', 0, ''),
(79, 'SANA', 0, ''),
(80, 'LEAD', 0, ''),
(81, 'YJs_CALL', 0, ''),
(82, 'LEAD_ONETIME', 0, ''),
(83, 'CALL_PCS', 0, ''),
(84, 'LEAD_DANSITBON', 0, ''),
(85, 'PERR_V2', 0, ''),
(86, 'LEAD_KEVIN', 0, ''),
(87, 'LEAD_MENDY', 0, ''),
(88, 'LEAD_BRIAN', 0, ''),
(89, 'LEAD_BEBERE_RECYCLAGE', 0, ''),
(90, 'CALL_GABRIEL', 0, ''),
(91, 'Call_JWS_PAC', 1, ''),
(92, 'CALL_UNITED', 0, ''),
(93, 'LEAD_HAROLD', 0, ''),
(94, 'LEAD_KRC_DIGITAL', 0, ''),
(95, 'LEAD_RDV_YOHAI', 0, ''),
(96, 'CU_CASA_FICHE', 0, ''),
(97, 'LEAD_SKYNET_PAC', 1, ''),
(101, 'SIDAM_CALL', 0, ''),
(99, 'LEAD_KARIM', 0, ''),
(100, 'LEAD_YJ', 0, ''),
(102, 'LEAD_PAC_DATA', 0, ''),
(103, 'LEAD_JWS', 0, ''),
(98, 'LEAD_SKYNET3', 0, ''),
(109, 'LEAD_YJ2', 0, ''),
(110, 'LEAD_Gary_PAC', 1, ''),
(111, 'LEAD_YJ2022', 0, ''),
(112, 'LEAD_REOUVEN', 0, '1'),
(113, 'LEAD_JEREMY_PAC', 1, ''),
(114, 'LEAD_FY_PAC', 1, ''),
(115, 'LEAD_SKYNET_DATA_PV', 1, ''),
(116, 'LEAD_YES_EVOLUTION', 0, ''),
(117, 'LEAD_JEREM09.22', 0, ''),
(118, 'LEAD_HARDOR09.22', 0, ''),
(146, 'Call_GOLDEN_CONSULTING_PV', 1, ''),
(119, 'LEAD_SHLOMI', 0, ''),
(120, 'Call_Phoceen_PAC', 1, ''),
(121, 'LEAD_TS-MARKETING', 0, ''),
(122, 'LEAD_2R', 0, ''),
(123, 'Call_VOICE_PRO_PAC', 1, ''),
(124, 'CASABIDJAN', 0, ''),
(125, 'CENTRE_TEST', 0, ''),
(126, 'Call_GOLDEN_CONSULTING_PAC', 1, ''),
(127, 'LEAD_Gary_PV', 1, ''),
(128, 'LEAD_FY_PV', 1, ''),
(129, 'LEAD_LAURENT_PV', 1, ''),
(130, 'Call_Perfectline_PV', 1, ''),
(131, 'Call_CASA_PV', 1, ''),
(132, 'LEAD_JEREMY_PV', 1, ''),
(133, 'Call_Phoceen_PV', 1, ''),
(134, 'LEAD_SKYNET_PV', 1, ''),
(135, 'Call_Revoice_PAC ', 1, ''),
(136, 'Call_Revoice_PV', 1, ''),
(137, 'LEAD_SKYNET', 0, ''),
(140, 'Call_Annarz_PAC', 1, ''),
(138, 'LEAD_SCALE_UP_PAC', 1, ''),
(139, 'LEAD_SCALE_UP_PV', 1, ''),
(141, 'Call_Annarz_PV', 1, ''),
(142, 'Call_GMA_PAC', 1, ''),
(143, 'Call_GMA_PV', 1, ''),
(144, 'Call_G2S_PAC', 1, ''),
(145, 'Call_G2S_PV', 1, ''),
(147, 'Call_JWS_PV', 1, ''),
(150, 'LEAD_2R_PAC', 1, ''),
(148, 'Call_Provoice_PV', 1, ''),
(149, 'Call_VOICE_PRO_PV', 1, ''),
(151, 'LEAD_2R_PV', 1, ''),
(152, 'Call_France_Eco_Energy_PAC', 1, ''),
(153, 'Call_France_Eco_Energy_PV', 1, ''),
(159, 'LEAD_LAURENT_DATA_PAC', 1, ''),
(158, 'TH_JWS', 1, ''),
(156, 'Call_JWS_SKYNET_PAC', 1, ''),
(157, 'Call_JWS_SKYNET_PV', 1, ''),
(160, 'LEAD_LAURENT_DATA_PV', 1, ''),
(161, 'CALL_JWS_LAURENT_PAC', 1, ''),
(162, 'CALL_JWS_LAURENT_PV', 1, ''),
(163, 'LEAD_YOHAI_PV', 1, ''),
(164, 'LEAD_SPIN8_PAC', 1, ''),
(165, 'LEAD_SPIN8_PV', 1, ''),
(166, 'Call_Optimum_PAC', 1, ''),
(167, 'Call_Optimum_PV', 1, ''),
(168, 'LEAD_NECTOM_PAC', 1, ''),
(169, 'LEAD_NECTOM_PV', 1, ''),
(170, 'LEAD_YOHAI_PAC', 1, ''),
(172, 'Call_SOS JOB_PAC', 1, ''),
(173, 'Call_SOS JOB_PV', 1, ''),
(174, 'LEAD_HARDOR09_PV', 1, ''),
(175, 'LEAD_HARDOR09_PAC', 1, ''),
(176, 'TH_CMI', 1, ''),
(177, 'TH_LEH', 1, ''),
(178, 'TH_CERTI', 1, ''),
(179, 'TH_BATI', 1, ''),
(180, 'Call_JWS_signé_PAC', 1, ''),
(181, 'Call_JWS_signé_PV', 1, ''),
(185, 'VOICE_PRO_PEPINIERE', 0, ''),
(184, 'TH_MS_RENOVES', 1, ''),
(193, 'CALL_HY770_PAC', 1, ''),
(186, 'TH_MHG', 1, ''),
(187, 'LEAD_ANCIEN_HAROLD_AD_PAC', 1, ''),
(188, 'LEAD_ANCIEN_HAROLD_AD_PV', 1, ''),
(189, 'CALL_WISSAL_PV', 1, ''),
(190, 'CALL_WISSAL_PAC', 1, ''),
(191, 'Call_VOICE_PRO_PEPINIERE_PAC', 1, ''),
(192, 'Call_VOICE_PRO_PEPINIERE_PV', 1, ''),
(194, 'CALL_HY770_PV', 1, ''),
(195, 'CALL_T2F_PV', 1, ''),
(196, 'LEAD_MDL_PV', 1, ''),
(197, 'CALL_DPM_SERVICES_PAC', 1, ''),
(198, 'CALL_DPM_SERVICES_PV', 1, ''),
(199, 'CALL_AGENCE26_PAC', 1, ''),
(200, 'CALL_AGENCE26_PV', 1, ''),
(201, 'LEAD_MDL_PAC', 1, ''),
(202, 'LEAD_SKYNET_ROBOT_PV', 1, ''),
(203, 'LEAD_LIMITLESS_PAC', 1, ''),
(204, 'LEAD_LIMITLESS_PV', 1, ''),
(205, 'LIMITLESS_DATA_PAC', 1, ''),
(206, 'LIMITLESS_DATA_PV', 1, ''),
(207, 'MY_LOOP_CALL_PAC', 1, ''),
(208, 'MY_LOOP_CALL_PV', 1, ''),
(209, 'LEAD_ADM_BLUE_PAC', 1, ''),
(210, 'LEAD_ADM_BLUE_PV', 1, ''),
(211, 'LEAD_LOGICALL_STP_DATA_PAC', 1, ''),
(212, 'LEAD_LOGICALL_STP_DATA_Pv', 1, ''),
(213, 'LEAD_2D_PAC', 1, ''),
(214, 'LEAD_2D_PV', 1, ''),
(215, 'LEAD_GROUPE_SOLARITE_PV', 1, ''),
(216, 'CALL_JWS_INSTALL_PAC', 1, ''),
(217, 'LEADS_DATA_CEDRIC_PV_PAC', 1, ''),
(218, 'LEAD_KOMTEL_PV', 1, ''),
(219, 'LEAD_KOMTEL_PAC', 1, ''),
(220, 'CALL_REDALA_SOLUTION_PAC', 1, ''),
(221, 'CALL_REDALA_SOLUTION_PV', 1, ''),
(222, 'LEADS_IA_DATACENTER_PRO_PAC', 1, ''),
(223, 'LEADS_IA_DATACENTER_PRO_PV', 1, ''),
(224, 'CALL_GMA_FICHES_PV', 1, ''),
(225, 'CALL_REYNES_PAC', 1, ''),
(226, 'CALL_GMA_FICHES_HC', 1, ''),
(227, 'LEAD_ASTON_PV', 1, ''),
(228, 'LEAD_ASTON_PAC', 1, ''),
(229, 'LEAD_FY_DATA_PV', 1, ''),
(231, 'LEAD_MEDIA_LTD_PV', 1, ''),
(232, 'CALL_JWS_ISO', 1, ''),
(233, 'LEAD_BASSEL_ENERGIE_PV', 1, ''),
(234, 'LEAD_BASSEL_ENERGIE_PAC', 1, '');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `yj_centre`
--
ALTER TABLE `yj_centre`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id` (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `yj_centre`
--
ALTER TABLE `yj_centre`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=235;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
