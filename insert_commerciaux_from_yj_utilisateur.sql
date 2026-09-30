-- =====================================================
-- Script : insérer uniquement les commerciaux (fonction 5)
-- depuis yj_utilisateur vers utilisateurs
-- Base de données: crm
-- =====================================================
--
-- Variante de insert_utilisateurs_from_yj_table.sql :
--   - filtre STRICT : yj_utilisateur.fonction = 5 (commerciaux)
--   - n'insère que les utilisateurs absents de `utilisateurs`
--     (même id, ou même login / pseudo déjà présent)
--
-- Mapping des colonnes (identique à insert_utilisateurs_from_yj_table.sql) :
--   yj_utilisateur.id         -> utilisateurs.id
--   yj_utilisateur.nom        -> utilisateurs.nom
--   yj_utilisateur.prenom     -> utilisateurs.prenom
--   yj_utilisateur.vrai_nom   -> utilisateurs.pseudo (sinon login)
--   yj_utilisateur.tel        -> utilisateurs.tel
--   yj_utilisateur.mail       -> utilisateurs.mail
--   yj_utilisateur.login      -> utilisateurs.login
--   yj_utilisateur.mdp        -> utilisateurs.mdp
--   yj_utilisateur.etat       -> utilisateurs.etat
--   yj_utilisateur.color      -> utilisateurs.color
--   yj_utilisateur.fonction   -> utilisateurs.fonction (= 5)
--   yj_utilisateur.chef_equipe-> utilisateurs.chef_equipe
--   yj_utilisateur.centre     -> utilisateurs.centre
--   date / photo / genre      -> NULL
--
-- Prérequis : table yj_utilisateur peuplée (yj_utilisateur.sql)
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Aperçu avant insertion
SELECT
  (SELECT COUNT(*) FROM `yj_utilisateur` WHERE `fonction` = 5 AND `id` IS NOT NULL) AS commerciaux_yj,
  (SELECT COUNT(*)
   FROM `yj_utilisateur` yj
   WHERE yj.`fonction` = 5
     AND yj.`id` IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM `utilisateurs` u WHERE u.`id` = yj.`id`)
     AND NOT EXISTS (
       SELECT 1 FROM `utilisateurs` u
       WHERE TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(IFNULL(yj.`login`, '')))
         AND TRIM(IFNULL(yj.`login`, '')) != ''
     )
     AND NOT EXISTS (
       SELECT 1 FROM `utilisateurs` u
       WHERE TRIM(UPPER(IFNULL(u.`pseudo`, ''))) = TRIM(UPPER(
         CASE
           WHEN yj.`vrai_nom` IS NOT NULL AND yj.`vrai_nom` != '' THEN yj.`vrai_nom`
           ELSE yj.`login`
         END
       ))
         AND TRIM(UPPER(
           CASE
             WHEN yj.`vrai_nom` IS NOT NULL AND yj.`vrai_nom` != '' THEN yj.`vrai_nom`
             ELSE IFNULL(yj.`login`, '')
           END
         )) != ''
     )
  ) AS commerciaux_a_inserer;

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
  `date`,
  `fonction`,
  `chef_equipe`,
  `centre`,
  `photo`,
  `genre`
)
SELECT
  yj.`id`,
  yj.`nom`,
  yj.`prenom`,
  CASE
    WHEN yj.`vrai_nom` IS NOT NULL AND yj.`vrai_nom` != '' THEN yj.`vrai_nom`
    ELSE yj.`login`
  END AS `pseudo`,
  yj.`tel`,
  yj.`mail`,
  yj.`login`,
  yj.`mdp`,
  yj.`etat`,
  yj.`color`,
  NULL AS `date`,
  5 AS `fonction`,
  yj.`chef_equipe`,
  yj.`centre`,
  NULL AS `photo`,
  NULL AS `genre`
FROM `yj_utilisateur` yj
WHERE yj.`fonction` = 5
  AND yj.`id` IS NOT NULL
  -- Déjà présent par id
  AND NOT EXISTS (
    SELECT 1 FROM `utilisateurs` u WHERE u.`id` = yj.`id`
  )
  -- Déjà présent par login
  AND NOT EXISTS (
    SELECT 1 FROM `utilisateurs` u
    WHERE TRIM(UPPER(IFNULL(u.`login`, ''))) = TRIM(UPPER(IFNULL(yj.`login`, '')))
      AND TRIM(IFNULL(yj.`login`, '')) != ''
  )
  -- Déjà présent par pseudo (vrai_nom ou login)
  AND NOT EXISTS (
    SELECT 1 FROM `utilisateurs` u
    WHERE TRIM(UPPER(IFNULL(u.`pseudo`, ''))) = TRIM(UPPER(
      CASE
        WHEN yj.`vrai_nom` IS NOT NULL AND yj.`vrai_nom` != '' THEN yj.`vrai_nom`
        ELSE yj.`login`
      END
    ))
      AND TRIM(UPPER(
        CASE
          WHEN yj.`vrai_nom` IS NOT NULL AND yj.`vrai_nom` != '' THEN yj.`vrai_nom`
          ELSE IFNULL(yj.`login`, '')
        END
      )) != ''
  );

SELECT ROW_COUNT() AS 'Commerciaux insérés (fonction 5)';

SELECT COUNT(*) AS 'Total commerciaux dans utilisateurs'
FROM `utilisateurs`
WHERE `fonction` = 5;

SET SQL_SAFE_UPDATES = 1;
