-- =====================================================
-- Migration : yj_compte_rendu -> compte_rendu_pending
-- =====================================================
-- Prérequis :
--   1. Table yj_compte_rendu importée (CREATE + INSERT depuis dump)
--   2. Table compte_rendu_pending créée (create_compte_rendu_table.sql)
--   3. Tables fiches, utilisateurs, etats, sous_etat peuplées
--
-- Mapping :
--   yj.fiche_id -> id_fiche (doit exister dans fiches)
--   yj.commercial (varchar) -> id_commercial via utilisateurs.pseudo/login
--   yj.etat_fiche (varchar) -> id_etat_final via etats.titre
--   yj.sous_etat (varchar) -> id_sous_etat via sous_etat.titre
--   yj.compte_rendu (text) -> commentaire
--   yj.ph3_* -> champs ph3_* correspondants
--   yj.date_visite -> date_creation
--   yj.date_modif -> date_modif
--   statut = 'approved' (CR historiques considérés validés)
--
-- POURQUOI compte_rendu_pending peut avoir moins de lignes que yj_compte_rendu (sans étape créations) :
--   1. Fiche inexistante : yj.fiche_id pas dans fiches ou fiche_id <= 0 (exclus par INNER JOIN + WHERE)
--   2. Commercial introuvable : résolu en créant les commerciaux manquants en état inactif (etat=0, fonction=5)
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- Désactiver temporairement les FK pour éviter les erreurs sur lignes orphelines
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- ÉTAPE 1 : Créer les commerciaux manquants (état inactif)
-- =====================================================
-- Pour chaque nom distinct dans yj_compte_rendu.commercial qui n'existe pas dans utilisateurs
-- (aucune ligne avec pseudo ou login égal à ce nom), on crée un utilisateur avec etat=0, fonction=5.
INSERT INTO `utilisateurs` (`nom`, `prenom`, `pseudo`, `login`, `etat`, `fonction`)
SELECT
  base.display_name,
  '' AS prenom,
  base.display_name,
  base.display_name,
  0 AS etat,
  5 AS fonction
FROM (
  SELECT MIN(TRIM(yj.`commercial`)) AS display_name
  FROM `yj_compte_rendu` yj
  WHERE TRIM(IFNULL(yj.`commercial`, '')) != ''
  GROUP BY UPPER(TRIM(yj.`commercial`))
) base
WHERE NOT EXISTS (
  SELECT 1 FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(base.display_name))
     OR TRIM(UPPER(u.`login`)) = TRIM(UPPER(base.display_name))
);

SELECT CONCAT('Commerciaux créés (état inactif) : ', ROW_COUNT(), ' ligne(s)') AS etape1;

-- =====================================================
-- ÉTAPE 2 : Migration compte_rendu_pending (fiche existe + commercial trouvé ou créé)
-- =====================================================
-- On cherche id_commercial par pseudo/login sans filtrer sur etat, pour inclure les commerciaux inactifs créés ci-dessus.
INSERT INTO `compte_rendu_pending` (
  `id_fiche`,
  `id_commercial`,
  `statut`,
  `id_etat_final`,
  `id_sous_etat`,
  `commentaire`,
  `ph3_installateur`,
  `ph3_pac`,
  `ph3_puissance`,
  `ph3_rr_model`,
  `ph3_ballon`,
  `ph3_alimentation`,
  `ph3_type`,
  `ph3_prix`,
  `ph3_mensualite`,
  `ph3_attente`,
  `nbr_annee_finance`,
  `date_creation`,
  `date_modif`
)
SELECT
  base.id_fiche,
  base.id_commercial,
  'approved' AS statut,
  base.id_etat_final,
  base.id_sous_etat,
  base.commentaire,
  base.ph3_installateur,
  base.ph3_pac,
  base.ph3_puissance,
  base.ph3_rr_model,
  base.ph3_ballon,
  base.ph3_alimentation,
  base.ph3_type,
  base.ph3_prix,
  base.ph3_mensualite,
  base.ph3_attente,
  base.nbr_annee_finance,
  base.date_creation,
  base.date_modif
