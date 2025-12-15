-- =====================================================
-- Script pour migrer les utilisateurs depuis yj_utilisateur vers utilisateurs
-- Base de données: crm
-- =====================================================
--
-- PRÉREQUIS:
-- Ce script suppose que la table yj_utilisateur existe déjà dans la base de données.
-- Si elle n'existe pas, vous devez d'abord exécuter yj_utilisateur.sql
--
-- Ce script migre tous les utilisateurs actifs (etat > 0) de yj_utilisateur vers utilisateurs
-- en adaptant les noms de colonnes.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- UTILISATEURS
-- =====================================================
-- Migration depuis yj_utilisateur vers utilisateurs
-- Mapping des colonnes:
--   yj_utilisateur.nom -> utilisateurs.nom
--   yj_utilisateur.prenom -> utilisateurs.prenom
--   yj_utilisateur.vrai_nom OU login -> utilisateurs.pseudo
--   yj_utilisateur.tel -> utilisateurs.tel
--   yj_utilisateur.mail -> utilisateurs.mail
--   yj_utilisateur.login -> utilisateurs.login
--   yj_utilisateur.mdp -> utilisateurs.mdp
--   yj_utilisateur.etat -> utilisateurs.etat
--   yj_utilisateur.color -> utilisateurs.color
--   yj_utilisateur.fonction -> utilisateurs.fonction
--   yj_utilisateur.centre -> utilisateurs.centre
--   yj_utilisateur.chef_equipe -> utilisateurs.chef_equipe
--   Les colonnes suivantes n'existent pas dans yj_utilisateur et seront NULL:
--     utilisateurs.date
--     utilisateurs.photo
--     utilisateurs.genre

INSERT INTO `utilisateurs` (
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
  `fonction`, 
  `centre`, 
  `chef_equipe`
) 
SELECT 
  `id`,
  COALESCE(NULLIF(`nom`, ''), '') as `nom`,
  COALESCE(NULLIF(`prenom`, ''), '') as `prenom`,
  COALESCE(
    NULLIF(`vrai_nom`, ''), 
    NULLIF(`login`, ''), 
    ''
  ) as `pseudo`,
  COALESCE(NULLIF(`tel`, ''), '') as `tel`,
  COALESCE(NULLIF(`mail`, ''), '') as `mail`,
  COALESCE(NULLIF(`login`, ''), '') as `login`,
  COALESCE(NULLIF(`mdp`, ''), '') as `mdp`,
  `etat`,
  COALESCE(NULLIF(`color`, ''), NULL) as `color`,
  `fonction`,
  `centre`,
  COALESCE(`chef_equipe`, 0) as `chef_equipe`
FROM `yj_utilisateur`
WHERE `etat` > 0
ON DUPLICATE KEY UPDATE 
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `pseudo` = VALUES(`pseudo`),
  `tel` = VALUES(`tel`),
  `mail` = VALUES(`mail`),
  `login` = VALUES(`login`),
  `mdp` = VALUES(`mdp`),
  `etat` = VALUES(`etat`),
  `color` = VALUES(`color`),
  `fonction` = VALUES(`fonction`),
  `centre` = VALUES(`centre`),
  `chef_equipe` = VALUES(`chef_equipe`);

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

