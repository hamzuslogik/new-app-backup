-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : mar. 18 nov. 2025 à 15:13
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
-- Structure de la table `depatements`
--

CREATE TABLE `depatements` (
  `id` int(11) NOT NULL,
  `cp` varchar(10) NOT NULL,
  `HONORE` tinyint(1) NOT NULL,
  `REPORTER` tinyint(1) NOT NULL,
  `REPOROGRAMMER` tinyint(1) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Déchargement des données de la table `depatements`
--

INSERT INTO `depatements` (`id`, `cp`, `HONORE`, `REPORTER`, `REPOROGRAMMER`) VALUES
(54, '54', 1, 1, 1),
(38, '38', 1, 1, 1),
(57, '57', 1, 1, 1),
(33, '33', 1, 1, 1),
(67, '67', 1, 1, 1),
(49, '49', 1, 1, 1),
(44, '44', 1, 1, 1),
(68, '68', 1, 1, 1),
(90, '90', 1, 1, 1),
(76, '76', 1, 1, 1),
(74, '74', 1, 1, 1),
(73, '73', 1, 1, 1),
(1, '01', 1, 1, 1),
(42, '42', 1, 1, 1),
(69, '69', 1, 1, 1),
(70, '70', 1, 1, 1),
(71, '71', 1, 1, 1),
(63, '63', 1, 1, 1),
(79, '79', 1, 1, 1),
(86, '86', 1, 1, 1),
(17, '17', 1, 1, 1),
(19, '19', 1, 1, 1),
(87, '87', 1, 1, 1),
(25, '25', 1, 1, 1),
(16, '16', 1, 1, 1),
(24, '24', 1, 1, 1),
(39, '39', 1, 1, 1),
(26, '26', 1, 1, 1),
(7, '07', 1, 1, 1),
(85, '85', 1, 1, 1),
(55, '55', 1, 1, 1),
(59, '59', 1, 1, 1),
(62, '62', 1, 1, 1),
(80, '80', 1, 1, 1),
(60, '60', 1, 1, 1),
(77, '77', 1, 1, 1),
(2, '02', 1, 1, 1),
(27, '27', 1, 1, 1),
(8, '08', 1, 1, 1),
(51, '51', 1, 1, 1),
(10, '10', 1, 1, 1),
(15, '15', 1, 1, 1),
(23, '23', 1, 1, 1),
(3, '03', 1, 1, 1),
(88, '88', 1, 1, 1),
(43, '43', 1, 1, 1),
(35, '35', 1, 1, 1),
(56, '56', 1, 1, 1),
(22, '22', 1, 1, 1),
(53, '53', 1, 1, 1),
(29, '29', 1, 1, 1),
(1112, '40', 1, 1, 1),
(1123, '04', 1, 1, 1),
(1113, '65', 1, 1, 1),
(1114, '64', 1, 1, 1),
(1115, '32', 1, 1, 1),
(1116, '31', 1, 1, 1),
(1117, '81', 1, 1, 1),
(1118, '47', 1, 1, 1),
(1119, '82', 1, 1, 1),
(1120, '34', 1, 1, 1),
(1121, '46', 1, 1, 1),
(1122, '30', 1, 1, 1),
(1124, '05', 1, 1, 1),
(1125, '06', 1, 1, 1),
(1126, '83', 1, 1, 1),
(1127, '78', 1, 1, 1),
(1128, '14', 1, 1, 1),
(1129, '28', 1, 1, 1),
(1130, '50', 1, 1, 1),
(1131, '52', 1, 1, 1),
(1132, '61', 1, 1, 1),
(1133, '91', 1, 1, 1),
(1134, '92', 1, 1, 1),
(1135, '93', 1, 1, 1),
(1136, '94', 1, 1, 1),
(1137, '95', 1, 1, 1);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `depatements`
--
ALTER TABLE `depatements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cp` (`cp`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `depatements`
--
ALTER TABLE `depatements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1138;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