FROM (
  SELECT
    yj.`fiche_id` AS id_fiche,
    IFNULL(
      (SELECT MIN(u.`id`) FROM `utilisateurs` u
       WHERE (TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(yj.`commercial`)) OR TRIM(UPPER(u.`login`)) = TRIM(UPPER(yj.`commercial`)))),
      (SELECT MIN(u.`id`) FROM `utilisateurs` u
       WHERE TRIM(UPPER(u.`pseudo`)) LIKE CONCAT('%', TRIM(UPPER(yj.`commercial`)), '%')
       AND u.`fonction` = 5)
    ) AS id_commercial,
    (SELECT MIN(e.`id`) FROM `etats` e
     WHERE TRIM(UPPER(e.`titre`)) = TRIM(UPPER(yj.`etat_fiche`))) AS id_etat_final,
    (SELECT MIN(s.`id`) FROM `sous_etat` s
     WHERE TRIM(UPPER(s.`titre`)) = TRIM(UPPER(yj.`sous_etat`))) AS id_sous_etat,
    NULLIF(TRIM(yj.`compte_rendu`), '') AS commentaire,
    CASE WHEN yj.`ph3_installateur` REGEXP '^[0-9]+$' THEN CAST(yj.`ph3_installateur` AS UNSIGNED) ELSE NULL END AS ph3_installateur,
    NULLIF(TRIM(yj.`ph3_pac`), '') AS ph3_pac,
    NULLIF(TRIM(yj.`ph3_puissance`), '') AS ph3_puissance,
    NULLIF(TRIM(yj.`ph3_rr_model`), '') AS ph3_rr_model,
    CASE WHEN yj.`ph3_ballon` IN (1, '1') THEN '1' WHEN yj.`ph3_ballon` IN (0, '0') THEN '0' WHEN TRIM(IFNULL(yj.`ph3_ballon`, '')) != '' THEN CAST(yj.`ph3_ballon` AS CHAR) ELSE NULL END AS ph3_ballon,
    NULLIF(TRIM(yj.`ph3_alimentation`), '') AS ph3_alimentation,
    NULLIF(TRIM(yj.`ph3_type`), '') AS ph3_type,
    CASE WHEN yj.`ph3_prix` REGEXP '^[0-9]+(\\.[0-9]+)?$' THEN CAST(yj.`ph3_prix` AS DECIMAL(10,2)) ELSE NULL END AS ph3_prix,
    CASE WHEN yj.`ph3_mensualite` REGEXP '^[0-9]+(\\.[0-9]+)?$' THEN CAST(yj.`ph3_mensualite` AS DECIMAL(10,2))
         WHEN yj.`valeur_mensualite` REGEXP '^[0-9]+(\\.[0-9]+)?$' THEN CAST(yj.`valeur_mensualite` AS DECIMAL(10,2))
         ELSE NULL END AS ph3_mensualite,
    NULLIF(TRIM(yj.`ph3_attente`), '') AS ph3_attente,
    CASE WHEN yj.`nbr_annee_finance` REGEXP '^[0-9]+$' THEN CAST(yj.`nbr_annee_finance` AS UNSIGNED) ELSE NULL END AS nbr_annee_finance,
    COALESCE(yj.`date_visite`, yj.`date_modif`) AS date_creation,
    yj.`date_modif` AS date_modif
  FROM `yj_compte_rendu` yj
  INNER JOIN `fiches` f ON f.`id` = yj.`fiche_id`
  WHERE yj.`fiche_id` > 0
) base
WHERE base.id_commercial IS NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- DIAGNOSTIC : pourquoi total compte_rendu_pending ≠ total yj_compte_rendu
-- =====================================================

SELECT '--- Effectifs ---' AS info;
SELECT
  (SELECT COUNT(*) FROM yj_compte_rendu) AS total_yj_compte_rendu,
  (SELECT COUNT(*) FROM compte_rendu_pending) AS total_compte_rendu_pending_apres_insert,
  (SELECT COUNT(*) FROM yj_compte_rendu) - (SELECT COUNT(*) FROM compte_rendu_pending) AS ecart_lignes_non_migrees;

