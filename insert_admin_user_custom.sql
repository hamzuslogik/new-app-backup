-- =====================================================
-- Script d'insertion d'un utilisateur administrateur personnalisé
-- Modifiez les valeurs ci-dessous selon vos besoins
-- =====================================================

USE `crm`;

-- =====================================================
-- VARIABLES À MODIFIER
-- =====================================================
SET @admin_nom = 'Votre Nom';
SET @admin_prenom = 'Votre Prénom';
SET @admin_pseudo = 'Admin Principal';
SET @admin_login = 'admin';
SET @admin_password = 'VotreMotDePasseSecurise123!';
SET @admin_email = 'admin@jwsgroup.fr';
SET @admin_centre_id = 1;
SET @admin_genre = 2;  -- 1 = Femme, 2 = Homme

-- =====================================================
-- 1. Créer un centre par défaut si nécessaire
-- =====================================================
INSERT INTO `centres` (`id`, `titre`, `etat`) 
VALUES (@admin_centre_id, 'Centre Principal', 1)
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
INSERT INTO `utilisateurs` (
  `nom`,
  `prenom`,
  `pseudo`,
  `login`,
  `mdp`,
  `mail`,
  `etat`,
  `fonction`,
  `centre`,
  `genre`,
  `color`,
  `date`
) VALUES (
  @admin_nom,
  @admin_prenom,
  @admin_pseudo,
  @admin_login,
  @admin_password,
  @admin_email,
  1,  -- État actif
  1,  -- Fonction 1 = Administrateur (tous les privilèges)
  @admin_centre_id,
  @admin_genre,
  '#629aa9',  -- Couleur par défaut
  UNIX_TIMESTAMP(NOW())
)
ON DUPLICATE KEY UPDATE 
  `nom`=VALUES(`nom`),
  `prenom`=VALUES(`prenom`),
  `pseudo`=VALUES(`pseudo`),
  `mdp`=VALUES(`mdp`),
  `mail`=VALUES(`mail`),
  `etat`=1,
  `fonction`=1,
  `centre`=@admin_centre_id;

-- =====================================================
-- 4. Afficher les informations de l'utilisateur créé
-- =====================================================
SELECT 
  id,
  login,
  pseudo,
  mail,
  fonction,
  (SELECT titre FROM fonctions WHERE id = utilisateurs.fonction) as fonction_titre,
  centre,
  (SELECT titre FROM centres WHERE id = utilisateurs.centre) as centre_titre,
  etat,
  CASE 
    WHEN etat = 1 THEN 'Actif'
    ELSE 'Inactif'
  END as statut
FROM utilisateurs 
WHERE login = @admin_login;

-- =====================================================
-- PRIVILÈGES DE L'ADMINISTRATEUR (Fonction 1)
-- =====================================================
-- ✅ Accès complet à toutes les fiches
-- ✅ Gestion des utilisateurs (création, modification, suppression)
-- ✅ Gestion de la configuration :
--    - Centres
--    - Départements
--    - Fonctions
--    - États
--    - Installateurs
-- ✅ Statistiques complètes
-- ✅ Planning et affectation
-- ✅ Export de données (CSV, PDF)
-- ✅ Gestion des décalages
-- ✅ Accès à tous les modules

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

