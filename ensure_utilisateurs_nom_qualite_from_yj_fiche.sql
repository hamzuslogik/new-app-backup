-- =====================================================
-- Creer les utilisateurs manquants pour yj_fiche.nom_qualite
-- =====================================================
--
-- Contexte : souvent id_qualite est vide dans yj_fiche et seul nom_qualite
-- est renseigne. La migration vers fiches.id_qualite exige un id dans utilisateurs.
--
-- Ce script insere un utilisateur par libelle distinct de nom_qualite lorsque
-- aucun utilisateur n'existe avec le meme pseudo OU login (comparaison insensible
-- a la casse), sur le meme principe que insert_compte_rendu_from_yj_compte_rendu.sql
-- (commerciaux).
--
-- A executer AVANT :
--   - insert_fiches_from_yj.sql
--   - ou update_fiches_id_qualite_from_yj_fiche.sql
--
-- Reglages :
--   @fonction_qualite : id dans la table fonctions (agent qualification / qualite).
--                       Par defaut 8 (qualification qualite).
--   @etat_inactif : toujours 0 — utilisateur cree mais INACTIF (pas de connexion / desactive).
--                   Reactiver manuellement dans le CRM (passer etat a 1) si besoin.
--
-- =====================================================

USE `crm`;

SET @fonction_qualite = 8;
SET @etat_inactif = 0;

SET SQL_SAFE_UPDATES = 0;

INSERT INTO `utilisateurs` (`nom`, `prenom`, `pseudo`, `login`, `etat`, `fonction`)
SELECT
  base.`display_name`,
  '' AS `prenom`,
  base.`display_name` AS `pseudo`,
  base.`display_name` AS `login`,
  @etat_inactif AS `etat`,
  @fonction_qualite AS `fonction`
FROM (
  SELECT MIN(TRIM(yj.`nom_qualite`)) AS `display_name`
  FROM `yj_fiche` yj
  WHERE TRIM(IFNULL(yj.`nom_qualite`, '')) != ''
  GROUP BY UPPER(TRIM(yj.`nom_qualite`))
) base
WHERE NOT EXISTS (
  SELECT 1
  FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(base.`display_name`))
     OR TRIM(UPPER(u.`login`)) = TRIM(UPPER(base.`display_name`))
);

-- Nombre de lignes inserees par l’INSERT ci-dessus (executer dans la meme session)
SELECT ROW_COUNT() AS lignes_inserees_nom_qualite;
