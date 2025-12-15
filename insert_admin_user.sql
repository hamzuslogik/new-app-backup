-- =====================================================
-- Script d'insertion d'un utilisateur administrateur
-- avec tous les privilèges
-- =====================================================

USE `crm`;

-- =====================================================
-- 1. Créer un centre par défaut si nécessaire
-- =====================================================
INSERT INTO `centres` (`id`, `titre`, `etat`) 
VALUES (1, 'Centre Principal', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `etat`=1;

-- =====================================================
-- 2. S'assurer que la fonction Administrateur existe
-- =====================================================
INSERT INTO `fonctions` (`id`, `titre`, `etat`) 
VALUES (1, 'Administrateur', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `etat`=1;

-- =====================================================
-- 3. Insérer l'utilisateur administrateur
-- =====================================================
-- Remplacez les valeurs suivantes selon vos besoins :
-- - login: identifiant de connexion
-- - mdp: mot de passe (en clair, car l'ancien système ne hash pas)
-- - pseudo: nom d'affichage
-- - mail: email de l'administrateur

INSERT INTO `utilisateurs` (
  `nom`,
  `prenom`,
  `pseudo`,
  `login`,
  `mdp`,
  `etat`,
  `fonction`,
  `centre`,
  `genre`,
  `color`,
  `date`
) VALUES (
  'Admin',
  'Système',
  'Administrateur',
  'admin',
  'admin123',
  1,
  1,  -- Fonction 1 = Administrateur (tous les privilèges)
  1,  -- Centre Principal
  2,  -- Genre: 2 = Homme (1 = Femme)
  '#629aa9',  -- Couleur par défaut
  UNIX_TIMESTAMP(NOW())
)
ON DUPLICATE KEY UPDATE 
  `nom`=VALUES(`nom`),
  `prenom`=VALUES(`prenom`),
  `pseudo`=VALUES(`pseudo`),
  `mdp`=VALUES(`mdp`),
  `etat`=1,
  `fonction`=1,
  `centre`=1;

-- =====================================================
-- 4. Afficher les informations de l'utilisateur créé
-- =====================================================
SELECT 
  id,
  login,
  pseudo,
  fonction,
  (SELECT titre FROM fonctions WHERE id = utilisateurs.fonction) as fonction_titre,
  centre,
  (SELECT titre FROM centres WHERE id = utilisateurs.centre) as centre_titre,
  etat
FROM utilisateurs 
WHERE login = 'admin';

-- =====================================================
-- 5. Vérifier les privilèges de l'utilisateur
-- =====================================================
-- L'utilisateur avec fonction = 1 (Administrateur) a accès à :
-- - Toutes les fiches
-- - Gestion des utilisateurs
-- - Gestion de la configuration (centres, départements, fonctions, états)
-- - Statistiques complètes
-- - Planning et affectation
-- - Export de données

-- =====================================================
-- INFORMATIONS DE CONNEXION PAR DÉFAUT
-- =====================================================
-- Login: admin
-- Mot de passe: admin123
-- 
-- ⚠️ IMPORTANT: Changez le mot de passe après la première connexion !
-- =====================================================

