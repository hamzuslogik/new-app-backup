-- =====================================================
-- Supprimer les utilisateurs crees par erreur depuis yj_fiche.nom_qualite
-- (ensure_utilisateurs_nom_qualite_from_yj_fiche.sql avec fonction = 3 au lieu de 8)
-- =====================================================
--
-- Cible : utilisateurs dont le pseudo/login correspond a un nom_qualite YJ,
--         avec fonction = 3 et le profil « stub » de migration (inactif, prenom vide,
--         nom = pseudo = login).
--
-- Avant suppression :
--   - fiches.id_qualite : bascule vers l'utilisateur fonction 8 homonyme si existe,
--     sinon NULL
--   - controle_qualite / alert_ko : meme regle de bascule si les tables existent
--
-- Apres execution :
--   1. ensure_utilisateurs_nom_qualite_from_yj_fiche.sql  (@fonction_qualite = 8)
--   2. update_fiches_id_qualite_from_yj_fiche.sql (section 1)
--
-- =====================================================

USE `crm`;

SET @fonction_erronee = 3;
SET @fonction_correcte = 8;
SET @etat_migration = 0;

SET SQL_SAFE_UPDATES = 0;

-- -----------------------------------------------------
-- 1) Liste des nom_qualite distincts (source YJ)
-- -----------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS `tmp_nom_qualite_yj`;
CREATE TEMPORARY TABLE `tmp_nom_qualite_yj` (
  `nom_key` VARCHAR(600) NOT NULL,
  PRIMARY KEY (`nom_key`)
) ENGINE=MEMORY;

INSERT INTO `tmp_nom_qualite_yj` (`nom_key`)
SELECT DISTINCT UPPER(TRIM(yj.`nom_qualite`)) AS `nom_key`
FROM `yj_fiche` yj
WHERE TRIM(IFNULL(yj.`nom_qualite`, '')) != '';

-- -----------------------------------------------------
-- 2) Utilisateurs errones a supprimer
-- -----------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS `tmp_utilisateurs_a_supprimer`;
CREATE TEMPORARY TABLE `tmp_utilisateurs_a_supprimer` (
  `id` INT NOT NULL,
  `pseudo` VARCHAR(255) NULL,
  `login` VARCHAR(255) NULL,
  `nom` VARCHAR(255) NULL,
  `fonction` INT NULL,
  `etat` INT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MEMORY;

INSERT INTO `tmp_utilisateurs_a_supprimer` (`id`, `pseudo`, `login`, `nom`, `fonction`, `etat`)
SELECT
  u.`id`,
  u.`pseudo`,
  u.`login`,
  u.`nom`,
  u.`fonction`,
  u.`etat`
FROM `utilisateurs` u
INNER JOIN `tmp_nom_qualite_yj` nq
  ON TRIM(UPPER(u.`pseudo`)) = nq.`nom_key`
  OR TRIM(UPPER(u.`login`)) = nq.`nom_key`
WHERE u.`fonction` = @fonction_erronee
  AND u.`etat` = @etat_migration
  AND (u.`prenom` IS NULL OR TRIM(u.`prenom`) = '')
  AND TRIM(IFNULL(u.`login`, '')) = TRIM(IFNULL(u.`pseudo`, ''))
  AND TRIM(IFNULL(u.`nom`, '')) = TRIM(IFNULL(u.`pseudo`, ''));

-- Ne pas supprimer si un compte fonction 8 existe deja avec le meme pseudo (on bascule d'abord)
-- (les deux peuvent coexister temporairement ; seul le compte fonction 3 part)

-- -----------------------------------------------------
-- 3) Apercu avant action
-- -----------------------------------------------------
SELECT COUNT(*) AS nb_utilisateurs_a_supprimer FROM `tmp_utilisateurs_a_supprimer`;

SELECT t.`id`, t.`pseudo`, t.`login`, t.`fonction`, t.`etat`,
       (SELECT COUNT(*) FROM `fiches` f WHERE f.`id_qualite` = t.`id`) AS nb_fiches_liees,
       (
         SELECT u8.`id`
         FROM `utilisateurs` u8
         WHERE u8.`fonction` = @fonction_correcte
           AND TRIM(UPPER(u8.`pseudo`)) = TRIM(UPPER(t.`pseudo`))
         LIMIT 1
       ) AS id_remplacement_fonction_8
FROM `tmp_utilisateurs_a_supprimer` t
ORDER BY t.`pseudo`;

-- -----------------------------------------------------
-- 4) Reaffecter les references vers le compte fonction 8 (si present)
-- -----------------------------------------------------
UPDATE `fiches` f
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON f.`id_qualite` = bad.`id`
INNER JOIN `utilisateurs` u8
  ON u8.`fonction` = @fonction_correcte
 AND TRIM(UPPER(u8.`pseudo`)) = TRIM(UPPER(bad.`pseudo`))
SET f.`id_qualite` = u8.`id`;

-- Tables optionnelles (ignorer l'erreur si la table n'existe pas)
UPDATE `controle_qualite` cq
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON cq.`id_qualite` = bad.`id`
INNER JOIN `utilisateurs` u8
  ON u8.`fonction` = @fonction_correcte
 AND TRIM(UPPER(u8.`pseudo`)) = TRIM(UPPER(bad.`pseudo`))
SET cq.`id_qualite` = u8.`id`;

UPDATE `alert_ko` ak
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON ak.`id_qualite` = bad.`id`
INNER JOIN `utilisateurs` u8
  ON u8.`fonction` = @fonction_correcte
 AND TRIM(UPPER(u8.`pseudo`)) = TRIM(UPPER(bad.`pseudo`))
SET ak.`id_qualite` = u8.`id`;

-- -----------------------------------------------------
-- 5) Detacher les references restantes (pas de compte fonction 8 homonyme)
-- -----------------------------------------------------
UPDATE `fiches` f
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON f.`id_qualite` = bad.`id`
SET f.`id_qualite` = NULL;

-- alert_ko.id_qualite est NOT NULL : supprimer les alertes orphelines (comptes migration inactifs)
DELETE ak FROM `alert_ko` ak
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON ak.`id_qualite` = bad.`id`;

-- controle_qualite.id_qualite est NOT NULL : supprimer les audits lies aux stubs errones
DELETE cq FROM `controle_qualite` cq
INNER JOIN `tmp_utilisateurs_a_supprimer` bad ON cq.`id_qualite` = bad.`id`;

-- -----------------------------------------------------
-- 6) Suppression des utilisateurs errones
-- -----------------------------------------------------
DELETE u
FROM `utilisateurs` u
INNER JOIN `tmp_utilisateurs_a_supprimer` t ON t.`id` = u.`id`;

SELECT ROW_COUNT() AS utilisateurs_supprimes;

-- -----------------------------------------------------
-- 7) Verification (avant nettoyage des tables temporaires)
-- -----------------------------------------------------
SELECT u.`id`, u.`pseudo`, u.`fonction`, u.`etat`
FROM `utilisateurs` u
INNER JOIN `tmp_nom_qualite_yj` nq
  ON TRIM(UPPER(u.`pseudo`)) = nq.`nom_key`
WHERE u.`fonction` = @fonction_erronee;

-- -----------------------------------------------------
-- 8) Nettoyage
-- -----------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS `tmp_utilisateurs_a_supprimer`;
DROP TEMPORARY TABLE IF EXISTS `tmp_nom_qualite_yj`;
