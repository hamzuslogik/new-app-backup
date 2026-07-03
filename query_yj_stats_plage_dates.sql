-- =====================================================
-- Stats YJ par plage de dates — 4 requêtes séparées
-- =====================================================
--
-- Modifier dans chaque requête :
--   DATE(hf.`date_heure_mod`) >= '2026-06-01'
--   DATE(hf.`date_heure_mod`) <= '2026-06-30'
--
-- Exécuter une requête à la fois dans phpMyAdmin.
-- Tables : yj_histo_fiche + yj_fiche
-- =====================================================


-- =====================================================
-- 1) Confirmateurs par jour — source : yj_histo_fiche uniquement
--    hf.nom_confirmateur → yj_utilisateur.nom (fonction = 6)
-- =====================================================

SELECT
  DATE(hf.`date_heure_mod`) AS jour,
  COUNT(DISTINCT u.`nom`) AS nb_confirmateurs,
  GROUP_CONCAT(DISTINCT u.`nom` ORDER BY u.`nom` SEPARATOR ', ') AS confirmateurs
FROM `yj_histo_fiche` hf
INNER JOIN `yj_utilisateur` u
  ON TRIM(UPPER(u.`nom`)) = TRIM(UPPER(hf.`nom_confirmateur`))
 AND u.`fonction` = 6
WHERE hf.`id_fiche` IS NOT NULL
  AND hf.`date_heure_mod` IS NOT NULL
  AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  AND TRIM(COALESCE(hf.`etat`, '')) != ''
  AND TRIM(COALESCE(hf.`nom_confirmateur`, '')) != ''
  AND DATE(hf.`date_heure_mod`) >= '2026-06-01'
  AND DATE(hf.`date_heure_mod`) <= '2026-06-30'
  AND hf.nom_confirmateur!='BUREAU'
GROUP BY DATE(hf.`date_heure_mod`)
ORDER BY jour ASC;


-- =====================================================
-- 2) Nombre de fiches distinctes traitées par jour
-- =====================================================

SELECT
  DATE(hf.`date_heure_mod`) AS jour,
  COUNT(DISTINCT hf.`id_fiche`) AS nb_fiches_traitees
FROM `yj_histo_fiche` hf
INNER JOIN `yj_fiche` y ON y.`id` = hf.`id_fiche`
WHERE hf.`id_fiche` IS NOT NULL
  AND hf.`date_heure_mod` IS NOT NULL
  AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  AND TRIM(COALESCE(hf.`etat`, '')) != ''
  AND (y.`archive` IS NULL OR y.`archive` = 0)
  AND DATE(hf.`date_heure_mod`) >= '2026-06-01'
  AND DATE(hf.`date_heure_mod`) <= '2026-06-30'
GROUP BY DATE(hf.`date_heure_mod`)
ORDER BY jour ASC;


-- =====================================================
-- 3) Nombre de RDV confirmés par jour
--    (dernier état du jour = CONFIRMER, 1 fiche = 1 comptage)
-- =====================================================

SELECT
  last_h.`jour`,
  COUNT(*) AS nb_rdv_confirmer
FROM (
  SELECT
    hf.`id_fiche`,
    DATE(hf.`date_heure_mod`) AS jour,
    MAX(hf.`date_heure_mod`) AS derniere_date
  FROM `yj_histo_fiche` hf
  INNER JOIN `yj_fiche` y ON y.`id` = hf.`id_fiche`
  WHERE hf.`id_fiche` IS NOT NULL
    AND hf.`date_heure_mod` IS NOT NULL
    AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
    AND TRIM(COALESCE(hf.`etat`, '')) != ''
    AND (y.`archive` IS NULL OR y.`archive` = 0)
    AND DATE(hf.`date_heure_mod`) >= '2026-06-01'
    AND DATE(hf.`date_heure_mod`) <= '2026-06-30'
  GROUP BY hf.`id_fiche`, DATE(hf.`date_heure_mod`)
) last_h
INNER JOIN `yj_histo_fiche` hf_last
  ON hf_last.`id_fiche` = last_h.`id_fiche`
 AND hf_last.`date_heure_mod` = last_h.`derniere_date`
 AND TRIM(hf_last.`etat`) = 'CONFIRMER'
GROUP BY last_h.`jour`
ORDER BY last_h.`jour` ASC;


-- =====================================================
-- 4) Nombre de fiches distinctes passées en NRP par jour
-- =====================================================

SELECT
  DATE(hf.`date_heure_mod`) AS jour,
  COUNT(DISTINCT hf.`id_fiche`) AS nb_nrp
FROM `yj_histo_fiche` hf
INNER JOIN `yj_fiche` y ON y.`id` = hf.`id_fiche`
WHERE hf.`id_fiche` IS NOT NULL
  AND hf.`date_heure_mod` IS NOT NULL
  AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  AND TRIM(hf.`etat`) = 'NRP'
  AND (y.`archive` IS NULL OR y.`archive` = 0)
  AND DATE(hf.`date_heure_mod`) >= '2026-06-01'
  AND DATE(hf.`date_heure_mod`) <= '2026-06-30'
GROUP BY DATE(hf.`date_heure_mod`)
ORDER BY jour ASC;
