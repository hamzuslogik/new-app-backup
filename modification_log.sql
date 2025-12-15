-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : mer. 19 nov. 2025 à 09:19
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
-- Structure de la table `modification_log`
--

CREATE TABLE `modification_log` (
  `id` int(11) NOT NULL,
  `id_fiche` int(11) NOT NULL,
  `modifier_par` varchar(100) NOT NULL,
  `champs` varchar(100) NOT NULL,
  `valeur` text NOT NULL,
  `Date_Heure` datetime NOT NULL DEFAULT current_timestamp(),
  `Old_valeur` text NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Déchargement des données de la table `modification_log`
--

INSERT INTO `modification_log` (`id`, `id_fiche`, `modifier_par`, `champs`, `valeur`, `Date_Heure`, `Old_valeur`) VALUES
(1, 233057, 'PIGUET ', 'revenu', '3000', '2019-10-08 12:39:53', 'ENTRE 3000 ET 3500');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `modification_log`
--
ALTER TABLE `modification_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `modifier_par` (`modifier_par`),
  ADD KEY `Date_Heure` (`Date_Heure`),
  ADD KEY `id_fiche` (`id_fiche`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `modification_log`
--
ALTER TABLE `modification_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10321094;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