SELECT '--- Cause 1 : fiches inexistantes (yj.fiche_id pas dans fiches ou <= 0) ---' AS info;
SELECT COUNT(*) AS nb_exclus_fiche_inexistante
FROM yj_compte_rendu yj
LEFT JOIN fiches f ON f.id = yj.fiche_id
WHERE f.id IS NULL OR yj.fiche_id <= 0;

SELECT '--- Échantillon fiches inexistantes (fiche_id, commercial, etat_fiche) ---' AS info;
SELECT yj.fiche_id, yj.commercial, yj.etat_fiche
FROM yj_compte_rendu yj
LEFT JOIN fiches f ON f.id = yj.fiche_id
WHERE (f.id IS NULL OR yj.fiche_id <= 0)
LIMIT 20;

SELECT '--- Cause 2 : commercial introuvable (après création des manquants, devrait être 0) ---' AS info;
SELECT COUNT(*) AS nb_exclus_commercial_introuvable
FROM yj_compte_rendu yj
INNER JOIN fiches f ON f.id = yj.fiche_id
WHERE yj.fiche_id > 0
  AND NOT EXISTS (
    SELECT 1 FROM utilisateurs u
    WHERE (TRIM(UPPER(u.pseudo)) = TRIM(UPPER(yj.commercial))
       OR TRIM(UPPER(u.login)) = TRIM(UPPER(yj.commercial)))
  )
  AND NOT EXISTS (
    SELECT 1 FROM utilisateurs u
    WHERE TRIM(UPPER(u.pseudo)) LIKE CONCAT('%', TRIM(UPPER(yj.commercial)), '%')
    AND u.fonction = 5
  );

SELECT '--- Échantillon commerciaux introuvables (fiche_id, commercial, etat_fiche) ---' AS info;
SELECT yj.fiche_id, yj.commercial, yj.etat_fiche
FROM yj_compte_rendu yj
INNER JOIN fiches f ON f.id = yj.fiche_id
WHERE yj.fiche_id > 0
  AND NOT EXISTS (
    SELECT 1 FROM utilisateurs u
    WHERE (TRIM(UPPER(u.pseudo)) = TRIM(UPPER(yj.commercial))
       OR TRIM(UPPER(u.login)) = TRIM(UPPER(yj.commercial)))
  )
  AND NOT EXISTS (
    SELECT 1 FROM utilisateurs u
    WHERE TRIM(UPPER(u.pseudo)) LIKE CONCAT('%', TRIM(UPPER(yj.commercial)), '%')
    AND u.fonction = 5
  )
LIMIT 20;

SELECT '--- Résumé : total exclu = fiches inexistantes (+ commerciaux introuvables si aucun créé) ---' AS info;
SELECT
  (SELECT COUNT(*) FROM yj_compte_rendu yj LEFT JOIN fiches f ON f.id = yj.fiche_id WHERE f.id IS NULL OR yj.fiche_id <= 0)
  + (SELECT COUNT(*) FROM yj_compte_rendu yj INNER JOIN fiches f ON f.id = yj.fiche_id WHERE yj.fiche_id > 0
     AND NOT EXISTS (SELECT 1 FROM utilisateurs u WHERE (TRIM(UPPER(u.pseudo)) = TRIM(UPPER(yj.commercial)) OR TRIM(UPPER(u.login)) = TRIM(UPPER(yj.commercial))))
     AND NOT EXISTS (SELECT 1 FROM utilisateurs u WHERE TRIM(UPPER(u.pseudo)) LIKE CONCAT('%', TRIM(UPPER(yj.commercial)), '%') AND u.fonction = 5)
  ) AS total_exclu_attendu;

SELECT 'Migration terminée : commerciaux manquants créés (état inactif), tous les CR migrés sauf fiches inexistantes.' AS message;
