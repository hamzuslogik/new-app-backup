-- =====================================================
-- Requêtes yj_fiche + yj_histo_fiche (ancien extranet)
-- =====================================================
--
-- yj_histo_fiche.id_fiche → yj_fiche.id
-- Colonne état : hf.etat (majuscules : 'NRP', 'CONFIRMER', etc.)
-- Date historique : hf.date_heure_mod
--
-- Période (requêtes 1, 1b, 1c) : modifier les dates dans le HAVING
--   DATE(MIN(...)) >= 'YYYY-MM-DD' AND DATE(MIN(...)) <= 'YYYY-MM-DD'
-- Autres requêtes : CURDATE() — remplacer par 'YYYY-MM-DD' si besoin
-- =====================================================


-- =====================================================
-- 1) 1ère confirmation sur la période + plus de 3 NRP dans l'historique
--    (jamais confirmées avant le début de la période)
-- =====================================================

SELECT
  y.`id`,
  y.`nom`,
  y.`prenom`,
  y.`tel`,
  y.`cp`,
  y.`ville`,
  y.`etat_final`,
  y.`date_heure_playning` AS date_rdv,
  y.`date_insertion`,
  y.`nom_agent`,
  y.`nom_confirmateur`,
  conf.`premiere_confirmation`,
  nrp.`nb_nrp`
FROM `yj_fiche` y
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    MIN(hf.`date_heure_mod`) AS premiere_confirmation
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) = 'CONFIRMER'
    AND hf.`date_heure_mod` IS NOT NULL
    AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  GROUP BY hf.`id_fiche`
  HAVING DATE(MIN(hf.`date_heure_mod`)) >= '2026-06-01'
     AND DATE(MIN(hf.`date_heure_mod`)) <= '2026-06-30'
) conf ON conf.`id_fiche` = y.`id`
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    COUNT(*) AS nb_nrp
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) = 'NRP'
  GROUP BY hf.`id_fiche`
  HAVING COUNT(*) > 3
) nrp ON nrp.`id_fiche` = y.`id`
WHERE TRIM(y.`etat_final`) = 'CONFIRMER'
  AND (y.`archive` IS NULL OR y.`archive` = 0)
ORDER BY nrp.`nb_nrp` DESC, conf.`premiere_confirmation` DESC;


-- =====================================================
-- 1b) 1ère occurrence de chaque état sur la période + plus de 3 NRP
--     (tous statuts : CONFIRMER, NRP, RAPPEL POUR BUREAU, etc.)
--     Une fiche peut apparaître plusieurs fois si plusieurs états
--     ont été atteints pour la 1ère fois dans la période.
-- =====================================================

SELECT
  y.id,
  y.nom,
  y.prenom,
  y.tel,
  y.cp,
  y.ville,
  y.etat_final,
  stat.etat_atteint,
  y.date_heure_playning AS date_rdv,
  y.date_insertion,
  y.nom_agent,
  y.nom_confirmateur,
  stat.premiere_occurrence,
  nrp.nb_nrp
FROM yj_fiche y
INNER JOIN (
  SELECT
    t.id_fiche,
    t.etat_atteint,
    t.premiere_occurrence
  FROM (
    SELECT
      hf.id_fiche AS id_fiche,
      TRIM(hf.etat) AS etat_atteint,
      MIN(hf.date_heure_mod) AS premiere_occurrence
    FROM yj_histo_fiche hf
    WHERE hf.id_fiche IS NOT NULL
      AND TRIM(COALESCE(hf.etat, '')) != ''
      AND hf.date_heure_mod IS NOT NULL
      AND hf.date_heure_mod != '0000-00-00 00:00:00'
    GROUP BY hf.id_fiche, TRIM(hf.etat)
  ) t
  WHERE DATE(t.premiere_occurrence) >= '2026-06-01'
    AND DATE(t.premiere_occurrence) <= '2026-06-30'
) stat ON stat.id_fiche = y.id
INNER JOIN (
  SELECT
    hf.id_fiche AS id_fiche,
    COUNT(*) AS nb_nrp
  FROM yj_histo_fiche hf
  WHERE hf.id_fiche IS NOT NULL
    AND TRIM(hf.etat) = 'NRP'
  GROUP BY hf.id_fiche
  HAVING COUNT(*) > 3
) nrp ON nrp.id_fiche = y.id
WHERE (y.archive IS NULL OR y.archive = 0)
ORDER BY stat.etat_atteint, nrp.nb_nrp DESC, stat.premiere_occurrence DESC;


