-- =====================================================
-- Script pour migrer les utilisateurs depuis yj_utilisateur vers utilisateurs
-- Base de données: crm
-- =====================================================
-- 
-- Ce script lit directement depuis la table yj_utilisateur existante
-- et insère les données dans la nouvelle table utilisateurs
-- en adaptant les colonnes.
--
-- Mapping des colonnes:
--   yj_utilisateur.id -> utilisateurs.id
--   yj_utilisateur.nom -> utilisateurs.nom
--   yj_utilisateur.prenom -> utilisateurs.prenom
--   yj_utilisateur.vrai_nom -> utilisateurs.pseudo (ou login si vrai_nom est vide)
--   yj_utilisateur.tel -> utilisateurs.tel
--   yj_utilisateur.mail -> utilisateurs.mail
--   yj_utilisateur.login -> utilisateurs.login
--   yj_utilisateur.mdp -> utilisateurs.mdp
--   yj_utilisateur.etat -> utilisateurs.etat
--   yj_utilisateur.color -> utilisateurs.color
--   yj_utilisateur.fonction -> utilisateurs.fonction
--   yj_utilisateur.chef_equipe -> utilisateurs.chef_equipe
--   yj_utilisateur.centre -> utilisateurs.centre
--   utilisateurs.date -> NULL (pas dans yj_utilisateur)
--   utilisateurs.photo -> NULL (pas dans yj_utilisateur)
--   utilisateurs.genre -> NULL (pas dans yj_utilisateur)
--
-- =====================================================

USE `crm`;

-- Vérifier si la table yj_utilisateur existe
-- Si elle n'existe pas, vous devez d'abord exécuter yj_utilisateur.sql

-- Insertion des utilisateurs depuis yj_utilisateur vers utilisateurs
-- Utilisation de INSERT IGNORE pour éviter les erreurs en cas de doublons d'ID
INSERT IGNORE INTO `utilisateurs` (
  `id`,
  `nom`,
  `prenom`,
  `pseudo`,
  `tel`,
  `mail`,
  `login`,
  `mdp`,
  `etat`,
  `color`,
  `date`,
  `fonction`,
  `chef_equipe`,
  `centre`,
  `photo`,
  `genre`
)
SELECT 
  `id`,
  `nom`,
  `prenom`,
  -- Utiliser vrai_nom si non vide, sinon login
  CASE 
    WHEN `vrai_nom` IS NOT NULL AND `vrai_nom` != '' THEN `vrai_nom`
    ELSE `login`
  END AS `pseudo`,
  `tel`,
  `mail`,
  `login`,
  `mdp`,
  `etat`,
  `color`,
  NULL AS `date`,
  `fonction`,
  `chef_equipe`,
  `centre`,
  NULL AS `photo`,
  NULL AS `genre`
FROM `yj_utilisateur`
WHERE `id` IS NOT NULL;

-- Afficher le nombre d'utilisateurs insérés
SELECT COUNT(*) AS 'Nombre d\'utilisateurs insérés' FROM `utilisateurs`;

-- Optionnel: Afficher quelques exemples d'utilisateurs insérés
-- SELECT id, nom, prenom, pseudo, login, etat, fonction, centre FROM `utilisateurs` LIMIT 10;