-- =====================================================
-- 1c) Variante : 1ère fois que l'état ACTUEL a été atteint sur la période
--     (1 ligne par fiche, etat_atteint = etat_final)
-- =====================================================

SELECT
  y.id,
  y.nom,
  y.prenom,
  y.tel,
  y.cp,
  y.ville,
  y.etat_final,
  y.date_heure_playning AS date_rdv,
  y.date_insertion,
  y.nom_agent,
  y.nom_confirmateur,
  stat.premiere_occurrence,
  nrp.nb_nrp
FROM yj_fiche y
INNER JOIN (
  SELECT
    t.id_fiche,
    t.etat_atteint,
    t.premiere_occurrence
  FROM (
    SELECT
      hf.id_fiche AS id_fiche,
      TRIM(hf.etat) AS etat_atteint,
      MIN(hf.date_heure_mod) AS premiere_occurrence
    FROM yj_histo_fiche hf
    WHERE hf.id_fiche IS NOT NULL
      AND TRIM(COALESCE(hf.etat, '')) != ''
      AND hf.date_heure_mod IS NOT NULL
      AND hf.date_heure_mod != '0000-00-00 00:00:00'
    GROUP BY hf.id_fiche, TRIM(hf.etat)
  ) t
  WHERE DATE(t.premiere_occurrence) >= '2026-06-01'
    AND DATE(t.premiere_occurrence) <= '2026-06-30'
) stat ON stat.id_fiche = y.id
      AND stat.etat_atteint = TRIM(y.etat_final)
INNER JOIN (
  SELECT
    hf.id_fiche AS id_fiche,
    COUNT(*) AS nb_nrp
  FROM yj_histo_fiche hf
  WHERE hf.id_fiche IS NOT NULL
    AND TRIM(hf.etat) = 'NRP'
  GROUP BY hf.id_fiche
  HAVING COUNT(*) > 3
) nrp ON nrp.id_fiche = y.id
WHERE (y.archive IS NULL OR y.archive = 0)
ORDER BY stat.etat_atteint, nrp.nb_nrp DESC, stat.premiere_occurrence DESC;


-- =====================================================
-- 2) RAPPEL POUR BUREAU devenus CONFIRMER aujourd'hui
--    (+ plus de 3 passages RAPPEL POUR BUREAU dans l'historique)
-- =====================================================
-- Libellé état : 'RAPPEL POUR BUREAU' ou 'RAPPEL_POUR_BUREAU' selon base

SELECT
  y.`id`,
  y.`nom`,
  y.`prenom`,
  y.`tel`,
  y.`cp`,
  y.`ville`,
  y.`etat_final`,
  y.`date_heure_playning` AS date_rdv,
  y.`date_insertion`,
  y.`nom_agent`,
  y.`nom_confirmateur`,
  conf.`premiere_confirmation`,
  rb.`nb_rappel_bureau`
FROM `yj_fiche` y
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    MIN(hf.`date_heure_mod`) AS premiere_confirmation
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) = 'CONFIRMER'
    AND hf.`date_heure_mod` IS NOT NULL
    AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
    AND DATE(hf.`date_heure_mod`) = CURDATE()
  GROUP BY hf.`id_fiche`
) conf ON conf.`id_fiche` = y.`id`
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    COUNT(*) AS nb_rappel_bureau
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
  GROUP BY hf.`id_fiche`
  HAVING COUNT(*) > 3
) rb ON rb.`id_fiche` = y.`id`
WHERE TRIM(y.`etat_final`) = 'CONFIRMER'
  AND (y.`archive` IS NULL OR y.`archive` = 0)
ORDER BY rb.`nb_rappel_bureau` DESC, conf.`premiere_confirmation` DESC;


-- =====================================================
-- 2b) Variante : au moins 1 RAPPEL POUR BUREAU avant CONFIRMER du jour
--     (sans seuil > 3)
-- =====================================================

SELECT
  y.`id`,
  y.`nom`,
  y.`prenom`,
  y.`tel`,
  y.`cp`,
  y.`ville`,
  y.`etat_final`,
  y.`date_heure_playning` AS date_rdv,
  y.`date_insertion`,
  y.`nom_agent`,
  y.`nom_confirmateur`,
  conf.`premiere_confirmation`,
  rb.`nb_rappel_bureau`
FROM `yj_fiche` y
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    MIN(hf.`date_heure_mod`) AS premiere_confirmation
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) = 'CONFIRMER'
    AND hf.`date_heure_mod` IS NOT NULL
    AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
    AND DATE(hf.`date_heure_mod`) = CURDATE()
  GROUP BY hf.`id_fiche`
) conf ON conf.`id_fiche` = y.`id`
INNER JOIN (
  SELECT
    hf.`id_fiche` AS id_fiche,
    COUNT(*) AS nb_rappel_bureau
  FROM `yj_histo_fiche` hf
  WHERE hf.`id_fiche` IS NOT NULL
    AND TRIM(hf.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
    AND hf.`date_heure_mod` IS NOT NULL
    AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  GROUP BY hf.`id_fiche`
  HAVING COUNT(*) >= 1
) rb ON rb.`id_fiche` = y.`id`
WHERE TRIM(y.`etat_final`) = 'CONFIRMER'
  AND (y.`archive` IS NULL OR y.`archive` = 0)
  AND EXISTS (
    SELECT 1
    FROM `yj_histo_fiche` h_rb
    WHERE h_rb.`id_fiche` = y.`id`
      AND TRIM(h_rb.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
      AND h_rb.`date_heure_mod` IS NOT NULL
      AND h_rb.`date_heure_mod` != '0000-00-00 00:00:00'
      AND h_rb.`date_heure_mod` < conf.`premiere_confirmation`
  )
ORDER BY rb.`nb_rappel_bureau` DESC, conf.`premiere_confirmation` DESC;


-- =====================================================
-- 3) Fiches passées par NRP puis changées vers un autre état
--    (≠ RAPPEL POUR BUREAU / RAPPEL_POUR_BUREAU)
-- =====================================================

SELECT DISTINCT
  y.`id`,
  y.`nom`,
  y.`prenom`,
  y.`tel`,
  y.`cp`,
  y.`ville`,
  y.`etat_final` AS etat_actuel,
  y.`date_heure_playning` AS date_rdv,
  y.`date_insertion`,
  y.`nom_agent`,
  y.`nom_confirmateur`
FROM `yj_fiche` y
WHERE (y.`archive` IS NULL OR y.`archive` = 0)
  AND EXISTS (
    SELECT 1
    FROM `yj_histo_fiche` h_nrp
    WHERE h_nrp.`id_fiche` = y.`id`
      AND TRIM(h_nrp.`etat`) = 'NRP'
      AND h_nrp.`date_heure_mod` IS NOT NULL
      AND h_nrp.`date_heure_mod` != '0000-00-00 00:00:00'
  )
  AND EXISTS (
    SELECT 1
    FROM `yj_histo_fiche` h_nrp
    INNER JOIN `yj_histo_fiche` h_suiv
      ON h_suiv.`id_fiche` = h_nrp.`id_fiche`
     AND h_suiv.`date_heure_mod` > h_nrp.`date_heure_mod`
     AND h_suiv.`date_heure_mod` IS NOT NULL
     AND h_suiv.`date_heure_mod` != '0000-00-00 00:00:00'
    WHERE h_nrp.`id_fiche` = y.`id`
      AND TRIM(h_nrp.`etat`) = 'NRP'
      AND TRIM(h_suiv.`etat`) NOT IN ('NRP', 'RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
  )
ORDER BY y.`id` DESC;


-- =====================================================
-- 3b) Même critère + 1er changement après NRP (état + date)
-- =====================================================

SELECT
  base.`id`,
  base.`nom`,
  base.`prenom`,
  base.`tel`,
  base.`cp`,
  base.`ville`,
  base.`etat_actuel`,
  base.`nom_agent`,
  base.`nom_confirmateur`,
  TRIM(h1.`etat`) AS premier_etat_apres_nrp,
  h1.`date_heure_mod` AS date_premier_changement
FROM (
  SELECT DISTINCT
    y.`id`,
    y.`nom`,
    y.`prenom`,
    y.`tel`,
    y.`cp`,
    y.`ville`,
    y.`etat_final` AS etat_actuel,
    y.`nom_agent`,
    y.`nom_confirmateur`
  FROM `yj_fiche` y
  WHERE (y.`archive` IS NULL OR y.`archive` = 0)
    AND EXISTS (
      SELECT 1 FROM `yj_histo_fiche` h_nrp
      WHERE h_nrp.`id_fiche` = y.`id` AND TRIM(h_nrp.`etat`) = 'NRP'
    )
    AND EXISTS (
      SELECT 1
      FROM `yj_histo_fiche` h_nrp
      INNER JOIN `yj_histo_fiche` h_suiv
        ON h_suiv.`id_fiche` = h_nrp.`id_fiche`
       AND h_suiv.`date_heure_mod` > h_nrp.`date_heure_mod`
      WHERE h_nrp.`id_fiche` = y.`id`
        AND TRIM(h_nrp.`etat`) = 'NRP'
        AND TRIM(h_suiv.`etat`) NOT IN ('NRP', 'RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
    )
) base
INNER JOIN `yj_histo_fiche` h1
  ON h1.`id_fiche` = base.`id`
 AND TRIM(h1.`etat`) NOT IN ('NRP', 'RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
 AND h1.`date_heure_mod` IS NOT NULL
 AND h1.`date_heure_mod` != '0000-00-00 00:00:00'
 AND h1.`date_heure_mod` = (
   SELECT MIN(h2.`date_heure_mod`)
   FROM `yj_histo_fiche` h2
   WHERE h2.`id_fiche` = base.`id`
     AND h2.`date_heure_mod` IS NOT NULL
     AND h2.`date_heure_mod` != '0000-00-00 00:00:00'
     AND TRIM(h2.`etat`) NOT IN ('NRP', 'RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
     AND h2.`date_heure_mod` > (
       SELECT MIN(h3.`date_heure_mod`)
       FROM `yj_histo_fiche` h3
       WHERE h3.`id_fiche` = base.`id`
         AND TRIM(h3.`etat`) = 'NRP'
         AND h3.`date_heure_mod` IS NOT NULL
         AND h3.`date_heure_mod` != '0000-00-00 00:00:00'
     )
 )
ORDER BY h1.`date_heure_mod` DESC;


-- =====================================================
-- 4) Fiches passées par RAPPEL POUR BUREAU puis changées
--    vers un autre état (≠ NRP)
-- =====================================================

SELECT DISTINCT
  y.`id`,
  y.`nom`,
  y.`prenom`,
  y.`tel`,
  y.`cp`,
  y.`ville`,
  y.`etat_final` AS etat_actuel,
  y.`date_heure_playning` AS date_rdv,
  y.`date_insertion`,
  y.`nom_agent`,
  y.`nom_confirmateur`
FROM `yj_fiche` y
WHERE (y.`archive` IS NULL OR y.`archive` = 0)
  AND EXISTS (
    SELECT 1
    FROM `yj_histo_fiche` h_rb
    WHERE h_rb.`id_fiche` = y.`id`
      AND TRIM(h_rb.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
      AND h_rb.`date_heure_mod` IS NOT NULL
      AND h_rb.`date_heure_mod` != '0000-00-00 00:00:00'
  )
  AND EXISTS (
    SELECT 1
    FROM `yj_histo_fiche` h_rb
    INNER JOIN `yj_histo_fiche` h_suiv
      ON h_suiv.`id_fiche` = h_rb.`id_fiche`
     AND h_suiv.`date_heure_mod` > h_rb.`date_heure_mod`
     AND h_suiv.`date_heure_mod` IS NOT NULL
     AND h_suiv.`date_heure_mod` != '0000-00-00 00:00:00'
    WHERE h_rb.`id_fiche` = y.`id`
      AND TRIM(h_rb.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
      AND TRIM(h_suiv.`etat`) != 'NRP'
  )
ORDER BY y.`id` DESC;


-- =====================================================
-- 4b) Même critère + 1er changement après RAPPEL BUREAU (état + date)
-- =====================================================

SELECT
  base.`id`,
  base.`nom`,
  base.`prenom`,
  base.`tel`,
  base.`cp`,
  base.`ville`,
  base.`etat_actuel`,
  base.`nom_agent`,
  base.`nom_confirmateur`,
  TRIM(h1.`etat`) AS premier_etat_apres_rappel,
  h1.`date_heure_mod` AS date_premier_changement
FROM (
  SELECT DISTINCT
    y.`id`,
    y.`nom`,
    y.`prenom`,
    y.`tel`,
    y.`cp`,
    y.`ville`,
    y.`etat_final` AS etat_actuel,
    y.`nom_agent`,
    y.`nom_confirmateur`
  FROM `yj_fiche` y
  WHERE (y.`archive` IS NULL OR y.`archive` = 0)
    AND EXISTS (
      SELECT 1 FROM `yj_histo_fiche` h_rb
      WHERE h_rb.`id_fiche` = y.`id`
        AND TRIM(h_rb.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
    )
    AND EXISTS (
      SELECT 1
      FROM `yj_histo_fiche` h_rb
      INNER JOIN `yj_histo_fiche` h_suiv
        ON h_suiv.`id_fiche` = h_rb.`id_fiche`
       AND h_suiv.`date_heure_mod` > h_rb.`date_heure_mod`
      WHERE h_rb.`id_fiche` = y.`id`
        AND TRIM(h_rb.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
        AND TRIM(h_suiv.`etat`) != 'NRP'
    )
) base
INNER JOIN `yj_histo_fiche` h1
  ON h1.`id_fiche` = base.`id`
 AND TRIM(h1.`etat`) != 'NRP'
 AND h1.`date_heure_mod` IS NOT NULL
 AND h1.`date_heure_mod` != '0000-00-00 00:00:00'
 AND h1.`date_heure_mod` = (
   SELECT MIN(h2.`date_heure_mod`)
   FROM `yj_histo_fiche` h2
   WHERE h2.`id_fiche` = base.`id`
     AND h2.`date_heure_mod` IS NOT NULL
     AND h2.`date_heure_mod` != '0000-00-00 00:00:00'
     AND TRIM(h2.`etat`) != 'NRP'
     AND h2.`date_heure_mod` > (
       SELECT MIN(h3.`date_heure_mod`)
       FROM `yj_histo_fiche` h3
       WHERE h3.`id_fiche` = base.`id`
         AND TRIM(h3.`etat`) IN ('RAPPEL POUR BUREAU', 'RAPPEL_POUR_BUREAU')
         AND h3.`date_heure_mod` IS NOT NULL
         AND h3.`date_heure_mod` != '0000-00-00 00:00:00'
     )
 )
ORDER BY h1.`date_heure_mod` DESC;

